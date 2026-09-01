/**
 * The single deterministic UK-first query/term normaliser.
 *
 * Normalisation exists ONLY for indexing and comparison. Authored occupation
 * titles and terms are stored and returned exactly as authored — this module
 * never rewrites canonical content.
 *
 * Deliberately conservative. There is no stemming, no lemmatisation, no synonym
 * expansion, no semantic embedding, no AI paraphrase and no aggressive
 * punctuation deletion, because every one of those can merge genuinely distinct
 * occupation titles (for example `nurse` and `nursery`, or `HGV` and `H.G.V.`
 * against unrelated abbreviations).
 */

/**
 * Deterministic normalisation:
 * 1. Unicode compatibility composition (`NFKC`) so visually identical authored
 *    forms compare equal;
 * 2. all Unicode whitespace runs collapsed to a single ASCII space;
 * 3. leading/trailing whitespace trimmed;
 * 4. case folded with the locale-independent `toLowerCase()`.
 *
 * `toLocaleLowerCase` is intentionally NOT used: it would make matching depend
 * on the ambient environment locale.
 */
export function normaliseOccupationText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLowerCase();
}

/** Deterministic token split of an already-normalised string. */
export function normalisedTokens(normalised: string): readonly string[] {
  return normalised.length === 0 ? [] : normalised.split(" ");
}

/** True when the normalised query carries no comparable content at all. */
export function isBlankNormalised(normalised: string): boolean {
  return normalised.length === 0;
}
