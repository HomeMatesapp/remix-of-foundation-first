/**
 * Increment 17, Stage D1 — settled field projection between the CLOSED Stage A
 * canonical Local Reality snapshot contract and the frozen relational shape.
 *
 * Declarative data only. Nothing here reads, writes, computes or executes.
 */

import {
  LOCAL_SNAPSHOT_OBJECT_TYPES,
  LOCATION_PRECISION_LEVELS,
  type LocalSnapshotObjectType,
  type LocationPrecisionLevel,
} from "../local-reality/codes";
import type {
  ProjectionBlockerCode,
  ProjectionClassification,
  ProjectionTargetTable,
} from "./codes";

export interface FieldProjection {
  /** Canonical Stage A field path, or null for fields Stage A does not own. */
  readonly canonicalField: string | null;
  /** Frozen relational column name, or null when no frozen column exists. */
  readonly column: string | null;
  readonly table: ProjectionTargetTable;
  readonly classification: ProjectionClassification;
  /** Present only for blocked entries. */
  readonly blocker?: ProjectionBlockerCode;
  readonly note: string;
}

/**
 * Precision levels are projected VERBATIM, including `coarse`, because the CLOSED
 * Stage A contract is the current authority for this vocabulary.
 */
export const PROJECTED_PRECISION_LEVELS: readonly LocationPrecisionLevel[] =
  LOCATION_PRECISION_LEVELS;

/** Object types are projected verbatim; there is deliberately no polymorphic id. */
export const PROJECTED_OBJECT_TYPES: readonly LocalSnapshotObjectType[] =
  LOCAL_SNAPSHOT_OBJECT_TYPES;

/** Exactly one typed reference is populated and must match the object type. */
export const TYPED_REFERENCE_COLUMNS = Object.freeze({
  provider: "provider_id",
  programme: "programme_id",
  opportunity: "opportunity_id",
} as const);

/**
 * Source-owned identity uniqueness, as tightened by CLOSED Stage A. Neither this
 * nor the historical typed-object uniqueness expression index may be silently
 * weakened by a later relational definition.
 */
export const SOURCE_IDENTITY_UNIQUENESS_COLUMNS = Object.freeze([
  "object_type",
  "source_id",
  "source_record_key",
] as const);

export const SNAPSHOT_FIELD_PROJECTIONS: readonly FieldProjection[] = Object.freeze([
  {
    canonicalField: "snapshotId",
    column: "id",
    table: "local_snapshot",
    classification: "proven",
    note: "Canonical snapshot identity.",
  },
  {
    canonicalField: "capturedAt",
    column: "captured_at",
    table: "local_snapshot",
    classification: "proven",
    note: "Verbatim capture timestamp.",
  },
  {
    canonicalField: "precisionLevel",
    column: "resolution_level",
    table: "local_snapshot",
    classification: "proven",
    note: "Projected verbatim including `coarse` per CLOSED Stage A authority.",
  },
  {
    canonicalField: "approxRadiusMiles",
    column: "radius_miles",
    table: "local_snapshot",
    classification: "proven",
    note: "Nullable whole miles 1–100.",
  },
  {
    canonicalField: "transportModeAssumptionKey",
    column: "transport_mode",
    table: "local_snapshot",
    classification: "proven",
    note: "Text mapping only. No interpretation, no travel-time meaning.",
  },
  {
    canonicalField: null,
    column: "participant_id",
    table: "local_snapshot",
    classification: "envelope_supplied_externally",
    note: "Supplied by a future authenticated/server boundary. NEVER derived from the canonical snapshot, which carries no participant identity.",
  },
  {
    canonicalField: null,
    column: "centre_geog",
    table: "local_snapshot",
    classification: "db_only_established_fact",
    note: "Nullable established fact only. Must not be synthesised from Stage A; Stage A holds no coordinates.",
  },
  {
    canonicalField: "schemaVersion",
    column: "schema_version",
    table: "local_snapshot",
    classification: "proven",
    note: "Stage D2 owner decision: text NOT NULL with NO relational default. Exact verbatim mapping; no broader version semantics.",
  },
  {
    canonicalField: "searchAreaLabel",
    column: "search_area_label",
    table: "local_snapshot",
    classification: "proven",
    note: "Stage D2 owner decision: text NULL. Participant-safe display geography only; never a raw participant full postcode. Stage A safety boundary unchanged.",
  },
]);

export const ITEM_FIELD_PROJECTIONS: readonly FieldProjection[] = Object.freeze([
  {
    canonicalField: "itemId",
    column: "id",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Canonical item identity.",
  },
  {
    canonicalField: null,
    column: "local_snapshot_id",
    table: "local_snapshot_item",
    classification: "envelope_supplied_externally",
    note: "Parent link supplied by the future persistence boundary from the containing canonical snapshot's `snapshotId`, with restricted delete behaviour. A canonical Stage A ITEM owns no snapshot identity field, so this is never item-owned canonical content.",
  },
  {
    canonicalField: "signalKey",
    column: "signal_key",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Opaque governed key. Exact match only; never trimmed, case-folded or hashed.",
  },
  {
    canonicalField: "objectType",
    column: "object_type",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Exactly one typed reference must match this value.",
  },
  {
    canonicalField: "providerId",
    column: "provider_id",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Typed reference, restricted delete behaviour.",
  },
  {
    canonicalField: "programmeId",
    column: "programme_id",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Typed reference, restricted delete behaviour.",
  },
  {
    canonicalField: "opportunityId",
    column: "opportunity_id",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Typed reference, restricted delete behaviour.",
  },
  {
    canonicalField: "sourceId",
    column: "source_id",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Source-owned identity, restricted delete behaviour.",
  },
  {
    canonicalField: "sourceRecordKey",
    column: "source_record_key",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Stored VERBATIM. U+0000 is rejected upstream; no normalisation of any kind.",
  },
  {
    canonicalField: "organisationName",
    column: "provider_or_employer_name",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Nullable snapshotted name as it stood.",
  },
  {
    canonicalField: "itemTitle",
    column: "item_title",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Nullable snapshotted title as it stood.",
  },
  {
    canonicalField: "occupationId",
    column: "occupation_id",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Optional governed reference.",
  },
  {
    canonicalField: "archetypeCode",
    column: "archetype_code",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Optional governed reference.",
  },
  {
    canonicalField: "routeKey",
    column: "route_key",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Optional governed key.",
  },
  {
    canonicalField: "approxDistanceMiles",
    column: "distance_miles",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Established approximate fact recorded verbatim. Never computed here.",
  },
  {
    canonicalField: "locationLabel",
    column: "location_label",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Nullable participant-safe label; never a full postcode.",
  },
  {
    canonicalField: "capturedAt",
    column: "captured_at",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Item-level capture timestamp.",
  },
  {
    canonicalField: null,
    column: "item_geog",
    table: "local_snapshot_item",
    classification: "db_only_established_fact",
    note: "Nullable established fact only. Must not be synthesised from Stage A.",
  },
  {
    canonicalField: "availabilityConfidenceKey",
    column: "availability_confidence",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Stage D2 owner decision: binds only to the four approved NON-ORDINAL opaque members in `./decisions`. Uninterpreted: no ranking, comparison, ordering, inference, accessibility, availability, eligibility or route meaning, and no Stage B interpretation. Exact match only; keys outside the approved vocabulary fail relational binding instead of being coerced.",
  },
  {
    canonicalField: "details",
    column: "participant_facing_detail",
    table: "local_snapshot_item",
    classification: "proven",
    note: "Stage D2 owner decision: jsonb NOT NULL mirroring the exact CLOSED Stage A bounded array of `{ detailKey, detailText }` in canonical Stage A order, reusing the Stage A bound. Empty/default expectation is an empty JSON array, never an empty object.",
  },
]);

export const ALL_FIELD_PROJECTIONS: readonly FieldProjection[] = Object.freeze([
  ...SNAPSHOT_FIELD_PROJECTIONS,
  ...ITEM_FIELD_PROJECTIONS,
]);
