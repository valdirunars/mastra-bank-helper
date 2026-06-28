# Bank pricing scrapers

Scrapes [Arion](https://www.arionbanki.is/bankinn/gogn/vextir-og-verdskra) and [Landsbankinn](https://www.landsbankinn.is/vextir-og-verdskra) pricing pages, downloads linked PDFs, and returns structured JSON.

## Setup (once)

```bash
npm run scrape:install
```

Requires Python 3 and Chrome.

## Scrape a bank

```bash
npm run scrape:arion
npm run scrape:landsbankinn
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

| Bank | Config |
|------|--------|
| Arion | `scrapers/config.arion.json` |
| Landsbankinn | `scrapers/config.landsbankinn.json` |

Direct Python usage:

```bash
.venv/bin/python -m scrapers --config scrapers/config.arion.json
```
