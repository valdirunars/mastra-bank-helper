import { createTool } from '@mastra/core/tools';

import {
  bankPricingCatalogSchema,
  bankPricingToolInputSchema,
} from './bank-pricing-schemas';
import { readBankPricingFor } from './read-bank-pricing';
import { resolveBankToolInput } from './resolve-bank-tool-input';

export const arionPricingTool = createTool({
  id: 'get-arion-pricing',
  description:
    'Read pre-scraped Arion bank pricing from disk. For cross-bank comparisons use compare-bank-pricing instead. Pass language ("is" or "en") and topic to filter results. Requires running npm run scrape:arion first.',
  inputSchema: bankPricingToolInputSchema,
  outputSchema: bankPricingCatalogSchema,
  execute: async (inputData, context) => {
    return readBankPricingFor('arion', resolveBankToolInput(inputData, context));
  },
});
