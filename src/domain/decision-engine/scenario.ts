import { createAnswerSnapshot } from "../assessment-inputs";
import { safeParseCanonicalCareerPack, type CareerPackScenario } from "../career-packs";
import type { SnapshotRef } from "../contracts";
import { engineIssue, type DecisionEngineIssue } from "./codes";
import { safeEvaluateRealityCheck } from "./engine";
import type { RealityCheckEvaluation } from "./schema";

/**
 * Pure scenario runner.
 *
 * Sufficient for the EXISTING seven frozen `CareerPackScenario` assertion kinds
 * and nothing more. It performs no writes, records no run, mints no attestation
 * and does not touch the publication gate: consuming this runner inside the
 * governance attestation gate is a later increment's decision.
 */

export interface ScenarioAssertionFailure {
  /** Stable index of the failed assertion within `scenario.expect`. */
  readonly index: number;
  readonly kind: CareerPackScenario["expect"][number]["kind"];
  /** Stable key the assertion addressed, when the kind carries one. */
  readonly key?: string;
}

export interface ScenarioRunOutcome {
  readonly scenarioKey: string;
  readonly passed: boolean;
  readonly failures: readonly ScenarioAssertionFailure[];
  readonly evaluation: RealityCheckEvaluation;
}

export interface RunCareerPackScenarioInput {
  readonly pack: unknown;
  readonly scenarioKey: string;
  /** Caller-supplied deterministic Answer Snapshot id. */
  readonly answerSnapshotId: string;
  /** The exact canonical Evidence Context Snapshot for this scenario run. */
  readonly evidenceContext: unknown;
  /** Caller-supplied evaluation instant. The runner never reads a clock. */
  readonly evaluatedAt: string;
  readonly localSnapshot?: SnapshotRef | null;
}

export type ScenarioRunResult =
  | { readonly ok: true; readonly outcome: ScenarioRunOutcome }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] };

function failure(
  index: number,
  assertion: CareerPackScenario["expect"][number],
): ScenarioAssertionFailure {
  switch (assertion.kind) {
    case "judgement_is":
      return { index, kind: assertion.kind };
    case "requirement_state_is":
      return { index, kind: assertion.kind, key: assertion.requirementKey };
    case "route_eligibility_is":
    case "route_practical_fit_is":
      return { index, kind: assertion.kind, key: assertion.routeKey };
    case "barrier_present":
      return { index, kind: assertion.kind, key: assertion.barrierKey };
    case "unresolved_check_present":
      return { index, kind: assertion.kind, key: assertion.checkKey };
    case "action_present":
      return { index, kind: assertion.kind, key: assertion.actionKey };
  }
}

export function runCareerPackScenario(input: RunCareerPackScenarioInput): ScenarioRunResult {
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

  const scenario = pack.scenarios.find((entry) => entry.scenarioKey === input.scenarioKey);
  if (!scenario) {
    return {
      ok: false,
      issues: [
        engineIssue(
          "unknown_scenario",
          "the Career Pack declares no scenario with this key",
          `scenario:${input.scenarioKey}`,
        ),
      ],
    };
  }

  const snapshot = createAnswerSnapshot({
    snapshotId: input.answerSnapshotId,
    pack,
    answers: scenario.answers.map((fixture) => ({
      question: fixture.question,
      value: fixture.value,
    })),
  });
  if (!snapshot.ok) {
    return {
      ok: false,
      issues: snapshot.issues.map((issue) =>
        engineIssue("invalid_scenario_answers", `${issue.code}: ${issue.message}`, issue.at),
      ),
    };
  }

  const evaluated = safeEvaluateRealityCheck({
    pack,
    answerSnapshot: snapshot.snapshot,
    evidenceContext: input.evidenceContext,
    evaluatedAt: input.evaluatedAt,
    ...(input.localSnapshot === undefined ? {} : { localSnapshot: input.localSnapshot }),
  });
  if (!evaluated.ok) return { ok: false, issues: evaluated.issues };

  const evaluation = evaluated.evaluation;
  const result = evaluation.result;

  const allAssessments = [
    ...result.requirementAssessments,
    ...result.candidateRoutes.flatMap((route) => [
      ...route.eligibility.requirementAssessments,
      ...route.practicalFit.requirementAssessments,
    ]),
  ];
  const allBarrierKeys = new Set<string>([
    ...result.barriers.map((barrier) => barrier.barrierKey),
    ...result.candidateRoutes.flatMap((route) =>
      route.barriers.map((barrier) => barrier.barrierKey),
    ),
  ]);
  const allCheckKeys = new Set<string>([
    ...result.unresolvedChecks.map((check) => check.checkKey),
    ...result.candidateRoutes.flatMap((route) =>
      route.unresolvedChecks.map((check) => check.checkKey),
    ),
  ]);

  const failures: ScenarioAssertionFailure[] = [];

  scenario.expect.forEach((assertion, index) => {
    let passed: boolean;
    switch (assertion.kind) {
      case "judgement_is":
        passed = result.judgement === assertion.judgement;
        break;
      case "requirement_state_is": {
        const states = new Set(
          allAssessments
            .filter((entry) => entry.requirement.requirementKey === assertion.requirementKey)
            .map((entry) => entry.state),
        );
        passed = states.size === 1 && states.has(assertion.state);
        break;
      }
      case "route_eligibility_is": {
        const route = result.candidateRoutes.find(
          (entry) => entry.route.routeKey === assertion.routeKey,
        );
        /* A determinately unavailable route is absent from candidates: the
         * assertion fails deterministically rather than being skipped. */
        passed = route !== undefined && route.eligibility.satisfied === assertion.eligibility;
        break;
      }
      case "route_practical_fit_is": {
        const route = result.candidateRoutes.find(
          (entry) => entry.route.routeKey === assertion.routeKey,
        );
        passed = route !== undefined && route.practicalFit.satisfied === assertion.practicalFit;
        break;
      }
      case "barrier_present":
        passed = allBarrierKeys.has(assertion.barrierKey);
        break;
      case "unresolved_check_present":
        passed = allCheckKeys.has(assertion.checkKey);
        break;
      case "action_present":
        passed = evaluation.triggeredActionKeys.includes(assertion.actionKey);
        break;
    }
    if (!passed) failures.push(failure(index, assertion));
  });

  return {
    ok: true,
    outcome: {
      scenarioKey: scenario.scenarioKey,
      passed: failures.length === 0,
      failures,
      evaluation,
    },
  };
}
