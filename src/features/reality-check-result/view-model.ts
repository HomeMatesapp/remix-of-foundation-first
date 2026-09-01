import type {
  CandidateRouteEvaluation,
  RequirementAssessment,
  RequirementSeverity,
} from "../../domain/contracts";
import type { RealityCheckEvaluation } from "../../domain/decision-engine";

import type { CareerResultCopy } from "./content-schema";
import { JUDGEMENT_COPY, type JudgementCopy } from "./judgement-copy";
import type { ResultActionRelation, ResultEvidenceItem } from "./result-types";

/**
 * Increment 16 — pure presentation view-model for a Reality Check result.
 *
 * It maps the Decision Engine's own structural output onto reviewed
 * participant copy. It is deliberately powerless:
 *
 * - it never derives, re-derives, softens, strengthens or re-orders a judgement,
 *   requirement state, route availability or ranking position;
 * - `unknown` and `verification_required` are presented as things to check, and
 *   never merged with `unmet`;
 * - a key with no reviewed copy is OMITTED; a raw internal key is never shown;
 * - an exact ranking TIE is presented as a tie: canonical key order is only the
 *   engine's deterministic tie-break and is never described as stronger;
 * - local provider, course, employer and vacancy access is NOT assessed here;
 * - no clock, no randomness, no network, no storage, no identity.
 */

export type RequirementDisplayStatus = "met" | "not_met" | "needs_checking" | "not_applicable";

export interface RequirementItem {
  readonly requirementKey: string;
  readonly label: string;
  readonly statement: string;
  readonly status: RequirementDisplayStatus;
  readonly severity: RequirementSeverity;
}

export interface ActionItem {
  readonly actionKey: string;
  readonly label: string;
  readonly guidance: string;
}

export interface CheckItem {
  readonly checkKey: string;
  readonly issue: string;
  readonly whyItMatters: string;
  readonly whatCouldResolveIt: string;
  /** Participant labels of routes the pack says this check affects. */
  readonly affectedRouteLabels: readonly string[];
  /** Participant labels of requirements the pack says this check relates to. */
  readonly relatedRequirementLabels: readonly string[];
  /** Triggered actions the pack itself relates to this check. */
  readonly relatedActions: readonly ActionItem[];
}

export interface BarrierItem {
  readonly barrierKey: string;
  readonly label: string;
  readonly explanation: string;
  /**
   * Engine truth, verbatim. `true` means the engine reported this barrier as
   * blocking, `false` means present but not blocking, and `null` means not yet
   * determined either way. A `false` or `null` barrier is never presented as
   * though it hard-blocks anything.
   */
  readonly blocking: boolean | null;
}

export interface RouteItem {
  readonly routeKey: string;
  readonly label: string;
  readonly beforeYouSpend: string;
  /** Engine ranking position, when a single ranking configuration applied. */
  readonly position: number | undefined;
  /** Engine truth, verbatim: null means unknown, never "no". */
  readonly eligibility: boolean | null;
  readonly practicalFit: boolean | null;
  /** False only when the engine determinately ruled this route out. */
  readonly viable: boolean;
  /** Positively matched ranking factor keys, exactly as the engine reported. */
  readonly factorKeys: readonly string[];
  readonly met: readonly RequirementItem[];
  readonly conditions: readonly RequirementItem[];
  readonly notApplicable: readonly RequirementItem[];
  /** Reviewed statements for ranking factors that positively matched. */
  readonly whyItFits: readonly string[];
  readonly barriers: readonly BarrierItem[];
  readonly checks: readonly CheckItem[];
  /**
   * Triggered actions the pack relates to this route, in the engine's canonical
   * key order. That order carries NO priority and is never presented as one.
   */
  readonly nextActions: readonly ActionItem[];
  /**
   * Set only when the engine triggered EXACTLY ONE action for this route, so
   * there is nothing to choose between. Never a selection out of several.
   */
  readonly soleNextAction: ActionItem | undefined;
}

export interface ResultViewModel {
  readonly careerTitle: string;
  readonly judgementValue: string;
  readonly judgement: JudgementCopy;
  /** True only when the engine applied a declared ranking configuration. */
  readonly ranked: boolean;
  /**
   * True only when the engine's own positively matched factors actually separate
   * or group viable routes. When false, nothing on screen may imply that the
   * displayed order is a preference.
   */
  readonly routePreferenceEstablished: boolean;
  /**
   * Set when exactly one viable route is surfaced prominently. Its BASIS is
   * always stated separately: it may be the only route left in contention rather
   * than a route the ranking factors actually preferred.
   */
  readonly strongestRoute: RouteItem | undefined;
  /** Why `strongestRoute` is surfaced; never inferred from key order. */
  readonly strongestRouteBasis: StrongestRouteBasis | undefined;

  /** Viable routes the engine cannot separate; never presented as ordered. */
  readonly tiedTopRoutes: readonly RouteItem[];
  readonly otherRoutes: readonly RouteItem[];
  /** Routes the engine reported as determinately unavailable. */
  readonly unavailableRoutes: readonly { readonly routeKey: string; readonly label: string }[];
  /**
   * A few short, neutral facts projected only from what the result already
   * surfaces. Nothing here is selected as "most important".
   */
  readonly summaryFacts: readonly string[];

  readonly overallRequirements: readonly RequirementItem[];
  readonly unresolved: readonly CheckItem[];
  readonly barriers: readonly BarrierItem[];
  readonly actions: readonly ActionItem[];
  readonly evidence: readonly ResultEvidenceItem[];
  readonly provenance: {
    readonly evaluatedAt: string;
    readonly careerPackVersion: string;
    readonly decisionEngineVersion: string;
  };
}

function requirementItem(
  assessment: RequirementAssessment,
  copy: CareerResultCopy,
): RequirementItem | undefined {
  const authored = copy.requirements.find(
    (entry) => entry.requirementKey === assessment.requirement.requirementKey,
  );
  if (!authored) return undefined;

  /* Engine state maps one-way onto display status. `unknown` is never `unmet`. */
  const status: RequirementDisplayStatus =
    assessment.state === "met"
      ? "met"
      : assessment.state === "unmet"
        ? "not_met"
        : assessment.state === "not_applicable"
          ? "not_applicable"
          : "needs_checking";

  return {
    requirementKey: authored.requirementKey,
    label: authored.label,
    statement: status === "met" ? authored.met : authored.gap,
    status,
    severity: assessment.severity,
  };
}

/**
 * Reviewed items for a list of assessments.
 *
 * Deduplicated by EXACT requirement identity: a pack route may legitimately
 * declare the same requirement under both eligibility and practical fit, and the
 * engine then reports it in both sub-envelopes. Showing it twice would imply two
 * separate outstanding matters. The engine's state is carried through unchanged;
 * only the repetition is removed.
 */
function requirementItems(
  assessments: readonly RequirementAssessment[],
  copy: CareerResultCopy,
): readonly RequirementItem[] {
  const seen = new Set<string>();
  return assessments.flatMap((assessment) => {
    const item = requirementItem(assessment, copy);
    if (!item) return [];
    if (seen.has(item.requirementKey)) return [];
    seen.add(item.requirementKey);
    return [item];
  });
}

function actionItems(keys: readonly string[], copy: CareerResultCopy): readonly ActionItem[] {
  return keys.flatMap((key) => {
    const authored = copy.actions.find((entry) => entry.actionKey === key);
    return authored ? [authored] : [];
  });
}

interface CheckContext {
  readonly relatedRequirementKeys: readonly string[];
  readonly relatedRouteKeys: readonly string[];
}

/**
 * Context for one unresolved check, using ONLY relationships the engine and the
 * bound pack already declare. No confirming body, authority or mechanism is
 * inferred here.
 */
function checkItems(
  checks: readonly ({ readonly checkKey: string } & Partial<CheckContext>)[],
  copy: CareerResultCopy,
  actionRelations: readonly ResultActionRelation[],
): readonly CheckItem[] {
  return checks.flatMap((check) => {
    const authored = copy.checks.find((entry) => entry.checkKey === check.checkKey);
    if (!authored) return [];
    const relatedActionKeys = actionRelations
      .filter((relation) => relation.relatedUnresolvedCheckKeys.includes(check.checkKey))
      .map((relation) => relation.actionKey);
    return [
      {
        ...authored,
        affectedRouteLabels: (check.relatedRouteKeys ?? []).flatMap((routeKey) => {
          const route = copy.routes.find((entry) => entry.routeKey === routeKey);
          return route ? [route.label] : [];
        }),
        relatedRequirementLabels: (check.relatedRequirementKeys ?? []).flatMap((requirementKey) => {
          const requirement = copy.requirements.find(
            (entry) => entry.requirementKey === requirementKey,
          );
          return requirement ? [requirement.label] : [];
        }),
        relatedActions: actionItems(relatedActionKeys, copy),
      },
    ];
  });
}

function barrierItems(
  barriers: readonly { readonly barrierKey: string; readonly blocking: boolean | null }[],
  copy: CareerResultCopy,
): readonly BarrierItem[] {
  return barriers.flatMap((barrier) => {
    const authored = copy.barriers.find((entry) => entry.barrierKey === barrier.barrierKey);
    if (!authored) return [];
    return [
      {
        barrierKey: authored.barrierKey,
        label: authored.label,
        explanation: authored.explanation,
        blocking: barrier.blocking,
      },
    ];
  });
}

/**
 * Next steps for one route.
 *
 * The engine emits triggered action keys in canonical order, which carries NO
 * priority. There is deliberately no authored or metadata-derived preference:
 * when a route has several triggered actions they are all presented neutrally,
 * and only a route with exactly ONE triggered action has a sole next step.
 */
function routeActions(
  routeKey: string,
  copy: CareerResultCopy,
  actionRelations: readonly ResultActionRelation[],
): {
  readonly nextActions: readonly ActionItem[];
  readonly soleNextAction: ActionItem | undefined;
} {
  const triggeredForRoute = actionRelations
    .filter((relation) => relation.relatedRouteKeys.includes(routeKey))
    .map((relation) => relation.actionKey);

  const nextActions = actionItems(triggeredForRoute, copy);
  return {
    nextActions,
    soleNextAction: nextActions.length === 1 ? nextActions[0] : undefined,
  };
}

function routeItem(
  candidate: CandidateRouteEvaluation,
  copy: CareerResultCopy,
  actionRelations: readonly ResultActionRelation[],
): RouteItem | undefined {
  const authored = copy.routes.find((entry) => entry.routeKey === candidate.route.routeKey);
  if (!authored) return undefined;

  const all = requirementItems(
    [
      ...candidate.eligibility.requirementAssessments,
      ...candidate.practicalFit.requirementAssessments,
    ],
    copy,
  );
  const factorKeys = candidate.ranking?.factorKeys ?? [];
  const { nextActions, soleNextAction } = routeActions(authored.routeKey, copy, actionRelations);

  return {
    routeKey: authored.routeKey,
    label: authored.label,
    beforeYouSpend: authored.beforeYouSpend,
    position: candidate.ranking?.position ?? undefined,
    eligibility: candidate.eligibility.satisfied,
    practicalFit: candidate.practicalFit.satisfied,
    /* Only a determinate negative removes a route from contention. */
    viable: candidate.eligibility.satisfied !== false && candidate.practicalFit.satisfied !== false,
    factorKeys,
    met: all.filter((item) => item.status === "met"),
    conditions: all.filter((item) => item.status === "not_met" || item.status === "needs_checking"),
    notApplicable: all.filter((item) => item.status === "not_applicable"),
    whyItFits: factorKeys.flatMap((factorKey) => {
      const factor = copy.factors.find((entry) => entry.factorKey === factorKey);
      return factor ? [factor.statement] : [];
    }),
    barriers: barrierItems(candidate.barriers, copy),
    checks: checkItems(candidate.unresolvedChecks, copy, actionRelations),
    nextActions,
    soleNextAction,
  };
}

function factorSignature(route: RouteItem): string {
  return [...route.factorKeys].sort().join("|");
}

/**
 * Why a single route is being surfaced prominently.
 *
 * - `factor_separation`: at least TWO routes were viable and the engine's own
 *   positively matched ranking factors actually separate this one from the
 *   others. It is never reachable with a single viable route.
 * - `sole_viable`: it is simply the only route not ruled out by a blocking issue
 *   on these answers. That is NOT a preference and must never be presented as
 *   one, even though it is useful to show prominently.
 */
export type StrongestRouteBasis = "factor_separation" | "sole_viable";

/**
 * Separates viable routes into "the engine genuinely puts this one first",
 * "the only route still in contention", "the engine cannot separate these" and
 * "everything else".
 *
 * The engine's own positively matched factor sets are the ONLY input to
 * preference. Canonical key order, which the closed engine uses purely as a
 * deterministic tie-break, is never treated as preference, and sole viability is
 * never treated as ranking preference either.
 */
function selectTopRoutes(routes: readonly RouteItem[]): {
  readonly strongest: RouteItem | undefined;
  readonly basis: StrongestRouteBasis | undefined;
  readonly tied: readonly RouteItem[];
} {
  const viable = routes.filter((route) => route.viable);
  if (viable.length === 0) return { strongest: undefined, basis: undefined, tied: [] };
  if (viable.length === 1) {
    return {
      strongest: viable[0],
      /*
       * With only one viable route there is nothing to separate it FROM, so
       * matched factors can explain fit but can never establish comparative
       * preference. This is sole viability regardless of factor keys.
       */
      basis: "sole_viable",
      tied: [],
    };
  }

  const leader = viable[0];
  if (!leader || leader.factorKeys.length === 0) {
    /* No positive factor distinguishes anything: nothing is called strongest. */
    return { strongest: undefined, basis: undefined, tied: [] };
  }
  const signature = factorSignature(leader);
  const tied = viable.filter((route) => factorSignature(route) === signature);
  if (tied.length === 1) return { strongest: leader, basis: "factor_separation", tied: [] };
  return { strongest: undefined, basis: undefined, tied };
}

/** Local access is explicitly outside this increment's assessment. */
export const LOCAL_ACCESS_NOT_ASSESSED =
  "Local access is not part of this result. Whether a provider, course, employer or vacancy near you is actually open to you has not been checked here.";

/**
 * A few neutral facts about what the result already contains.
 *
 * Nothing here is chosen as the most important thing: no first barrier, first
 * outstanding condition, first unresolved check or preferred next step is
 * singled out. Only counts and the engine's own route separation are stated.
 */
function summaryFacts(args: {
  readonly strongest: RouteItem | undefined;
  readonly strongestBasis: StrongestRouteBasis | undefined;
  readonly tied: readonly RouteItem[];
  readonly viableCount: number;
  readonly conditionCount: number;
  readonly checkCount: number;
  readonly barrierCount: number;
  readonly nextActionCount: number;
}): readonly string[] {
  const facts: string[] = [];

  if (args.strongest && args.strongestBasis === "factor_separation") {
    facts.push(
      `On your answers, this route is separated from the others: ${args.strongest.label}.`,
    );
  } else if (args.strongest) {
    facts.push(
      `This is the only route not ruled out by a blocking issue on your answers: ${args.strongest.label}. That is not a preference between routes, and no route has been recommended here.`,
    );
  } else if (args.tied.length > 1) {
    facts.push(
      `These routes fit at the same level on your answers and cannot be separated: ${args.tied
        .map((route) => route.label)
        .join(", ")}.`,
    );
  } else if (args.viableCount > 1) {
    facts.push(
      "No route has been preferred over another here, and the order routes appear in is not a recommendation.",
    );
  } else {
    facts.push("Your answers do not open a route on this pack's conditions yet.");
  }

  const counted = [
    args.conditionCount > 0
      ? `${args.conditionCount} outstanding ${args.conditionCount === 1 ? "condition" : "conditions"}`
      : undefined,
    args.checkCount > 0
      ? `${args.checkCount} ${args.checkCount === 1 ? "thing" : "things"} still to check`
      : undefined,
    args.barrierCount > 0
      ? `${args.barrierCount} ${args.barrierCount === 1 ? "barrier" : "barriers"} recorded below`
      : undefined,
  ].filter((entry): entry is string => entry !== undefined);
  if (counted.length > 0) facts.push(`This result contains ${counted.join(", ")}.`);

  if (args.nextActionCount > 0) {
    facts.push(
      args.nextActionCount === 1
        ? "There is one next step that follows from your answers."
        : `There are ${args.nextActionCount} next steps that follow from your answers, in no order of priority.`,
    );
  }

  facts.push(LOCAL_ACCESS_NOT_ASSESSED);
  return facts;
}

export function buildResultViewModel(input: {
  readonly evaluation: RealityCheckEvaluation;
  readonly evidence: readonly ResultEvidenceItem[];
  readonly copy: CareerResultCopy;
  /** Canonical pack relationships for the triggered actions, from the server. */
  readonly actionRelations?: readonly ResultActionRelation[];
}): ResultViewModel {
  const { evaluation, copy } = input;
  const { result } = evaluation;
  const actionRelations = input.actionRelations ?? [];

  const routes = result.candidateRoutes.flatMap((candidate) => {
    const item = routeItem(candidate, copy, actionRelations);
    return item ? [item] : [];
  });

  const ranked = routes.some((route) => route.position !== undefined);
  const { strongest, basis, tied } = selectTopRoutes(routes);
  const topKeys = new Set(
    [...(strongest ? [strongest] : []), ...tied].map((route) => route.routeKey),
  );

  const unavailableRoutes = evaluation.routeAvailability.flatMap((item) => {
    if (item.available !== false) return [];
    const authored = copy.routes.find((entry) => entry.routeKey === item.route.routeKey);
    return authored ? [{ routeKey: authored.routeKey, label: authored.label }] : [];
  });

  const overallRequirements = requirementItems(result.requirementAssessments, copy);
  const barriers = barrierItems(result.barriers, copy);
  const unresolved = checkItems(result.unresolvedChecks, copy, actionRelations);
  const displayedRoutes = routes;
  const actions = actionItems(evaluation.triggeredActionKeys, copy);

  /*
   * Truthful count: every DISTINCT declared requirement identity that the
   * displayed result actually presents as outstanding, across all displayed
   * candidate routes plus the overall assessments. Counting only one focus route
   * would undercount tied and other routes that are on screen too, and counting
   * per route would double-count a shared requirement.
   */
  const outstandingRequirementKeys = new Set(
    [...overallRequirements, ...displayedRoutes.flatMap((route) => route.conditions)]
      .filter((item) => item.status === "not_met" || item.status === "needs_checking")
      .map((item) => item.requirementKey),
  );

  return {
    careerTitle: copy.careerTitle,
    judgementValue: result.judgement,
    judgement: JUDGEMENT_COPY[result.judgement],
    ranked,
    routePreferenceEstablished: basis === "factor_separation" || tied.length > 1,
    strongestRoute: strongest,
    strongestRouteBasis: basis,
    tiedTopRoutes: tied,
    otherRoutes: routes.filter((route) => !topKeys.has(route.routeKey)),
    unavailableRoutes,
    summaryFacts: summaryFacts({
      strongest,
      strongestBasis: basis,
      tied,
      viableCount: routes.filter((route) => route.viable).length,
      conditionCount: outstandingRequirementKeys.size,
      checkCount: unresolved.length,
      barrierCount: barriers.length,
      nextActionCount: actions.length,
    }),

    overallRequirements,
    unresolved,
    barriers,
    actions,

    evidence: input.evidence,
    provenance: {
      evaluatedAt: result.provenance.evaluatedAt,
      careerPackVersion: result.provenance.careerPackVersion,
      decisionEngineVersion: evaluation.decisionEngineVersion,
    },
  };
}
