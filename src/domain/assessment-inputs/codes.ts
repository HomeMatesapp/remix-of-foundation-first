/**
 * Frozen catalogues for Immutable Assessment Inputs.
 *
 * This package CONSUMES the already-approved primitive, question, Career Pack
 * and Evidence Registry vocabularies. It defines no judgement, requirement,
 * evidence-strength, ranking or engine vocabulary of its own.
 */

/**
 * Version of the Answer Snapshot DOCUMENT schema itself.
 *
 * Not a Career Pack version, not an evidence record version, not a governance
 * version and not a Decision Engine version.
 */
export const ANSWER_SNAPSHOT_SCHEMA_VERSION = "1.0.0" as const;

/** Version of the Evidence Context Snapshot DOCUMENT schema itself. */
export const EVIDENCE_CONTEXT_SCHEMA_VERSION = "1.0.0" as const;

/* -------------------------------------------------------------------------- */
/* Answer Snapshot issue codes                                                */
/* -------------------------------------------------------------------------- */

export const ANSWER_SNAPSHOT_ISSUE_CODES = Object.freeze([
  "schema_invalid",
  "career_pack_binding_mismatch",
  "duplicate_question",
  "unknown_question",
  "answer_kind_mismatch",
  "unknown_option_key",
  "duplicate_option_key",
  "empty_selection",
  "value_out_of_range",
  "text_invalid",
  "date_invalid",
] as const);
export type AnswerSnapshotIssueCode = (typeof ANSWER_SNAPSHOT_ISSUE_CODES)[number];

export interface AnswerSnapshotIssue {
  readonly code: AnswerSnapshotIssueCode;
  /** Internal diagnostic text. Never participant-facing copy. */
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

export interface AnswerSnapshotValidationResult {
  readonly valid: boolean;
  readonly issues: readonly AnswerSnapshotIssue[];
}

/* -------------------------------------------------------------------------- */
/* Evidence Context Snapshot issue codes                                      */
/* -------------------------------------------------------------------------- */

export const EVIDENCE_CONTEXT_ISSUE_CODES = Object.freeze([
  "schema_invalid",
  "career_pack_binding_mismatch",
  "evidence_reference_unresolved",
  "withdrawn_revision_not_usable",
  "missing_evidence_entry",
  "unknown_evidence_entry",
  "duplicate_evidence_entry",
  /**
   * A supplied entry embeds a revision that does not satisfy the Career Pack
   * evidence reference declared under the same `evidenceKey`. Deliberately
   * distinct from missing/unknown coverage codes.
   */
  "evidence_revision_reference_mismatch",
] as const);
export type EvidenceContextIssueCode = (typeof EVIDENCE_CONTEXT_ISSUE_CODES)[number];

export interface EvidenceContextIssue {
  readonly code: EvidenceContextIssueCode;
  readonly message: string;
  readonly at?: string;
}

export interface EvidenceContextValidationResult {
  readonly valid: boolean;
  readonly issues: readonly EvidenceContextIssue[];
}

/* -------------------------------------------------------------------------- */
/* Provenance assembly issue codes                                            */
/* -------------------------------------------------------------------------- */

export const ASSESSMENT_PROVENANCE_ISSUE_CODES = Object.freeze([
  "provenance_invalid",
  "career_pack_binding_mismatch",
] as const);
export type AssessmentProvenanceIssueCode = (typeof ASSESSMENT_PROVENANCE_ISSUE_CODES)[number];

export interface AssessmentProvenanceIssue {
  readonly code: AssessmentProvenanceIssueCode;
  readonly message: string;
  readonly at?: string;
}
