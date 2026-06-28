"""Page-level extractors for list fields, embedded JSON, and derived values."""

from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import unquote

from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement

_BY_MAP = {
    "css": By.CSS_SELECTOR,
    "xpath": By.XPATH,
    "id": By.ID,
    "name": By.NAME,
    "class_name": By.CLASS_NAME,
    "tag_name": By.TAG_NAME,
}


def _get_nested(data: Any, path: str) -> Any:
    current = data
    for part in path.split("."):
        if part.endswith("[*]"):
            key = part[:-3]
            if key:
                current = current.get(key, []) if isinstance(current, dict) else []
            if not isinstance(current, list):
                return []
            values: list[Any] = []
            remainder = ".".join(path.split(".")[path.split(".").index(part) + 1 :])
            if not remainder:
                return current
            for item in current:
                values.extend(_flatten(_get_nested(item, remainder)))
            return values
        if part.isdigit():
            current = current[int(part)] if isinstance(current, list) else None
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _flatten(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _walk_for_typename(obj: Any, typename: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(obj, dict):
        if obj.get("__typename") == typename:
            found.append(obj)
        for value in obj.values():
            found.extend(_walk_for_typename(value, typename))
    elif isinstance(obj, list):
        for item in obj:
            found.extend(_walk_for_typename(item, typename))
    return found


def _extract_json_field(item: dict[str, Any], spec: dict[str, Any]) -> Any:
    path = spec.get("json_path", "")
    value = item
    for part in path.split("."):
        if part.isdigit():
            value = value[int(part)] if isinstance(value, list) else None
        elif isinstance(value, dict):
            value = value.get(part)
        else:
            value = None
            break

    transform = spec.get("transform")
    if transform == "extract_effective_date" and isinstance(value, str):
        match = re.search(r"(?:Gildir frá|Valid from)\s+(.+)$", value, re.I)
        return match.group(1).strip() if match else value
    if transform == "trim":
        return value.strip() if isinstance(value, str) else value
    return value


def _derive_value(source: str, rules: list[dict[str, str]]) -> str:
    decoded = unquote(source)
    for rule in rules:
        if rule["match"] in decoded or rule["match"] in source:
            return rule["value"]
    return rules[-1]["value"] if rules else "other"


def _extract_list_item(element: WebElement, fields: dict[str, dict[str, Any]]) -> dict[str, Any]:
    row: dict[str, Any] = {}
    for name, spec in fields.items():
        source = spec.get("source", "text")
        if source == "constant":
            row[name] = spec.get("value")
        elif source == "text":
            row[name] = (element.text or "").strip()
        elif source == "attribute":
            row[name] = element.get_attribute(spec.get("attribute", "href"))
        elif source == "derived":
            from_value = row.get(spec.get("from", ""), "")
            row[name] = _derive_value(str(from_value), spec.get("rules", []))
    return row


def extract_documents_from_list(driver: WebDriver, config: dict[str, Any]) -> list[dict[str, Any]]:
    by = _BY_MAP[config.get("by", "css")]
    elements = driver.find_elements(by, config["item_selector"])
    documents: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for element in elements:
        row = _extract_list_item(element, config["fields"])
        url = row.get("url")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        for name, spec in config["fields"].items():
            if spec.get("source") == "derived":
                from_value = row.get(spec.get("from", ""), "")
                row[name] = _derive_value(str(from_value), spec.get("rules", []))

        documents.append(row)
    return documents


def extract_documents_from_embedded_json(driver: WebDriver, config: dict[str, Any]) -> list[dict[str, Any]]:
    script = driver.find_element(By.CSS_SELECTOR, config["script_selector"])
    payload = json.loads(script.get_attribute("innerHTML"))

    if "typename" in config:
        items = _walk_for_typename(payload, config["typename"])
    elif "json_path" in config:
        items = _flatten(_get_nested(payload, config["json_path"]))
    else:
        items = []

    documents: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for item in items:
        if not isinstance(item, dict):
            continue
        row: dict[str, Any] = {}
        for name, spec in config["fields"].items():
            row[name] = _extract_json_field(item, spec)

        url = row.get("url")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)

        for name, spec in config["fields"].items():
            if spec.get("source") == "derived":
                from_value = row.get(spec.get("from", ""), "")
                row[name] = _derive_value(str(from_value), spec.get("rules", []))

        documents.append(row)
    return documents
