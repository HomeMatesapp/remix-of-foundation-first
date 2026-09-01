import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_RESULT_COPY } from "../../../content/reality-check-result-copy/architecture-tests";
import { resolveRealityCheckPackBinding } from "../../career-discovery/coverage.server";
import { careerResultCopyByOccupationKey } from "../content-schema";
import { evaluateConfirmedRealityCheck, type SubmittedAnswer } from "../evaluation.server";
import { buildResultViewModel, type ResultViewModel } from "../view-model";

/**
 * Increment 16 R4.2 — presentation-only correction.
 *
 * With exactly ONE viable route there is no other viable route for positive
 * ranking factors to separate it FROM, so the basis is ALWAYS `sole_viable`,
 * even when factors matched. `factor_separation` therefore implies at least two
 * viable routes existed for comparison.
 */

const EVALUATED_AT = "2026-09-01T00:00:00Z";

function packFor(occupationKey: string) {
  const pack = ARCHITECTURE_TEST_PACKS.find(
    (candidate) => candidate.occupation.occupationKey === occupationKey,
  );
  if (!pack) throw new Error(`no pack for ${occupationKey}`);
  return pack;
}

function scenarioAnswers(occupationKey: string, scenarioKey: string): readonly SubmittedAnswer[] {
  const scenario = packFor(occupationKey).scenarios.find(
    (candidate) => candidate.scenarioKey === scenarioKey,
  );
  if (!scenario) throw new Error(`no scenario ${scenarioKey}`);
  return scenario.answers.map((fixture) => ({
    question: {
      moduleCode: fixture.question.moduleCode,
      questionKey: fixture.question.questionKey,
    },
    value: fixture.value,
  }));
}

function modelFor(occupationKey: string, scenarioKey: string): ResultViewModel {
  const binding = resolveRealityCheckPackBinding({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    packs: ARCHITECTURE_TEST_PACKS,
  });
  if (binding.state !== "assessment_available") throw new Error("expected a binding");
  const outcome = evaluateConfirmedRealityCheck({
    occupationKey,
    declaredPack: binding.pack,
    answers: scenarioAnswers(occupationKey, scenarioKey),
    evaluatedAt: EVALUATED_AT,
    binding,
  });
  if (outcome.state !== "evaluated") throw new Error(`expected an evaluation: ${outcome.state}`);
  const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
  if (!copy) throw new Error("expected copy");
  return buildResultViewModel({
    evaluation: outcome.evaluation,
    evidence: outcome.evidence,
    copy,
    actionRelations: outcome.actionRelations,
  });
}

function viableRoutes(model: ResultViewModel) {
  return [
    ...(model.strongestRoute ? [model.strongestRoute] : []),
    ...model.tiedTopRoutes,
    ...model.otherRoutes,
  ].filter((route) => route.viable);
}

describe("R4.2 — a single viable route is always sole viability", () => {
  it("is sole viability with zero matched factors (real Registered Nurse scenario)", () => {
    const model = modelFor("registered_nurse", "scenario_prospective_approved_degree_candidate");
    expect(viableRoutes(model)).toHaveLength(1);
    expect(model.strongestRoute?.factorKeys).toEqual([]);
    expect(model.strongestRouteBasis).toBe("sole_viable");
    expect(model.routePreferenceEstablished).toBe(false);
  });

  it("is sole viability even WITH matched factors (real Solicitor scenario)", () => {
    const model = modelFor(
      "solicitor_england_wales",
      "scenario_degree_holder_sqe_milestones_outstanding",
    );
    expect(viableRoutes(model)).toHaveLength(1);
    expect(model.strongestRoute?.factorKeys.length).toBeGreaterThan(0);
    expect(model.strongestRouteBasis).toBe("sole_viable");
    expect(model.routePreferenceEstablished).toBe(false);
    const summary = model.summaryFacts.join(" ");
    expect(summary).not.toMatch(/separated/i);
    expect(summary).toMatch(/only route not ruled out by a blocking issue/i);
  });

  it("still shows the governed why-it-fits statements inside the sole viable route card", () => {
    const model = modelFor(
      "solicitor_england_wales",
      "scenario_non_graduate_apprenticeship_alternative",
    );
    expect(model.strongestRouteBasis).toBe("sole_viable");
    expect(model.strongestRoute?.whyItFits.length).toBeGreaterThan(0);
  });
});

describe("R4.2 — factor_separation implies at least two viable routes", () => {
  it("holds across every real architecture-test scenario", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const model = modelFor(pack.occupation.occupationKey, scenario.scenarioKey);
        if (model.strongestRouteBasis !== "factor_separation") continue;
        expect(viableRoutes(model).length).toBeGreaterThanOrEqual(2);
        expect(model.strongestRoute?.factorKeys.length ?? 0).toBeGreaterThan(0);
        expect(model.routePreferenceEstablished).toBe(true);
      }
    }
  }, 30_000);

  it("preserves genuine multi-viable factor separation (real Registered Nurse scenario)", () => {
    const model = modelFor("registered_nurse", "scenario_registered_nurse_direct_practice");
    expect(viableRoutes(model).length).toBeGreaterThanOrEqual(2);
    expect(model.strongestRouteBasis).toBe("factor_separation");
    expect(model.routePreferenceEstablished).toBe(true);
    expect(model.summaryFacts.join(" ")).toMatch(/separated from the others/i);
  });

  it("preserves exact ties (real Electrician scenario)", () => {
    const model = modelFor("electrician", "scenario_new_entrant_training_routes");
    expect(model.strongestRoute).toBeUndefined();
    expect(model.strongestRouteBasis).toBeUndefined();
    expect(model.tiedTopRoutes.length).toBeGreaterThan(1);
    expect(model.summaryFacts.join(" ")).toMatch(/cannot be separated/i);
  });
});
