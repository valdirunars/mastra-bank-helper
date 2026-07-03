import { createTool } from '@mastra/core/tools';

import {
  bankPricingCatalogSchema,
  bankPricingToolInputSchema,
} from './bank-pricing-schemas';
import { assertCompleteScrapedData } from './assert-scraped-data';
import { readBankPricingFor } from './read-bank-pricing';
import { resolveBankToolInput } from './resolve-bank-tool-input';

export const landsbankinnPricingTool = createTool({
  id: 'get-landsbankinn-pricing',
  description:
    'Read Landsbankinn pricing from saved scrape files on disk. Requires all four scrape outputs; if missing, call scrape-bank-pricing first. For cross-bank comparisons use compare-bank-pricing instead. Pass language ("is" or "en") and topic to filter results.',
  inputSchema: bankPricingToolInputSchema,
  outputSchema: bankPricingCatalogSchema,
  execute: async (inputData, context) => {
    await assertCompleteScrapedData();
    return readBankPricingFor(
      'landsbankinn',
      resolveBankToolInput(inputData, context),
    );
  },
});
