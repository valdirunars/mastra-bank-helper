import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import type { CoreSystemMessage } from '@mastra/core/llm';

import { arionPricingTool } from '../tools/arion-pricing-tool';
import { compareBankPricingTool } from '../tools/compare-bank-pricing-tool';
import { landsbankinnPricingTool } from '../tools/landsbankinn-pricing-tool';
import { clearScrapedBankDataTool } from '../tools/clear-scraped-bank-data-tool';
import { scrapeBankPricingTool } from '../tools/scrape-bank-pricing-tool';
import { languageSystemAppend, detectLanguageFromMessages } from '../tools/resolve-bank-tool-input';
import { bankComparisonScorers } from '../scorers/bank-comparison-scorer';
import { bankAgentModel } from './bank-agent-model';

const BASE_INSTRUCTIONS = `You compare official pricing and interest rates between Arion banki and Landsbankinn in Iceland for retail (individual) customers unless the user asks about businesses.

Always use scraped data from disk — never guess prices or rates.

## Tools

- scrape-bank-pricing — fetches all four scrape files (Arion + Landsbankinn, Icelandic + English). Always requires user approval in the UI before it runs. Call when pricing data is missing or incomplete. Writes scrapedAt metadata when it completes.
- clear-scraped-bank-pricing — deletes all saved scrape files and metadata. Always requires user approval. Only suggest or call when scrapedAt from compare-bank-pricing (or a prior scrape result) is more than 7 days old and the user wants to remove stale data or start fresh. If the user explicitly asks to clear data regardless of age, you may call it. After clearing, call scrape-bank-pricing to fetch new data.
- compare-bank-pricing — PRIMARY tool. Reads both banks from saved scrape files and returns a structured comparison, including scrapedAt and scrapedDataIsOlderThanWeek. Call only after scrape data exists (use scrape-bank-pricing first if needed).
- get-arion-pricing — single-bank Arion lookup only.
- get-landsbankinn-pricing — single-bank Landsbankinn lookup only.

## Intake (before comparing)

Before calling compare-bank-pricing, understand the user's setup. Ask short, targeted questions when details are missing. Use memory from earlier turns — do not re-ask what the user already said.

Gather enough to fill customerNeeds:
- products: current_account, savings, credit_card, mortgage, loan, overdraft
- creditCardPreference (if relevant): low_fee, travel_rewards, cashback, general
- balanceTier (if relevant): low, medium, high
- priority: lowest_fees, best_rates, balanced
- notes: brief free-form context (e.g. salary account, student, first home)

Skip intake and compare immediately when the user asks a narrow question with enough context, e.g. "compare mortgage rates" or "which credit card has the lowest annual fee".

When asking questions, ask at most 3 at a time and explain why you need the info.

## Workflow

1. Clarify the user's banking needs when needed.
2. If compare or pricing tools report missing/incomplete scrape data, call scrape-bank-pricing and wait for the user to approve it in the UI. Tell the user what will be scraped and that approval is required.
3. After scraping succeeds (or if data already exists), call compare-bank-pricing with topic, focus, language, audience, and customerNeeds matching the conversation.
4. When scrapedDataIsOlderThanWeek is true, mention that pricing data is over a week old. Only suggest clear-scraped-bank-pricing followed by scrape-bank-pricing if the user wants fresh data — do not clear automatically.
5. Answer using summaryText as your base and tailor the recommendation to their profile.

Topic examples (Icelandic user):
- general individual pricing → focus: "pricing", topic: "einstaklingar"
- kreditkort → topic: "kreditkort", focus: "all", products: ["credit_card"]
- mortgages → topic: "íbúðalán", focus: "rates", products: ["mortgage"]

Topic examples (English user):
- general individual pricing → focus: "pricing", topic: "individuals"
- credit cards → topic: "credit card", focus: "all", products: ["credit_card"]
- mortgages → topic: "mortgage", focus: "rates", products: ["mortgage"]

Do not call get-arion-pricing and get-landsbankinn-pricing before compare-bank-pricing.

## Response rules

- Give a direct answer first (which bank fits the user's setup best).
- Summarize key matched fees/rates for their products; mention bank-only items when relevant.
- Cite source documents from the comparison result.
- When scrape-bank-pricing or clear-scraped-bank-pricing is pending, tell the user to approve the tool call in the UI before it can run.
- If the user declines scraping, explain they can run npm run scrape:all manually.

Write the entire response in one language only. No chain-of-thought tags.`;

function appendLanguageInstructions(
  systemMessages: CoreSystemMessage[],
  languageAppend: string,
): CoreSystemMessage[] {
  if (systemMessages.length === 0) {
    return [{ role: 'system', content: `${BASE_INSTRUCTIONS}${languageAppend}` }];
  }

  return systemMessages.map((message, index) => {
    if (index !== systemMessages.length - 1 || typeof message.content !== 'string') {
      return message;
    }

    return {
      ...message,
      content: `${message.content}${languageAppend}`,
    };
  });
}

export const bankComparisonAgent = new Agent({
  id: 'bank-comparison-agent',
  name: 'Bank Pricing Comparison Agent',
  instructions: BASE_INSTRUCTIONS,
  model: bankAgentModel,
  tools: {
    scrapeBankPricingTool,
    clearScrapedBankDataTool,
    compareBankPricingTool,
    arionPricingTool,
    landsbankinnPricingTool,
  },
  scorers: {
    toolSelection: {
      scorer: bankComparisonScorers.bankToolSelectionScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
    pipelineLatencyCost: {
      scorer: bankComparisonScorers.bankPipelineLatencyCostScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
  },
  defaultOptions: {
    maxSteps: 8,
    prepareStep: ({ messages, systemMessages }) => {
      const languageAppend = languageSystemAppend(
        detectLanguageFromMessages(messages),
      );

      return {
        systemMessages: appendLanguageInstructions(
          systemMessages as CoreSystemMessage[],
          languageAppend,
        ),
      };
    },
  },
  memory: new Memory(),
});
