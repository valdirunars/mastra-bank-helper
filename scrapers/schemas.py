"""Structured output types for Icelandic bank pricing scrapers."""

from __future__ import annotations

from typing import Literal, TypedDict

DocumentType = Literal["rates", "pricing", "account_fees", "rate_history", "other"]
PricingUnit = Literal["percent", "isk", "range", "text"]


class PricingDocument(TypedDict):
    title: str
    url: str
    category: str
    document_type: DocumentType
    effective_date: str | None
    subtitle: str | None


class PricingItem(TypedDict):
    code: str
    description: str
    amount: str
    unit: PricingUnit
    document_title: str
    document_url: str
    category: str


class RateItem(TypedDict):
    section: str
    product: str
    rate: str
    document_title: str
    document_url: str
    category: str


class BankPricingCatalog(TypedDict):
    bank: str
    source_url: str
    documents: list[PricingDocument]
    pricing_items: list[PricingItem]
    rate_items: list[RateItem]
