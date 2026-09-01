import type { CareerPack } from "../../domain/career-packs";
import { hashCanonicalCareerPack } from "../../domain/career-pack-governance";
import { occupationRefOf, type OccupationUniverse } from "../../domain/occupation-universe";
import {
  resolveRealityCheckCoverageFromPacks,
  type CoveragePackRef,
} from "../../domain/universal-coverage";

import type { RoleAssessmentAvailability } from "./view-model";

/**
 * Server-only bridge to the CLOSED Increment 13 coverage layer.
 *
 * Increment 13 recomputes Career Pack content hashes through the governance
 * hashing authority, which is deliberately server-side (`node:crypto`). This
 * module therefore never enters a browser bundle: presentation code receives
 * the already-resolved outcome and never re-derives or widens it.
 *
 * Increment 14 reads coverage only. It resolves no judgement, no requirement
 * state and no route authority.
 */
export function resolveRoleAssessmentAvailability(input: {
  readonly occupationKey: string;
  readonly universe: OccupationUniverse;
  readonly packs: readonly CareerPack[];
}): RoleAssessmentAvailability {
  const record = input.universe.find((entry) => entry.occupationKey === input.occupationKey);
  if (!record) return { state: "assessment_not_available_yet" };

  const occupation = occupationRefOf(record);
  const coverage = resolveRealityCheckCoverageFromPacks({
    occupationResolution: {
      outcome: "resolved",
      occupationId: occupation.occupationId,
      occupationKey: occupation.occupationKey,
      canonicalTitle: occupation.canonicalTitle,
      matchedTerm: record.canonicalTitle,
      termCategory: "canonical_title",
      matchMode: "exact",
    },
    universe: input.universe,
    availablePacks: input.packs,
  });

  if (!coverage.ok || coverage.coverage.outcome !== "full_assessment_available") {
    return { state: "assessment_not_available_yet" };
  }

  return {
    state: "assessment_available",
    occupationKey: coverage.coverage.occupation.occupationKey,
    pack: coverage.coverage.pack,
  };
}

/**
 * EXACT pack binding for the participant Reality Check question experience.
 *
 * The client must never reselect a Career Pack by id/version and ignore the
 * content hash. This helper resolves safe FULL coverage through the closed
 * Increment 13 layer and then returns the canonical in-repo Career Pack
 * document ONLY when its RECOMPUTED content hash equals the coverage ref hash
 * produced by that same server-side governance hashing authority.
 *
 * A pack with the same id, version and occupation but different bytes therefore
 * fails closed: no document is returned and no experience can start.
 */
export type RealityCheckPackBinding =
  | {
      readonly state: "assessment_available";
      readonly occupationKey: string;
      readonly pack: CoveragePackRef;
      /** The exact canonical document the coverage ref was recomputed from. */
      readonly document: CareerPack;
    }
  | { readonly state: "assessment_not_available_yet" };

export function resolveRealityCheckPackBinding(input: {
  readonly occupationKey: string;
  readonly universe: OccupationUniverse;
  readonly packs: readonly CareerPack[];
}): RealityCheckPackBinding {
  const availability = resolveRoleAssessmentAvailability(input);
  if (availability.state !== "assessment_available") {
    return { state: "assessment_not_available_yet" };
  }

  const ref = availability.pack;
  const exact = input.packs.filter(
    (pack) =>
      pack.careerPackId === ref.careerPackId &&
      pack.version === ref.version &&
      pack.occupation.occupationKey === availability.occupationKey &&
      pack.questionModules.length > 0 &&
      hashCanonicalCareerPack(pack) === ref.contentHash,
  );
  /* Exactly one document may claim an exact coverage ref. */
  const document = exact.length === 1 ? exact[0] : undefined;
  if (!document) return { state: "assessment_not_available_yet" };

  return {
    state: "assessment_available",
    occupationKey: availability.occupationKey,
    pack: ref,
    document,
  };
}
