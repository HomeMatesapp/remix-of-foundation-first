/**
 * Increment 17, Stage D1 — proposed column manifest.
 *
 * FOR FUTURE REVIEW ONLY. This manifest names frozen relational columns and the
 * qualified type expectations a later, separately approved relational change
 * would have to honour. It emits NO executable statements and authorises nothing.
 */

import type { ProjectionTargetTable } from "./codes";

export interface ProposedColumn {
  readonly table: ProjectionTargetTable;
  readonly column: string;
  /** Declarative type expectation string. Never executed, never interpolated. */
  readonly typeExpectation: string;
  readonly nullable: boolean;
  readonly note?: string;
}

/**
 * Qualified spatial type expectation, per the frozen qualification rule that
 * every spatial type, function and operator is reached through the `extensions`
 * schema and never through a broad application search path.
 */
export const QUALIFIED_POINT_TYPE_EXPECTATION = "extensions.geography(Point,4326)" as const;

export const PROPOSED_COLUMNS: readonly ProposedColumn[] = Object.freeze([
  { table: "local_snapshot", column: "id", typeExpectation: "uuid", nullable: false },
  {
    table: "local_snapshot",
    column: "participant_id",
    typeExpectation: "uuid",
    nullable: false,
    note: "Envelope field supplied by a future authenticated/server boundary.",
  },
  {
    table: "local_snapshot",
    column: "resolution_level",
    typeExpectation: "text",
    nullable: false,
    note: "Frozen relational type is `text`. Allowed values are exactly `PROJECTED_PRECISION_LEVELS` from `./projection` (`full_postcode|sector|outward|coarse|none`) per CLOSED Stage A. No enum type is proposed or invented.",
  },
  {
    table: "local_snapshot",
    column: "centre_geog",
    typeExpectation: QUALIFIED_POINT_TYPE_EXPECTATION,
    nullable: true,
    note: "Established fact only; nullable; GIST index expected on this column.",
  },
  {
    table: "local_snapshot",
    column: "radius_miles",
    typeExpectation: "smallint",
    nullable: true,
    note: "Frozen as `smallint`; CLOSED Stage A supplies whole miles 1-100.",
  },
  { table: "local_snapshot", column: "transport_mode", typeExpectation: "text", nullable: true },
  {
    table: "local_snapshot",
    column: "schema_version",
    typeExpectation: "text",
    nullable: false,
    note: "Stage D2 owner decision: NOT NULL with NO relational default. Canonical Stage A `schemaVersion` maps here exactly.",
  },
  {
    table: "local_snapshot",
    column: "search_area_label",
    typeExpectation: "text",
    nullable: true,
    note: "Stage D2 owner decision: participant-safe display geography only; never a raw participant full postcode.",
  },

  {
    table: "local_snapshot",
    column: "captured_at",
    typeExpectation: "timestamptz",
    nullable: false,
  },
  { table: "local_snapshot_item", column: "id", typeExpectation: "uuid", nullable: false },
  {
    table: "local_snapshot_item",
    column: "local_snapshot_id",
    typeExpectation: "uuid",
    nullable: false,
  },
  { table: "local_snapshot_item", column: "signal_key", typeExpectation: "text", nullable: false },
  {
    table: "local_snapshot_item",
    column: "object_type",
    typeExpectation: "text",
    nullable: false,
    note: "Frozen relational type is `text`. Exact values come from `PROJECTED_OBJECT_TYPES` in `./projection` (`provider|programme|opportunity`). No enum type is proposed or invented.",
  },
  { table: "local_snapshot_item", column: "provider_id", typeExpectation: "uuid", nullable: true },
  { table: "local_snapshot_item", column: "programme_id", typeExpectation: "uuid", nullable: true },
  {
    table: "local_snapshot_item",
    column: "opportunity_id",
    typeExpectation: "uuid",
    nullable: true,
  },
  { table: "local_snapshot_item", column: "source_id", typeExpectation: "uuid", nullable: false },
  {
    table: "local_snapshot_item",
    column: "source_record_key",
    typeExpectation: "text",
    nullable: false,
    note: "Verbatim.",
  },
  {
    table: "local_snapshot_item",
    column: "provider_or_employer_name",
    typeExpectation: "text",
    nullable: true,
  },
  { table: "local_snapshot_item", column: "item_title", typeExpectation: "text", nullable: true },
  {
    table: "local_snapshot_item",
    column: "occupation_id",
    typeExpectation: "uuid",
    nullable: true,
  },
  {
    table: "local_snapshot_item",
    column: "archetype_code",
    typeExpectation: "text",
    nullable: true,
  },
  { table: "local_snapshot_item", column: "route_key", typeExpectation: "text", nullable: true },
  {
    table: "local_snapshot_item",
    column: "distance_miles",
    typeExpectation: "numeric(5,1)",
    nullable: true,
  },
  {
    table: "local_snapshot_item",
    column: "location_label",
    typeExpectation: "text",
    nullable: true,
    note: "Participant-safe label; never a full postcode.",
  },
  {
    table: "local_snapshot_item",
    column: "item_geog",
    typeExpectation: QUALIFIED_POINT_TYPE_EXPECTATION,
    nullable: true,
    note: "Established fact only; nullable; GIST index expected on this column.",
  },
  {
    table: "local_snapshot_item",
    column: "captured_at",
    typeExpectation: "timestamptz",
    nullable: false,
  },
  {
    table: "local_snapshot_item",
    column: "availability_confidence",
    typeExpectation: "availability_confidence",
    nullable: false,
    note: "Stage D2 owner decision: allowed values are EXACTLY `APPROVED_AVAILABILITY_CONFIDENCE_VALUES` from `./decisions`. The members are non-ordinal and uninterpreted; no ordering, ranking, weight or comparator is declared or implied. The amended ERD already fixes the relational type as the named `availability_confidence` type NOT NULL; the eventual relational change must create/use that named type with exactly those four members. Any internal declaration order of the type is an implementation artefact and must never be exposed or used as product ordering.",
  },
  {
    table: "local_snapshot_item",
    column: "participant_facing_detail",
    typeExpectation: "jsonb",
    nullable: false,
    note: "Stage D2 owner decision: exact CLOSED Stage A bounded array of `{ detailKey, detailText }` in canonical Stage A order, bound reused from Stage A. Expected empty/default document value is `[]` (JSON array), never `{}`.",
  },
]);

/**
 * Stage D1 withheld four columns pending owner decisions. All four were resolved
 * in Stage D2 (see `./decisions`), so nothing remains withheld.
 */
export const WITHHELD_COLUMNS: readonly string[] = Object.freeze([]);

/**
 * Fields this projection FORBIDS outright. Durable participant raw-location
 * storage is not authorised by current governing material, and Stage C keeps the
 * raw value transient.
 */
export const FORBIDDEN_COLUMNS: readonly string[] = Object.freeze([
  "any durable raw full participant location value",
  "any normalised participant location value",
  "any participant coordinate pair",
]);
