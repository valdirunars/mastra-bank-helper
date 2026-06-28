import type { BankPricingCatalog, PricingItem, RateItem } from './bank-pricing-schemas';
import { matchesTopic, normalizeText } from './topic-matching';

export type ComparisonFocus = 'rates' | 'pricing' | 'all';

export interface PricingComparisonRow {
  topic: string;
  arion: { description: string; amount: string; unit: string } | null;
  landsbankinn: { description: string; amount: string; unit: string } | null;
  matchScore: number;
}

export interface RateComparisonRow {
  topic: string;
  arion: { product: string; rate: string; section: string } | null;
  landsbankinn: { product: string; rate: string; section: string } | null;
  matchScore: number;
}

export interface BankPricingComparison {
  comparedAt: string;
  focus: ComparisonFocus;
  topic: string | null;
  sources: {
    arion: { url: string; pricingDocument: string | null; ratesDocument: string | null };
    landsbankinn: {
      url: string;
      pricingDocument: string | null;
      ratesDocument: string | null;
    };
  };
  summary: {
    pricingMatches: number;
    rateMatches: number;
    arionOnlyPricing: number;
    landsbankinnOnlyPricing: number;
    arionOnlyRates: number;
    landsbankinnOnlyRates: number;
  };
  pricingComparisons: PricingComparisonRow[];
  rateComparisons: RateComparisonRow[];
  arionOnlyPricing: PricingItem[];
  landsbankinnOnlyPricing: PricingItem[];
  arionOnlyRates: RateItem[];
  landsbankinnOnlyRates: RateItem[];
}

const STOP_WORDS = new Set([
  'og',
  'eða',
  'í',
  'á',
  'um',
  'til',
  'frá',
  'við',
  'the',
  'and',
  'for',
  'kort',
  'kredit',
]);

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function matchScore(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function matchesTopicFilter(text: string, topic: string): boolean {
  return matchesTopic(text, topic);
}

function latestDocumentTitle(
  catalog: BankPricingCatalog,
  documentType: 'pricing' | 'rates',
): string | null {
  const docs = catalog.documents.filter((doc) => doc.document_type === documentType);
  if (docs.length === 0) {
    return null;
  }

  const dated = docs.filter((doc) => doc.effective_date);
  if (dated.length > 0) {
    return dated[0]?.title ?? docs[0]?.title ?? null;
  }

  return docs[0]?.title ?? null;
}

function filterByLatestDocument<T extends { document_title: string }>(
  items: T[],
  latestTitle: string | null,
): T[] {
  if (!latestTitle) {
    return items;
  }
  const filtered = items.filter((item) => item.document_title === latestTitle);
  return filtered.length > 0 ? filtered : items;
}

function pairItems<T extends { description?: string; product?: string }>(
  arionItems: T[],
  landsbankinnItems: T[],
  labelFn: (item: T) => string,
  minScore = 0.35,
): {
  pairs: Array<{ arion: T; landsbankinn: T; score: number }>;
  arionOnly: T[];
  landsbankinnOnly: T[];
} {
  const pairs: Array<{ arion: T; landsbankinn: T; score: number }> = [];
  const usedLandsbankinn = new Set<number>();

  for (const arionItem of arionItems) {
    let bestIndex = -1;
    let bestScore = 0;

    landsbankinnItems.forEach((landsbankinnItem, index) => {
      if (usedLandsbankinn.has(index)) {
        return;
      }
      const score = matchScore(labelFn(arionItem), labelFn(landsbankinnItem));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestScore >= minScore) {
      usedLandsbankinn.add(bestIndex);
      pairs.push({
        arion: arionItem,
        landsbankinn: landsbankinnItems[bestIndex]!,
        score: bestScore,
      });
    }
  }

  const matchedArion = new Set(pairs.map((pair) => pair.arion));
  const arionOnly = arionItems.filter((item) => !matchedArion.has(item));
  const landsbankinnOnly = landsbankinnItems.filter(
    (_, index) => !usedLandsbankinn.has(index),
  );

  return { pairs, arionOnly, landsbankinnOnly };
}

export function compareBankPricing(
  arion: BankPricingCatalog,
  landsbankinn: BankPricingCatalog,
  options: { topic?: string; focus?: ComparisonFocus } = {},
): BankPricingComparison {
  const focus = options.focus ?? 'all';
  const topic = options.topic?.trim() || null;

  const arionPricingDoc = latestDocumentTitle(arion, 'pricing');
  const landsbankinnPricingDoc = latestDocumentTitle(landsbankinn, 'pricing');
  const arionRatesDoc = latestDocumentTitle(arion, 'rates');
  const landsbankinnRatesDoc = latestDocumentTitle(landsbankinn, 'rates');

  let arionPricing = filterByLatestDocument(arion.pricing_items, arionPricingDoc);
  let landsbankinnPricing = filterByLatestDocument(
    landsbankinn.pricing_items,
    landsbankinnPricingDoc,
  );
  let arionRates = filterByLatestDocument(arion.rate_items, arionRatesDoc);
  let landsbankinnRates = filterByLatestDocument(
    landsbankinn.rate_items,
    landsbankinnRatesDoc,
  );

  if (topic) {
    arionPricing = arionPricing.filter((item) =>
      matchesTopicFilter(item.description, topic),
    );
    landsbankinnPricing = landsbankinnPricing.filter((item) =>
      matchesTopicFilter(item.description, topic),
    );
    arionRates = arionRates.filter(
      (item) =>
        matchesTopicFilter(item.product, topic) ||
        matchesTopicFilter(item.section, topic),
    );
    landsbankinnRates = landsbankinnRates.filter(
      (item) =>
        matchesTopicFilter(item.product, topic) ||
        matchesTopicFilter(item.section, topic),
    );
  }

  const pricingPairs =
    focus === 'rates'
      ? { pairs: [], arionOnly: arionPricing, landsbankinnOnly: landsbankinnPricing }
      : pairItems(
          arionPricing,
          landsbankinnPricing,
          (item) => item.description ?? '',
        );

  const ratePairs =
    focus === 'pricing'
      ? { pairs: [], arionOnly: arionRates, landsbankinnOnly: landsbankinnRates }
      : pairItems(arionRates, landsbankinnRates, (item) => item.product ?? '');

  return {
    comparedAt: new Date().toISOString(),
    focus,
    topic,
    sources: {
      arion: {
        url: arion.source_url,
        pricingDocument: arionPricingDoc,
        ratesDocument: arionRatesDoc,
      },
      landsbankinn: {
        url: landsbankinn.source_url,
        pricingDocument: landsbankinnPricingDoc,
        ratesDocument: landsbankinnRatesDoc,
      },
    },
    summary: {
      pricingMatches: pricingPairs.pairs.length,
      rateMatches: ratePairs.pairs.length,
      arionOnlyPricing: pricingPairs.arionOnly.length,
      landsbankinnOnlyPricing: pricingPairs.landsbankinnOnly.length,
      arionOnlyRates: ratePairs.arionOnly.length,
      landsbankinnOnlyRates: ratePairs.landsbankinnOnly.length,
    },
    pricingComparisons: pricingPairs.pairs
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(({ arion: arionItem, landsbankinn: landsbankinnItem, score }) => ({
        topic: arionItem.description,
        arion: {
          description: arionItem.description,
          amount: arionItem.amount,
          unit: arionItem.unit,
        },
        landsbankinn: {
          description: landsbankinnItem.description,
          amount: landsbankinnItem.amount,
          unit: landsbankinnItem.unit,
        },
        matchScore: Number(score.toFixed(2)),
      })),
    rateComparisons: ratePairs.pairs
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(({ arion: arionItem, landsbankinn: landsbankinnItem, score }) => ({
        topic: arionItem.product,
        arion: {
          product: arionItem.product,
          rate: arionItem.rate,
          section: arionItem.section,
        },
        landsbankinn: {
          product: landsbankinnItem.product,
          rate: landsbankinnItem.rate,
          section: landsbankinnItem.section,
        },
        matchScore: Number(score.toFixed(2)),
      })),
    arionOnlyPricing: pricingPairs.arionOnly.slice(0, 25),
    landsbankinnOnlyPricing: pricingPairs.landsbankinnOnly.slice(0, 25),
    arionOnlyRates: ratePairs.arionOnly.slice(0, 25),
    landsbankinnOnlyRates: ratePairs.landsbankinnOnly.slice(0, 25),
  };
}
