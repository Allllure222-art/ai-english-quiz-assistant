import juniorLemmas from './data/juniorCoreLemmas.json'

/** ~1200 high-frequency lemmas (lowercase); rare words = tokens not in this set (after light normalization). */
export const JUNIOR_CORE_LEMMA_SET = new Set(juniorLemmas)
