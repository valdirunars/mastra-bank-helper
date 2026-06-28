import { createTool } from '@mastra/core/tools';

import {
  bankPricingCatalogSchema,
  bankPricingToolInputSchema,
} from './bank-pricing-schemas';
import { runBankScraperFor } from './run-bank-pricing-scraper';
import { resolveBankToolInput } from './resolve-bank-tool-input';

export const arionPricingTool = createTool({
  id: 'get-arion-pricing',
  description:
    'Fetch Arion bank pricing for a single bank. For cross-bank comparisons use compare-bank-pricing instead. Pass language ("is" or "en") and topic to filter results.',
  inputSchema: bankPricingToolInputSchema,
  outputSchema: bankPricingCatalogSchema,
  execute: async (inputData, context) => {
    return runBankScraperFor('arion', resolveBankToolInput(inputData, context));
  },
});
