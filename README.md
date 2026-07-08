# mastra-bank-helper

A [Mastra](https://mastra.ai/) app that compares Icelandic bank pricing and rates for [Arion](https://www.arionbanki.is) and [Landsbankinn](https://www.landsbankinn.is). The agent reads saved pricing data from disk — it does not fetch live bank pages on every question. If data is missing, the comparison tool asks you to confirm before scraping.

<video src="https://github.com/valdirunars/mastra-bank-helper/raw/main/mastra%20demo.mp4" controls width="100%"></video>

## Getting Started

### 1. Install dependencies

```shell
npm install
cp .env.example .env
```

### 2. Configure the language model

The agent model is defined in `src/mastra/agents/bank-agent-model.ts`. This project defaults to a **local Ollama** model.

#### Option A: Ollama (default)

1. Install [Ollama](https://ollama.com/) and make sure it is running.
2. Pull a model that exists on your machine. The default is `qwen2.5:7b-instruct` (recommended for reliable tool calling):

   ```shell
   ollama pull qwen2.5:7b-instruct
   ```

3. Optional: override the model in `.env` (the tag must already be pulled locally):

   ```env
   BANK_AGENT_MODEL=your-model:tag
   ```

   Avoid `qwen3` for this agent — it tends to skip tool calls and return empty responses in Studio. See comments in `bank-agent-model.ts`.

   Scraper locale follows the model name by default (English PDFs for qwen/llama/mistral/phi/gemma). Set `BANK_SCRAPER_LOCALE=is` in `.env` to force Icelandic scrape configs.

#### Option B: Google Gemini

1. Add your API key to `.env`:

   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your-api-key
   ```

2. Switch the model in `src/mastra/agents/bank-agent-model.ts` from Ollama to a Google model string, for example:

   ```typescript
   export const bankAgentModel = 'google/gemini-2.5-flash';
   ```

   Other Google models: `google/gemini-2.5-pro`, etc.

### 3. Start the development server

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
