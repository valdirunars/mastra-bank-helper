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

export const bankPricingToolInputSchema = z.object({
  documentsOnly: z
    .boolean()
    .optional()
    .describe('If true, only list PDF documents without parsing their contents'),
  topic: z
    .string()
    .optional()
    .describe(
      'Filter results to items matching this topic, e.g. "kreditkort", "íbúðalán"',
    ),
});

export type BankPricingToolInput = z.infer<typeof bankPricingToolInputSchema>;
