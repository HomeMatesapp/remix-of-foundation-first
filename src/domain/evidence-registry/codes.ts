/**
 * Frozen catalogues for the Evidence & Source Registry.
 *
 * This package CONSUMES the Increment 2 evidence vocabularies (grades A-D and
 * the four participant classifications) and deliberately does not redefine,
 * extend or reorder them.
 */

/**
 * Version of the evidence-registry SCHEMA framework itself.
 *
 * This is NOT an evidence record version, a Career Pack version, a governance
 * version or a Decision Engine version.
 */
export const EVIDENCE_REGISTRY_SCHEMA_VERSION = "1.0.0" as const;

/* -------------------------------------------------------------------------- */
/* Registry integrity issue codes                                             */
/* -------------------------------------------------------------------------- */

export const EVIDENCE_REGISTRY_ISSUE_CODES = Object.freeze([
  "schema_invalid",
  "duplicate_source_id",
  "duplicate_source_key",
  "unknown_source",
  "duplicate_revision",
  "content_hash_conflict",
  "unknown_supersedes_target",
  "supersedes_identity_mismatch",
  "supersedes_version_not_greater",
  "self_supersession",
  "supersession_cycle",
  "supersession_branch",
  "lineage_ambiguous",
] as const);
export type EvidenceRegistryIssueCode = (typeof EVIDENCE_REGISTRY_ISSUE_CODES)[number];

export interface EvidenceRegistryIssue {
  readonly code: EvidenceRegistryIssueCode;
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

export interface EvidenceRegistryValidationResult {
  readonly valid: boolean;
  readonly issues: readonly EvidenceRegistryIssue[];
}

/* -------------------------------------------------------------------------- */
/* Evidence reference resolution issue codes                                  */
/* -------------------------------------------------------------------------- */

export const EVIDENCE_REFERENCE_ISSUE_CODES = Object.freeze([
  "reference_invalid",
  "unknown_source",
  "unknown_record",
  "unknown_revision",
  "version_mismatch",
  "content_hash_mismatch",
  "grade_mismatch",
  "participant_classification_mismatch",
  "retrieved_at_mismatch",
  "current_revision_withdrawn",
] as const);
export type EvidenceReferenceIssueCode = (typeof EVIDENCE_REFERENCE_ISSUE_CODES)[number];

export interface EvidenceReferenceIssue {
  readonly code: EvidenceReferenceIssueCode;
  readonly message: string;
  readonly at?: string;
}
