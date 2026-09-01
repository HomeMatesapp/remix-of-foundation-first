/**
 * Increment 17, Stage D1 contract with Stage D2 decision resolution applied —
 * deterministic persistence readiness assessment.
 *
 * Pure and total. It inspects nothing live: no relational connection, no network,
 * no environment, no clock. Dependency availability is SUPPLIED as an input
 * capability snapshot and defaults to unavailable.
 *
 * IMPORTANT: `migrationReady` is an AUTHORING-readiness statement about this
 * contract only. It is NEVER authorisation to apply a hosted relational change;
 * applying one remains a separate hard owner gate.
 */

import {
  PROJECTION_BLOCKER_CODES,
  REQUIRED_DEPENDENCY_OBJECTS,
  type ProjectionBlocker,
  type ProjectionBlockerCode,
  type RequiredDependencyObject,
} from "./codes";
import { ALL_FIELD_PROJECTIONS, type FieldProjection } from "./projection";

/** Externally supplied statement of which frozen dependency objects exist. */
export type DependencyCapabilitySnapshot = {
  readonly [K in RequiredDependencyObject]?: boolean;
};

export interface PersistenceReadinessResult {
  /**
   * Contract/authoring readiness only. False while any blocker remains, and
   * never a permission to touch hosted state.
   */
  readonly migrationReady: boolean;
  readonly blockers: readonly ProjectionBlocker[];
  readonly blockerCodes: readonly ProjectionBlockerCode[];
  readonly missingDependencies: readonly RequiredDependencyObject[];
  readonly provenFields: readonly FieldProjection[];
  readonly blockedFields: readonly FieldProjection[];
}

const BLOCKER_REASONS: Readonly<Record<ProjectionBlockerCode, string>> = Object.freeze({
  required_dependency_objects_absent:
    "One or more frozen dependency objects the referential constraints require are not present in the current foundation, and this stage must not create them or substitute shadow objects.",
});

/**
 * Blockers only an owner or approved-vocabulary decision can clear. Stage D2
 * resolved all four such blockers, so none remains; dependency absence is a
 * foundation-state blocker rather than a decision.
 */
const OWNER_DECISION_BLOCKERS: readonly ProjectionBlockerCode[] = Object.freeze([]);

function blockerFor(code: ProjectionBlockerCode): ProjectionBlocker {
  return Object.freeze({
    code,
    reason: BLOCKER_REASONS[code],
    requiresOwnerDecision: OWNER_DECISION_BLOCKERS.includes(code),
  });
}

export function assessLocalRealityPersistenceReadiness(
  dependencies: DependencyCapabilitySnapshot = {},
): PersistenceReadinessResult {
  const missingDependencies = REQUIRED_DEPENDENCY_OBJECTS.filter(
    (object) => dependencies[object] !== true,
  );

  const codes = PROJECTION_BLOCKER_CODES.filter((code) =>
    code === "required_dependency_objects_absent" ? missingDependencies.length > 0 : true,
  );

  return Object.freeze({
    migrationReady: codes.length === 0,
    blockers: Object.freeze(codes.map(blockerFor)),
    blockerCodes: Object.freeze([...codes]),
    missingDependencies: Object.freeze([...missingDependencies]),
    provenFields: Object.freeze(
      ALL_FIELD_PROJECTIONS.filter((field) => field.classification === "proven"),
    ),
    blockedFields: Object.freeze(
      ALL_FIELD_PROJECTIONS.filter(
        (field) => field.classification === "blocked_owner_or_vocabulary_decision",
      ),
    ),
  });
}
