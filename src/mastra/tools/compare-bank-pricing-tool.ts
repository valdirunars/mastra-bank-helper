import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { bankPricingCatalogSchema, pricingItemSchema, rateItemSchema } from './bank-pricing-schemas';
import { compareBankPricing } from './compare-bank-pricing';

const sidePricingSchema = z
  .object({
    description: z.string(),
    amount: z.string(),
    unit: z.string(),
  })
  .nullable();

const sideRateSchema = z
  .object({
    product: z.string(),
    rate: z.string(),
    section: z.string(),
  })
  .nullable();

export const compareBankPricingTool = createTool({
  id: 'compare-bank-pricing',
  description:
    'Compare latest Arion and Landsbankinn pricing and interest rates. Pass catalogs from get-arion-pricing and get-landsbankinn-pricing, or omit them to fetch fresh data.',
  inputSchema: z.object({
    arion: bankPricingCatalogSchema
      .optional()
      .describe('Arion catalog from get-arion-pricing'),
    landsbankinn: bankPricingCatalogSchema
      .optional()
      .describe('Landsbankinn catalog from get-landsbankinn-pricing'),
    topic: z
      .string()
      .optional()
      .describe(
        'Optional filter, e.g. "íbúðalán", "kreditkort", "veltireikningur", "lántökugjald"',
      ),
    focus: z
      .enum(['rates', 'pricing', 'all'])
      .optional()
      .describe('Compare rates only, pricing/fees only, or both'),
  }),
  outputSchema: z.object({
    comparedAt: z.string(),
    focus: z.enum(['rates', 'pricing', 'all']),
    topic: z.string().nullable(),
    sources: z.object({
      arion: z.object({
        url: z.string(),
        pricingDocument: z.string().nullable(),
        ratesDocument: z.string().nullable(),
      }),
      landsbankinn: z.object({
        url: z.string(),
        pricingDocument: z.string().nullable(),
        ratesDocument: z.string().nullable(),
      }),
    }),
    summary: z.object({
      pricingMatches: z.number(),
      rateMatches: z.number(),
      arionOnlyPricing: z.number(),
      landsbankinnOnlyPricing: z.number(),
      arionOnlyRates: z.number(),
      landsbankinnOnlyRates: z.number(),
    }),
    pricingComparisons: z.array(
      z.object({
        topic: z.string(),
        arion: sidePricingSchema,
        landsbankinn: sidePricingSchema,
        matchScore: z.number(),
      }),
    ),
    rateComparisons: z.array(
      z.object({
        topic: z.string(),
        arion: sideRateSchema,
        landsbankinn: sideRateSchema,
        matchScore: z.number(),
      }),
    ),
    arionOnlyPricing: z.array(pricingItemSchema),
    landsbankinnOnlyPricing: z.array(pricingItemSchema),
    arionOnlyRates: z.array(rateItemSchema),
    landsbankinnOnlyRates: z.array(rateItemSchema),
  }),
  execute: async (inputData) => {
    const { runBankPricingScraper } = await import('./run-bank-pricing-scraper');

    const arion =
      inputData.arion ??
      (await runBankPricingScraper('scrapers/config.arion.json'));
    const landsbankinn =
      inputData.landsbankinn ??
      (await runBankPricingScraper('scrapers/config.landsbankinn.json'));

    return compareBankPricing(arion, landsbankinn, {
      topic: inputData.topic,
      focus: inputData.focus,
    });
  },
});
