/**
 * Increment 17, Stage D9 — CANONICAL TITLE NORMALISATION, computed in
 * application/domain code.
 *
 * The product owner approved an architecture change: `occupation.title_normalised`
 * is no longer a database-generated column produced by a database
 * `normalise_title()` function. Clear Routes computes the canonical normalised
 * title HERE, before persistence, and the database stores exactly that supplied
 * canonical value while continuing to enforce NOT NULL, the frozen
 * uniqueness/partial-uniqueness rules and the frozen search indexes.
 *
 * This module is pure and total: text in, canonical text out. It reads no
 * database, no network, no environment, no clock and no ambient state. It is
 * NOT authority to apply any hosted relational change.
 *
 * The normalisation BEHAVIOUR is unchanged from the frozen Stage D4 contract.
 * Only the place of computation moved.
 */

import { NORMALISE_TITLE_OPERATIONS, type NormaliseTitleOperation } from "./d4-decisions";

/** Version of the Stage D9 canonical-title contract document itself. */
export const LOCAL_REALITY_D9_TITLE_CONTRACT_VERSION = "1.0.0" as const;

/**
 * The canonical operation order, restated from the frozen Stage D4 authority
 * rather than re-declared, so the two can never drift.
 */
export const CANONICAL_TITLE_OPERATION_ORDER: readonly NormaliseTitleOperation[] =
  NORMALISE_TITLE_OPERATIONS;

/**
 * Unicode mechanism actually used, recorded exactly. Standard Unicode handling
 * only: canonical decomposition plus combining-mark removal. There is no
 * `unaccent`, no accent lookup table, no transliteration package and no
 * locale-specific title rule.
 */
export const CANONICAL_TITLE_UNICODE_MECHANISM = Object.freeze({
  caseFolding: "String.prototype.toLowerCase (locale-independent)" as const,
  punctuationRemoval:
    "Unicode-aware: every character that is not a Unicode letter, number, combining mark or whitespace becomes a single space separator, so punctuation can never concatenate adjacent words." as const,
  diacriticRemoval:
    'String.prototype.normalize("NFD") canonical decomposition followed by removal of Unicode combining marks (\\p{M}).' as const,
  whitespaceCollapse:
    "All Unicode whitespace runs collapse to a single ASCII space, then the result is trimmed." as const,
  transliterationMap: null,
  localeDependent: false as const,
  unaccentUsed: false as const,
});

/**
 * Explicit prohibitions on this normaliser. Canonical relational identity must
 * never alter word morphology or meaning.
 */
export const CANONICAL_TITLE_PROHIBITIONS = Object.freeze([
  "No singularisation or pluralisation.",
  "No stemming, lemmatisation or suffix stripping.",
  "No morphology of any kind.",
  "No synonym expansion, translation or generative rewriting.",
  "No semantic or embedding-based matching.",
  "No AI or model-derived transformation.",
  "No hand-written transliteration or accent mapping table.",
  "No career-specific or domain-specific word transformation.",
  "No database, network, environment, clock or ambient state dependency.",
] as const);

/**
 * Anything that is not a Unicode letter, number, combining mark or whitespace.
 * Combining marks are deliberately preserved at the punctuation step so that
 * the frozen operation order (punctuation BEFORE diacritics) stays exact.
 */
const NON_CANONICAL_CHARACTER = /[^\p{L}\p{N}\p{M}\s]/gu;
const COMBINING_MARK = /\p{M}/gu;
const WHITESPACE_RUN = /\s+/gu;

/**
 * The single canonical title normaliser, applying EXACTLY the frozen operation
 * order: lowercase, remove punctuation, remove diacritics, collapse whitespace.
 *
 * Pure, deterministic and idempotent.
 */
export function normaliseCanonicalTitle(title: string): string {
  const lowercased = title.toLowerCase();
  const punctuationRemoved = lowercased.replace(NON_CANONICAL_CHARACTER, " ");
  const diacriticsRemoved = punctuationRemoved.normalize("NFD").replace(COMBINING_MARK, "");
  return diacriticsRemoved.replace(WHITESPACE_RUN, " ").trim();
}

/** True when `candidate` is already exactly the canonical form of itself. */
export function isCanonicalTitleNormalised(candidate: string): boolean {
  return normaliseCanonicalTitle(candidate) === candidate;
}

/**
 * Stable rejection codes at the persistence boundary. A caller can never
 * persist an arbitrary mismatching canonical value.
 */
export const CANONICAL_TITLE_WRITE_REJECTIONS = Object.freeze([
  "canonical_title_blank",
  "title_normalised_blank",
  "title_normalised_mismatch",
] as const);
export type CanonicalTitleWriteRejection = (typeof CANONICAL_TITLE_WRITE_REJECTIONS)[number];

export class CanonicalTitleWriteError extends Error {
  readonly rejection: CanonicalTitleWriteRejection;

  constructor(rejection: CanonicalTitleWriteRejection, message: string) {
    super(message);
    this.name = "CanonicalTitleWriteError";
    this.rejection = rejection;
  }
}

/**
 * The exact value pair any occupation create/update write path must carry. There
 * is no third way to produce `titleNormalised`.
 */
export interface OccupationTitleWriteValues {
  /** Authored canonical title, stored exactly as authored. */
  readonly canonicalTitle: string;
  /** Derived canonical normalised title. Always `normaliseCanonicalTitle(canonicalTitle)`. */
  readonly titleNormalised: string;
}

/**
 * The ONLY authored way to produce occupation title write values: the normalised
 * value is always derived, never accepted from a caller.
 */
export function buildOccupationTitleWriteValues(
  canonicalTitle: string,
): OccupationTitleWriteValues {
  if (canonicalTitle.trim().length === 0) {
    throw new CanonicalTitleWriteError(
      "canonical_title_blank",
      "canonical_title must carry authored content.",
    );
  }
  const titleNormalised = normaliseCanonicalTitle(canonicalTitle);
  if (titleNormalised.length === 0) {
    throw new CanonicalTitleWriteError(
      "title_normalised_blank",
      "The authored canonical_title normalises to an empty canonical identity, so it cannot be persisted.",
    );
  }
  return Object.freeze({ canonicalTitle, titleNormalised });
}

/**
 * Boundary guard for a write whose `title_normalised` arrived from elsewhere
 * (for example an adapter payload or an untrusted mapper). It fails closed on
 * any value that is not exactly the canonical derivation, so a mismatching
 * canonical title can never cross the persistence boundary.
 */
export function assertOccupationTitleWriteValues(candidate: {
  readonly canonicalTitle: string;
  readonly titleNormalised: string;
}): OccupationTitleWriteValues {
  const derived = buildOccupationTitleWriteValues(candidate.canonicalTitle);
  if (candidate.titleNormalised !== derived.titleNormalised) {
    throw new CanonicalTitleWriteError(
      "title_normalised_mismatch",
      "Supplied title_normalised does not equal the canonical normalisation of canonical_title.",
    );
  }
  return derived;
}
