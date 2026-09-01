import { describe, expect, it } from "vitest";

import {
  DECISION_ENGINE_VERSION,
  runCareerPackScenario,
  safeEvaluateRealityCheck,
} from "../../../../domain/decision-engine";
import {
  safeParseCanonicalCareerPack,
  collectPackConditionRefs,
  type CareerPack,
} from "../../../../domain/career-packs";
import { CAREER_PACK_SCHEMA_VERSION } from "../../../../domain/career-packs/version";
import { formatQuestionAddress } from "../../../../domain/questions";
import {
  ARCHITECTURE_TEST_PACKS,
  ELECTRICIAN_PACK,
  PHOTOGRAPHER_PACK,
  REGISTERED_NURSE_PACK,
  SOLICITOR_ENGLAND_WALES_PACK,
} from "..";
import {
  ARCHITECTURE_TEST_EVALUATED_AT,
  answerSnapshotId,
  answersFor,
  evidenceContextFor,
  scenarioAnswers,
} from "./fixtures";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function evaluate(
  pack: CareerPack,
  entries: readonly { question: ReturnType<typeof questionOf>; value: unknown }[],
) {
  const outcome = safeEvaluateRealityCheck({
    pack,
    answerSnapshot: answersFor(
      pack,
      entries as never as readonly { question: never; value: never }[],
    ),
    evidenceContext: evidenceContextFor(pack),
    evaluatedAt: ARCHITECTURE_TEST_EVALUATED_AT,
  });
  if (!outcome.ok) throw new Error(`evaluation failed: ${JSON.stringify(outcome.issues)}`);
  return outcome.evaluation;
}

function questionOf(pack: CareerPack, questionKey: string) {
  for (const module of pack.questionModules) {
    for (const question of module.questions) {
      if (question.questionKey === questionKey) {
        return { moduleCode: module.moduleCode, questionKey };
      }
    }
  }
  throw new Error(`unknown question ${questionKey}`);
}

function scenarioEvaluation(pack: CareerPack, scenarioKey: string) {
  const outcome = safeEvaluateRealityCheck({
    pack,
    answerSnapshot: scenarioAnswers(pack, scenarioKey),
    evidenceContext: evidenceContextFor(pack),
    evaluatedAt: ARCHITECTURE_TEST_EVALUATED_AT,
  });
  if (!outcome.ok) throw new Error(`evaluation failed: ${JSON.stringify(outcome.issues)}`);
  return outcome.evaluation;
}

function candidate(evaluation: ReturnType<typeof scenarioEvaluation>, routeKey: string) {
  return evaluation.result.candidateRoutes.find((entry) => entry.route.routeKey === routeKey);
}

function allRequirementStates(
  evaluation: ReturnType<typeof scenarioEvaluation>,
  requirementKey: string,
): readonly string[] {
  const states: string[] = [];
  for (const assessment of evaluation.result.requirementAssessments) {
    if (assessment.requirement.requirementKey === requirementKey) states.push(assessment.state);
  }
  for (const route of evaluation.result.candidateRoutes) {
    for (const assessment of [
      ...route.eligibility.requirementAssessments,
      ...route.practicalFit.requirementAssessments,
    ]) {
      if (assessment.requirement.requirementKey === requirementKey) states.push(assessment.state);
    }
  }
  return states;
}

function questionKeysUsedConsequentially(pack: CareerPack): ReadonlySet<string> {
  const used = new Set<string>();
  const collect = (rule: Parameters<typeof collectPackConditionRefs>[0]): void => {
    for (const ref of collectPackConditionRefs(rule)) used.add(formatQuestionAddress(ref));
  };
  for (const rule of pack.requirementRules) collect(rule.when);
  for (const rule of pack.routeAvailabilityRules) collect(rule.when);
  for (const rule of pack.barrierRules) collect(rule.when);
  for (const rule of pack.unresolvedCheckRules) collect(rule.when);
  for (const rule of pack.actionRules) collect(rule.when);
  for (const config of pack.rankingConfigs) {
    for (const factor of config.factors) collect(factor.preferWhen);
  }
  return used;
}

/* -------------------------------------------------------------------------- */
/* A. Canonical pack validity                                                 */
/* -------------------------------------------------------------------------- */

describe("architecture-test packs: canonical validity", () => {
  it("declares exactly the four architecture-test careers, each distinct", () => {
    expect(ARCHITECTURE_TEST_PACKS.map((pack) => pack.occupation.occupationKey)).toEqual([
      "registered_nurse",
      "electrician",
      "solicitor_england_wales",
      "photographer",
    ]);
    expect(new Set(ARCHITECTURE_TEST_PACKS.map((pack) => pack.careerPackId)).size).toBe(4);
  });

  for (const pack of ARCHITECTURE_TEST_PACKS) {
    describe(pack.occupation.occupationKey, () => {
      it("revalidates through the canonical boundary and is deeply frozen", () => {
        const outcome = safeParseCanonicalCareerPack(pack);
        expect(outcome.ok).toBe(true);
        expect(pack.schemaVersion).toBe(CAREER_PACK_SCHEMA_VERSION);
        expect(Object.isFrozen(pack)).toBe(true);
        expect(Object.isFrozen(pack.routes)).toBe(true);
        expect(Object.isFrozen(pack.requirements)).toBe(true);
      });

      it("declares authored content version 1.0.0, distinct from the schema version", () => {
        expect(pack.version).toBe("1.0.0");
        expect(CAREER_PACK_SCHEMA_VERSION).toBe("1.0.0");
      });

      it("asks between six and ten questions, all of them consequential", () => {
        const questions = pack.questionModules.flatMap((module) => module.questions);
        expect(questions.length).toBeGreaterThanOrEqual(6);
        expect(questions.length).toBeLessThanOrEqual(10);
        const used = questionKeysUsedConsequentially(pack);
        for (const module of pack.questionModules) {
          for (const question of module.questions) {
            expect(
              used.has(
                formatQuestionAddress({
                  moduleCode: module.moduleCode,
                  questionKey: question.questionKey,
                }),
              ),
            ).toBe(true);
            expect(question.consequences.length).toBeGreaterThan(0);
          }
        }
      });

      it("declares multiple genuine routes and at least four scenarios", () => {
        expect(pack.routes.length).toBeGreaterThanOrEqual(4);
        expect(pack.scenarios.length).toBeGreaterThanOrEqual(4);
      });

      it("carries no author-supplied publication, hash or copy fields", () => {
        const serialised = JSON.stringify(pack);
        for (const forbidden of [
          "contentHash",
          "publishedAt",
          "publicationState",
          "approvedBy",
          "prompt",
          "model",
          "score",
          "weight",
        ]) {
          expect(serialised).not.toContain(`"${forbidden}"`);
        }
      });

      it("attaches an explicit grade and classification to every evidence entry", () => {
        expect(pack.evidence.length).toBeGreaterThan(0);
        for (const entry of pack.evidence) {
          expect(entry.reference.grade).toBeTypeOf("string");
          expect(entry.reference.participantClassification).toBeTypeOf("string");
        }
      });
    });
  }
});

/* -------------------------------------------------------------------------- */
/* B. Same-engine proof                                                       */
/* -------------------------------------------------------------------------- */

describe("architecture-test packs: one shared engine", () => {
  it("still runs on the unchanged Decision Engine version", () => {
    expect(DECISION_ENGINE_VERSION).toBe("1.0.0");
  });

  for (const pack of ARCHITECTURE_TEST_PACKS) {
    for (const scenario of pack.scenarios) {
      it(`${pack.occupation.occupationKey}: ${scenario.scenarioKey} passes on the shared engine`, () => {
        const run = runCareerPackScenario({
          pack,
          scenarioKey: scenario.scenarioKey,
          answerSnapshotId: answerSnapshotId(pack),
          evidenceContext: evidenceContextFor(pack),
          evaluatedAt: ARCHITECTURE_TEST_EVALUATED_AT,
        });
        expect(run.ok).toBe(true);
        if (!run.ok) return;
        expect(run.outcome.failures).toEqual([]);
        expect(run.outcome.passed).toBe(true);
        expect(run.outcome.evaluation.decisionEngineVersion).toBe(DECISION_ENGINE_VERSION);
      });
    }

    it(`${pack.occupation.occupationKey}: identical inputs are byte-equivalent`, () => {
      const first = scenarioEvaluation(pack, pack.scenarios[0]!.scenarioKey);
      const second = scenarioEvaluation(pack, pack.scenarios[0]!.scenarioKey);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it(`${pack.occupation.occupationKey}: every declared route stays visible in availability`, () => {
      const evaluation = scenarioEvaluation(pack, pack.scenarios[0]!.scenarioKey);
      expect(evaluation.routeAvailability.map((item) => item.route.routeKey).sort()).toEqual(
        pack.routes.map((route) => route.routeKey).sort(),
      );
    });
  }
});

/* -------------------------------------------------------------------------- */
/* C. Architecture diversity                                                  */
/* -------------------------------------------------------------------------- */

describe("architecture-test packs: structural diversity", () => {
  const archetypeCodes = new Set(
    ARCHITECTURE_TEST_PACKS.flatMap((pack) =>
      pack.routes.flatMap((route) =>
        (route.archetypeComposition?.archetypes ?? []).map((ref) => ref.code),
      ),
    ),
  );

  it("exercises regulated, apprenticeship, experience-led, portfolio and self-employed structures", () => {
    for (const code of [
      "regulated_undergraduate",
      "degree_apprenticeship",
      "apprenticeship",
      "vocational_qualification",
      "experience_led_progression",
      "portfolio_experience",
      "self_employed",
      "direct_employment",
      "bridging",
      "regulator_verification",
    ]) {
      expect(archetypeCodes.has(code as never)).toBe(true);
    }
  });

  it("uses composed archetypes where a single skeleton would be wrong", () => {
    const composed = ARCHITECTURE_TEST_PACKS.flatMap((pack) => pack.routes).filter(
      (route) => (route.archetypeComposition?.archetypes.length ?? 0) > 1,
    );
    expect(composed.length).toBeGreaterThanOrEqual(3);
  });

  it("declares exactly one inspectable ranking configuration per pack, with no scores", () => {
    for (const pack of [
      REGISTERED_NURSE_PACK,
      SOLICITOR_ENGLAND_WALES_PACK,
      ELECTRICIAN_PACK,
      PHOTOGRAPHER_PACK,
    ]) {
      /* More than one configuration would make the engine refuse to choose. */
      expect(pack.rankingConfigs).toHaveLength(1);
      for (const factor of pack.rankingConfigs[0]!.factors) {
        /* Ordered factors ONLY: no weight, score, direction or magnitude field. */
        expect(Object.keys(factor).sort()).toEqual(["factorKey", "preferWhen", "routeKeys"]);
        /* Every factor is scoped to routes the same pack declares. */
        for (const routeKey of factor.routeKeys) {
          expect(pack.routes.map((route) => route.routeKey)).toContain(routeKey);
        }
      }
    }
  });

  it("declares local dependence without any geographic implementation", () => {
    expect(REGISTERED_NURSE_PACK.localRequirements).toHaveLength(1);
    const local = REGISTERED_NURSE_PACK.localRequirements[0]!;
    expect(local.unresolvedCheckKey).toBe("check_local_approved_programme_access");
    expect(JSON.stringify(local)).not.toMatch(/postcode|latitude|longitude|radius|distance/i);
  });

  it("covers confirmed, provider-dependent and general-guidance evidence", () => {
    const classifications = new Set(
      ARCHITECTURE_TEST_PACKS.flatMap((pack) =>
        pack.evidence.map((entry) => entry.reference.participantClassification),
      ),
    );
    expect(classifications.has("confirmed_requirement")).toBe(true);
    expect(classifications.has("provider_dependent")).toBe(true);
    expect(classifications.has("general_guidance")).toBe(true);
  });

  it("covers mandatory, preferred and contextual requirement severities", () => {
    const severities = new Set(
      ARCHITECTURE_TEST_PACKS.flatMap((pack) => pack.requirements.map((req) => req.severity)),
    );
    expect(severities.has("mandatory")).toBe(true);
    expect(severities.has("preferred")).toBe(true);
    expect(severities.has("contextual")).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* D. Guardrails preserved with REAL pack content                             */
/* -------------------------------------------------------------------------- */

describe("architecture-test packs: guardrails with real content", () => {
  it("unanswered questions never become unmet requirements", () => {
    const evaluation = evaluate(REGISTERED_NURSE_PACK, [
      {
        question: questionOf(REGISTERED_NURSE_PACK, "nursing_registration_status"),
        value: "registered_nurse",
      },
    ]);
    const states = [
      ...allRequirementStates(evaluation, "req_approved_programme_entry"),
      ...allRequirementStates(evaluation, "req_study_commitment"),
      ...allRequirementStates(evaluation, "req_clinical_placement_commitment"),
    ];
    expect(states.length).toBeGreaterThan(0);
    expect(states).not.toContain("unmet");
    for (const state of states) expect(state).toBe("unknown");
  });

  it("a missing mandatory answer leaves eligibility and practical fit unknown, never false", () => {
    const evaluation = evaluate(REGISTERED_NURSE_PACK, [
      {
        question: questionOf(REGISTERED_NURSE_PACK, "health_character_declaration_status"),
        value: "no_known_issue",
      },
    ]);
    const degree = candidate(evaluation, "route_nmc_approved_degree");
    expect(degree).toBeDefined();
    expect(degree?.eligibility.satisfied).toBeNull();
    expect(degree?.practicalFit.satisfied).toBeNull();
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("one blocked route never produces a negative overall judgement while another route is open", () => {
    const evaluation = scenarioEvaluation(
      SOLICITOR_ENGLAND_WALES_PACK,
      "scenario_non_graduate_apprenticeship_alternative",
    );
    expect(candidate(evaluation, "route_sqe_standard")?.eligibility.satisfied).toBe(false);
    expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
  });

  it("normal route milestones do not close the route before they can be completed", () => {
    const evaluation = scenarioEvaluation(
      SOLICITOR_ENGLAND_WALES_PACK,
      "scenario_degree_holder_sqe_milestones_outstanding",
    );
    expect(allRequirementStates(evaluation, "req_sqe1_passed")).toContain("unmet");
    expect(candidate(evaluation, "route_sqe_standard")?.eligibility.satisfied).toBe(true);
    expect(evaluation.result.judgement).toBe("realistic_with_conditions");
  });

  it("judgement strength never exceeds evidence strength", () => {
    const evaluation = scenarioEvaluation(
      ELECTRICIAN_PACK,
      "scenario_qualified_electrician_direct",
    );
    /* The authored rule says `met`, but the only evidence is general guidance. */
    for (const state of allRequirementStates(evaluation, "req_physical_site_tolerance")) {
      expect(state).toBe("verification_required");
    }
    /* Confirmed grade A evidence still permits a consequential state. */
    expect(allRequirementStates(evaluation, "req_recognised_qualified_competence")).toContain(
      "met",
    );
    expect(evaluation.result.judgement).not.toBe("realistic_now");
  });

  it("provider and employer entry criteria are never generalised into failure", () => {
    const evaluation = scenarioEvaluation(ELECTRICIAN_PACK, "scenario_new_entrant_training_routes");
    for (const state of allRequirementStates(evaluation, "req_employer_entry_criteria")) {
      expect(state).toBe("verification_required");
    }
    expect(
      candidate(evaluation, "route_installation_maintenance_apprenticeship")?.eligibility.satisfied,
    ).toBe(true);
  });

  it("the domestic apprenticeship keeps identical semantics on its own standard's requirement", () => {
    const evaluation = scenarioEvaluation(ELECTRICIAN_PACK, "scenario_new_entrant_training_routes");
    for (const state of allRequirementStates(evaluation, "req_domestic_training_commitment")) {
      expect(state).toBe("met");
    }
    expect(candidate(evaluation, "route_domestic_apprenticeship")?.eligibility.satisfied).toBe(
      true,
    );
    expect(
      candidate(evaluation, "route_installation_maintenance_apprenticeship")?.eligibility.satisfied,
    ).toBe(true);
  });

  it("out-of-scope national criteria are declared unavailable, never silently applied", () => {
    const evaluation = scenarioEvaluation(
      ELECTRICIAN_PACK,
      "scenario_scotland_no_scheme_generalisation",
    );
    const availability = new Map(
      evaluation.routeAvailability.map((item) => [item.route.routeKey, item.available]),
    );
    expect(availability.get("route_installation_maintenance_ewa")).toBe(false);
    expect(availability.get("route_domestic_ewa")).toBe(false);
    expect(candidate(evaluation, "route_installation_maintenance_ewa")).toBeUndefined();
    expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
  });

  it("unresolved local access is unresolved, never route impossibility", () => {
    const evaluation = scenarioEvaluation(
      REGISTERED_NURSE_PACK,
      "scenario_prospective_approved_degree_candidate",
    );
    const degree = candidate(evaluation, "route_nmc_approved_degree");
    expect(degree?.eligibility.satisfied).toBe(true);
    expect(degree?.practicalFit.satisfied).toBe(true);
    expect(degree?.unresolvedChecks.map((check) => check.checkKey)).toContain(
      "check_local_approved_programme_access",
    );
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("an unregulated career invents no statutory eligibility rule", () => {
    for (const requirement of PHOTOGRAPHER_PACK.requirements) {
      if (requirement.purposes.includes("eligibility")) {
        throw new Error("the photographer pack must declare no eligibility requirement");
      }
    }
    for (const route of PHOTOGRAPHER_PACK.routes) {
      expect(route.eligibilityRequirementKeys).toEqual([]);
    }
  });

  it("ranks candidate routes by ordered factors only, with a stable position", () => {
    const electrician = scenarioEvaluation(
      ELECTRICIAN_PACK,
      "scenario_qualified_electrician_direct",
    );
    expect(electrician.result.candidateRoutes[0]?.route.routeKey).toBe(
      "route_qualified_electrician_direct",
    );
    expect(electrician.result.candidateRoutes[0]?.ranking?.rankingConfigKey).toBe(
      "ranking_electrician_starting_point",
    );
    expect(electrician.result.candidateRoutes[0]?.ranking?.position).toBe(1);

    const photographer = scenarioEvaluation(PHOTOGRAPHER_PACK, "scenario_self_employment_ready");
    expect(photographer.result.candidateRoutes[0]?.route.routeKey).toBe(
      "route_self_employed_photographer",
    );
  });

  it("keeps every judgement inside the four frozen values", () => {
    const allowed = new Set([
      "realistic_now",
      "realistic_with_conditions",
      "more_information_needed",
      "not_realistic_yet",
    ]);
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      for (const scenario of pack.scenarios) {
        const evaluation = scenarioEvaluation(pack, scenario.scenarioKey);
        expect(allowed.has(evaluation.result.judgement)).toBe(true);
      }
    }
  });
});
