"""CLI entry point for running scrapers."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from scrapers.base import SeleniumScraper, scrape_url
from scrapers.examples import EXAMPLES
from scrapers.pipeline import scrape_bank_config
from scrapers.types import ScrapeSchema, SelectorSpec


def _selector_from_dict(data: dict[str, Any]) -> SelectorSpec:
    return SelectorSpec(
        selector=data["selector"],
        by=data.get("by", "css"),
        attribute=data.get("attribute"),
        multiple=data.get("multiple", False),
        default=data.get("default"),
    )


def _schema_from_config(config: dict[str, Any]) -> ScrapeSchema[Any]:
    wait_for = None
    if "wait_for" in config:
        wait_for = _selector_from_dict(config["wait_for"])

    fields = {name: _selector_from_dict(spec) for name, spec in config["fields"].items()}

    return ScrapeSchema(
        fields=fields,
        wait_for=wait_for,
        wait_timeout=config.get("wait_timeout", 10),
        page_load_timeout=config.get("page_load_timeout", 30),
    )


def _load_config(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _is_bank_pipeline_config(config: dict[str, Any]) -> bool:
    return "page" in config and "schema" in config


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scrape a URL using Selenium and selector-based field mapping.",
    )
    parser.add_argument("--url", help="URL to scrape")
    parser.add_argument(
        "--scraper",
        choices=sorted(EXAMPLES.keys()),
        help="Use a built-in example scraper configuration",
    )
    parser.add_argument(
        "--config",
        type=Path,
        help="Path to a JSON config file with url, fields, and optional wait_for",
    )
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="Run Chrome with a visible browser window",
    )
    parser.add_argument(
        "--output",
        choices=("json", "pretty"),
        default="pretty",
        help="Output format (default: pretty)",
    )
    parser.add_argument(
        "--documents-only",
        action="store_true",
        help="For bank pipeline configs, skip PDF download and parsing",
    )
    parser.add_argument(
        "--output-file",
        type=Path,
        help="Write JSON result to this file instead of stdout",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    url = args.url
    schema: ScrapeSchema[Any] | None = None
    bank_config: dict[str, Any] | None = None

    if args.config:
        bank_config = _load_config(args.config)
        if _is_bank_pipeline_config(bank_config):
            url = url or bank_config.get("url")
        else:
            schema = _schema_from_config(bank_config)
            url = url or bank_config.get("url")

    if args.scraper:
        example = EXAMPLES[args.scraper]
        schema = example.schema
        url = url or example.DEFAULT_URL

    headless = not args.no_headless

    if bank_config and _is_bank_pipeline_config(bank_config):
        if args.documents_only:
            bank_config = {
                **bank_config,
                "pdf": {**bank_config.get("pdf", {}), "enabled": False},
            }
        result = scrape_bank_config(bank_config, headless=headless)
    elif schema is not None:
        if not url:
            parser.error("Provide --url or use a scraper/config that includes a default url")
        result = scrape_url(url, schema, headless=headless)
    else:
        parser.error("Provide --scraper or --config to define field selectors")

    if args.output == "json":
        payload = json.dumps(result, ensure_ascii=False)
    else:
        payload = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output_file:
        args.output_file.parent.mkdir(parents=True, exist_ok=True)
        args.output_file.write_text(payload, encoding="utf-8")
    else:
        print(payload)

    return 0


if __name__ == "__main__":
    sys.exit(main())
