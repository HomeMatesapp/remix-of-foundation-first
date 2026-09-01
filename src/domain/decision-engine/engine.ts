import {
  buildDeterministicProvenance,
  deepFreezeDocument,
  safeParseCanonicalAnswerSnapshot,
  safeParseCanonicalEvidenceContextSnapshot,
  type AnswerSnapshot,
  type EvidenceContextSnapshot,
} from "../assessment-inputs";
import { safeParseCanonicalCareerPack, type CareerPack } from "../career-packs";
import {
  isoTimestampSchema,
  snapshotRefSchema,
  type BarrierResultItem,
  type CandidateRouteEvaluation,
  type RealityCheckResult,
  type RequirementAssessment,
  type SnapshotRef,
  type UnresolvedCheckItem,
} from "../contracts";
import { DOMAIN_CONTRACT_VERSION } from "../contracts/version";
import { canonicalKeyList, routeRefOf, sortStableKeys } from "./canonical";
import {
  DECISION_ENGINE_VERSION,
  DecisionEngineError,
  engineIssue,
  type DecisionEngineIssue,
} from "./codes";
import { buildEvidenceIndex } from "./evidence";
import { decideJudgement, isConditionGap, type JudgementRouteInput } from "./judgement";
import { rankCandidateRoutes } from "./ranking";
import {
  buildRequirementAssessment,
  resolveRequirements,
  type RequirementResolution,
} from "./requirements";
import { resolveRouteAvailability } from "./routes";
import {
  barrierResultItem,
  surfaceBarriers,
  surfaceTriggeredActionKeys,
  surfaceUnresolvedChecks,
  unresolvedCheckItem,
  type SurfacedBarrier,
  type SurfacedCheck,
} from "./signals";
import { realityCheckEvaluationSchema, type RealityCheckEvaluation } from "./schema";
import { buildAnswerIndex, type Truth } from "./truth";

/**
 * The shared deterministic Decision Engine.
 *
 * ONE evaluator for every occupation and every Career Pack: there is no
 * career-specific, occupation-specific or slug-specific branch anywhere in this
 * package. Every consequential decision comes from validated declarative pack
 * data plus the exact immutable assessment-input snapshots.
 *
 * Purity contract:
 * - no ambient clock (`Date.now`, `new Date()`), no environment, no filesystem,
 *   no network, no database, no live Evidence Registry and no mutable state;
 * - `evaluatedAt` is always caller-supplied;
 * - identical exact inputs — including `evaluatedAt` and the optional opaque
 *   local snapshot reference — produce byte-equivalent structural output.
 *
 * AI holds no authority here: no model, prompt or generation metadata exists in
 * the inputs, the logic or the output.
 */

export interface EvaluateRealityCheckInput {
  /** The exact canonical Career Pack (revalidated through its own boundary). */
  readonly pack: unknown;
  /** The exact canonical Answer Snapshot. */
  readonly answerSnapshot: unknown;
  /** The exact canonical Evidence Context Snapshot. */
  readonly evidenceContext: unknown;
  /** Caller-supplied evaluation instant. The engine never reads a clock. */
  readonly evaluatedAt: string;
  /** Opaque Local Reality snapshot reference only. No local fact evaluation. */
  readonly localSnapshot?: SnapshotRef | null;
}

export type SafeEvaluationResult =
  | { readonly ok: true; readonly evaluation: RealityCheckEvaluation }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] };

/* -------------------------------------------------------------------------- */
/* Input boundary                                                             */
/* -------------------------------------------------------------------------- */

interface ValidatedInput {
  readonly pack: CareerPack;
  readonly answerSnapshot: AnswerSnapshot;
  readonly evidenceContext: EvidenceContextSnapshot;
  readonly evaluatedAt: string;
  readonly localSnapshot?: SnapshotRef | null;
}

function validateInput(
  input: EvaluateRealityCheckInput,
):
  | { readonly ok: true; readonly input: ValidatedInput }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const packOutcome = safeParseCanonicalCareerPack(input.pack);
  if (!packOutcome.ok) {
    return {
      ok: false,
      issues: packOutcome.issues.map((issue) =>
        engineIssue("invalid_career_pack", `${issue.code}: ${issue.message}`, issue.at),
      ),
    };
  }
  const pack = packOutcome.pack;

  const issues: DecisionEngineIssue[] = [];

  /* Snapshot hash binding is always recomputed: caller hashes are never trusted. */
  const answers = safeParseCanonicalAnswerSnapshot(input.answerSnapshot, pack);
  if (!answers.ok) {
    for (const issue of answers.issues) {
      issues.push(
        engineIssue("invalid_answer_snapshot", `${issue.code}: ${issue.message}`, issue.at),
      );
    }
  }
  const evidence = safeParseCanonicalEvidenceContextSnapshot(input.evidenceContext, pack);
  if (!evidence.ok) {
    for (const issue of evidence.issues) {
      issues.push(
        engineIssue("invalid_evidence_context", `${issue.code}: ${issue.message}`, issue.at),
      );
    }
  }

  const evaluatedAt = isoTimestampSchema.safeParse(input.evaluatedAt);
  if (!evaluatedAt.success) {
    issues.push(
      engineIssue(
        "invalid_evaluated_at",
        "evaluatedAt must be an exact ISO instant",
        "evaluatedAt",
      ),
    );
  }

  let localSnapshot: SnapshotRef | null | undefined;
  if (input.localSnapshot !== undefined) {
    if (input.localSnapshot === null) {
      localSnapshot = null;
    } else {
      const parsed = snapshotRefSchema.safeParse(input.localSnapshot);
      if (!parsed.success) {
        issues.push(
          engineIssue(
            "invalid_local_snapshot",
            "localSnapshot must be an opaque snapshot reference",
            "localSnapshot",
          ),
        );
      } else {
        localSnapshot = parsed.data;
      }
    }
  }

  if (issues.length > 0 || !answers.ok || !evidence.ok || !evaluatedAt.success) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    input:
      localSnapshot === undefined
        ? {
            pack,
            answerSnapshot: answers.snapshot,
            evidenceContext: evidence.snapshot,
            evaluatedAt: evaluatedAt.data,
          }
        : {
            pack,
            answerSnapshot: answers.snapshot,
            evidenceContext: evidence.snapshot,
            evaluatedAt: evaluatedAt.data,
            localSnapshot,
          },
  };
}

/* -------------------------------------------------------------------------- */
/* Purpose satisfaction                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Eligibility and practical fit are STRUCTURALLY SEPARATE: neither envelope may
 * ever determine the other. Only MANDATORY requirements can make a purpose
 * negative or unresolved; preferred/contextual requirements stay visible without
 * ever forcing `false` or `null`.
 */
function purposeSatisfaction(
  requirementKeys: readonly string[],
  resolutions: ReadonlyMap<string, RequirementResolution>,
): Truth {
  let unresolved = false;
  for (const key of requirementKeys) {
    const resolution = resolutions.get(key);
    if (!resolution) continue;
    if (resolution.severity !== "mandatory") continue;
    if (resolution.state === "unmet") return false;
    if (resolution.state === "unknown" || resolution.state === "verification_required") {
      unresolved = true;
    }
  }
  return unresolved ? null : true;
}

/* -------------------------------------------------------------------------- */
/* Evaluation                                                                 */
/* -------------------------------------------------------------------------- */

export function safeEvaluateRealityCheck(input: EvaluateRealityCheckInput): SafeEvaluationResult {
  const validated = validateInput(input);
  if (!validated.ok) return { ok: false, issues: validated.issues };
  const { pack, answerSnapshot, evidenceContext, evaluatedAt, localSnapshot } = validated.input;

  const answers = buildAnswerIndex(answerSnapshot);
  const evidenceIndex = buildEvidenceIndex(evidenceContext);

  const requirements = resolveRequirements(pack, answers, evidenceIndex);
  if (!requirements.ok) return { ok: false, issues: requirements.issues };
  const resolutions = requirements.resolutions;

  const availability = resolveRouteAvailability(pack, answers);
  if (!availability.ok) return { ok: false, issues: availability.issues };
  const availabilityByRoute = new Map(
    availability.availability.map((item) => [item.routeKey, item.available] as const),
  );

  const declaredRouteKeys = sortStableKeys(pack.routes.map((route) => route.routeKey));
  /* A determinately unavailable route is excluded from candidates but remains
   * visible in the engine envelope's routeAvailability. */
  const candidateRouteKeys = declaredRouteKeys.filter(
    (routeKey) => availabilityByRoute.get(routeKey) !== false,
  );

  const routesByKey = new Map(pack.routes.map((route) => [route.routeKey, route] as const));

  /* Requirements attached to any DECLARED route belong to that route; the rest
   * are overall, route-independent assessments. */
  const routeAttachedKeys = new Set<string>();
  for (const route of pack.routes) {
    for (const key of route.eligibilityRequirementKeys) routeAttachedKeys.add(key);
    for (const key of route.practicalFitRequirementKeys) routeAttachedKeys.add(key);
  }
  const overallRequirementKeys = sortStableKeys(
    pack.requirements
      .map((requirement) => requirement.requirementKey)
      .filter((key) => !routeAttachedKeys.has(key)),
  );

  const surfacedRequirementKeys = new Set<string>(overallRequirementKeys);
  for (const routeKey of candidateRouteKeys) {
    const route = routesByKey.get(routeKey);
    if (!route) continue;
    for (const key of route.eligibilityRequirementKeys) surfacedRequirementKeys.add(key);
    for (const key of route.practicalFitRequirementKeys) surfacedRequirementKeys.add(key);
  }

  const barriers = surfaceBarriers(pack, answers);
  if (!barriers.ok) return { ok: false, issues: barriers.issues };

  const checks = surfaceUnresolvedChecks({
    pack,
    answers,
    resolutions,
    surfacedRequirementKeys,
    candidateRouteKeys,
  });
  if (!checks.ok) return { ok: false, issues: checks.issues };

  const actions = surfaceTriggeredActionKeys(pack, answers);
  if (!actions.ok) return { ok: false, issues: actions.issues };

  const ranking = rankCandidateRoutes({ pack, answers, candidateRouteKeys });
  if (!ranking.ok) return { ok: false, issues: ranking.issues };

  /* ---- Signal placement ------------------------------------------------- */

  const globalBarriers: readonly SurfacedBarrier[] = barriers.barriers.filter(
    (barrier) => barrier.relatedRouteKeys.length === 0,
  );
  const globalChecks: readonly SurfacedCheck[] = checks.checks.filter(
    (check) => check.relatedRouteKeys.length === 0,
  );
  const barriersForRoute = (routeKey: string): readonly SurfacedBarrier[] =>
    barriers.barriers.filter((barrier) => barrier.relatedRouteKeys.includes(routeKey));
  const checksForRoute = (routeKey: string): readonly SurfacedCheck[] =>
    checks.checks.filter((check) => check.relatedRouteKeys.includes(routeKey));

  const surfacedCheckKeys = checks.checks;

  const assessmentFor = (resolution: RequirementResolution): RequirementAssessment => {
    const related = surfacedCheckKeys.filter((check) =>
      check.relatedRequirementKeys.includes(resolution.requirementKey),
    );
    const explanation =
      related.find((check) => check.explanationKey !== null)?.explanationKey ?? null;
    return buildRequirementAssessment(
      resolution,
      related.map((check) => check.checkKey),
      explanation,
    );
  };

  const assessmentsFor = (keys: readonly string[]): readonly RequirementAssessment[] =>
    sortStableKeys(keys)
      .map((key) => resolutions.get(key))
      .filter((resolution): resolution is RequirementResolution => resolution !== undefined)
      .map(assessmentFor);

  /* ---- Candidate route evaluations --------------------------------------- */

  const judgementRoutes: JudgementRouteInput[] = [];
  const candidateEvaluations: CandidateRouteEvaluation[] = [];

  const routeSatisfaction = new Map<
    string,
    { readonly eligibility: Truth; readonly practicalFit: Truth }
  >();

  for (const routeKey of declaredRouteKeys) {
    const route = routesByKey.get(routeKey);
    if (!route) continue;
    const eligibility = purposeSatisfaction(route.eligibilityRequirementKeys, resolutions);
    const practicalFit = purposeSatisfaction(route.practicalFitRequirementKeys, resolutions);
    routeSatisfaction.set(routeKey, { eligibility, practicalFit });

    const conditionGap = [
      ...route.eligibilityRequirementKeys,
      ...route.practicalFitRequirementKeys,
    ].some((key) => {
      const resolution = resolutions.get(key);
      return resolution ? isConditionGap(resolution.severity, resolution.state) : false;
    });

    judgementRoutes.push({
      routeKey,
      available: availabilityByRoute.get(routeKey) ?? null,
      eligibilitySatisfied: eligibility,
      practicalFitSatisfied: practicalFit,
      hasRouteBlockingBarrier: barriersForRoute(routeKey).some(
        (barrier) => barrier.blocking === true,
      ),
      hasRouteUnresolvedCheck: checksForRoute(routeKey).length > 0,
      hasConditionGap: conditionGap,
    });
  }

  for (const routeKey of ranking.outcome.order) {
    const route = routesByKey.get(routeKey);
    if (!route) continue;
    const satisfaction = routeSatisfaction.get(routeKey);
    if (!satisfaction) continue;
    const metadata = ranking.outcome.metadata.get(routeKey);

    const evaluation: CandidateRouteEvaluation = {
      route: routeRefOf(route),
      eligibility: {
        satisfied: satisfaction.eligibility,
        requirementAssessments: [...assessmentsFor(route.eligibilityRequirementKeys)],
      },
      practicalFit: {
        satisfied: satisfaction.practicalFit,
        requirementAssessments: [...assessmentsFor(route.practicalFitRequirementKeys)],
      },
      barriers: barriersForRoute(routeKey).map(barrierResultItem),
      unresolvedChecks: checksForRoute(routeKey).map(unresolvedCheckItem),
      ranking: metadata ?? null,
    };
    candidateEvaluations.push(evaluation);
  }

  /* ---- Judgement --------------------------------------------------------- */

  const judgement = decideJudgement({
    routes: judgementRoutes,
    hasGlobalBlockingBarrier: globalBarriers.some((barrier) => barrier.blocking === true),
    hasGlobalUnresolvedCheck: globalChecks.length > 0,
  });

  /* ---- Provenance -------------------------------------------------------- */

  const provenance = buildDeterministicProvenance({
    answerSnapshot,
    evidenceContext,
    decisionEngineVersion: DECISION_ENGINE_VERSION,
    evaluatedAt,
    ...(localSnapshot === undefined ? {} : { localSnapshot }),
  });
  if (!provenance.ok) {
    return {
      ok: false,
      issues: provenance.issues.map((issue) =>
        engineIssue("provenance_invalid", `${issue.code}: ${issue.message}`, issue.at),
      ),
    };
  }

  /* ---- Frozen result contract ------------------------------------------- */

  const overallBarriers: readonly BarrierResultItem[] = globalBarriers.map(barrierResultItem);
  const overallChecks: readonly UnresolvedCheckItem[] = globalChecks.map(unresolvedCheckItem);

  const resultCandidate = {
    contractVersion: DOMAIN_CONTRACT_VERSION,
    judgement,
    candidateRoutes: candidateEvaluations,
    requirementAssessments: assessmentsFor(overallRequirementKeys),
    barriers: overallBarriers,
    unresolvedChecks: overallChecks,
    provenance: provenance.provenance,
  };

  const parsedResult = realityCheckResultParse(resultCandidate);
  if (!parsedResult.ok) return { ok: false, issues: parsedResult.issues };

  const envelopeCandidate = {
    decisionEngineVersion: DECISION_ENGINE_VERSION,
    result: parsedResult.result,
    routeAvailability: declaredRouteKeys.map((routeKey) => {
      const route = routesByKey.get(routeKey);
      return {
        route: route ? routeRefOf(route) : { routeKey },
        available: availabilityByRoute.get(routeKey) ?? null,
      };
    }),
    triggeredActionKeys: canonicalKeyList(actions.actionKeys),
  };

  const envelope = realityCheckEvaluationSchema.safeParse(envelopeCandidate);
  if (!envelope.success) {
    return {
      ok: false,
      issues: envelope.error.issues.map((issue) =>
        engineIssue("invalid_evaluation_envelope", issue.message, issue.path.join(".")),
      ),
    };
  }

  return { ok: true, evaluation: deepFreezeDocument(envelope.data) };
}

function realityCheckResultParse(
  candidate: unknown,
):
  | { readonly ok: true; readonly result: RealityCheckResult }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const parsed = realityCheckEvaluationSchema.shape.result.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) =>
        engineIssue("invalid_evaluation_envelope", issue.message, issue.path.join(".")),
      ),
    };
  }
  return { ok: true, result: parsed.data };
}

/** Throwing variant. Fails closed: there is never a partial successful result. */
export function evaluateRealityCheck(input: EvaluateRealityCheckInput): RealityCheckEvaluation {
  const outcome = safeEvaluateRealityCheck(input);
  if (!outcome.ok) throw new DecisionEngineError(outcome.issues);
  return outcome.evaluation;
}
