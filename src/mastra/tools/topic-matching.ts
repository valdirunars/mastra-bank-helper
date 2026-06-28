const TOPIC_ALIASES: Record<string, string[]> = {
  kreditkort: ['kreditkort', 'kredit', 'credit card', 'visa', 'mastercard', 'kort'],
  ibudalan: ['ibudalan', 'ibudalán', 'housing loan', 'mortgage', 'fasteignalán'],
  veltireikningur: ['veltireikningur', 'veltureikningur', 'current account'],
  lantokugjald: ['lántökugjald', 'lantokugjald', 'origination fee', 'lánveiting'],
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function expandTopicTerms(topic: string): string[] {
  const normalized = normalizeText(topic);
  const terms = new Set<string>([normalized, topic.trim().toLowerCase()]);

  for (const [key, aliases] of Object.entries(TOPIC_ALIASES)) {
    if (
      aliases.some((alias) => normalized.includes(normalizeText(alias))) ||
      normalized.includes(key)
    ) {
      for (const alias of aliases) {
        terms.add(normalizeText(alias));
        terms.add(alias);
      }
    }
  }

  return [...terms];
}

export function matchesTopic(text: string, topicOrTerms: string | string[]): boolean {
  const normalizedText = normalizeText(text);
  const terms = Array.isArray(topicOrTerms)
    ? topicOrTerms
    : expandTopicTerms(topicOrTerms);

  return terms.some((term) => {
    const normalizedTerm = normalizeText(term);
    return (
      normalizedTerm.length > 0 &&
      (normalizedText.includes(normalizedTerm) ||
        normalizedText.split(' ').some((token) => token.startsWith(normalizedTerm)))
    );
  });
}
