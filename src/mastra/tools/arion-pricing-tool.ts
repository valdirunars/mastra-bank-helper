import { createTool } from '@mastra/core/tools';

import {
  bankPricingCatalogSchema,
  bankPricingToolInputSchema,
} from './bank-pricing-schemas';
import { runBankPricingScraper } from './run-bank-pricing-scraper';

export const arionPricingTool = createTool({
  id: 'get-arion-pricing',
  description:
    'Fetch Arion bank interest rates (vextir) and pricing (verðskrá) from arionbanki.is. Returns PDF document links plus parsed fee and rate tables.',
  inputSchema: bankPricingToolInputSchema,
  outputSchema: bankPricingCatalogSchema,
  execute: async (inputData) => {
    return runBankPricingScraper('scrapers/config.arion.json', inputData);
  },
});
