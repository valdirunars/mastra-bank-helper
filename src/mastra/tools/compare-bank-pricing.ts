import type { BankPricingCatalog, PricingItem, RateItem, CustomerNeeds } from './bank-pricing-schemas';
import {
  formatCustomerNeedsSummary,
  matchesCreditCardPreference,
  matchesProductNeeds,
  resolveFocusFromNeeds,
  resolveTopicFromNeeds,
} from './customer-needs';
import { matchesTopic, normalizeText } from './topic-matching';

import type { ScraperLocale } from './scraper-config';

export type ComparisonFocus = 'rates' | 'pricing' | 'all';
export type ComparisonAudience = 'individuals' | 'business' | 'all';

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
  audience?: ComparisonAudience;
  customerNeeds?: CustomerNeeds;
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
  summaryText: string;
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

function matchesAudience(text: string, audience: ComparisonAudience): boolean {
  if (audience === 'all') {
    return true;
  }

  const normalized = normalizeText(text);
  const individualTerms = [
    'einstakling',
    'neytend',
    'almennt kreditkort',
    'einkareikning',
    'individual',
    'retail',
    'personal',
  ];
  const businessTerms = [
    'fyrirtæk',
    'lóg aðila',
    'logadila',
    'viðskipta',
    'business',
    'corporate',
    'legal entit',
  ];

  if (audience === 'individuals') {
    return !businessTerms.some((term) => normalized.includes(term));
  }

  return businessTerms.some((term) => normalized.includes(term));
}

function formatComparisonSummary(
  comparison: Omit<BankPricingComparison, 'summaryText'>,
  language: ScraperLocale = 'is',
): string {
  const topicLabel = comparison.topic ?? (language === 'en' ? 'general pricing' : 'almenn verðlagning');
  const profileSummary = formatCustomerNeedsSummary(comparison.customerNeeds, language);
  const audienceLabel =
    comparison.audience === 'business'
      ? language === 'en'
        ? 'business'
        : 'fyrirtæki'
      : comparison.audience === 'all'
        ? language === 'en'
          ? 'all customers'
          : 'allir'
        : language === 'en'
          ? 'individuals'
          : 'einstaklingar';

  const lines = [
    language === 'en'
      ? `Comparison: ${topicLabel} (${comparison.focus}, ${audienceLabel})`
      : `Samanburður: ${topicLabel} (${comparison.focus}, ${audienceLabel})`,
  ];

  if (profileSummary) {
    lines.push(
      language === 'en'
        ? `Customer profile: ${profileSummary}`
        : `Notandi: ${profileSummary}`,
    );
  }

  lines.push('');

  if (comparison.pricingComparisons.length > 0) {
    lines.push(language === 'en' ? 'Matched fees/charges:' : 'Samsvarandi gjöld:');
    for (const row of comparison.pricingComparisons.slice(0, 10)) {
      lines.push(
        `- ${row.topic}: Arion ${row.arion?.amount ?? 'n/a'} vs Landsbankinn ${row.landsbankinn?.amount ?? 'n/a'}`,
      );
    }
    lines.push('');
  }

  if (comparison.rateComparisons.length > 0) {
    lines.push(language === 'en' ? 'Matched rates:' : 'Samsvarandi vextir:');
    for (const row of comparison.rateComparisons.slice(0, 10)) {
      lines.push(
        `- ${row.topic}: Arion ${row.arion?.rate ?? 'n/a'} vs Landsbankinn ${row.landsbankinn?.rate ?? 'n/a'}`,
      );
    }
    lines.push('');
  }

  if (comparison.arionOnlyPricing.length > 0) {
    lines.push(language === 'en' ? 'Arion-only fees (sample):' : 'Gjöld eingöngu hjá Arion (dæmi):');
    for (const item of comparison.arionOnlyPricing.slice(0, 5)) {
      lines.push(`- ${item.description}: ${item.amount}`);
    }
    lines.push('');
  }

  if (comparison.landsbankinnOnlyPricing.length > 0) {
    lines.push(
      language === 'en'
        ? 'Landsbankinn-only fees (sample):'
        : 'Gjöld eingöngu hjá Landsbankinn (dæmi):',
    );
    for (const item of comparison.landsbankinnOnlyPricing.slice(0, 5)) {
      lines.push(`- ${item.description}: ${item.amount}`);
    }
    lines.push('');
  }

  lines.push(
    language === 'en'
      ? `Sources: Arion ${comparison.sources.arion.pricingDocument ?? comparison.sources.arion.ratesDocument ?? 'PDF'}; Landsbankinn ${comparison.sources.landsbankinn.pricingDocument ?? comparison.sources.landsbankinn.ratesDocument ?? 'PDF'}.`
      : `Heimildir: Arion ${comparison.sources.arion.pricingDocument ?? comparison.sources.arion.ratesDocument ?? 'PDF'}; Landsbankinn ${comparison.sources.landsbankinn.pricingDocument ?? comparison.sources.landsbankinn.ratesDocument ?? 'PDF'}.`,
  );

  return lines.join('\n');
}

export function compareBankPricing(
  arion: BankPricingCatalog,
  landsbankinn: BankPricingCatalog,
  options: {
    topic?: string;
    focus?: ComparisonFocus;
    audience?: ComparisonAudience;
    language?: ScraperLocale;
    customerNeeds?: CustomerNeeds;
  } = {},
): BankPricingComparison {
  const customerNeeds = options.customerNeeds;
  const focus = resolveFocusFromNeeds(options.focus, customerNeeds);
  const topic = resolveTopicFromNeeds(options.topic, customerNeeds);
  const audience = options.audience ?? 'individuals';
  const language = options.language ?? 'is';

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
  } else if (customerNeeds?.products?.length) {
    arionPricing = arionPricing.filter((item) =>
      matchesProductNeeds(item.description, customerNeeds),
    );
    landsbankinnPricing = landsbankinnPricing.filter((item) =>
      matchesProductNeeds(item.description, customerNeeds),
    );
    arionRates = arionRates.filter(
      (item) =>
        matchesProductNeeds(item.product, customerNeeds) ||
        matchesProductNeeds(item.section, customerNeeds),
    );
    landsbankinnRates = landsbankinnRates.filter(
      (item) =>
        matchesProductNeeds(item.product, customerNeeds) ||
        matchesProductNeeds(item.section, customerNeeds),
    );
  }

  if (customerNeeds) {
    arionPricing = arionPricing.filter((item) =>
      matchesCreditCardPreference(item.description, customerNeeds),
    );
    landsbankinnPricing = landsbankinnPricing.filter((item) =>
      matchesCreditCardPreference(item.description, customerNeeds),
    );
    arionRates = arionRates.filter(
      (item) =>
        matchesCreditCardPreference(item.product, customerNeeds) ||
        matchesCreditCardPreference(item.section, customerNeeds),
    );
    landsbankinnRates = landsbankinnRates.filter(
      (item) =>
        matchesCreditCardPreference(item.product, customerNeeds) ||
        matchesCreditCardPreference(item.section, customerNeeds),
    );
  }

  if (audience !== 'all') {
    arionPricing = arionPricing.filter((item) =>
      matchesAudience(item.description, audience),
    );
    landsbankinnPricing = landsbankinnPricing.filter((item) =>
      matchesAudience(item.description, audience),
    );
    arionRates = arionRates.filter(
      (item) =>
        matchesAudience(item.product, audience) ||
        matchesAudience(item.section, audience),
    );
    landsbankinnRates = landsbankinnRates.filter(
      (item) =>
        matchesAudience(item.product, audience) ||
        matchesAudience(item.section, audience),
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

  return buildComparisonResult(
    arion,
    landsbankinn,
    focus,
    topic,
    audience,
    customerNeeds,
    arionPricingDoc,
    landsbankinnPricingDoc,
    arionRatesDoc,
    landsbankinnRatesDoc,
    pricingPairs,
    ratePairs,
    language,
  );
}

function buildComparisonResult(
  arion: BankPricingCatalog,
  landsbankinn: BankPricingCatalog,
  focus: ComparisonFocus,
  topic: string | null,
  audience: ComparisonAudience,
  customerNeeds: CustomerNeeds | undefined,
  arionPricingDoc: string | null,
  landsbankinnPricingDoc: string | null,
  arionRatesDoc: string | null,
  landsbankinnRatesDoc: string | null,
  pricingPairs: ReturnType<typeof pairItems<PricingItem>>,
  ratePairs: ReturnType<typeof pairItems<RateItem>>,
  language: ScraperLocale,
): BankPricingComparison {
  const comparisonWithoutSummary = {
    comparedAt: new Date().toISOString(),
    focus,
    topic,
    audience,
    customerNeeds,
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

  return {
    ...comparisonWithoutSummary,
    summaryText: formatComparisonSummary(comparisonWithoutSummary, language),
  };
}
