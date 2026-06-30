import type { BankingProduct, CustomerNeeds } from './bank-pricing-schemas';
import { matchesTopic, normalizeText } from './topic-matching';

type ComparisonFocus = 'rates' | 'pricing' | 'all';

const PRODUCT_TOPICS: Record<BankingProduct, string[]> = {
  current_account: ['veltireikningur', 'current account', 'einkareikning'],
  savings: ['sparnaður', 'sparnadur', 'savings', 'vaxtareikning'],
  credit_card: ['kreditkort', 'credit card', 'kort'],
  mortgage: ['íbúðalán', 'ibudalan', 'mortgage', 'fasteignalán'],
  loan: ['lán', 'lan', 'loan', 'neytendalán'],
  overdraft: ['yfirdráttur', 'yfirdrattur', 'overdraft'],
};

const CREDIT_CARD_PREFERENCE_TERMS: Record<
  NonNullable<CustomerNeeds['creditCardPreference']>,
  string[]
> = {
  low_fee: ['lágt', 'laagt', 'low', 'árlegt', 'annual', 'gjald', 'fee', 'kostnaður'],
  travel_rewards: [
    'ferðalag',
    'ferdalag',
    'travel',
    'erlendis',
    'abroad',
    'foreign',
    'flug',
  ],
  cashback: ['endurgreiðsla', 'endurgreidsla', 'cashback', 'punktar', 'points'],
  general: [],
};

const RATE_HEAVY_PRODUCTS = new Set<BankingProduct>(['mortgage', 'loan']);
const FEE_HEAVY_PRODUCTS = new Set<BankingProduct>([
  'current_account',
  'savings',
  'credit_card',
  'overdraft',
]);

export function productTopicTerms(product: BankingProduct): string[] {
  return PRODUCT_TOPICS[product];
}

export function resolveTopicFromNeeds(
  explicitTopic: string | null | undefined,
  needs?: CustomerNeeds,
): string | null {
  if (explicitTopic?.trim()) {
    return explicitTopic.trim();
  }

  const products = needs?.products ?? [];
  if (products.length === 1) {
    return productTopicTerms(products[0]!)[0] ?? null;
  }

  return null;
}

export function resolveFocusFromNeeds(
  explicitFocus: ComparisonFocus | undefined,
  needs?: CustomerNeeds,
): ComparisonFocus {
  if (explicitFocus) {
    return explicitFocus;
  }

  if (needs?.priority === 'best_rates') {
    return 'rates';
  }
  if (needs?.priority === 'lowest_fees') {
    return 'pricing';
  }

  const products = needs?.products ?? [];
  if (products.length === 0) {
    return 'all';
  }

  const allRateHeavy = products.every((product) => RATE_HEAVY_PRODUCTS.has(product));
  const allFeeHeavy = products.every((product) => FEE_HEAVY_PRODUCTS.has(product));

  if (allRateHeavy) {
    return 'rates';
  }
  if (allFeeHeavy) {
    return 'pricing';
  }

  return 'all';
}

export function matchesProductNeeds(text: string, needs?: CustomerNeeds): boolean {
  const products = needs?.products ?? [];
  if (products.length === 0) {
    return true;
  }

  return products.some((product) =>
    productTopicTerms(product).some((term) => matchesTopic(text, term)),
  );
}

export function matchesCreditCardPreference(text: string, needs?: CustomerNeeds): boolean {
  const preference = needs?.creditCardPreference;
  if (!preference || preference === 'general') {
    return true;
  }

  const products = needs?.products ?? [];
  if (products.length > 0 && !products.includes('credit_card')) {
    return true;
  }

  const terms = CREDIT_CARD_PREFERENCE_TERMS[preference];
  if (terms.length === 0) {
    return true;
  }

  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

export function formatCustomerNeedsSummary(
  needs: CustomerNeeds | undefined,
  language: 'is' | 'en' = 'is',
): string | null {
  if (!needs) {
    return null;
  }

  const parts: string[] = [];

  if (needs.products?.length) {
    parts.push(
      language === 'en'
        ? `Products: ${needs.products.join(', ')}`
        : `Vörur: ${needs.products.join(', ')}`,
    );
  }
  if (needs.creditCardPreference) {
    parts.push(
      language === 'en'
        ? `Credit card preference: ${needs.creditCardPreference}`
        : `Kortakostur: ${needs.creditCardPreference}`,
    );
  }
  if (needs.balanceTier) {
    parts.push(
      language === 'en'
        ? `Balance tier: ${needs.balanceTier}`
        : `Innistæða: ${needs.balanceTier}`,
    );
  }
  if (needs.priority) {
    parts.push(
      language === 'en'
        ? `Priority: ${needs.priority}`
        : `Forgangur: ${needs.priority}`,
    );
  }
  if (needs.notes?.trim()) {
    parts.push(needs.notes.trim());
  }

  return parts.length > 0 ? parts.join('; ') : null;
}
