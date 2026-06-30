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

function scrapeCommandFor(bank: ScraperBank, locale: ScraperLocale): string {
  const suffix = locale === 'en' ? ':en' : '';
  return `npm run scrape:${bank}${suffix}`;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
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
        `Run \`${scrapeCommandFor(bank, locale)}\` first.`,
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
