"""Parse pricing and rate tables from bank PDF documents."""

from __future__ import annotations

import re
from io import BytesIO
from typing import Any

import pdfplumber
import requests

from scrapers.schemas import PricingItem, PricingUnit, RateItem

NUMBERED_LINE = re.compile(
    r"^(?P<code>\d+(?:\.\d+)*\.?)\s+(?P<body>.+)$",
)
VALUE_PERCENT = re.compile(r"(?P<amount>[\d.,]+(?:\s*-\s*[\d.,]+)?)\s*%$")
VALUE_ISK = re.compile(r"(?P<amount>[\d.,]+(?:\s*-\s*[\d.,]+)?)\s*kr\.?$", re.I)
VALUE_RANGE = re.compile(r"(?P<amount>[\d.,]+\s*-\s*[\d.,]+(?:\s*kr\.?|%)?)$", re.I)
RATE_LINE = re.compile(
    r"^(?P<product>.+?)\s+(?P<rate>[\d]+[.,][\d]+%(?:\s+[\d]+[.,][\d]+%)*)\s*$",
)
SECTION_HEADER = re.compile(r"^\d+\.\s+.+")
SUBSECTION_HEADER = re.compile(r"^\d+\.\d+\s+[^0-9].+")


def _classify_unit(amount: str) -> PricingUnit:
    if amount.endswith("%") or "%" in amount:
        return "percent"
    if "kr" in amount.lower():
        return "isk"
    if re.match(r"^\d+,\d+$", amount):
        return "percent"
    if "-" in amount and any(ch.isdigit() for ch in amount):
        return "range"
    if re.match(r"^[\d.,]+$", amount):
        return "isk"
    return "text"


def _split_numbered_line(line: str) -> tuple[str, str, str] | None:
    match = NUMBERED_LINE.match(line)
    if not match:
        return None

    code = match.group("code")
    body = match.group("body").strip()

    for pattern in (VALUE_PERCENT, VALUE_ISK, VALUE_RANGE):
        value_match = pattern.search(body)
        if value_match:
            amount = value_match.group("amount").strip()
            description = body[: value_match.start()].strip(" ,")
            if description:
                return code, description, amount

    if re.search(r"[\d]", body):
        parts = body.rsplit(" ", 1)
        if len(parts) == 2 and re.search(r"[\d]", parts[1]):
            return code, parts[0].strip(), parts[1].strip()
    return code, body, ""


def _has_meaningful_amount(amount: str) -> bool:
    if "%" in amount or "kr" in amount.lower():
        return True
    return bool(re.match(r"^[\d.,]+(?:\s*-\s*[\d.,]+)?$", amount) and ("," in amount or "." in amount))


def parse_numbered_pricing(text: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or "Bls." in line:
            continue
        parsed = _split_numbered_line(line)
        if not parsed:
            continue
        code, description, amount = parsed
        if not description or not _has_meaningful_amount(amount):
            continue
        items.append({"code": code, "description": description, "amount": amount})
    return items


def parse_rate_lines(text: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    current_section = "General"

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if SECTION_HEADER.match(line) and not RATE_LINE.match(line):
            current_section = line
            continue
        if SUBSECTION_HEADER.match(line) and not RATE_LINE.match(line):
            current_section = line
            continue

        rate_match = RATE_LINE.match(line)
        if rate_match:
            items.append(
                {
                    "section": current_section,
                    "product": rate_match.group("product").strip(),
                    "rate": rate_match.group("rate").strip(),
                },
            )
            continue

        percent_match = re.search(r"([\d]+[.,][\d]+%)", line)
        if percent_match and len(line) < 120 and not line.startswith("*"):
            product = line.replace(percent_match.group(1), "").strip(" :")
            if product and not product.startswith("Gildir"):
                items.append(
                    {
                        "section": current_section,
                        "product": product,
                        "rate": percent_match.group(1),
                    },
                )
    return items


def download_pdf_text(url: str) -> str:
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    chunks: list[str] = []
    with pdfplumber.open(BytesIO(response.content)) as pdf:
        for page in pdf.pages:
            chunks.append(page.extract_text() or "")
    return "\n".join(chunks)


def parse_document_pdf(
    document: dict[str, Any],
    parser_config: dict[str, Any],
) -> tuple[list[PricingItem], list[RateItem]]:
    parser_type = parser_config["type"]
    url = document["url"]
    text = download_pdf_text(url)

    pricing_items: list[PricingItem] = []
    rate_items: list[RateItem] = []

    if parser_type == "numbered_pricing":
        for row in parse_numbered_pricing(text):
            amount = row["amount"]
            pricing_items.append(
                PricingItem(
                    code=row["code"],
                    description=row["description"],
                    amount=amount,
                    unit=_classify_unit(amount),
                    document_title=document["title"],
                    document_url=url,
                    category=document.get("category", ""),
                ),
            )
    elif parser_type == "rate_lines":
        for row in parse_rate_lines(text):
            rate_items.append(
                RateItem(
                    section=row["section"],
                    product=row["product"],
                    rate=row["rate"],
                    document_title=document["title"],
                    document_url=url,
                    category=document.get("category", ""),
                ),
            )

    return pricing_items, rate_items
