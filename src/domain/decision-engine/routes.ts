import type { CareerPack, CareerPackRouteDefinition } from "../career-packs";
import { engineIssue, type DecisionEngineIssue } from "./codes";
import { evaluatePackRule, type AnswerIndex, type Truth } from "./truth";

/**
 * Route availability: internal tri-state, evaluated ONLY from the route's own
 * declared availability rules.
 *
 * There is no hidden default selector, no provider/vacancy logic and no local
 * fact evaluation. Absence of an answer can never make a route unavailable.
 */

export interface RouteAvailability {
  readonly routeKey: string;
  /** true = available, false = declared unavailable, null = unresolved. */
  readonly available: Truth;
}

function availabilityOf(
  route: CareerPackRouteDefinition,
  pack: CareerPack,
  answers: AnswerIndex,
):
  | { readonly ok: true; readonly available: Truth }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const issues: DecisionEngineIssue[] = [];
  const asserted = new Set<boolean>();
  const possible = new Set<boolean>();

  const rulesByKey = new Map(pack.routeAvailabilityRules.map((rule) => [rule.ruleKey, rule]));

  for (const ruleKey of route.availabilityRuleKeys) {
    const rule = rulesByKey.get(ruleKey);
    if (!rule) {
      issues.push(
        engineIssue(
          "missing_pack_definition",
          "route declares an availability rule key with no matching rule",
          `route:${route.routeKey}/availabilityRule:${ruleKey}`,
        ),
      );
      continue;
    }
    const truth = evaluatePackRule(rule.when, answers);
    if (!truth.ok) {
      issues.push(...truth.issues);
      continue;
    }
    if (truth.value === true) asserted.add(rule.available);
    else if (truth.value === null) possible.add(rule.available);
  }

  if (issues.length > 0) return { ok: false, issues };

  if (asserted.size > 1) {
    return {
      ok: false,
      issues: [
        engineIssue(
          "conflicting_route_availability_rules",
          "determinately-true availability rules assert both available and unavailable; no precedence is invented",
          `route:${route.routeKey}`,
        ),
      ],
    };
  }

  /* No declared unavailability condition applies: the route stays available. */
  const declared = asserted.size === 1 ? ([...asserted][0] as boolean) : true;

  for (const candidate of possible) {
    /* An unresolved rule that could assert the opposite of the current outcome
     * leaves availability genuinely unresolved. */
    if (candidate !== declared) return { ok: true, available: null };
  }
  return { ok: true, available: declared };
}

export function resolveRouteAvailability(
  pack: CareerPack,
  answers: AnswerIndex,
):
  | { readonly ok: true; readonly availability: readonly RouteAvailability[] }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const issues: DecisionEngineIssue[] = [];
  const availability: RouteAvailability[] = [];

  for (const route of pack.routes) {
    const outcome = availabilityOf(route, pack, answers);
    if (!outcome.ok) {
      issues.push(...outcome.issues);
      continue;
    }
    availability.push({ routeKey: route.routeKey, available: outcome.available });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, availability };
}
