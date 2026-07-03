import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  bankPricingCatalogSchema,
  type BankPricingCatalog,
  type BankPricingToolInput,
} from './bank-pricing-schemas';
import { filterCatalogByTopic } from './filter-catalog';
import { resolveProjectRoot } from './project-root';
import {
  resolveScraperLocale,
  SCRAPER_BANKS,
  SCRAPER_LOCALES,
  type ScraperBank,
  type ScraperLocale,
} from './scraper-config';

const OUTPUT_DIR = '.scraper-output';

export function getBankPricingOutputPath(
  bank: ScraperBank,
  language?: ScraperLocale,
): string {
  const locale = resolveScraperLocale(language);
  return path.join(OUTPUT_DIR, `${bank}.${locale}.json`);
}

export function scrapeCommandFor(
  bank: ScraperBank,
  locale: ScraperLocale,
): string {
  const suffix = locale === 'en' ? ':en' : '';
  return `npm run scrape:${bank}${suffix}`;
}

export function allScrapeCommands(): string[] {
  return SCRAPER_BANKS.flatMap((bank) =>
    SCRAPER_LOCALES.map((locale) => scrapeCommandFor(bank, locale)),
  );
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function bankPricingDataExists(
  bank: ScraperBank,
  language?: ScraperLocale,
): Promise<boolean> {
  const locale = resolveScraperLocale(language);
  const projectRoot = await resolveProjectRoot();
  const outputPath = path.join(
    projectRoot,
    getBankPricingOutputPath(bank, locale),
  );
  return pathExists(outputPath);
}

export async function listMissingBankPricing(
  banks: ScraperBank[],
  language?: ScraperLocale,
): Promise<ScraperBank[]> {
  const locale = resolveScraperLocale(language);
  const missing: ScraperBank[] = [];

  for (const bank of banks) {
    if (!(await bankPricingDataExists(bank, locale))) {
      missing.push(bank);
    }
  }

  return missing;
}

export async function readBankPricingFor(
  bank: ScraperBank,
  input: BankPricingToolInput = {},
): Promise<BankPricingCatalog> {
  const locale = resolveScraperLocale(input.language);
  const projectRoot = await resolveProjectRoot();
  const outputPath = path.join(
    projectRoot,
    getBankPricingOutputPath(bank, locale),
  );

  if (!(await pathExists(outputPath))) {
    throw new Error(
      `Bank pricing data not found at ${getBankPricingOutputPath(bank, locale)}. ` +
        'Call the scrape-bank-pricing tool first (requires user approval).',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(outputPath, 'utf-8'));
  } catch {
    throw new Error(`Failed to parse bank pricing data at ${outputPath}`);
  }

  const catalog = bankPricingCatalogSchema.parse(parsed);
  return filterCatalogByTopic(catalog, input.topic);
}

export async function readBothBankPricing(
  input: BankPricingToolInput = {},
): Promise<{ arion: BankPricingCatalog; landsbankinn: BankPricingCatalog }> {
  const [arion, landsbankinn] = await Promise.all([
    readBankPricingFor('arion', input),
    readBankPricingFor('landsbankinn', input),
  ]);
  return { arion, landsbankinn };
}
