/**
 * Frozen catalogues for the Local Reality snapshot document (Increment 17,
 * Stage A).
 *
 * Stage A is FACT STORAGE ONLY. Nothing here concludes local accessibility,
 * interprets opportunity status, models local labour demand, or resolves any
 * declared Career Pack local requirement. Those remain later, separately gated
 * work. This package consumes the already-approved primitive vocabularies and
 * defines no judgement, requirement, evidence-strength or ranking vocabulary.
 */

/**
 * Version of the Local Reality snapshot DOCUMENT schema itself.
 *
 * Not a Career Pack version, not an evidence record version, not a governance
 * version and not a Decision Engine version.
 */
export const LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Location precision level, exactly as frozen by the ERD addendum.
 *
 * The snapshot records WHICH precision level the underlying collection used. It
 * deliberately carries no raw postcode of any precision.
 */
export const LOCATION_PRECISION_LEVELS = Object.freeze([
  "full_postcode",
  "sector",
  "outward",
  "coarse",
  "none",
] as const);
export type LocationPrecisionLevel = (typeof LOCATION_PRECISION_LEVELS)[number];

/**
 * Snapshotted object type. Each item points at exactly one typed entity; there
 * is deliberately no polymorphic `object_id`.
 */
export const LOCAL_SNAPSHOT_OBJECT_TYPES = Object.freeze([
  "provider",
  "programme",
  "opportunity",
] as const);
export type LocalSnapshotObjectType = (typeof LOCAL_SNAPSHOT_OBJECT_TYPES)[number];

/** Maximum number of bounded participant-facing detail entries per item. */
export const MAX_ITEM_DETAILS = 6;

/** Inclusive approximate radius bounds in WHOLE miles, per the frozen ERD. */
export const MIN_RADIUS_MILES = 1;
export const MAX_RADIUS_MILES = 100;

/**
 * Maximum approximate distance fact, bounded so Stage A never admits a value the
 * approved `distance_miles numeric(5,1)` projection could not store.
 */
export const MAX_DISTANCE_MILES = 9999.9;

export const LOCAL_REALITY_SNAPSHOT_ISSUE_CODES = Object.freeze([
  "schema_invalid",
  "duplicate_item_id",
  "duplicate_source_identity",
  "typed_reference_mismatch",
  "unsafe_location_label",
  "duplicate_detail_key",
] as const);
export type LocalRealitySnapshotIssueCode = (typeof LOCAL_REALITY_SNAPSHOT_ISSUE_CODES)[number];

export interface LocalRealitySnapshotIssue {
  readonly code: LocalRealitySnapshotIssueCode;
  /** Internal diagnostic text. Never participant-facing copy. */
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

export interface LocalRealitySnapshotValidationResult {
  readonly valid: boolean;
  readonly issues: readonly LocalRealitySnapshotIssue[];
}
