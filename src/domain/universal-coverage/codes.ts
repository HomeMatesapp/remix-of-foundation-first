/**
 * Frozen catalogues for the Universal Reality Check Coverage Layer
 * (Increment 13).
 *
 * Stable internal machine vocabulary only: no participant-facing prose, no
 * score, no confidence, no operational workflow vocabulary, no Reality Check
 * judgement value and no requirement state.
 *
 * Binding principle for every code declared here: **automatic assembly, not
 * automatic invention.** A code may declare that career-specific truth is NOT
 * yet available; no code may ever assert career-specific truth.
 */

/* -------------------------------------------------------------------------- */
/* Coverage outcomes                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The four — and only four — coverage outcomes.
 *
 * `full_assessment_available` means an exact, validated Career Pack is bound to
 * one canonical occupation, so the existing engine-backed pathway may be
 * offered. This layer does NOT run that engine.
 */
export const REALITY_CHECK_COVERAGE_OUTCOMES = Object.freeze([
  "full_assessment_available",
  "provisional_assessment_available",
  "clarification_required",
  "demand_capture_required",
] as const);
export type RealityCheckCoverageOutcome = (typeof REALITY_CHECK_COVERAGE_OUTCOMES)[number];

/**
 * Depth of career-specific decision support actually available.
 *
 * There are exactly two honest values at this layer: an exact validated Career
 * Pack is bound, or career-specific depth is not yet supported. No intermediate
 * "partial" depth is invented, because nothing at this layer may estimate how
 * complete unresearched career content would be.
 */
export const COVERAGE_SUPPORT_DEPTHS = Object.freeze([
  "exact_career_pack",
  "not_yet_supported",
] as const);
export type CoverageSupportDepth = (typeof COVERAGE_SUPPORT_DEPTHS)[number];

/* -------------------------------------------------------------------------- */
/* Catalogue issue codes                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Why a set of available Career Packs cannot form a deterministic coverage
 * catalogue. Every code fails CLOSED: no partial catalogue is ever returned.
 */
export const COVERAGE_CATALOGUE_ISSUE_CODES = Object.freeze([
  /** The supplied pack document is not a valid canonical Career Pack. */
  "pack_invalid",
  /** The pack's occupation reference does not bind to exactly one occupation. */
  "pack_occupation_unbound",
  /**
   * Two or more materially different packs claim the same canonical occupation.
   * Frozen governance supplies no current-version selection semantic at this
   * layer, so neither SemVer order nor caller array order may decide.
   */
  "competing_pack_support",
  /** The same pack identity was supplied twice with different content. */
  "conflicting_pack_content",
] as const);
export type CoverageCatalogueIssueCode = (typeof COVERAGE_CATALOGUE_ISSUE_CODES)[number];

export interface CoverageCatalogueIssue {
  readonly code: CoverageCatalogueIssueCode;
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

/* -------------------------------------------------------------------------- */
/* Provisional limitation codes                                               */
/* -------------------------------------------------------------------------- */

/**
 * Structural statements of ABSENCE, declared by a provisional plan.
 *
 * Each code says only "this class of career-specific truth is not available or
 * verified here". None of them classifies, grades, infers or asserts anything
 * about the occupation.
 */
export const PROVISIONAL_LIMITATION_CODES = Object.freeze([
  "career_specific_decision_depth_not_reviewed",
  "career_specific_entry_pathway_truth_unavailable",
  "career_specific_condition_truth_unavailable",
  "career_specific_source_review_unavailable",
  "local_context_truth_unavailable",
] as const);
export type ProvisionalLimitationCode = (typeof PROVISIONAL_LIMITATION_CODES)[number];

/* -------------------------------------------------------------------------- */
/* Escalation / capture action codes                                          */
/* -------------------------------------------------------------------------- */

/**
 * Pure descriptors for what a later adapter, human reviewer or persistence
 * layer must do. No workflow, no queue, no table, no assignee and no prose.
 */
export const COVERAGE_ESCALATION_CODES = Object.freeze([
  "content_review_needed",
  "adviser_escalation_needed",
  "participant_interest_capture_needed",
  "unrecognised_intent_capture_needed",
] as const);
export type CoverageEscalationCode = (typeof COVERAGE_ESCALATION_CODES)[number];

/* -------------------------------------------------------------------------- */
/* Runtime trust-boundary issue codes                                         */
/* -------------------------------------------------------------------------- */

/**
 * Why untrusted runtime input supplied at the PUBLIC coverage boundary cannot be
 * reconciled against canonical truth.
 *
 * TypeScript types are not a runtime trust boundary: a caller can hand this
 * layer an arbitrary object shaped like a canonical universe or like a resolved
 * occupation. Every code here fails CLOSED — a contradiction is never degraded
 * to provisional support, and never silently carried into output.
 */
export const COVERAGE_TRUST_ISSUE_CODES = Object.freeze([
  /** The supplied occupation universe is not a valid canonical universe. */
  "occupation_universe_invalid",
  /** The supplied occupation resolution is structurally invalid. */
  "occupation_resolution_invalid",
  /** The supplied resolution contradicts canonical occupation truth. */
  "occupation_resolution_mismatch",
] as const);
export type CoverageTrustIssueCode = (typeof COVERAGE_TRUST_ISSUE_CODES)[number];

export interface CoverageTrustIssue {
  readonly code: CoverageTrustIssueCode;
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

/** Any reason the public safe coverage resolver failed closed. */
export type CoverageResolutionIssue = CoverageCatalogueIssue | CoverageTrustIssue;
