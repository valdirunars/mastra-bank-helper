import { createTool } from '@mastra/core/tools';

import {
  bankPricingCatalogSchema,
  bankPricingToolInputSchema,
} from './bank-pricing-schemas';
import { runBankPricingScraper } from './run-bank-pricing-scraper';

export const landsbankinnPricingTool = createTool({
  id: 'get-landsbankinn-pricing',
  description:
    'Fetch Landsbankinn interest rates (vextir) and pricing (verðskrá) from landsbankinn.is. Returns PDF document links plus parsed fee and rate tables.',
  inputSchema: bankPricingToolInputSchema,
  outputSchema: bankPricingCatalogSchema,
  execute: async (inputData) => {
    return runBankPricingScraper(
      'scrapers/config.landsbankinn.json',
      inputData,
    );
  },
});
