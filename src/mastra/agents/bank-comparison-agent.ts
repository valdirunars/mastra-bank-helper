import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { ollama } from 'ai-sdk-ollama';

import { arionPricingTool } from '../tools/arion-pricing-tool';
import { compareBankPricingTool } from '../tools/compare-bank-pricing-tool';
import { landsbankinnPricingTool } from '../tools/landsbankinn-pricing-tool';

export const bankComparisonAgent = new Agent({
  id: 'bank-comparison-agent',
  name: 'Bank Pricing Comparison Agent',
  instructions: `You compare official pricing and interest rates between Arion banki and Landsbankinn in Iceland.

Always use live scraped data from the bank websites — never guess prices or rates.

## Tools

- get-arion-pricing — latest Arion vextir og verðskrá (PDF catalog + parsed tables)
- get-landsbankinn-pricing — latest Landsbankinn vextir og verðskrá
- compare-bank-pricing — structured side-by-side comparison (pass both catalogs when available)

## Comparison workflow

When the user asks to compare banks, find the cheaper option, or see differences:

1. Call get-arion-pricing to fetch the latest Arion data.
2. Call get-landsbankinn-pricing to fetch the latest Landsbankinn data.
3. Call compare-bank-pricing with both catalogs. Use topic when the user mentions a product (e.g. "íbúðalán", "kreditkort", "lántökugjald"). Use focus "rates" for interest-only questions, "pricing" for fees, or "all" for general comparisons.

## How to present results

- Lead with a concise summary: which bank is cheaper or better for the asked topic, and how confident the match is.
- Show matched pairs in a clear table: product/fee, Arion amount, Landsbankinn amount, difference.
- Note when items exist at only one bank (arionOnly / landsbankinnOnly sections).
- Cite source documents (document titles and effective dates from the catalogs).
- Amounts use Icelandic formatting (comma decimals, kr, %). Do not convert currencies.
- If scraping fails, say so and suggest running npm run scrape:install.

Respond in the user's language (Icelandic or English). Be precise and factual.`,
  model: ollama('qwen3:latest'),
  tools: {
    arionPricingTool,
    landsbankinnPricingTool,
    compareBankPricingTool,
  },
  memory: new Memory(),
});
