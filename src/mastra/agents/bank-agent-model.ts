import { ollama } from 'ai-sdk-ollama';

/**
 * Default: local Ollama. Requires Ollama running and the model pulled locally
 * (see README — Option A). Override with BANK_AGENT_MODEL in .env.
 *
 * qwen3 emits long internal reasoning and often skips tool calls, leaving empty
 * responses in Studio. qwen2.5 handles tool calling reliably for this agent.
 *
 * English scraper configs are used by default for qwen-family models (see scraper-config.ts).
 * Set BANK_SCRAPER_LOCALE=is to force Icelandic PDFs.
 *
 * Google alternative (see README — Option B): set GOOGLE_GENERATIVE_AI_API_KEY in .env, then:
 *   export const bankAgentModel = 'google/gemini-2.5-flash';
 */
export const bankAgentModel = ollama(
  process.env.BANK_AGENT_MODEL ?? 'qwen2.5:7b-instruct',
);
