import type { CareerPack } from "../../domain/career-packs";
import {
  occupationRefOf,
  resolveOccupationIntent,
  type OccupationClarificationReason,
  type OccupationRef,
  type OccupationUnmatchedReason,
  type OccupationUniverse,
} from "../../domain/occupation-universe";
import type { CoveragePackRef } from "../../domain/universal-coverage";
import {
  careerOverviewByOccupationKey,
  type CareerOverview,
  type OverviewRouteDisplay,
  type OverviewSource,
} from "./content-schema";

/**
 * Pure presentation view-models for Increment 14 career discovery.
 *
 * This module composes CLOSED prior increments and adds no new authority:
 * - occupation identity and search precedence come from Increment 12
 *   `resolveOccupationIntent`; there is no second matching algorithm here;
 * - assessment coverage is INJECTED, already resolved by Increment 13
 *   `resolveRealityCheckCoverageFromPacks` on the server (that governance
 *   hashing authority is server-only and must never run in a browser);
 * - participant copy comes from the Increment 14 presentation content layer.
 *
 * It never runs the Decision Engine, never derives eligibility, practical fit,
 * barriers, unresolved checks or a Reality Check judgement, never scores an
 * occupation or route, and never touches the network, a database or a clock.
 */

/* -------------------------------------------------------------------------- */
/* Discovery submission                                                       */
/* -------------------------------------------------------------------------- */

export interface DiscoveryNavigate {
  readonly kind: "navigate";
  readonly occupation: OccupationRef;
}

export interface DiscoveryChoiceRequired {
  readonly kind: "choice_required";
  readonly reason: OccupationClarificationReason;
  /** Deterministic candidate list, never narrowed and never auto-chosen. */
  readonly candidates: readonly OccupationRef[];
}

export interface DiscoveryNoConfidentMatch {
  readonly kind: "no_confident_match";
  readonly reason: OccupationUnmatchedReason;
  /** Echoed for the participant's immediate benefit only; never persisted here. */
  readonly rawQuery: string;
}

export type DiscoverySubmission =
  DiscoveryNavigate | DiscoveryChoiceRequired | DiscoveryNoConfidentMatch;

/**
 * Resolves what a submitted search should do. Ambiguity always becomes an
 * explicit participant choice; an unmatched query never becomes an occupation.
 */
export function resolveDiscoverySubmission(
  universe: OccupationUniverse,
  rawQuery: string,
): DiscoverySubmission {
  const resolution = resolveOccupationIntent(universe, rawQuery);

  if (resolution.outcome === "resolved") {
    return {
      kind: "navigate",
      occupation: {
        occupationId: resolution.occupationId,
        occupationKey: resolution.occupationKey,
        canonicalTitle: resolution.canonicalTitle,
      },
    };
  }

  if (resolution.outcome === "clarification_required") {
    return {
      kind: "choice_required",
      reason: resolution.reason,
      candidates: resolution.candidates.map((candidate) => ({ ...candidate })),
    };
  }

  return { kind: "no_confident_match", reason: resolution.reason, rawQuery };
}

/** Canonical browse/example list. Deterministic, with no ranking or scoring. */
export function listCanonicalExamples(universe: OccupationUniverse): readonly OccupationRef[] {
  return universe
    .map((record) => occupationRefOf(record))
    .slice()
    .sort((left, right) => (left.occupationKey < right.occupationKey ? -1 : 1));
}

/* -------------------------------------------------------------------------- */
/* Role overview                                                              */
/* -------------------------------------------------------------------------- */

export interface RoleOverviewSalary {
  readonly starterGbp: number;
  readonly experiencedGbp: number;
  readonly source: OverviewSource;
}

export interface RoleOverviewWorkPattern {
  readonly typicalHours: string;
  readonly patternSummary: string;
  readonly source: OverviewSource;
}

/**
 * What the CTA may honestly offer. `assessment_available` means Increment 13
 * bound an exact Career Pack; the assessment flow itself arrives in Increment 15,
 * so this view-model exposes no start action.
 */
export type RoleAssessmentAvailability =
  | {
      readonly state: "assessment_available";
      /** Canonical occupation the coverage outcome was resolved for. */
      readonly occupationKey: string;
      readonly pack: CoveragePackRef;
    }
  | { readonly state: "assessment_not_available_yet" };

export interface RoleOverviewViewModel {
  readonly kind: "role_overview";
  readonly occupation: OccupationRef;
  readonly summary: string;
  readonly salary: RoleOverviewSalary;
  readonly workPattern: RoleOverviewWorkPattern;
  readonly marketContextSummary: string;
  readonly marketContextSource: OverviewSource;
  readonly dayToDay: readonly string[];
  readonly routeDisplays: readonly OverviewRouteDisplay[];
  readonly appeal: readonly string[];
  readonly challenges: readonly string[];
  readonly sources: readonly OverviewSource[];
  readonly assessment: RoleAssessmentAvailability;
}

export interface RoleOverviewUnavailable {
  readonly kind: "role_not_available";
  /** Why nothing can be shown. Never a claim about the occupation itself. */
  readonly reason: "unknown_occupation" | "overview_content_unavailable" | "route_mapping_invalid";
}

export type RoleOverviewResult = RoleOverviewViewModel | RoleOverviewUnavailable;

export interface RoleOverviewInput {
  /** Untrusted route parameter. Validated against the canonical universe. */
  readonly occupationKey: string;
  readonly universe: OccupationUniverse;
  readonly overviews: readonly CareerOverview[];
  readonly packs: readonly CareerPack[];
  /**
   * Assessment availability already resolved by the CLOSED Increment 13
   * coverage layer. This module never re-derives it and never widens it.
   */
  readonly assessment: RoleAssessmentAvailability;
}

function sourceByKey(overview: CareerOverview, sourceKey: string): OverviewSource {
  const source = overview.sources.find((entry) => entry.sourceKey === sourceKey);
  if (!source) throw new Error(`overview content references unknown sourceKey ${sourceKey}`);
  return source;
}

/**
 * Exact one-to-one check between declared pack routes and presentation copy.
 * A mismatch fails closed rather than showing a partial or invented route set.
 */
export function routeMappingIsExact(
  pack: CareerPack,
  routeDisplays: readonly OverviewRouteDisplay[],
): boolean {
  const declared = pack.routes.map((route) => route.routeKey).sort();
  const presented = routeDisplays.map((route) => route.routeKey).sort();
  return declared.length === presented.length && declared.every((key, i) => key === presented[i]);
}

/** Presentation route order follows the pack's declared order, not authored order. */
function orderedRouteDisplays(
  pack: CareerPack,
  routeDisplays: readonly OverviewRouteDisplay[],
): readonly OverviewRouteDisplay[] {
  return pack.routes.flatMap((route) => {
    const display = routeDisplays.find((entry) => entry.routeKey === route.routeKey);
    return display ? [display] : [];
  });
}

/**
 * Builds a role overview from canonical occupation truth, presentation content
 * and the exact bound Career Pack. The route parameter is never trusted.
 */
export function buildRoleOverview(input: RoleOverviewInput): RoleOverviewResult {
  const record = input.universe.find((entry) => entry.occupationKey === input.occupationKey);
  if (!record) return { kind: "role_not_available", reason: "unknown_occupation" };

  const occupation = occupationRefOf(record);
  const overview = careerOverviewByOccupationKey(input.overviews, occupation.occupationKey);
  if (!overview || overview.occupation.occupationId !== occupation.occupationId) {
    return { kind: "role_not_available", reason: "overview_content_unavailable" };
  }

  const assessment =
    input.assessment.state === "assessment_available" &&
    input.assessment.occupationKey === occupation.occupationKey
      ? input.assessment
      : ({ state: "assessment_not_available_yet" } as const);

  const boundPack =
    assessment.state === "assessment_available"
      ? input.packs.find((pack) => pack.careerPackId === assessment.pack.careerPackId)
      : undefined;

  if (boundPack && !routeMappingIsExact(boundPack, overview.routeDisplays)) {
    return { kind: "role_not_available", reason: "route_mapping_invalid" };
  }

  return {
    kind: "role_overview",
    occupation,
    summary: overview.summary,
    salary: {
      starterGbp: overview.salary.starterGbp,
      experiencedGbp: overview.salary.experiencedGbp,
      source: sourceByKey(overview, overview.salary.sourceKey),
    },
    workPattern: {
      typicalHours: overview.workPattern.typicalHours,
      patternSummary: overview.workPattern.patternSummary,
      source: sourceByKey(overview, overview.workPattern.sourceKey),
    },
    marketContextSummary: overview.marketContextSummary,
    marketContextSource: sourceByKey(overview, overview.marketContextSourceKey),
    dayToDay: overview.dayToDay,
    routeDisplays: boundPack
      ? orderedRouteDisplays(boundPack, overview.routeDisplays)
      : overview.routeDisplays,
    appeal: overview.appeal,
    challenges: overview.challenges,
    sources: overview.sources,
    assessment,
  };
}

/** Presentation-only money formatting. No rounding judgement, no score. */
export function formatGbpAnnual(amount: number): string {
  return `£${amount.toLocaleString("en-GB")}`;
}
