import type { CareerPack } from "../career-packs";
import type { BarrierResultItem, UnresolvedCheckItem } from "../contracts";
import { canonicalKeyList } from "./canonical";
import type { DecisionEngineIssue } from "./codes";
import type { RequirementResolutionIndex } from "./requirements";
import { evaluatePackRule, type AnswerIndex } from "./truth";

/**
 * Surfacing of barriers, unresolved checks and action keys.
 *
 * Canonical stable-key ordering and de-duplication throughout: authored array
 * order never determines output. Uncertainty is itself surfaced rather than
 * silently resolved in either direction.
 */

export interface SurfacedBarrier {
  readonly barrierKey: string;
  /** null means "not yet determined", never "no barrier". */
  readonly blocking: boolean | null;
  readonly relatedRequirementKeys: readonly string[];
  readonly relatedRouteKeys: readonly string[];
}

export interface SurfacedCheck {
  readonly checkKey: string;
  readonly relatedRequirementKeys: readonly string[];
  readonly relatedRouteKeys: readonly string[];
  readonly explanationKey: string | null;
}

export function surfaceBarriers(
  pack: CareerPack,
  answers: AnswerIndex,
):
  | { readonly ok: true; readonly barriers: readonly SurfacedBarrier[] }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const issues: DecisionEngineIssue[] = [];
  const barriers: SurfacedBarrier[] = [];

  for (const definition of pack.barriers) {
    let asserted = false;
    let unresolved = false;
    let targeted = false;

    for (const rule of pack.barrierRules) {
      if (rule.barrierKey !== definition.barrierKey) continue;
      targeted = true;
      const truth = evaluatePackRule(rule.when, answers);
      if (!truth.ok) {
        issues.push(...truth.issues);
        continue;
      }
      if (truth.value === true) asserted = true;
      else if (truth.value === null) unresolved = true;
    }

    if (!targeted) continue;
    if (!asserted && !unresolved) continue;

    barriers.push({
      barrierKey: definition.barrierKey,
      blocking: asserted ? definition.blocking : null,
      relatedRequirementKeys: canonicalKeyList(definition.relatedRequirementKeys),
      relatedRouteKeys: canonicalKeyList(definition.relatedRouteKeys),
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  barriers.sort((left, right) =>
    left.barrierKey < right.barrierKey ? -1 : left.barrierKey > right.barrierKey ? 1 : 0,
  );
  return { ok: true, barriers };
}

export function surfaceUnresolvedChecks(args: {
  readonly pack: CareerPack;
  readonly answers: AnswerIndex;
  readonly resolutions: RequirementResolutionIndex;
  /** Requirement keys actually surfaced in this evaluation. */
  readonly surfacedRequirementKeys: ReadonlySet<string>;
  /** Candidate route keys, used for the local-requirement obligation. */
  readonly candidateRouteKeys: readonly string[];
}):
  | { readonly ok: true; readonly checks: readonly SurfacedCheck[] }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const { pack, answers, resolutions, surfacedRequirementKeys, candidateRouteKeys } = args;
  const issues: DecisionEngineIssue[] = [];
  const surfaced = new Set<string>();

  for (const definition of pack.unresolvedChecks) {
    let present = false;
    let targeted = false;

    for (const rule of pack.unresolvedCheckRules) {
      if (rule.checkKey !== definition.checkKey) continue;
      targeted = true;
      const truth = evaluatePackRule(rule.when, answers);
      if (!truth.ok) {
        issues.push(...truth.issues);
        continue;
      }
      /* True surfaces the check; unknown is itself unresolved and surfaces it. */
      if (truth.value === true || truth.value === null) present = true;
    }

    if (targeted && present) {
      surfaced.add(definition.checkKey);
      continue;
    }

    /* Auto-surface: a surfaced related requirement is unknown or needs verification. */
    for (const requirementKey of definition.relatedRequirementKeys) {
      if (!surfacedRequirementKeys.has(requirementKey)) continue;
      const resolution = resolutions.get(requirementKey);
      if (!resolution) continue;
      if (resolution.state === "unknown" || resolution.state === "verification_required") {
        surfaced.add(definition.checkKey);
        break;
      }
    }
  }

  /**
   * Local requirements are unresolved in Increment 9 by construction: no local
   * fact evaluation exists. Only the pack's own declared check key is surfaced —
   * no generic key is invented.
   */
  const candidates = new Set(candidateRouteKeys);
  for (const local of pack.localRequirements) {
    const attachedByRoute = pack.routes.some(
      (route) =>
        candidates.has(route.routeKey) &&
        route.localRequirementKeys.includes(local.localRequirementKey),
    );
    const attachedByDeclaration = local.relatedRouteKeys.some((routeKey) =>
      candidates.has(routeKey),
    );
    if (!attachedByRoute && !attachedByDeclaration) continue;
    if (typeof local.unresolvedCheckKey === "string") surfaced.add(local.unresolvedCheckKey);
  }

  if (issues.length > 0) return { ok: false, issues };

  const definitions = new Map(pack.unresolvedChecks.map((check) => [check.checkKey, check]));
  const checks: SurfacedCheck[] = [];
  for (const checkKey of canonicalKeyList([...surfaced])) {
    const definition = definitions.get(checkKey);
    if (!definition) continue;
    checks.push({
      checkKey,
      relatedRequirementKeys: canonicalKeyList(definition.relatedRequirementKeys),
      relatedRouteKeys: canonicalKeyList(definition.relatedRouteKeys),
      explanationKey: definition.explanationKey ?? null,
    });
  }
  return { ok: true, checks };
}

export function surfaceTriggeredActionKeys(
  pack: CareerPack,
  answers: AnswerIndex,
):
  | { readonly ok: true; readonly actionKeys: readonly string[] }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const issues: DecisionEngineIssue[] = [];
  const triggered = new Set<string>();

  for (const rule of pack.actionRules) {
    const truth = evaluatePackRule(rule.when, answers);
    if (!truth.ok) {
      issues.push(...truth.issues);
      continue;
    }
    /* Only a determinately-true rule triggers an action. */
    if (truth.value === true) triggered.add(rule.actionKey);
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, actionKeys: canonicalKeyList([...triggered]) };
}

/* -------------------------------------------------------------------------- */
/* Frozen contract shapes                                                     */
/* -------------------------------------------------------------------------- */

export function barrierResultItem(barrier: SurfacedBarrier): BarrierResultItem {
  return {
    barrierKey: barrier.barrierKey,
    blocking: barrier.blocking,
    relatedRequirementKeys: [...barrier.relatedRequirementKeys],
  };
}

export function unresolvedCheckItem(check: SurfacedCheck): UnresolvedCheckItem {
  return {
    checkKey: check.checkKey,
    relatedRequirementKeys: [...check.relatedRequirementKeys],
    relatedRouteKeys: [...check.relatedRouteKeys],
    explanationKey: check.explanationKey,
  };
}
