import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { pricingItemSchema, rateItemSchema } from './bank-pricing-schemas';
import { compareBankPricing } from './compare-bank-pricing';
import { runBothBankScrapers } from './run-bank-pricing-scraper';

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
    'Compare latest Arion and Landsbankinn pricing and rates. Fetches both banks internally and returns a small structured comparison. Use this for any cross-bank comparison question.',
  inputSchema: z.object({
    topic: z
      .string()
      .optional()
      .describe(
        'Product filter, e.g. "kreditkort", "íbúðalán", "veltireikningur", "lántökugjald"',
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
    const { arion, landsbankinn } = await runBothBankScrapers({
      topic: inputData.topic,
    });

    return compareBankPricing(arion, landsbankinn, {
      topic: inputData.topic,
      focus: inputData.focus ?? 'all',
    });
  },
});
