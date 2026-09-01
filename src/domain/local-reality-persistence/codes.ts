/**
 * Increment 17, Stage D1 — Local Reality persistence PROJECTION CONTRACT codes.
 *
 * This package is a schema/mapping READINESS contract only. It is not a database
 * client, not a repository, not runtime persistence and not authority to apply
 * any relational change. No relational object is claimed to exist.
 */

/** Version of the projection contract document itself. */
export const LOCAL_REALITY_PROJECTION_CONTRACT_VERSION = "1.0.0" as const;

/**
 * Relational objects the projection targets. Naming only: neither is claimed to
 * exist in the current foundation.
 */
export const PROJECTION_TARGET_TABLES = Object.freeze([
  "local_snapshot",
  "local_snapshot_item",
] as const);
export type ProjectionTargetTable = (typeof PROJECTION_TARGET_TABLES)[number];

/**
 * Mapping classification for a single field.
 *
 * - `proven`: canonical Stage A field with a frozen relational column.
 * - `envelope_supplied_externally`: relational field supplied by a future
 *   authenticated/server boundary, NEVER derived from a Stage A snapshot.
 * - `db_only_established_fact`: nullable relational fact that may only be
 *   persisted when already established upstream; never synthesised here.
 * - `blocked_owner_or_vocabulary_decision`: unresolved; fails closed.
 */
export const PROJECTION_CLASSIFICATIONS = Object.freeze([
  "proven",
  "envelope_supplied_externally",
  "db_only_established_fact",
  "blocked_owner_or_vocabulary_decision",
] as const);
export type ProjectionClassification = (typeof PROJECTION_CLASSIFICATIONS)[number];

/**
 * Blocker codes Stage D1 correctly reported while the four relational-mapping
 * questions were unresolved. Retained as accurate HISTORY only; the product
 * owner resolved all four in Stage D2 (see `./decisions`), so none of them is a
 * current blocker.
 */
export const RESOLVED_D2_BLOCKER_CODES = Object.freeze([
  "schema_version_column_not_frozen",
  "search_area_label_column_not_frozen",
  "availability_confidence_vocabulary_not_approved",
  "participant_facing_detail_representation_not_frozen",
] as const);
export type ResolvedD2BlockerCode = (typeof RESOLVED_D2_BLOCKER_CODES)[number];

/**
 * CURRENT stable blocker codes after Stage D2 decision resolution. Order is
 * stable for deterministic reporting. Dependency absence is the only remaining
 * migration-readiness blocker.
 */
export const PROJECTION_BLOCKER_CODES = Object.freeze([
  "required_dependency_objects_absent",
] as const);
export type ProjectionBlockerCode = (typeof PROJECTION_BLOCKER_CODES)[number];

/**
 * Relational dependency objects the projection would need. They are real frozen
 * dependencies but are NOT present in the current foundation, and Stage D1 must
 * not create them.
 */
export const REQUIRED_DEPENDENCY_OBJECTS = Object.freeze([
  "source",
  "occupation",
  "route_archetype",
  "provider",
  "programme",
  "opportunity",
] as const);
export type RequiredDependencyObject = (typeof REQUIRED_DEPENDENCY_OBJECTS)[number];

export interface ProjectionBlocker {
  readonly code: ProjectionBlockerCode;
  /** Internal reviewer-facing explanation. Never participant-facing copy. */
  readonly reason: string;
  /** True when only an owner/vocabulary decision can unblock it. */
  readonly requiresOwnerDecision: boolean;
}
