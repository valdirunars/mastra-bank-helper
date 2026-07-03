import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getBankPricingOutputPath } from './read-bank-pricing';
import { runAllBankScrapers } from './run-bank-scraper';
import {
  SCRAPER_BANKS,
  SCRAPER_LOCALES,
  type ScraperBank,
  type ScraperLocale,
} from './scraper-config';

const scrapeTargetSchema = z.object({
  bank: z.enum(['arion', 'landsbankinn']),
  locale: z.enum(['is', 'en']),
  path: z.string(),
});

export const scrapeBankPricingTool = createTool({
  id: 'scrape-bank-pricing',
  description:
    'Scrape official Arion and Landsbankinn pricing pages and save all four locale files (Icelandic and English for both banks). Requires user approval before running. Takes about 1–3 minutes per file and needs Chrome. Call this when scraped data is missing or incomplete before using compare-bank-pricing or single-bank pricing tools.',
  requireApproval: true,
  inputSchema: z.object({
    reason: z
      .string()
      .optional()
      .describe('Brief note on why scraping is needed (e.g. missing data for a comparison)'),
  }),
  outputSchema: z.object({
    scrapedAt: z.string(),
    files: z.array(scrapeTargetSchema),
    message: z.string(),
  }),
  mcp: {
    annotations: {
      title: 'Scrape bank pricing',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  execute: async () => {
    await runAllBankScrapers();

    const files = SCRAPER_BANKS.flatMap((bank: ScraperBank) =>
      SCRAPER_LOCALES.map((locale: ScraperLocale) => ({
        bank,
        locale,
        path: getBankPricingOutputPath(bank, locale),
      })),
    );

    return {
      scrapedAt: new Date().toISOString(),
      files,
      message:
        'Scraped Arion and Landsbankinn pricing for Icelandic and English. You can now call compare-bank-pricing or single-bank pricing tools.',
    };
  },
});
