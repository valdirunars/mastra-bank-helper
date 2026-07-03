import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  bankPricingToolInputSchema,
  customerNeedsSchema,
  pricingItemSchema,
  rateItemSchema,
} from './bank-pricing-schemas';
import { assertCompleteScrapedData } from './assert-scraped-data';
import { compareBankPricing } from './compare-bank-pricing';
import { resolveBankToolInput } from './resolve-bank-tool-input';
import { readBothBankPricing } from './read-bank-pricing';

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
    'Compare latest Arion and Landsbankinn pricing and rates from saved scrape files on disk. Requires all four scrape outputs; if missing, call scrape-bank-pricing first. Pass customerNeeds with products and preferences gathered from the conversation. Pass language ("is" or "en") to pick Icelandic or English source files.',
  inputSchema: bankPricingToolInputSchema.extend({
    focus: z
      .enum(['rates', 'pricing', 'all'])
      .optional()
      .describe('Compare rates only, pricing/fees only, or both'),
    audience: z
      .enum(['individuals', 'business', 'all'])
      .optional()
      .describe('Filter to retail or business pricing where possible'),
    customerNeeds: customerNeedsSchema
      .optional()
      .describe(
        'Structured summary of what the user needs: products, credit card preference, balance tier, and priority',
      ),
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
    summaryText: z.string(),
  }),
  execute: async (inputData, context) => {
    await assertCompleteScrapedData();

    const resolved = resolveBankToolInput(inputData, context);
    const { arion, landsbankinn } = await readBothBankPricing(resolved);

    return compareBankPricing(arion, landsbankinn, {
      topic: resolved.topic,
      focus: resolved.focus ?? 'all',
      audience: resolved.audience ?? 'individuals',
      language: resolved.language,
      customerNeeds: resolved.customerNeeds,
    });
  },
});
