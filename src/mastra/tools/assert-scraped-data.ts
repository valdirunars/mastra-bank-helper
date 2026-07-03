import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { bankPricingCatalogSchema } from './bank-pricing-schemas';
import { getBankPricingOutputPath } from './read-bank-pricing';
import { resolveProjectRoot } from './project-root';
import {
  SCRAPER_BANKS,
  SCRAPER_LOCALES,
  type ScraperBank,
  type ScraperLocale,
} from './scraper-config';

export type ScrapeOutputTarget = {
  bank: ScraperBank;
  locale: ScraperLocale;
  path: string;
};

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function isCatalogSufficient(
  catalog: ReturnType<typeof bankPricingCatalogSchema.parse>,
): boolean {
  return (
    catalog.documents.length > 0 ||
    catalog.pricing_items.length > 0 ||
    catalog.rate_items.length > 0
  );
}

/** All four scrape outputs (both banks × both locales). */
export function allScrapeOutputTargets(): ScrapeOutputTarget[] {
  return SCRAPER_BANKS.flatMap((bank) =>
    SCRAPER_LOCALES.map((locale) => ({
      bank,
      locale,
      path: getBankPricingOutputPath(bank, locale),
    })),
  );
}

export async function listIncompleteScrapeOutputs(): Promise<
  ScrapeOutputTarget[]
> {
  const projectRoot = await resolveProjectRoot();
  const incomplete: ScrapeOutputTarget[] = [];

  for (const target of allScrapeOutputTargets()) {
    const outputPath = path.join(projectRoot, target.path);

    if (!(await pathExists(outputPath))) {
      incomplete.push(target);
      continue;
    }

    try {
      const parsed = JSON.parse(await readFile(outputPath, 'utf-8'));
      const catalog = bankPricingCatalogSchema.parse(parsed);
      if (!isCatalogSufficient(catalog)) {
        incomplete.push(target);
      }
    } catch {
      incomplete.push(target);
    }
  }

  return incomplete;
}

export async function assertCompleteScrapedData(): Promise<void> {
  const incomplete = await listIncompleteScrapeOutputs();
  if (incomplete.length === 0) {
    return;
  }

  const missingList = incomplete
    .map((target) => `${target.bank}.${target.locale}.json`)
    .join(', ');

  throw new Error(
    `Scraped bank pricing is missing or incomplete (${missingList}). ` +
      'Call the scrape-bank-pricing tool first — it requires user approval and runs scrape:all ' +
      '(Arion and Landsbankinn, Icelandic and English). Then retry the pricing or comparison tool.',
  );
}
