/**
 * Frozen catalogues for the Occupation Universe & Search domain (Increment 12).
 *
 * Stable internal codes only. No participant-facing prose, no scores, no AI
 * metadata and no operational vocabulary lives here.
 */

/* -------------------------------------------------------------------------- */
/* Term categories                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Semantic category of an authored, searchable occupation term.
 *
 * `canonical_title` is the single owning full title of an occupation. Every
 * other category is a legitimate non-canonical way people express the same
 * occupation intent.
 */
export const OCCUPATION_TERM_CATEGORIES = Object.freeze([
  "canonical_title",
  "specialism",
  "alias",
  "abbreviation",
  "colloquial",
  "emerging",
] as const);
export type OccupationTermCategory = (typeof OCCUPATION_TERM_CATEGORIES)[number];

/** Authored (non-canonical) collection categories, in canonical order. */
export const OCCUPATION_AUTHORED_TERM_CATEGORIES = Object.freeze([
  "specialism",
  "alias",
  "abbreviation",
  "colloquial",
  "emerging",
] as const);
export type OccupationAuthoredTermCategory = (typeof OCCUPATION_AUTHORED_TERM_CATEGORIES)[number];

/* -------------------------------------------------------------------------- */
/* Bounds                                                                     */
/* -------------------------------------------------------------------------- */

/** Maximum authored title/term length. Deliberately generous but bounded. */
export const OCCUPATION_TITLE_MAX_LENGTH = 160;

/** Minimum canonical-title length; a one-character title is never legitimate. */
export const OCCUPATION_CANONICAL_TITLE_MIN_LENGTH = 3;

/* -------------------------------------------------------------------------- */
/* Universe validation issue codes                                            */
/* -------------------------------------------------------------------------- */

export const OCCUPATION_UNIVERSE_ISSUE_CODES = Object.freeze([
  "schema_invalid",
  "duplicate_occupation_id",
  "duplicate_occupation_key",
  "duplicate_canonical_title",
  "duplicate_term_within_occupation",
  "canonical_title_conflict",
] as const);
export type OccupationUniverseIssueCode = (typeof OCCUPATION_UNIVERSE_ISSUE_CODES)[number];

export interface OccupationUniverseIssue {
  readonly code: OccupationUniverseIssueCode;
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

export interface OccupationUniverseValidationResult {
  readonly valid: boolean;
  readonly issues: readonly OccupationUniverseIssue[];
}

/* -------------------------------------------------------------------------- */
/* Resolution outcome codes                                                   */
/* -------------------------------------------------------------------------- */

export const OCCUPATION_MATCH_MODES = Object.freeze(["exact", "normalised", "fuzzy"] as const);
export type OccupationMatchMode = (typeof OCCUPATION_MATCH_MODES)[number];

export const OCCUPATION_CLARIFICATION_REASONS = Object.freeze([
  "generic_collision_word",
  "exact_term_collision",
  "normalised_term_collision",
  "fuzzy_collision",
] as const);
export type OccupationClarificationReason = (typeof OCCUPATION_CLARIFICATION_REASONS)[number];

export const OCCUPATION_UNMATCHED_REASONS = Object.freeze([
  "blank_query",
  "no_match",
  "below_fuzzy_threshold",
] as const);
export type OccupationUnmatchedReason = (typeof OCCUPATION_UNMATCHED_REASONS)[number];

/* -------------------------------------------------------------------------- */
/* Career Pack binding issue codes                                            */
/* -------------------------------------------------------------------------- */

export const OCCUPATION_BINDING_ISSUE_CODES = Object.freeze([
  "unknown_occupation_id",
  "unknown_occupation_key",
  "identity_mismatch",
] as const);
export type OccupationBindingIssueCode = (typeof OCCUPATION_BINDING_ISSUE_CODES)[number];

/* -------------------------------------------------------------------------- */
/* Protected generic collision words                                          */
/* -------------------------------------------------------------------------- */

/**
 * Generic single words that are shared across many real UK occupations.
 *
 * A query consisting of nothing but one of these words expresses no safe
 * occupation intent, so it must NEVER auto-resolve — not even when the current
 * catalogue happens to hold exactly one plausible candidate. `advisor` is the
 * common alternative spelling of `adviser` and is protected identically.
 *
 * Values are stored already query-normalised (lowercase, single tokens).
 */
export const PROTECTED_GENERIC_COLLISION_WORDS: readonly string[] = Object.freeze([
  "adviser",
  "advisor",
  "assistant",
  "associate",
  "consultant",
  "coordinator",
  "director",
  "engineer",
  "executive",
  "manager",
  "officer",
  "specialist",
  "technician",
] as const);
