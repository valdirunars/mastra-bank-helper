import { createTool } from '@mastra/core/tools';

import {
  bankPricingCatalogSchema,
  bankPricingToolInputSchema,
} from './bank-pricing-schemas';
import { runBankScraperFor } from './run-bank-pricing-scraper';
import { resolveBankToolInput } from './resolve-bank-tool-input';

export const landsbankinnPricingTool = createTool({
  id: 'get-landsbankinn-pricing',
  description:
    'Fetch Landsbankinn pricing for a single bank. For cross-bank comparisons use compare-bank-pricing instead. Pass language ("is" or "en") and topic to filter results.',
  inputSchema: bankPricingToolInputSchema,
  outputSchema: bankPricingCatalogSchema,
  execute: async (inputData, context) => {
    return runBankScraperFor(
      'landsbankinn',
      resolveBankToolInput(inputData, context),
    );
  },
});
