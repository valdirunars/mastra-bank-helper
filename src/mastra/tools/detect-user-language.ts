import type { ScraperLocale } from './scraper-config';

const ICELANDIC_CHARS = /[ðþæöáéíúý]/i;
const ICELANDIC_WORDS =
  /\b(og|eða|hvað|hver|hvernig|verð|vaxta|lán|kort|banki|einstakling|fyrirtæk|kr)\b/i;

export function detectUserLanguage(text: string): ScraperLocale {
  const sample = text.trim();
  if (!sample) {
    return 'en';
  }

  if (ICELANDIC_CHARS.test(sample) || ICELANDIC_WORDS.test(sample)) {
    return 'is';
  }

  return 'en';
}

function messageText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          return String(part.text ?? '');
        }
        return '';
      })
      .join(' ');
  }

  if (content && typeof content === 'object' && 'parts' in content) {
    const parts = (content as { parts?: unknown[] }).parts ?? [];
    return parts
      .map((part) =>
        part && typeof part === 'object' && 'text' in part
          ? String(part.text ?? '')
          : '',
      )
      .join(' ');
  }

  return '';
}

export function latestUserMessageText(messages: unknown[] | undefined): string {
  if (!messages?.length) {
    return '';
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message &&
      typeof message === 'object' &&
      'role' in message &&
      message.role === 'user'
    ) {
      return messageText('content' in message ? message.content : '');
    }
  }

  return '';
}

export function resolveToolLanguage(
  requestedLanguage: ScraperLocale | undefined,
  userText: string,
): ScraperLocale {
  const detected = detectUserLanguage(userText);
  if (!requestedLanguage) {
    return detected;
  }

  if (requestedLanguage !== detected) {
    return detected;
  }

  return requestedLanguage;
}
