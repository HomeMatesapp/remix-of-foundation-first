import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_RESULT_COPY } from "../../../content/reality-check-result-copy/architecture-tests";
import { REALITY_CHECK_JUDGEMENTS } from "../../../domain/contracts";
import { resolveRealityCheckPackBinding } from "../../career-discovery/coverage.server";
import { careerResultCopyByOccupationKey, resultCopyCoverageDefects } from "../content-schema";
import { evaluateConfirmedRealityCheck, type SubmittedAnswer } from "../evaluation.server";
import { JUDGEMENT_COPY } from "../judgement-copy";
import { buildResultViewModel } from "../view-model";

/**
 * Increment 16 — hostile verification of the result experience.
 *
 * Every assertion here defends a boundary: the engine decides, the presentation
 * layer only reports, and anything that cannot be reported truthfully is
 * withheld rather than guessed.
 */

const EVALUATED_AT = "2026-09-01T00:00:00Z";

function bindingFor(occupationKey: string) {
  return resolveRealityCheckPackBinding({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    packs: ARCHITECTURE_TEST_PACKS,
  });
}

function scenarioAnswersFor(occupationKey: string, scenarioIndex = 0): readonly SubmittedAnswer[] {
  const pack = ARCHITECTURE_TEST_PACKS.find(
    (candidate) => candidate.occupation.occupationKey === occupationKey,
  );
  if (!pack) throw new Error(`no pack for ${occupationKey}`);
  const scenario = pack.scenarios[scenarioIndex];
  if (!scenario) throw new Error(`no scenario ${scenarioIndex} for ${occupationKey}`);
  return scenario.answers.map((fixture) => ({
    question: {
      moduleCode: fixture.question.moduleCode,
      questionKey: fixture.question.questionKey,
    },
    value: fixture.value,
  }));
}

function evaluateFor(occupationKey: string, scenarioIndex = 0) {
  const binding = bindingFor(occupationKey);
  if (binding.state !== "assessment_available") throw new Error("expected an available binding");
  return evaluateConfirmedRealityCheck({
    occupationKey,
    declaredPack: binding.pack,
    answers: scenarioAnswersFor(occupationKey, scenarioIndex),
    evaluatedAt: EVALUATED_AT,
    binding,
  });
}

const OCCUPATION_KEYS = ARCHITECTURE_TEST_PACKS.map((pack) => pack.occupation.occupationKey);

describe("Increment 16 — result copy governance", () => {
  it("covers every declared key of every pack in both directions", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const copy = careerResultCopyByOccupationKey(
        ARCHITECTURE_TEST_RESULT_COPY,
        pack.occupation.occupationKey,
      );
      if (!copy) throw new Error(`no result copy for ${pack.occupation.occupationKey}`);
      expect(resultCopyCoverageDefects(pack, copy)).toEqual([]);
    }
  });

  it("provides copy for every protected judgement value and no other", () => {
    expect(Object.keys(JUDGEMENT_COPY).sort()).toEqual([...REALITY_CHECK_JUDGEMENTS].sort());
    for (const judgement of REALITY_CHECK_JUDGEMENTS) {
      const copy = JUDGEMENT_COPY[judgement];
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.meaning.length).toBeGreaterThan(0);
      /* Every judgement must state honestly what it does NOT mean. */
      expect(copy.whatItIsNot.length).toBeGreaterThan(0);
    }
  });

  it("binds each copy set to the exact Career Pack it describes", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const copy = careerResultCopyByOccupationKey(
        ARCHITECTURE_TEST_RESULT_COPY,
        pack.occupation.occupationKey,
      );
      expect(copy?.careerPackId).toBe(pack.careerPackId);
    }
  });
});

describe("Increment 16 — server evaluation boundary", () => {
  it("produces an engine evaluation for every architecture-test career", () => {
    for (const occupationKey of OCCUPATION_KEYS) {
      const outcome = evaluateFor(occupationKey);
      expect(outcome.state).toBe("evaluated");
      if (outcome.state !== "evaluated") continue;
      expect(REALITY_CHECK_JUDGEMENTS).toContain(outcome.evaluation.result.judgement);
      expect(outcome.evaluatedAt).toBe(EVALUATED_AT);
      expect(outcome.evaluation.result.provenance.evaluatedAt).toBe(EVALUATED_AT);
    }
  });

  it("refuses to evaluate when the client declares a different pack content hash", () => {
    const binding = bindingFor(OCCUPATION_KEYS[0]!);
    if (binding.state !== "assessment_available") throw new Error("expected a binding");
    const outcome = evaluateConfirmedRealityCheck({
      occupationKey: OCCUPATION_KEYS[0]!,
      declaredPack: { ...binding.pack, contentHash: "0".repeat(64) },
      answers: scenarioAnswersFor(OCCUPATION_KEYS[0]!),
      evaluatedAt: EVALUATED_AT,
      binding,
    });
    expect(outcome.state).toBe("assessment_not_available_yet");
  });

  it("rejects an undeclared question ref instead of ignoring it", () => {
    const occupationKey = OCCUPATION_KEYS[0]!;
    const binding = bindingFor(occupationKey);
    if (binding.state !== "assessment_available") throw new Error("expected a binding");
    const outcome = evaluateConfirmedRealityCheck({
      occupationKey,
      declaredPack: binding.pack,
      answers: [
        ...scenarioAnswersFor(occupationKey),
        { question: { moduleCode: "finance", questionKey: "not_a_real_question" }, value: true },
      ],
      evaluatedAt: EVALUATED_AT,
      binding,
    });
    expect(outcome.state).toBe("answers_rejected");
  });

  it("rejects a duplicated question ref rather than merging last-wins", () => {
    const occupationKey = OCCUPATION_KEYS[0]!;
    const binding = bindingFor(occupationKey);
    if (binding.state !== "assessment_available") throw new Error("expected a binding");
    const answers = scenarioAnswersFor(occupationKey);
    const outcome = evaluateConfirmedRealityCheck({
      occupationKey,
      declaredPack: binding.pack,
      answers: [...answers, answers[0]!],
      evaluatedAt: EVALUATED_AT,
      binding,
    });
    expect(outcome.state).toBe("answers_rejected");
  });

  it("reports incomplete answers rather than evaluating a partial set", () => {
    const occupationKey = OCCUPATION_KEYS[0]!;
    const binding = bindingFor(occupationKey);
    if (binding.state !== "assessment_available") throw new Error("expected a binding");
    const outcome = evaluateConfirmedRealityCheck({
      occupationKey,
      declaredPack: binding.pack,
      answers: scenarioAnswersFor(occupationKey).slice(0, 1),
      evaluatedAt: EVALUATED_AT,
      binding,
    });
    expect(outcome.state).toBe("answers_incomplete");
  });

  it("withholds any result when no full-coverage pack is bound", () => {
    const outcome = evaluateConfirmedRealityCheck({
      occupationKey: "not_a_real_occupation",
      declaredPack: {
        careerPackId: "00000000-0000-4000-8000-000000000000",
        version: "1.0.0",
        contentHash: "0".repeat(64),
      },
      answers: [{ question: { moduleCode: "finance", questionKey: "x" }, value: true }],
      evaluatedAt: EVALUATED_AT,
      binding: bindingFor("not_a_real_occupation"),
    });
    expect(outcome.state).toBe("assessment_not_available_yet");
  });

  it("is deterministic for identical answers and the same evaluation instant", () => {
    const occupationKey = OCCUPATION_KEYS[1] ?? OCCUPATION_KEYS[0]!;
    const first = evaluateFor(occupationKey);
    const second = evaluateFor(occupationKey);
    if (first.state !== "evaluated" || second.state !== "evaluated") {
      throw new Error("expected two evaluations");
    }
    expect(first.evaluation.result.judgement).toBe(second.evaluation.result.judgement);
    expect(first.evaluation.result.candidateRoutes.map((route) => route.route.routeKey)).toEqual(
      second.evaluation.result.candidateRoutes.map((route) => route.route.routeKey),
    );
  });
});

describe("Increment 16 — result view-model", () => {
  it("preserves the engine's own route order and never invents one", () => {
    for (const occupationKey of OCCUPATION_KEYS) {
      const outcome = evaluateFor(occupationKey);
      if (outcome.state !== "evaluated") throw new Error("expected an evaluation");
      const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
      if (!copy) throw new Error("expected copy");
      const model = buildResultViewModel({
        evaluation: outcome.evaluation,
        evidence: outcome.evidence,
        copy,
      });
      const presented = [
        ...(model.strongestRoute ? [model.strongestRoute] : []),
        ...model.tiedTopRoutes,
        ...model.otherRoutes,
      ].map((route) => route.routeKey);
      /* Engine order is preserved; the top group is simply pulled to the front. */
      expect([...presented].sort()).toEqual(
        outcome.evaluation.result.candidateRoutes.map((route) => route.route.routeKey).sort(),
      );
      expect(model.otherRoutes.map((route) => route.routeKey)).toEqual(
        outcome.evaluation.result.candidateRoutes
          .map((route) => route.route.routeKey)
          .filter(
            (key) => !presented.slice(0, presented.length - model.otherRoutes.length).includes(key),
          ),
      );
      /* Nothing is highlighted unless the engine actually ranked the routes. */
      if (model.strongestRoute) expect(model.strongestRoute.viable).toBe(true);
    }
  });

  it("reports the engine judgement verbatim and never a fifth state", () => {
    for (const occupationKey of OCCUPATION_KEYS) {
      const outcome = evaluateFor(occupationKey);
      if (outcome.state !== "evaluated") throw new Error("expected an evaluation");
      const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
      if (!copy) throw new Error("expected copy");
      const model = buildResultViewModel({
        evaluation: outcome.evaluation,
        evidence: outcome.evidence,
        copy,
      });
      expect(model.judgementValue).toBe(outcome.evaluation.result.judgement);
      expect(model.judgement).toBe(JUDGEMENT_COPY[outcome.evaluation.result.judgement]);
    }
  });

  it("never presents an unknown or verification-required requirement as not met", () => {
    for (const occupationKey of OCCUPATION_KEYS) {
      const outcome = evaluateFor(occupationKey);
      if (outcome.state !== "evaluated") throw new Error("expected an evaluation");
      const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
      if (!copy) throw new Error("expected copy");
      const model = buildResultViewModel({
        evaluation: outcome.evaluation,
        evidence: outcome.evidence,
        copy,
      });
      const byKey = new Map(
        outcome.evaluation.result.requirementAssessments.map((assessment) => [
          assessment.requirement.requirementKey,
          assessment.state,
        ]),
      );
      for (const item of model.overallRequirements) {
        const state = byKey.get(item.requirementKey);
        if (state === "unknown" || state === "verification_required") {
          expect(item.status).toBe("needs_checking");
        }
        if (state === "unmet") expect(item.status).toBe("not_met");
        if (state === "met") expect(item.status).toBe("met");
      }
    }
  });

  it("attributes every presented evidence item to a reviewed source with a check date", () => {
    for (const occupationKey of OCCUPATION_KEYS) {
      const outcome = evaluateFor(occupationKey);
      if (outcome.state !== "evaluated") throw new Error("expected an evaluation");
      for (const item of outcome.evidence) {
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.url.startsWith("https://")).toBe(true);
        expect(item.checkedOn.length).toBeGreaterThan(0);
      }
    }
  });

  it("omits any key that has no reviewed copy instead of exposing a raw key", () => {
    const occupationKey = OCCUPATION_KEYS[0]!;
    const outcome = evaluateFor(occupationKey);
    if (outcome.state !== "evaluated") throw new Error("expected an evaluation");
    const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
    if (!copy) throw new Error("expected copy");
    const starved = {
      ...copy,
      routes: [],
      requirements: [],
      actions: [],
      checks: [],
      barriers: [],
    };
    const model = buildResultViewModel({
      evaluation: outcome.evaluation,
      evidence: outcome.evidence,
      copy: starved,
    });
    expect(model.strongestRoute).toBeUndefined();
    expect(model.tiedTopRoutes).toEqual([]);
    expect(model.otherRoutes).toEqual([]);
    expect(model.overallRequirements).toEqual([]);
    expect(model.actions).toEqual([]);
    expect(model.unresolved).toEqual([]);
    expect(model.barriers).toEqual([]);
  });
});
