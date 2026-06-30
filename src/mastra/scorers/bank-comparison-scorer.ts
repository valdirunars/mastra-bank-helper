import { createScorer } from '@mastra/core/evals';
import {
  extractInputMessages,
  getUserMessageFromRunInput,
} from '@mastra/evals/scorers/utils';

import {
  collectBankPipelineMetrics,
  DEFAULT_PIPELINE_BUDGETS,
  extractPricingToolCalls,
  resolveBankToolIntent,
  scorePipelineEfficiency,
  scoreToolSelectionMatch,
} from './bank-scorer-utils';

export const bankToolSelectionScorer = createScorer({
  id: 'bank-tool-selection-scorer',
  name: 'Bank Tool Selection Accuracy',
  description:
    'Deterministic check that the agent calls the correct pricing tool for Arion vs Landsbankinn based on target URLs, bank names, and comparison intent.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const userText =
      getUserMessageFromRunInput(run.input) ??
      extractInputMessages(run.input).join('\n') ??
      '';

    const expectation = resolveBankToolIntent(userText, run.groundTruth);
    const actualTools = extractPricingToolCalls(run.output);
    const evaluation = scoreToolSelectionMatch(
      expectation.intent,
      expectation.expectedTool,
      actualTools,
    );

    return {
      userText,
      ...expectation,
      actualTools,
      ...evaluation,
    };
  })
  .generateScore(({ results }) => results.preprocessStepResult?.score ?? 0)
  .generateReason(({ results, score }) => {
    const r = results.preprocessStepResult;
    if (!r) {
      return `Score=${score}. Missing preprocess data.`;
    }

    return [
      `Score=${score}.`,
      r.detail,
      `Intent=${r.intent}, expected=${r.expectedTool}, actual=[${r.actualTools.join(', ') || 'none'}].`,
      r.matchedUrls.length > 0
        ? `URLs=${r.matchedUrls.join(', ')}.`
        : 'No bank URLs in user text.',
      r.reason,
    ].join(' ');
  });

export const bankPipelineLatencyCostScorer = createScorer({
  id: 'bank-pipeline-latency-cost-scorer',
  name: 'Bank Pipeline Latency & Cost',
  description:
    'Tracks per-bank tool execution time and LLM token usage against disk-read budgets to ensure the pre-scraped pricing pipeline stays efficient.',
  type: 'agent',
})
  .preprocess(({ run }) => {
    const metrics = collectBankPipelineMetrics(run.output);
    const efficiency = scorePipelineEfficiency(metrics, DEFAULT_PIPELINE_BUDGETS);

    return {
      metrics,
      budgets: DEFAULT_PIPELINE_BUDGETS,
      dimensions: efficiency.dimensions,
    };
  })
  .generateScore(
    ({ results }) =>
      scorePipelineEfficiency(
        results.preprocessStepResult?.metrics ?? {
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
        },
        results.preprocessStepResult?.budgets ?? DEFAULT_PIPELINE_BUDGETS,
      ).score,
  )
  .generateReason(({ results, score }) => {
    const r = results.preprocessStepResult;
    if (!r) {
      return `Score=${score}. Missing preprocess data.`;
    }

    const m = r.metrics;
    const dimensionSummary = Object.entries(r.dimensions)
      .map(([name, value]) => `${name}=${value.toFixed(2)}`)
      .join(', ');

    return [
      `Score=${score.toFixed(2)}.`,
      `Tools: arion=${m.arionCalls}, landsbankinn=${m.landsbankinnCalls}, compare=${m.compareCalls}.`,
      `DurationMs: arion=${m.arionDurationMs}, landsbankinn=${m.landsbankinnDurationMs}, compare=${m.compareDurationMs}, total=${m.totalToolDurationMs}.`,
      `Tokens: prompt=${m.promptTokens}, completion=${m.completionTokens}, total=${m.totalTokens}, modelSteps=${m.modelGenerations}.`,
      dimensionSummary ? `Dimensions: ${dimensionSummary}.` : 'No timed tool steps recorded.',
    ].join(' ');
  });

export const bankComparisonScorers = {
  bankToolSelectionScorer,
  bankPipelineLatencyCostScorer,
};
