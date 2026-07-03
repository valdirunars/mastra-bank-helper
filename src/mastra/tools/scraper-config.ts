export type ScraperBank = 'arion' | 'landsbankinn';
export type ScraperLocale = 'is' | 'en';

export const SCRAPER_BANKS: ScraperBank[] = ['arion', 'landsbankinn'];
export const SCRAPER_LOCALES: ScraperLocale[] = ['is', 'en'];

const SCRAPER_CONFIGS: Record<ScraperBank, Record<ScraperLocale, string>> = {
  arion: {
    is: 'scrapers/config.arion.json',
    en: 'scrapers/config.arion.en.json',
  },
  landsbankinn: {
    is: 'scrapers/config.landsbankinn.json',
    en: 'scrapers/config.landsbankinn.en.json',
  },
};

const ENGLISH_FIRST_MODELS = ['qwen', 'llama', 'mistral', 'phi', 'gemma'];

function modelPrefersEnglishScraper(modelName: string): boolean {
  const normalized = modelName.toLowerCase();
  return ENGLISH_FIRST_MODELS.some((name) => normalized.includes(name));
}

export function resolveScraperLocale(language?: ScraperLocale): ScraperLocale {
  if (language === 'is' || language === 'en') {
    return language;
  }

  const explicit = process.env.BANK_SCRAPER_LOCALE?.trim().toLowerCase();
  if (explicit === 'en' || explicit === 'is') {
    return explicit;
  }

  const modelName = process.env.BANK_AGENT_MODEL ?? 'qwen2.5:7b-instruct';
  return modelPrefersEnglishScraper(modelName) ? 'en' : 'is';
}

export function getScraperConfigPath(
  bank: ScraperBank,
  language?: ScraperLocale,
): string {
  return SCRAPER_CONFIGS[bank][resolveScraperLocale(language)];
}
