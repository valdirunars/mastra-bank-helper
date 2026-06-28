import type { BankPricingCatalog } from './bank-pricing-schemas';
import { expandTopicTerms, matchesTopic } from './topic-matching';

export function filterCatalogByTopic(
  catalog: BankPricingCatalog,
  topic?: string,
): BankPricingCatalog {
  if (!topic?.trim()) {
    return catalog;
  }

  const terms = expandTopicTerms(topic);
  const pricing_items = catalog.pricing_items.filter((item) =>
    matchesTopic(item.description, terms),
  );
  const rate_items = catalog.rate_items.filter(
    (item) =>
      matchesTopic(item.product, terms) || matchesTopic(item.section, terms),
  );

  return {
    ...catalog,
    pricing_items,
    rate_items,
  };
}
