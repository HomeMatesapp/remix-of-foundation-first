import {
  compareCanonicalKeys,
  deepFreezeDocument,
  questionIdentityKey,
} from "../assessment-inputs";
import type { CareerPackRequirementDefinition, CareerPackRouteDefinition } from "../career-packs";
import type { RequirementRef, RouteRef } from "../contracts";

/**
 * Canonical ordering, de-duplication and reference-shaping helpers.
 *
 * Authored array order must never accidentally determine engine output, so every
 * emitted collection is ordered by canonical stable key. The existing
 * `compareCanonicalKeys` / `deepFreezeDocument` / `questionIdentityKey` helpers
 * are REUSED rather than re-implemented.
 */

export { compareCanonicalKeys, deepFreezeDocument, questionIdentityKey };

/** Total, stable ordering over Clear Routes-owned stable keys. */
export function sortStableKeys(keys: readonly string[]): readonly string[] {
  return [...keys].sort(compareCanonicalKeys);
}

/** Canonical, de-duplicated stable-key list. */
export function canonicalKeyList(keys: readonly string[]): readonly string[] {
  return sortStableKeys([...new Set(keys)]);
}

/** Route identity as declared by the pack. `routeId` is emitted only if declared. */
export function routeRefOf(route: CareerPackRouteDefinition): RouteRef {
  return route.routeId == null
    ? { routeKey: route.routeKey }
    : { routeKey: route.routeKey, routeId: route.routeId };
}

/** Requirement identity as declared by the pack. */
export function requirementRefOf(requirement: CareerPackRequirementDefinition): RequirementRef {
  return requirement.requirementId == null
    ? { requirementKey: requirement.requirementKey }
    : { requirementKey: requirement.requirementKey, requirementId: requirement.requirementId };
}
