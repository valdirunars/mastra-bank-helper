import type { BankPricingToolInput } from './bank-pricing-schemas';
import {
  detectUserLanguage,
  latestUserMessageText,
  resolveToolLanguage,
} from './detect-user-language';
import type { ScraperLocale } from './scraper-config';

type ToolExecutionContext = {
  agent?: {
    messages?: unknown[];
  };
};

export function resolveBankToolInput<T extends BankPricingToolInput>(
  input: T,
  context?: ToolExecutionContext,
): T & { language: ScraperLocale } {
  const userText = latestUserMessageText(context?.agent?.messages);
  const language = resolveToolLanguage(input.language, userText);

  return {
    ...input,
    language,
  };
}

export function languageSystemAppend(language: ScraperLocale): string {
  if (language === 'is') {
    return [
      '',
      '## Active language: Icelandic (is)',
      'Pass language "is" to pricing tools.',
      'Respond entirely in Icelandic. Use kr and % for amounts.',
      'Do not mix English into the response.',
    ].join('\n');
  }

  return [
    '',
    '## Active language: English (en)',
    'Pass language "en" to pricing tools.',
    'Respond entirely in English. Use ISK and % for amounts.',
    'Do not mix Icelandic words or phrases into the response.',
    'Quote fee and product names exactly as they appear in the tool result.',
  ].join('\n');
}

export function detectLanguageFromMessages(messages: unknown[] | undefined): ScraperLocale {
  return detectUserLanguage(latestUserMessageText(messages));
}
