import { z } from 'zod';

export const pricingDocumentSchema = z.object({
  title: z.string(),
  url: z.string(),
  category: z.string(),
  document_type: z.enum([
    'rates',
    'pricing',
    'account_fees',
    'rate_history',
    'other',
  ]),
  effective_date: z.string().nullable(),
  subtitle: z.string().nullable(),
});

export const pricingItemSchema = z.object({
  code: z.string(),
  description: z.string(),
  amount: z.string(),
  unit: z.enum(['percent', 'isk', 'range', 'text']),
  document_title: z.string(),
  document_url: z.string(),
  category: z.string(),
});

export const rateItemSchema = z.object({
  section: z.string(),
  product: z.string(),
  rate: z.string(),
  document_title: z.string(),
  document_url: z.string(),
  category: z.string(),
});

export const bankPricingCatalogSchema = z.object({
  bank: z.string(),
  source_url: z.string(),
  documents: z.array(pricingDocumentSchema),
  pricing_items: z.array(pricingItemSchema),
  rate_items: z.array(rateItemSchema),
});

export type BankPricingCatalog = z.infer<typeof bankPricingCatalogSchema>;
export type PricingItem = z.infer<typeof pricingItemSchema>;
export type RateItem = z.infer<typeof rateItemSchema>;

export const scraperLanguageSchema = z
  .enum(['is', 'en'])
  .describe(
    'Scraper language: "is" for Icelandic PDFs, "en" for English PDFs. Match the user language when possible.',
  );

export const bankPricingToolInputSchema = z.object({
  language: scraperLanguageSchema.optional(),
  documentsOnly: z
    .boolean()
    .optional()
    .describe('If true, only list PDF documents without parsing their contents'),
  topic: z
    .string()
    .optional()
    .describe(
      'Filter results to items matching this topic, e.g. "kreditkort", "íbúðalán", "credit card", "mortgage"',
    ),
});

export type BankPricingToolInput = z.infer<typeof bankPricingToolInputSchema>;

export const bankingProductSchema = z.enum([
  'current_account',
  'savings',
  'credit_card',
  'mortgage',
  'loan',
  'overdraft',
]);

export const creditCardPreferenceSchema = z.enum([
  'low_fee',
  'travel_rewards',
  'cashback',
  'general',
]);

export const balanceTierSchema = z.enum(['low', 'medium', 'high']);

export const comparisonPrioritySchema = z.enum([
  'lowest_fees',
  'best_rates',
  'balanced',
]);

export const customerNeedsSchema = z.object({
  products: z
    .array(bankingProductSchema)
    .optional()
    .describe('Banking products the user wants to compare or set up'),
  creditCardPreference: creditCardPreferenceSchema
    .optional()
    .describe('What the user values most in a credit card'),
  balanceTier: balanceTierSchema
    .optional()
    .describe('Expected typical account balance: low, medium, or high'),
  priority: comparisonPrioritySchema
    .optional()
    .describe('Whether the user cares most about fees, rates, or both'),
  notes: z
    .string()
    .optional()
    .describe('Short free-form context gathered from the conversation'),
});

export type CustomerNeeds = z.infer<typeof customerNeedsSchema>;
export type BankingProduct = z.infer<typeof bankingProductSchema>;
