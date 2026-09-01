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
 * Increment 16 R3 closure reconciliation — the participant result must not imply
 * prioritisation or blocking semantics the closed deterministic engine never
 * established.
 *
 * Nothing here changes the Decision Engine, a domain contract or a schema.
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

function override(
  answers: readonly SubmittedAnswer[],
  questionKey: string,
  value: SubmittedAnswer["value"],
): readonly SubmittedAnswer[] {
  return answers.map((entry) =>
    entry.question.questionKey === questionKey ? { ...entry, value } : entry,
  );
}

function modelFor(occupationKey: string, answers: readonly SubmittedAnswer[]): ResultViewModel {
  const binding = resolveRealityCheckPackBinding({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    packs: ARCHITECTURE_TEST_PACKS,
  });
  if (binding.state !== "assessment_available") throw new Error("expected a binding");
  const outcome = evaluateConfirmedRealityCheck({
    occupationKey,
    declaredPack: binding.pack,
    answers,
    evaluatedAt: EVALUATED_AT,
    binding,
  });
  if (outcome.state !== "evaluated")
    throw new Error(`expected an evaluation, got ${outcome.state}`);
  const copy = careerResultCopyByOccupationKey(ARCHITECTURE_TEST_RESULT_COPY, occupationKey);
  if (!copy) throw new Error("expected copy");
  return buildResultViewModel({
    evaluation: outcome.evaluation,
    evidence: outcome.evidence,
    copy,
    actionRelations: outcome.actionRelations,
  });
}

function allRoutes(model: ResultViewModel) {
  return [
    ...(model.strongestRoute ? [model.strongestRoute] : []),
    ...model.tiedTopRoutes,
    ...model.otherRoutes,
  ];
}

const COMPONENT = readFileSync(
  "src/features/reality-check-result/components/reality-check-outcome.tsx",
  "utf8",
);

describe("R3 closure — no presentation priority over several triggered actions", () => {
  it("has removed the authored next-step priority layer entirely", () => {
    for (const file of [
      "src/features/reality-check-result/content-schema.ts",
      "src/content/reality-check-result-copy/architecture-tests.ts",
      "src/features/reality-check-result/view-model.ts",
      "src/features/reality-check-result/components/reality-check-outcome.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("routeActionPriority");
    }
  });

  it("never offers a preferred next step when several actions were triggered", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const model = modelFor(
          pack.occupation.occupationKey,
          scenario.answers.map((fixture) => ({
            question: {
              moduleCode: fixture.question.moduleCode,
              questionKey: fixture.question.questionKey,
            },
            value: fixture.value,
          })),
        );
        for (const route of allRoutes(model)) {
          if (route.nextActions.length === 1) {
            expect(route.soleNextAction?.actionKey).toBe(route.nextActions[0]?.actionKey);
          } else {
            expect(route.soleNextAction).toBeUndefined();
          }
        }
      }
    }
  }, 20000);

  it("uses neutral next-step wording and no 'start here' instruction", () => {
    expect(COMPONENT).not.toContain("Start here");
    expect(COMPONENT).toContain("Next steps for this route, in no order of priority");
  });
});

describe("R3 closure — the summary is neutral", () => {
  const model = modelFor(
    "registered_nurse",
    scenarioAnswers("registered_nurse", "scenario_health_character_issue_to_declare"),
  );

  it("is titled as a plain summary, not as what matters most", () => {
    expect(COMPONENT).toContain("A quick summary");
    expect(COMPONENT).not.toContain("What matters most");
  });

  it("never singles out a first barrier, condition or check as most important", () => {
    const singled = [
      ...model.barriers.map((barrier) => barrier.label),
      ...model.overallRequirements.map((item) => item.label),
      ...model.unresolved.map((check) => check.issue),
    ];
    for (const fact of model.summaryFacts) {
      for (const label of singled) expect(fact).not.toContain(label);
      expect(fact).not.toMatch(/Start here|most important|An obstacle right now/);
    }
  });
});

describe("R3 closure — displayed order is never a recommendation", () => {
  it("says plainly that no route has been preferred when nothing distinguishes one", () => {
    const model = modelFor(
      "registered_nurse",
      override(
        override(
          scenarioAnswers("registered_nurse", "scenario_prospective_approved_degree_candidate"),
          "degree_apprenticeship_employer_status",
          "confirmed",
        ),
        "approved_programme_entry_status",
        "confirmed",
      ),
    );
    /* Ranking metadata exists on the pack, yet no positive factor matches. */
    expect(packFor("registered_nurse").rankingConfigs.length).toBeGreaterThan(0);
    for (const route of allRoutes(model)) expect(route.factorKeys).toEqual([]);
    if (allRoutes(model).filter((route) => route.viable).length > 1) {
      expect(model.routePreferenceEstablished).toBe(false);
      expect(model.summaryFacts.some((fact) => fact.includes("No route has been preferred"))).toBe(
        true,
      );
    }
    expect(COMPONENT).toContain("is not a recommendation order");
  });
});

describe("R3 closure — barrier blocking state is preserved verbatim", () => {
  it("carries true, false or null through to presentation", () => {
    const model = modelFor(
      "registered_nurse",
      scenarioAnswers("registered_nurse", "scenario_health_character_issue_to_declare"),
    );
    expect(model.barriers.length).toBeGreaterThan(0);
    for (const barrier of model.barriers) expect([true, false, null]).toContain(barrier.blocking);
  });

  it("uses the neutral barrier heading and never makes a non-blocking barrier sound blocking", () => {
    expect(COMPONENT).toContain("Barriers and practical obstacles");
    expect(COMPONENT).not.toContain("What stands in the way at the moment");
    expect(COMPONENT).toContain("does not block this route");
    expect(COMPONENT).toContain("not yet settled either way");
  });
});

describe("R3 closure — proposed Nurse ranking is conservative", () => {
  const config = packFor("registered_nurse").rankingConfigs[0];

  it("retains only the three direct starting-status factors", () => {
    expect(config?.factors.map((factor) => factor.factorKey)).toEqual([
      "factor_registration_already_held",
      "factor_nursing_associate_starting_point",
      "factor_overseas_qualified_starting_point",
    ]);
  });

  it("gives a prospective entrant who confirms both starting points no preference", () => {
    const model = modelFor(
      "registered_nurse",
      override(
        override(
          scenarioAnswers("registered_nurse", "scenario_prospective_approved_degree_candidate"),
          "degree_apprenticeship_employer_status",
          "confirmed",
        ),
        "approved_programme_entry_status",
        "confirmed",
      ),
    );
    for (const route of allRoutes(model)) expect(route.whyItFits).toEqual([]);
  });
});

describe("R3 closure — proposed Solicitor ranking", () => {
  const config = packFor("solicitor_england_wales").rankingConfigs[0];

  it("retains the apprenticeship and confirmed-transitional factors", () => {
    expect(config?.factors.map((factor) => factor.factorKey)).toEqual([
      "factor_non_graduate_apprenticeship_starting_point",
      "factor_graduate_apprenticeship_starting_point",
      "factor_confirmed_transitional_without_apprenticeship",
      "factor_standard_sqe_when_no_apprenticeship_sought",
    ]);
  });

  it("prefers the standard SQE route only when transitional eligibility is explicitly not_eligible", () => {
    const model = modelFor(
      "solicitor_england_wales",
      scenarioAnswers(
        "solicitor_england_wales",
        "scenario_degree_holder_sqe_milestones_outstanding",
      ),
    );
    const standard = allRoutes(model).find((route) => route.routeKey === "route_sqe_standard");
    expect(standard?.factorKeys).toContain("factor_standard_sqe_when_no_apprenticeship_sought");
  });

  it("creates no LPC or SQE preference when transitional eligibility is not_sure", () => {
    const model = modelFor(
      "solicitor_england_wales",
      override(
        scenarioAnswers(
          "solicitor_england_wales",
          "scenario_degree_holder_sqe_milestones_outstanding",
        ),
        "lpc_transitional_eligibility_status",
        "not_sure",
      ),
    );
    for (const route of allRoutes(model)) {
      expect(route.factorKeys).not.toContain("factor_standard_sqe_when_no_apprenticeship_sought");
      expect(route.factorKeys).not.toContain(
        "factor_confirmed_transitional_without_apprenticeship",
      );
    }
  });
});
