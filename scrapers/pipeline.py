"""Multi-step bank pricing scrape pipeline."""

from __future__ import annotations

from typing import Any

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from scrapers.extractors import extract_documents_from_embedded_json, extract_documents_from_list
from scrapers.pdf_parser import parse_document_pdf
from scrapers.schemas import BankPricingCatalog

_BY_MAP = {
    "css": By.CSS_SELECTOR,
    "xpath": By.XPATH,
    "id": By.ID,
    "name": By.NAME,
    "class_name": By.CLASS_NAME,
    "tag_name": By.TAG_NAME,
}


def _create_driver(headless: bool, page_load_timeout: int) -> webdriver.Chrome:
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.set_page_load_timeout(page_load_timeout)
    return driver


def _run_page_actions(driver: webdriver.Chrome, actions: list[dict[str, Any]]) -> None:
    for action in actions:
        if action["type"] == "click":
            by = _BY_MAP[action.get("by", "css")]
            element = driver.find_element(by, action["selector"])
            driver.execute_script("arguments[0].click();", element)
        elif action["type"] == "sleep":
            import time

            time.sleep(action.get("seconds", 1))


def scrape_bank_config(config: dict[str, Any], *, headless: bool = True) -> BankPricingCatalog:
    page_cfg = config["page"]
    url = config["url"]
    page_load_timeout = page_cfg.get("page_load_timeout", 60)
    driver = _create_driver(headless, page_load_timeout)

    try:
        driver.get(url)

        if "wait_for" in page_cfg:
            wait = WebDriverWait(driver, page_cfg.get("wait_timeout", 20))
            wait_for = page_cfg["wait_for"]
            by = _BY_MAP[wait_for.get("by", "css")]
            wait.until(EC.presence_of_element_located((by, wait_for["selector"])))

        if "actions" in page_cfg:
            _run_page_actions(driver, page_cfg["actions"])

        documents_cfg = page_cfg["documents"]
        extractor_type = documents_cfg["type"]
        if extractor_type == "list":
            documents = extract_documents_from_list(driver, documents_cfg)
        elif extractor_type == "embedded_json":
            documents = extract_documents_from_embedded_json(driver, documents_cfg)
        else:
            raise ValueError(f"Unsupported documents extractor: {extractor_type}")
    finally:
        driver.quit()

    pricing_items = []
    rate_items = []
    pdf_cfg = config.get("pdf", {})
    if pdf_cfg.get("enabled", True):
        parser_map = pdf_cfg.get("parsers", {})
        type_map = pdf_cfg.get("document_type_map", {})
        include_types = set(pdf_cfg.get("download_document_types", ["pricing", "rates"]))

        for document in documents:
            doc_type = document.get("document_type") or type_map.get(document.get("category", ""), "other")
            document["document_type"] = doc_type
            if doc_type not in include_types:
                continue

            parser_name = pdf_cfg.get("parser_by_document_type", {}).get(doc_type)
            if not parser_name:
                continue
            parser_config = parser_map.get(parser_name)
            if not parser_config:
                continue

            parsed_pricing, parsed_rates = parse_document_pdf(document, parser_config)
            pricing_items.extend(parsed_pricing)
            rate_items.extend(parsed_rates)

    return BankPricingCatalog(
        bank=config["name"],
        source_url=url,
        documents=documents,
        pricing_items=pricing_items,
        rate_items=rate_items,
    )
