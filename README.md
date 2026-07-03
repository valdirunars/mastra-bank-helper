# mastra-bank-helper

A [Mastra](https://mastra.ai/) app that compares Icelandic bank pricing and rates for [Arion](https://www.arionbanki.is) and [Landsbankinn](https://www.landsbankinn.is). The agent reads saved pricing data from disk — it does not fetch live bank pages on every question. If data is missing, the comparison tool asks you to confirm before scraping.

## Getting Started

### 1. Install dependencies

```shell
npm install
cp .env.example .env
```

Set `GOOGLE_API_KEY` in `.env` (or configure another model provider in `src/mastra/agents/bank-agent-model.ts`).

### 2. Start the development server

```shell
npm run dev
```

Open [http://localhost:4111](http://localhost:4111) to access [Mastra Studio](https://mastra.ai/docs/studio/overview) and test the bank comparison agent.

When you ask for a comparison and no saved pricing data exists yet, the agent pauses and asks you to confirm scraping. On confirm it scrapes all four files (Arion and Landsbankinn, Icelandic and English). Scraping uses Python + Chrome and takes about 1–3 minutes per file. The scraper environment is installed automatically on first scrape.

### Optional: scrape bank data manually

You can pre-fetch pricing data instead of waiting for an in-chat confirmation:

```shell
npm run scrape:install   # once — Python venv + dependencies
npm run scrape:all       # arion.is, arion.en, landsbankinn.is, landsbankinn.en
```

Or run individual scripts:

```shell
npm run scrape:arion
npm run scrape:arion:en
npm run scrape:landsbankinn
npm run scrape:landsbankinn:en
```

Output is written to `.scraper-output/` (gitignored). Re-run when you need fresh pricing data. See [scrapers/README.md](scrapers/README.md) for details.

## Learn more

- [Scraper setup and options](scrapers/README.md)
- [Mastra documentation](https://mastra.ai/docs/)
- [Agents](https://mastra.ai/docs/agents/overview), [tools](https://mastra.ai/docs/agents/using-tools), [workflows](https://mastra.ai/docs/workflows/overview), [scorers](https://mastra.ai/docs/evals/overview)

## Deploy to the Mastra platform

The [Mastra platform](https://projects.mastra.ai) provides two products for deploying and managing AI applications built with the Mastra framework:

- **Studio**: A hosted visual environment for testing agents, running workflows, and inspecting traces
- **Server**: A production deployment target that runs your Mastra application as an API server

Learn more in the [Mastra platform documentation](https://mastra.ai/docs/mastra-platform/overview).
