import type { CareerPackLocalRequirement } from "../career-packs/schema";
import { canonicalTupleKey, compareCanonicalKeys, snapshotItemIdentityKey } from "./canonical";
import type { LocationPrecisionLevel } from "./codes";
import type { LocalRealitySnapshot } from "./schema";

/**
 * Local Requirement resolver (Increment 17, Stage B).
 *
 * PURE and deterministic. It sits BESIDE the closed Decision Engine and never
 * calls, imports, mutates, filters or reinterprets it. It answers exactly one
 * narrow question per declared Career Pack local requirement: does the supplied
 * governed Local Reality snapshot contain matching signal evidence for that
 * declared opaque local fact?
 *
 * It deliberately does NOT decide structural entry conditions, practical
 * suitability, route availability, ranking, local accessibility, opportunity
 * status or local labour demand, and it produces none of the four protected
 * judgement values. Its vocabulary is LOCAL-ONLY and shares no state name with
 * any protected requirement or judgement vocabulary.
 *
 * Binding is EXACT stable-key equality only:
 *   `LocalSnapshotItem.signalKey === CareerPackLocalRequirement.localFactKey`
 * There is no alias table, normalisation, case folding, trimming, fuzzy
 * matching, inference or generative step of any kind.
 *
 * IMPORTANT LIMITATION — why there is no "no current example found" state.
 * The frozen Local Reality snapshot contract records positive established local
 * facts. It carries no replayable "a search was executed for this signal and
 * returned zero results" record. An empty matching set therefore cannot honestly
 * be reported as nothing existing locally: it only means the snapshot holds no
 * matching governed evidence. A truthful searched-and-found-none state is
 * deferred until an explicit, historically replayable search-outcome contract is
 * separately approved. Stage B does not amend the ERD or the Stage A snapshot to
 * manufacture that fact.
 */

/* -------------------------------------------------------------------------- */
/* Local-only resolution vocabulary                                           */
/* -------------------------------------------------------------------------- */

/**
 * The only three Stage B meanings.
 *
 * - `location_not_supplied`: no snapshot, or the snapshot precision level is
 *   `none`. Nothing local was established, and nothing negative is inferred.
 * - `matching_local_evidence_present`: a usable-location snapshot holds one or
 *   more items whose `signalKey` exactly equals the declared `localFactKey`.
 *   This asserts only that matching governed evidence exists; the opaque
 *   availability-confidence key is not read, ordered or interpreted.
 * - `local_evidence_insufficient`: a usable-location snapshot exists but holds
 *   no matching signal item. This is an absence of governed evidence ONLY. It
 *   does not mean nothing exists locally, and it is not unavailability,
 *   inaccessibility or impossibility.
 */
export const LOCAL_REQUIREMENT_RESOLUTION_STATES = Object.freeze([
  "location_not_supplied",
  "matching_local_evidence_present",
  "local_evidence_insufficient",
] as const);
export type LocalRequirementResolutionState = (typeof LOCAL_REQUIREMENT_RESOLUTION_STATES)[number];

/** One deterministic resolution for one declared local requirement. */
export interface LocalRequirementResolution {
  readonly localRequirementKey: string;
  /** Opaque declared local fact key, copied verbatim for provenance. */
  readonly localFactKey: string;
  readonly relatedRouteKeys: readonly string[];
  readonly purposes: readonly string[];
  readonly resolution: LocalRequirementResolutionState;
  /** Exact snapshot item ids that matched, in canonical snapshot order. */
  readonly matchingItemIds: readonly string[];
  /**
   * Authored check key that remains outstanding in this local envelope. Present
   * only for the two unresolved local states, and only when the pack authored
   * one.
   */
  readonly outstandingCheckKey: string | null;
  /**
   * Authored check key that matching local evidence satisfies, exposed
   * NON-DESTRUCTIVELY. Stage B never removes or rewrites anything in the closed
   * Decision Engine output.
   */
  readonly resolvedCheckKey: string | null;
}

/** Whole deterministic resolution envelope. Participant prose lives elsewhere. */
export interface LocalRequirementResolutionSet {
  readonly snapshotId: string | null;
  readonly precisionLevel: LocationPrecisionLevel | null;
  readonly locationUsable: boolean;
  readonly resolutions: readonly LocalRequirementResolution[];
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

function canonicalItemOrderKey(item: LocalRealitySnapshot["items"][number]): string {
  return canonicalTupleKey([
    snapshotItemIdentityKey({
      sourceId: item.sourceId,
      sourceRecordKey: item.sourceRecordKey,
      objectType: item.objectType,
    }),
    item.itemId,
  ]);
}

/**
 * Resolve each declared local requirement against a canonical snapshot.
 *
 * Consumes the already-canonical, already-frozen `LocalRealitySnapshot` type: it
 * does not re-parse, reorder or mutate it, and it does not mutate the supplied
 * declarations. Snapshot signal keys that no supplied declaration names are
 * simply ignored — they are neither an error nor truth for this pack.
 *
 * Authored declaration order is preserved exactly.
 */
export function resolveLocalRequirements(input: {
  readonly localRequirements: readonly CareerPackLocalRequirement[];
  readonly snapshot?: LocalRealitySnapshot | null | undefined;
}): LocalRequirementResolutionSet {
  const snapshot = input.snapshot ?? null;
  const precisionLevel = snapshot ? snapshot.precisionLevel : null;
  const locationUsable = snapshot !== null && snapshot.precisionLevel !== "none";

  const bySignal = new Map<string, { readonly itemId: string; readonly orderKey: string }[]>();
  if (locationUsable && snapshot) {
    for (const item of snapshot.items) {
      const bucket = bySignal.get(item.signalKey) ?? [];
      bucket.push({ itemId: item.itemId, orderKey: canonicalItemOrderKey(item) });
      bySignal.set(item.signalKey, bucket);
    }
  }

  const resolutions = input.localRequirements.map((declaration) => {
    const authoredCheckKey =
      typeof declaration.unresolvedCheckKey === "string" ? declaration.unresolvedCheckKey : null;

    if (!locationUsable) {
      return Object.freeze({
        localRequirementKey: declaration.localRequirementKey,
        localFactKey: declaration.localFactKey,
        relatedRouteKeys: Object.freeze([...declaration.relatedRouteKeys]),
        purposes: Object.freeze([...declaration.purposes]),
        resolution: "location_not_supplied" as const,
        matchingItemIds: Object.freeze([] as readonly string[]),
        outstandingCheckKey: authoredCheckKey,
        resolvedCheckKey: null,
      });
    }

    const matches = [...(bySignal.get(declaration.localFactKey) ?? [])].sort((left, right) =>
      compareCanonicalKeys(left.orderKey, right.orderKey),
    );
    const matched = matches.length > 0;

    return Object.freeze({
      localRequirementKey: declaration.localRequirementKey,
      localFactKey: declaration.localFactKey,
      relatedRouteKeys: Object.freeze([...declaration.relatedRouteKeys]),
      purposes: Object.freeze([...declaration.purposes]),
      resolution: matched
        ? ("matching_local_evidence_present" as const)
        : ("local_evidence_insufficient" as const),
      matchingItemIds: Object.freeze(matches.map((entry) => entry.itemId)),
      outstandingCheckKey: matched ? null : authoredCheckKey,
      resolvedCheckKey: matched ? authoredCheckKey : null,
    });
  });

  return Object.freeze({
    snapshotId: snapshot ? snapshot.snapshotId : null,
    precisionLevel,
    locationUsable,
    resolutions: Object.freeze(resolutions),
  });
}
