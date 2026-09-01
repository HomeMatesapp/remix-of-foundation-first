import {
  REALITY_CHECK_JUDGEMENTS,
  type RealityCheckJudgement,
  type RequirementSeverity,
  type RequirementState,
} from "../contracts";
import type { Truth } from "./truth";

/**
 * Overall protected judgement.
 *
 * Exactly the four frozen values, no fifth state, no participant copy. Unknown
 * always wins over a negative conclusion: a route can only contribute to
 * `not_realistic_yet` when nothing about it is unresolved in a way that could
 * change that conclusion.
 */
export const JUDGEMENTS: readonly RealityCheckJudgement[] = REALITY_CHECK_JUDGEMENTS;

export interface JudgementRouteInput {
  readonly routeKey: string;
  readonly available: Truth;
  readonly eligibilitySatisfied: Truth;
  readonly practicalFitSatisfied: Truth;
  /** Blocking barriers attached to this route (blocking === true). */
  readonly hasRouteBlockingBarrier: boolean;
  /** Unresolved checks attached to this route. */
  readonly hasRouteUnresolvedCheck: boolean;
  /**
   * A preferred/contextual requirement on this route assessed as `unmet`,
   * `unknown` or `verification_required`.
   */
  readonly hasConditionGap: boolean;
}

export interface JudgementInput {
  /** Every DECLARED route, including routes excluded from candidates. */
  readonly routes: readonly JudgementRouteInput[];
  readonly hasGlobalBlockingBarrier: boolean;
  readonly hasGlobalUnresolvedCheck: boolean;
}

export function isDefinitelyFeasible(route: JudgementRouteInput): boolean {
  return (
    route.available === true &&
    route.eligibilitySatisfied === true &&
    route.practicalFitSatisfied === true
  );
}

export function hasMandatoryUncertainty(route: JudgementRouteInput): boolean {
  return (
    route.available === null ||
    route.eligibilitySatisfied === null ||
    route.practicalFitSatisfied === null
  );
}

export function isDefinitelyBlocked(route: JudgementRouteInput): boolean {
  return (
    route.available === false ||
    route.eligibilitySatisfied === false ||
    route.practicalFitSatisfied === false
  );
}

/** Is a preferred/contextual requirement state a known condition gap? */
export function isConditionGap(severity: RequirementSeverity, state: RequirementState): boolean {
  if (severity === "mandatory") return false;
  return state === "unmet" || state === "unknown" || state === "verification_required";
}

export function decideJudgement(input: JudgementInput): RealityCheckJudgement {
  const blocking = (route: JudgementRouteInput): boolean =>
    route.hasRouteBlockingBarrier || input.hasGlobalBlockingBarrier;
  const unresolved = (route: JudgementRouteInput): boolean =>
    route.hasRouteUnresolvedCheck || input.hasGlobalUnresolvedCheck;

  /* 1. A feasible route with nothing outstanding at all. */
  if (
    input.routes.some(
      (route) =>
        isDefinitelyFeasible(route) &&
        !blocking(route) &&
        !unresolved(route) &&
        !route.hasConditionGap,
    )
  ) {
    return "realistic_now";
  }

  /* 2. KNOWN conditionality on a feasible route — not missing information. */
  if (
    input.routes.some(
      (route) =>
        isDefinitelyFeasible(route) &&
        (blocking(route) || route.hasConditionGap) &&
        !unresolved(route),
    )
  ) {
    return "realistic_with_conditions";
  }

  /* 3. Anything genuinely unresolved outranks a negative conclusion. */
  if (
    input.routes.some(
      (route) =>
        !isDefinitelyBlocked(route) && (hasMandatoryUncertainty(route) || unresolved(route)),
    )
  ) {
    return "more_information_needed";
  }

  /* 4. Only when every declared route is definitively blocked. */
  if (input.routes.length > 0 && input.routes.every((route) => isDefinitelyBlocked(route))) {
    return "not_realistic_yet";
  }

  /* Fail safe: never conclude negatively when the picture is not determinate. */
  return "more_information_needed";
}
