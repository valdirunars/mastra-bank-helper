"""Example scraper: quotes.toscrape.com first quote on a page."""

from __future__ import annotations

from typing import TypedDict

from scrapers.types import ScrapeSchema, SelectorSpec

DEFAULT_URL = "https://quotes.toscrape.com/"


class QuotePage(TypedDict):
    """Typed output for a single quote listing page."""

    quote_text: str
    author: str
    tags: list[str]


schema: ScrapeSchema[QuotePage] = ScrapeSchema(
    wait_for=SelectorSpec(selector="div.quote", by="css"),
    fields={
        "quote_text": SelectorSpec(
            selector="div.quote span.text",
            by="css",
            transform=lambda text: text.strip("\u201c\u201d"),
        ),
        "author": SelectorSpec(selector="div.quote small.author", by="css"),
        "tags": SelectorSpec(
            selector="div.quote:first-of-type div.tags a.tag",
            by="css",
            multiple=True,
        ),
    },
)
