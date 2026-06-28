import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import type { CoreSystemMessage } from '@mastra/core/llm';

import { arionPricingTool } from '../tools/arion-pricing-tool';
import { compareBankPricingTool } from '../tools/compare-bank-pricing-tool';
import { landsbankinnPricingTool } from '../tools/landsbankinn-pricing-tool';
import { languageSystemAppend, detectLanguageFromMessages } from '../tools/resolve-bank-tool-input';
import { bankAgentModel } from './bank-agent-model';

const BASE_INSTRUCTIONS = `You compare official pricing and interest rates between Arion banki and Landsbankinn in Iceland for retail (individual) customers unless the user asks about businesses.

Always use live scraped data — never guess prices or rates.

## Tools

- compare-bank-pricing — PRIMARY tool. Fetches both banks and returns a compact comparison. Use this first for almost every question.
- get-arion-pricing — single-bank Arion lookup only.
- get-landsbankinn-pricing — single-bank Landsbankinn lookup only.

## Workflow

1. Call compare-bank-pricing with topic, focus, and language matching the user's language.
2. Answer using summaryText as your base and expand where helpful.

Topic examples (Icelandic user):
- general individual pricing → focus: "pricing", topic: "einstaklingar"
- kreditkort → topic: "kreditkort", focus: "all"
- mortgages → topic: "íbúðalán", focus: "rates"

Topic examples (English user):
- general individual pricing → focus: "pricing", topic: "individuals"
- credit cards → topic: "credit card", focus: "all"
- mortgages → topic: "mortgage", focus: "rates"

Do not call get-arion-pricing and get-landsbankinn-pricing before compare-bank-pricing.

## Response rules

- Give a direct answer first (which bank is cheaper for the asked topic).
- Summarize key matched fees/rates; mention bank-only items when relevant.
- Cite source documents from the comparison result.
- If scraping fails, suggest running npm run scrape:install.

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
    compareBankPricingTool,
    arionPricingTool,
    landsbankinnPricingTool,
  },
  defaultOptions: {
    maxSteps: 5,
    prepareStep: ({ stepNumber, messages, systemMessages }) => {
      const languageAppend = languageSystemAppend(
        detectLanguageFromMessages(messages),
      );
      const updatedSystemMessages = appendLanguageInstructions(
        systemMessages as CoreSystemMessage[],
        languageAppend,
      );

      if (stepNumber === 0) {
        return {
          systemMessages: updatedSystemMessages,
          toolChoice: {
            type: 'tool',
            toolName: 'compareBankPricingTool',
          },
        };
      }

      return {
        systemMessages: updatedSystemMessages,
        toolChoice: 'none',
        activeTools: [],
      };
    },
  },
  memory: new Memory(),
});
