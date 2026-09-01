/**
 * Increment 17, Stage D2 — owner DECISION-RESOLUTION record.
 *
 * Stage D1 correctly reported four unresolved relational-mapping questions and
 * failed closed on them. That Stage D1 history is accurate and is NOT rewritten
 * here. Stage D2 records the product owner's explicit resolution of those four
 * questions, so the CURRENT contract truth in this package changes accordingly.
 *
 * Pure data only. Nothing here reads, writes, computes, executes or authorises.
 * Recording a decision is NOT authority to apply a hosted relational change.
 */

import { MAX_ITEM_DETAILS } from "../local-reality/codes";
import type { ProjectionBlockerCode, ResolvedD2BlockerCode } from "./codes";

/** Version of the Stage D2 decision record document itself. */
export const LOCAL_REALITY_D2_DECISION_VERSION = "1.0.0" as const;

/** Date the product owner accepted the decisions below (ISO calendar date). */
export const LOCAL_REALITY_D2_DECISION_DATE = "2026-08-30" as const;

/**
 * Approved relational availability-confidence members, exactly four.
 *
 * These members are NON-ORDINAL, opaque governed values. There is deliberately
 * no rank, weight, score, severity, comparator or order-of-goodness attached to
 * them anywhere. They carry no accessibility, availability, eligibility or route
 * meaning, and Stage B does not interpret them. In particular `known_scarce` is
 * a governed upstream statement and must never be inferred from a small or
 * empty result count.
 */
export const APPROVED_AVAILABILITY_CONFIDENCE_VALUES = Object.freeze([
  "known_available",
  "uncertain",
  "known_scarce",
  "unknown",
] as const);
export type ApprovedAvailabilityConfidenceValue =
  (typeof APPROVED_AVAILABILITY_CONFIDENCE_VALUES)[number];

/**
 * Canonical relational representation of bounded participant-facing details:
 * the exact CLOSED Stage A array of `{ detailKey, detailText }` objects, in the
 * Stage A canonical detail order, with the Stage A bound REUSED (not restated).
 */
export const PARTICIPANT_FACING_DETAIL_MAX_ENTRIES = MAX_ITEM_DETAILS;

/** Expected empty/default document value: an empty JSON ARRAY, never `{}`. */
export const PARTICIPANT_FACING_DETAIL_EMPTY_EXPECTATION = "[]" as const;

/** Exact object member names of one detail entry, mirroring closed Stage A. */
export const PARTICIPANT_FACING_DETAIL_MEMBER_NAMES = Object.freeze([
  "detailKey",
  "detailText",
] as const);

export interface OwnerDecisionRecord {
  /** Stable code for the Stage D1 mapping blocker this decision resolves. */
  readonly resolvesBlockerCode: ResolvedD2BlockerCode;
  readonly decision: string;
}

/**
 * Exactly the FOUR owner decisions that resolve `RESOLVED_D2_BLOCKER_CODES`.
 * Dependency architecture is NOT one of them: see the separate immutable
 * reaffirmation below, which leaves `required_dependency_objects_absent` a
 * CURRENT blocker.
 */
export const LOCAL_REALITY_D2_DECISIONS: readonly OwnerDecisionRecord[] = Object.freeze([
  Object.freeze({
    resolvesBlockerCode: "schema_version_column_not_frozen",
    decision:
      "`local_snapshot.schema_version` is text NOT NULL with NO relational default. Canonical Stage A `schemaVersion` maps to it exactly. No broader version semantics are introduced.",
  }),
  Object.freeze({
    resolvesBlockerCode: "search_area_label_column_not_frozen",
    decision:
      "`local_snapshot.search_area_label` is text NULL. Canonical Stage A `searchAreaLabel` maps to it. It carries participant-safe display geography only and never a raw participant full location value; the Stage A safety boundary is preserved unchanged.",
  }),
  Object.freeze({
    resolvesBlockerCode: "availability_confidence_vocabulary_not_approved",
    decision:
      "The approved relational member vocabulary of the frozen `availability_confidence` type is exactly `known_available | uncertain | known_scarce | unknown`, as non-ordinal opaque governed members. Canonical `availabilityConfidenceKey` binds only when it already equals one of those members exactly; nothing is coerced, trimmed, cased or normalised. The owner decision resolved the MEMBERS, not the relational type, which the amended ERD already fixed.",
  }),
  Object.freeze({
    resolvesBlockerCode: "participant_facing_detail_representation_not_frozen",
    decision:
      "`local_snapshot_item.participant_facing_detail` is jsonb NOT NULL holding the exact CLOSED Stage A bounded array of `{ detailKey, detailText }` in canonical Stage A order. The empty/default expectation is an empty JSON array, not an empty object.",
  }),
] as const);

export interface DependencyArchitectureReaffirmation {
  /** Blocker code that REMAINS current; a reaffirmation resolves nothing. */
  readonly reaffirmedBlockerCode: ProjectionBlockerCode;
  readonly reaffirmation: string;
}

/**
 * Immutable architecture reaffirmation. Deliberately separate from the four
 * resolving decisions so nothing can read it as a resolved blocker.
 */
export const LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION: DependencyArchitectureReaffirmation =
  Object.freeze({
    reaffirmedBlockerCode: "required_dependency_objects_absent",
    reaffirmation:
      "REAFFIRMED, NOT REOPENED: the required direct dependency objects remain `source`, `occupation`, `route_archetype`, `provider`, `programme`, `opportunity` with real referential constraints. No constraint is weakened or removed and no shadow or minimal substitute object is permitted. Dependency absence remains the only current migration-readiness blocker.",
  });
