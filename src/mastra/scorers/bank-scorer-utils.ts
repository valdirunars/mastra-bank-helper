import type { ScorerRunOutputForAgent, Trajectory } from '@mastra/core/evals';
import { extractToolCalls } from '@mastra/evals/scorers/utils';

export const BANK_PRICING_TOOLS = {
  arion: 'get-arion-pricing',
  landsbankinn: 'get-landsbankinn-pricing',
  compare: 'compare-bank-pricing',
} as const;

export type BankPricingToolId =
  (typeof BANK_PRICING_TOOLS)[keyof typeof BANK_PRICING_TOOLS];

export type BankToolIntent = 'arion' | 'landsbankinn' | 'compare';

export const BANK_SOURCE_URLS = {
  arion: 'https://www.arionbanki.is/bankinn/gogn/vextir-og-verdskra',
  landsbankinn: 'https://www.landsbankinn.is/vextir-og-verdskra',
} as const;

const URL_PATTERN =
  /https?:\/\/[^\s)>]+|(?:arionbanki|landsbankinn)\.is[^\s)>]*/gi;

const COMPARE_PATTERN =
  /\b(compare|comparison|versus|vs\.?|between|which bank|better bank|cheaper|lower fees|best rates|bera saman|samanburður|samanburð|hvaða banki|betri banki|ódýrari|lægri gjöld|bestu vextir)\b/i;

const ARION_HOST_PATTERN = /(?:^|\.)arionbanki\.is/i;
const LANDSBANKINN_HOST_PATTERN = /(?:^|\.)landsbankinn\.is/i;

const ARION_NAME_PATTERN = /\barion(?:\s+bank(?:i)?)?\b/i;
const LANDSBANKINN_NAME_PATTERN = /\blandsbankinn\b/i;

export type BankToolSelectionGroundTruth = {
  expectedTool?: BankPricingToolId;
  intent?: BankToolIntent;
};

export function extractUrlsFromText(text: string): string[] {
  return text.match(URL_PATTERN) ?? [];
}

export function detectBanksFromText(text: string): Set<'arion' | 'landsbankinn'> {
  const banks = new Set<'arion' | 'landsbankinn'>();
  const normalized = text.toLowerCase();

  for (const url of extractUrlsFromText(text)) {
    if (ARION_HOST_PATTERN.test(url)) {
      banks.add('arion');
    }
    if (LANDSBANKINN_HOST_PATTERN.test(url)) {
      banks.add('landsbankinn');
    }
  }

  if (ARION_NAME_PATTERN.test(normalized)) {
    banks.add('arion');
  }
  if (LANDSBANKINN_NAME_PATTERN.test(normalized)) {
    banks.add('landsbankinn');
  }

  return banks;
}

export function resolveBankToolIntent(
  userText: string,
  groundTruth?: unknown,
): {
  intent: BankToolIntent;
  expectedTool: BankPricingToolId;
  matchedUrls: string[];
  detectedBanks: Array<'arion' | 'landsbankinn'>;
  reason: string;
} {
  const gt = groundTruth as BankToolSelectionGroundTruth | undefined;

  if (gt?.expectedTool) {
    const intent =
      gt.intent ??
      (gt.expectedTool === BANK_PRICING_TOOLS.arion
        ? 'arion'
        : gt.expectedTool === BANK_PRICING_TOOLS.landsbankinn
          ? 'landsbankinn'
          : 'compare');

    return {
      intent,
      expectedTool: gt.expectedTool,
      matchedUrls: extractUrlsFromText(userText),
      detectedBanks: [...detectBanksFromText(userText)],
      reason: 'Used expectedTool from groundTruth.',
    };
  }

  if (gt?.intent) {
    const expectedTool =
      gt.intent === 'arion'
        ? BANK_PRICING_TOOLS.arion
        : gt.intent === 'landsbankinn'
          ? BANK_PRICING_TOOLS.landsbankinn
          : BANK_PRICING_TOOLS.compare;

    return {
      intent: gt.intent,
      expectedTool,
      matchedUrls: extractUrlsFromText(userText),
      detectedBanks: [...detectBanksFromText(userText)],
      reason: 'Used intent from groundTruth.',
    };
  }

  const matchedUrls = extractUrlsFromText(userText);
  const detectedBanks = detectBanksFromText(userText);
  const mentionsCompare = COMPARE_PATTERN.test(userText);

  if (detectedBanks.has('arion') && detectedBanks.has('landsbankinn')) {
    return {
      intent: 'compare',
      expectedTool: BANK_PRICING_TOOLS.compare,
      matchedUrls,
      detectedBanks: [...detectedBanks],
      reason: 'Both bank URLs or names detected.',
    };
  }

  if (mentionsCompare) {
    return {
      intent: 'compare',
      expectedTool: BANK_PRICING_TOOLS.compare,
      matchedUrls,
      detectedBanks: [...detectedBanks],
      reason: 'Comparison language detected.',
    };
  }

  if (detectedBanks.size === 1 && detectedBanks.has('arion')) {
    return {
      intent: 'arion',
      expectedTool: BANK_PRICING_TOOLS.arion,
      matchedUrls,
      detectedBanks: ['arion'],
      reason: 'Arion URL or name detected without comparison context.',
    };
  }

  if (detectedBanks.size === 1 && detectedBanks.has('landsbankinn')) {
    return {
      intent: 'landsbankinn',
      expectedTool: BANK_PRICING_TOOLS.landsbankinn,
      matchedUrls,
      detectedBanks: ['landsbankinn'],
      reason: 'Landsbankinn URL or name detected without comparison context.',
    };
  }

  return {
    intent: 'compare',
    expectedTool: BANK_PRICING_TOOLS.compare,
    matchedUrls,
    detectedBanks: [...detectedBanks],
    reason: 'No single-bank target; defaulting to cross-bank comparison.',
  };
}

export function isTrajectoryOutput(output: unknown): output is Trajectory {
  return (
    typeof output === 'object' &&
    output !== null &&
    'steps' in output &&
    Array.isArray((output as Trajectory).steps)
  );
}

export function extractPricingToolCalls(output: unknown): string[] {
  if (isTrajectoryOutput(output)) {
    return output.steps
      .filter((step) => step.stepType === 'tool_call')
      .map((step) => step.name)
      .filter((name) =>
        Object.values(BANK_PRICING_TOOLS).includes(name as BankPricingToolId),
      );
  }

  const { tools } = extractToolCalls(output as ScorerRunOutputForAgent);
  return tools.filter((name) =>
    Object.values(BANK_PRICING_TOOLS).includes(name as BankPricingToolId),
  );
}

export function scoreToolSelectionMatch(
  intent: BankToolIntent,
  expectedTool: BankPricingToolId,
  actualTools: string[],
): { score: number; passed: boolean; detail: string } {
  if (actualTools.length === 0) {
    return {
      score: 0,
      passed: false,
      detail: 'No pricing tool calls were made.',
    };
  }

  const usedCompare = actualTools.includes(BANK_PRICING_TOOLS.compare);
  const usedArion = actualTools.includes(BANK_PRICING_TOOLS.arion);
  const usedLandsbankinn = actualTools.includes(BANK_PRICING_TOOLS.landsbankinn);

  if (intent === 'compare') {
    if (usedCompare) {
      return {
        score: 1,
        passed: true,
        detail: 'Used compare-bank-pricing for a cross-bank request.',
      };
    }

    if (usedArion && usedLandsbankinn) {
      return {
        score: 0,
        passed: false,
        detail:
          'Called both single-bank tools instead of compare-bank-pricing.',
      };
    }

    return {
      score: 0,
      passed: false,
      detail: `Expected ${expectedTool} but got [${actualTools.join(', ')}].`,
    };
  }

  if (intent === 'arion') {
    const passed = usedArion && !usedLandsbankinn && !usedCompare;
    return {
      score: passed ? 1 : 0,
      passed,
      detail: passed
        ? 'Used get-arion-pricing for an Arion-only request.'
        : `Expected ${expectedTool} only but got [${actualTools.join(', ')}].`,
    };
  }

  const passed = usedLandsbankinn && !usedArion && !usedCompare;
  return {
    score: passed ? 1 : 0,
    passed,
    detail: passed
      ? 'Used get-landsbankinn-pricing for a Landsbankinn-only request.'
      : `Expected ${expectedTool} only but got [${actualTools.join(', ')}].`,
  };
}

type UsageTotals = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type BankPipelineMetrics = {
  arionCalls: number;
  landsbankinnCalls: number;
  compareCalls: number;
  arionDurationMs: number;
  landsbankinnDurationMs: number;
  compareDurationMs: number;
  totalToolDurationMs: number;
  modelGenerations: number;
} & UsageTotals;

export type PipelineLatencyBudgets = {
  maxArionReadMs: number;
  maxLandsbankinnReadMs: number;
  maxCompareReadMs: number;
  maxTotalToolMs: number;
  maxTotalTokens: number;
};

export const DEFAULT_PIPELINE_BUDGETS: PipelineLatencyBudgets = {
  maxArionReadMs: 500,
  maxLandsbankinnReadMs: 500,
  maxCompareReadMs: 1_000,
  maxTotalToolMs: 2_000,
  maxTotalTokens: 12_000,
};

function addUsage(target: UsageTotals, usage: Partial<UsageTotals>) {
  target.promptTokens += usage.promptTokens ?? 0;
  target.completionTokens += usage.completionTokens ?? 0;
  target.totalTokens += usage.totalTokens ?? 0;
}

function usageFromRecord(value: unknown): UsageTotals | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const promptTokens = Number(
    record.promptTokens ?? record.inputTokens ?? record.prompt ?? 0,
  );
  const completionTokens = Number(
    record.completionTokens ?? record.outputTokens ?? record.completion ?? 0,
  );
  const totalTokens = Number(
    record.totalTokens ?? promptTokens + completionTokens,
  );

  if (promptTokens + completionTokens + totalTokens === 0) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
}

function extractUsageFromMessages(
  output: ScorerRunOutputForAgent,
): UsageTotals {
  const totals: UsageTotals = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  for (const message of output) {
    const content = message.content;
    const candidates = [
      content.metadata?.usage,
      content.providerMetadata,
      (message as { metadata?: { usage?: unknown } }).metadata?.usage,
    ];

    for (const candidate of candidates) {
      const usage = usageFromRecord(candidate);
      if (usage) {
        addUsage(totals, usage);
      }
    }
  }

  return totals;
}

function accumulateToolDuration(
  metrics: BankPipelineMetrics,
  toolName: string,
  durationMs: number,
) {
  metrics.totalToolDurationMs += durationMs;

  if (toolName === BANK_PRICING_TOOLS.arion) {
    metrics.arionCalls += 1;
    metrics.arionDurationMs += durationMs;
    return;
  }

  if (toolName === BANK_PRICING_TOOLS.landsbankinn) {
    metrics.landsbankinnCalls += 1;
    metrics.landsbankinnDurationMs += durationMs;
    return;
  }

  if (toolName === BANK_PRICING_TOOLS.compare) {
    metrics.compareCalls += 1;
    metrics.compareDurationMs += durationMs;
  }
}

function countToolCalls(metrics: BankPipelineMetrics, toolName: string) {
  if (toolName === BANK_PRICING_TOOLS.arion) {
    metrics.arionCalls += 1;
    return;
  }

  if (toolName === BANK_PRICING_TOOLS.landsbankinn) {
    metrics.landsbankinnCalls += 1;
    return;
  }

  if (toolName === BANK_PRICING_TOOLS.compare) {
    metrics.compareCalls += 1;
  }
}

export function collectBankPipelineMetrics(
  output: unknown,
): BankPipelineMetrics {
  const metrics: BankPipelineMetrics = {
    arionCalls: 0,
    landsbankinnCalls: 0,
    compareCalls: 0,
    arionDurationMs: 0,
    landsbankinnDurationMs: 0,
    compareDurationMs: 0,
    totalToolDurationMs: 0,
    modelGenerations: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  if (isTrajectoryOutput(output)) {
    for (const step of output.steps) {
      if (step.stepType === 'model_generation') {
        metrics.modelGenerations += 1;
        addUsage(metrics, {
          promptTokens: step.promptTokens ?? 0,
          completionTokens: step.completionTokens ?? 0,
          totalTokens: (step.promptTokens ?? 0) + (step.completionTokens ?? 0),
        });
        continue;
      }

      if (
        step.stepType !== 'tool_call' &&
        step.stepType !== 'mcp_tool_call'
      ) {
        continue;
      }

      if (
        !Object.values(BANK_PRICING_TOOLS).includes(
          step.name as BankPricingToolId,
        )
      ) {
        continue;
      }

      countToolCalls(metrics, step.name);
      if (step.durationMs != null) {
        accumulateToolDuration(metrics, step.name, step.durationMs);
      }
    }

    if (metrics.totalTokens === 0 && output.totalDurationMs != null) {
      // Trajectory-only runs may omit per-step tokens; keep zero usage explicit.
    }

    return metrics;
  }

  addUsage(metrics, extractUsageFromMessages(output as ScorerRunOutputForAgent));

  const { tools } = extractToolCalls(output as ScorerRunOutputForAgent);
  for (const toolName of tools) {
    if (
      !Object.values(BANK_PRICING_TOOLS).includes(toolName as BankPricingToolId)
    ) {
      continue;
    }
    countToolCalls(metrics, toolName);
  }

  return metrics;
}

function dimensionScore(actual: number, budget: number): number {
  if (actual <= budget) {
    return 1;
  }

  return Math.max(0, 1 - (actual - budget) / budget);
}

export function scorePipelineEfficiency(
  metrics: BankPipelineMetrics,
  budgets: PipelineLatencyBudgets = DEFAULT_PIPELINE_BUDGETS,
): { score: number; dimensions: Record<string, number> } {
  const dimensions: Record<string, number> = {};

  if (metrics.arionDurationMs > 0) {
    dimensions.arionRead = dimensionScore(
      metrics.arionDurationMs,
      budgets.maxArionReadMs,
    );
  }

  if (metrics.landsbankinnDurationMs > 0) {
    dimensions.landsbankinnRead = dimensionScore(
      metrics.landsbankinnDurationMs,
      budgets.maxLandsbankinnReadMs,
    );
  }

  if (metrics.compareDurationMs > 0) {
    dimensions.compareRead = dimensionScore(
      metrics.compareDurationMs,
      budgets.maxCompareReadMs,
    );
  }

  if (metrics.totalToolDurationMs > 0) {
    dimensions.totalToolDuration = dimensionScore(
      metrics.totalToolDurationMs,
      budgets.maxTotalToolMs,
    );
  }

  if (metrics.totalTokens > 0) {
    dimensions.tokenUsage = dimensionScore(
      metrics.totalTokens,
      budgets.maxTotalTokens,
    );
  } else {
    // Disk reads should keep LLM usage bounded; neutral when usage isn't attached.
    dimensions.tokenUsage = 1;
  }

  const values = Object.values(dimensions);
  if (values.length === 0) {
    return { score: 1, dimensions };
  }

  const score =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return { score, dimensions };
}
