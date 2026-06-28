import { ollama } from 'ai-sdk-ollama';

/**
 * qwen3 emits long internal reasoning and often skips tool calls, leaving empty
 * responses in Studio. qwen2.5 handles tool calling reliably for this agent.
 *
 * English scraper configs are used by default for qwen-family models (see scraper-config.ts).
 * Set BANK_SCRAPER_LOCALE=is to force Icelandic PDFs.
 */
export const bankAgentModel = ollama(
  process.env.BANK_AGENT_MODEL ?? 'qwen2.5:7b-instruct',
);
