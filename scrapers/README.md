# Bank pricing scrapers

Scrapes [Arion](https://www.arionbanki.is/bankinn/gogn/vextir-og-verdskra) and [Landsbankinn](https://www.landsbankinn.is/vextir-og-verdskra) pricing pages, downloads linked PDFs, and returns structured JSON.

English pages are also supported for models that handle English better than Icelandic:

- [Arion (EN)](https://www.arionbanki.is/en/bank/data/rates)
- [Landsbankinn (EN)](https://www.landsbankinn.is/en/interest-rates-and-fees)

## Setup (once)

```bash
npm run scrape:install
```

Requires Python 3 and Chrome.

## Scrape a bank

```bash
npm run scrape:arion
npm run scrape:landsbankinn
npm run scrape:arion:en
npm run scrape:landsbankinn:en
```

Save to a file:

```bash
npm run scrape:arion -- --output json > arion-pricing.json
npm run scrape:landsbankinn -- --output json > landsbankinn-pricing.json
```

## Output

Each run returns a `BankPricingCatalog` JSON object:

- `documents` — PDF links found on the bank page (title, url, category, effective date)
- `pricing_items` — fee/charge rows parsed from verðskrá PDFs
- `rate_items` — product/rate rows parsed from vaxtatafla PDFs

## Useful flags

| Flag | Description |
|------|-------------|
| `--documents-only` | List PDFs only; skip PDF download/parsing |
| `--output json` | Compact JSON (good for piping to files) |
| `--no-headless` | Show the browser window |

Example — document list only:

```bash
npm run scrape:arion -- --documents-only
```

## Config files

| Bank | Icelandic | English |
|------|-----------|---------|
| Arion | `scrapers/config.arion.json` | `scrapers/config.arion.en.json` |
| Landsbankinn | `scrapers/config.landsbankinn.json` | `scrapers/config.landsbankinn.en.json` |

The Mastra agent picks Icelandic or English configs automatically. Set `BANK_SCRAPER_LOCALE=en` or `BANK_SCRAPER_LOCALE=is` to override. Models like qwen default to English scrapers.

Direct Python usage:

```bash
.venv/bin/python -m scrapers --config scrapers/config.arion.json
```
