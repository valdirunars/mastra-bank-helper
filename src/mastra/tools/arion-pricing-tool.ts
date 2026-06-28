import { createTool } from '@mastra/core/tools';

import {
  bankPricingCatalogSchema,
  bankPricingToolInputSchema,
} from './bank-pricing-schemas';
import { runBankPricingScraper } from './run-bank-pricing-scraper';

export const arionPricingTool = createTool({
  id: 'get-arion-pricing',
  description:
    'Fetch Arion bank pricing for a single bank. For cross-bank comparisons use compare-bank-pricing instead. Pass topic to filter results.',
  inputSchema: bankPricingToolInputSchema,
  outputSchema: bankPricingCatalogSchema,
  execute: async (inputData) => {
    return runBankPricingScraper('scrapers/config.arion.json', inputData);
  },
});
