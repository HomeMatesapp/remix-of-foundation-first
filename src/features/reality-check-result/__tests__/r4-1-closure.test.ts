import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_RESULT_COPY } from "../../../content/reality-check-result-copy/architecture-tests";
import { resolveRealityCheckPackBinding } from "../../career-discovery/coverage.server";
import { careerResultCopyByOccupationKey } from "../content-schema";
import { evaluateConfirmedRealityCheck, type SubmittedAnswer } from "../evaluation.server";
import { buildResultViewModel, type ResultViewModel } from "../view-model";

/**
 * Increment 16 R4.1 — presentation-only reconciliation.
 *
 * One viable route with NO positively matched ranking factor is sole viability,
 * not ranking preference. It may still be surfaced prominently, but its basis
 * must be stated as such, `routePreferenceEstablished` must stay false, and no
 * factor-separation or recommendation claim may be produced.
 */

const EVALUATED_AT = "2026-09-01T00:00:00Z";
const OUTCOME_SOURCE = readFileSync(
  "src/features/reality-check-result/components/reality-check-outcome.tsx",
  "utf8",
);

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

describe("R4.1 — sole viability is never presented as ranking preference", () => {
  /* Real documented case: exactly one viable route, zero positive factors. */
  const model = modelFor("registered_nurse", "scenario_prospective_approved_degree_candidate");

  it("surfaces the route but marks its basis as sole viability", () => {
    expect(model.strongestRoute).toBeDefined();
    expect(model.strongestRoute?.factorKeys).toEqual([]);
    expect(model.strongestRouteBasis).toBe("sole_viable");
  });

  it("does not establish a route preference", () => {
    expect(model.routePreferenceEstablished).toBe(false);
  });

  it("never claims reviewed factors separated the route, and never recommends", () => {
    const summary = model.summaryFacts.join(" ");
    expect(summary).not.toMatch(/separated/i);
    expect(summary).not.toMatch(/strongest|best|recommend(?!ed here)/i);
    expect(summary).toMatch(/only route not ruled out by a blocking issue/i);
    expect(summary).toMatch(/not a preference between routes/i);
  });
});

describe("R4.1 — genuine factor separation and exact ties are preserved", () => {
  it("keeps factor-separation basis when positive factors matched", () => {
    const model = modelFor("registered_nurse", "scenario_registered_nurse_direct_practice");
    expect(model.strongestRouteBasis).toBe("factor_separation");
    expect(model.routePreferenceEstablished).toBe(true);
    expect(model.strongestRoute?.factorKeys.length).toBeGreaterThan(0);
    expect(model.summaryFacts.join(" ")).toMatch(/separated from the others/i);
  });

  it("keeps exact ties as ties", () => {
    const model = modelFor("electrician", "scenario_new_entrant_training_routes");
    expect(model.strongestRoute).toBeUndefined();
    expect(model.strongestRouteBasis).toBeUndefined();
    expect(model.tiedTopRoutes.length).toBeGreaterThan(1);
    expect(model.summaryFacts.join(" ")).toMatch(/cannot be separated/i);
  });
});

describe("R4.1 — route wording matches engine contracts", () => {
  it("gates factor-separation wording on the stated basis", () => {
    expect(OUTCOME_SOURCE).toContain('model.strongestRouteBasis === "factor_separation"');
    expect(OUTCOME_SOURCE).toContain("The only route still in contention on your answers");
  });

  it("uses dimension-specific blocking wording, not generic ruling out", () => {
    expect(OUTCOME_SOURCE).toContain(
      "A blocking formal entry issue was identified on your answers",
    );
    expect(OUTCOME_SOURCE).toContain("A blocking practical issue was identified on your answers");
    expect(OUTCOME_SOURCE).not.toContain("Ruled out on your answers");
  });

  it("describes declared-unavailable routes exactly", () => {
    expect(OUTCOME_SOURCE).toContain("Routes unavailable on the answers you gave");
    expect(OUTCOME_SOURCE).not.toContain("Routes that do not apply to your situation");
  });
});
