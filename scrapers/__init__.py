"""Generic Selenium scrapers with typed selector-based field mapping."""

from scrapers.base import SeleniumScraper, scrape_url
from scrapers.types import FieldMapping, ScrapeSchema, ScrapeResult, SelectorSpec

__all__ = [
    "FieldMapping",
    "ScrapeResult",
    "ScrapeSchema",
    "SelectorSpec",
    "SeleniumScraper",
    "scrape_url",
]
