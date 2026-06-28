"""Selenium-backed scraper with generic typed output."""

from __future__ import annotations

import json
from typing import Any, Generic, TypeVar

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from scrapers.types import ScrapeResult, ScrapeSchema, SelectorSpec, SelectorStrategy

T = TypeVar("T", bound=ScrapeResult)

_BY_MAP: dict[SelectorStrategy, str] = {
    "css": By.CSS_SELECTOR,
    "xpath": By.XPATH,
    "id": By.ID,
    "name": By.NAME,
    "class_name": By.CLASS_NAME,
    "tag_name": By.TAG_NAME,
    "link_text": By.LINK_TEXT,
    "partial_link_text": By.PARTIAL_LINK_TEXT,
}


class SeleniumScraper(Generic[T]):
    """Scrape a URL and map DOM nodes to a typed record via selectors."""

    def __init__(
        self,
        schema: ScrapeSchema[T],
        *,
        headless: bool = True,
        driver: webdriver.Chrome | None = None,
    ) -> None:
        self.schema = schema
        self._headless = headless
        self._driver = driver
        self._owns_driver = driver is None

    def _create_driver(self) -> webdriver.Chrome:
        options = Options()
        if self._headless:
            options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(self.schema.page_load_timeout)
        return driver

    @property
    def driver(self) -> webdriver.Chrome:
        if self._driver is None:
            self._driver = self._create_driver()
        return self._driver

    def _locate(self, spec: SelectorSpec) -> list[WebElement]:
        by = _BY_MAP[spec.by]
        if spec.multiple:
            return self.driver.find_elements(by, spec.selector)
        element = self.driver.find_element(by, spec.selector)
        return [element]

    @staticmethod
    def _extract_value(element: WebElement, spec: SelectorSpec) -> Any:
        raw = element.get_attribute(spec.attribute) if spec.attribute else element.text
        value: str | None = raw.strip() if isinstance(raw, str) else raw
        if value is None or value == "":
            return spec.default
        if spec.transform is not None:
            return spec.transform(value)
        return value

    def _extract_field(self, spec: SelectorSpec) -> Any:
        elements = self._locate(spec)
        if not elements:
            return [] if spec.multiple else spec.default

        values = [self._extract_value(el, spec) for el in elements]
        if spec.multiple:
            return values
        return values[0]

    def scrape(self, url: str) -> dict[str, Any]:
        self.driver.get(url)

        if self.schema.wait_for is not None:
            wait = WebDriverWait(self.driver, self.schema.wait_timeout)
            by = _BY_MAP[self.schema.wait_for.by]
            wait.until(EC.presence_of_element_located((by, self.schema.wait_for.selector)))

        result: dict[str, Any] = {}
        for field_name, spec in self.schema.fields.items():
            result[field_name] = self._extract_field(spec)
        return result

    def scrape_json(self, url: str) -> str:
        return json.dumps(self.scrape(url), indent=2)

    def close(self) -> None:
        if self._owns_driver and self._driver is not None:
            self._driver.quit()
            self._driver = None

    def __enter__(self) -> SeleniumScraper[T]:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def scrape_url(
    url: str,
    schema: ScrapeSchema[T],
    *,
    headless: bool = True,
) -> dict[str, Any]:
    with SeleniumScraper(schema, headless=headless) as scraper:
        return scraper.scrape(url)
