import type { QuestionModuleDefinition } from "../../questions";
import { CAREER_PACK_SCHEMA_VERSION } from "../version";

/**
 * SYNTHETIC internal stable keys only.
 *
 * No participant-facing copy, no real occupation, no real career pack. These
 * fixtures exist purely to exercise the structural schema.
 */

export const PACK_ID = "11111111-1111-4111-8111-111111111111";
export const ROUTE_ID = "22222222-2222-4222-8222-222222222222";
export const REQUIREMENT_ID = "33333333-3333-4333-8333-333333333333";
export const SOURCE_ID = "44444444-4444-4444-8444-444444444444";

export function questionModules(): QuestionModuleDefinition[] {
  return [
    {
      moduleCode: "qualifications",
      frameworkVersion: "1.0.0",
      questions: [
        {
          questionKey: "q_level",
          moduleCode: "qualifications",
          input: { kind: "single_select", optionKeys: ["opt_a", "opt_b"] },
          consequences: ["eligibility"],
        },
        {
          questionKey: "q_count",
          moduleCode: "qualifications",
          input: { kind: "integer", min: 0, max: 10 },
          consequences: ["eligibility"],
        },
      ],
    },
    {
      moduleCode: "driving",
      frameworkVersion: "1.0.0",
      questions: [
        {
          questionKey: "q_licences",
          moduleCode: "driving",
          input: { kind: "multi_select", optionKeys: ["opt_car", "opt_van"] },
          consequences: ["practical_fit"],
        },
      ],
    },
    {
      moduleCode: "study_availability",
      frameworkVersion: "1.0.0",
      questions: [
        {
          questionKey: "q_note",
          moduleCode: "study_availability",
          input: { kind: "text", minLength: 3, maxLength: 10 },
          consequences: ["practical_fit"],
        },
        {
          questionKey: "q_start",
          moduleCode: "study_availability",
          input: { kind: "date" },
          consequences: ["practical_fit"],
        },
      ],
    },
  ];
}

/** Minimal valid canonical pack input. */
export function basePack(): Record<string, unknown> {
  return {
    schemaVersion: CAREER_PACK_SCHEMA_VERSION,
    careerPackId: PACK_ID,
    version: "2.3.1",
    occupation: { occupationKey: "occ_synthetic_a" },
    questionModules: questionModules(),
    routes: [
      {
        routeKey: "route_a",
        routeId: ROUTE_ID,
        archetypeComposition: {
          frameworkVersion: "1.0.0",
          archetypes: [{ code: "apprenticeship", version: "1.0.0" }],
        },
        eligibilityRequirementKeys: ["req_a"],
        practicalFitRequirementKeys: ["req_b"],
        availabilityRuleKeys: ["rule_avail_a"],
        localRequirementKeys: ["local_a"],
      },
    ],
    requirements: [
      {
        requirementKey: "req_a",
        requirementId: REQUIREMENT_ID,
        severity: "mandatory",
        purposes: ["eligibility"],
        evidenceKeys: ["ev_a"],
      },
      {
        requirementKey: "req_b",
        severity: "contextual",
        purposes: ["practical_fit"],
        evidenceKeys: [],
      },
    ],
    requirementRules: [
      {
        ruleKey: "rule_req_a",
        requirementKey: "req_a",
        when: {
          all: [
            {
              question: { moduleCode: "qualifications", questionKey: "q_level" },
              operator: "equals",
              value: "opt_a",
            },
            {
              question: { moduleCode: "qualifications", questionKey: "q_count" },
              operator: "gte",
              value: 2,
            },
          ],
        },
        state: "met",
      },
      {
        ruleKey: "rule_req_a_unknown",
        requirementKey: "req_a",
        when: {
          question: { moduleCode: "qualifications", questionKey: "q_level" },
          operator: "unanswered",
        },
        state: "unknown",
      },
    ],
    routeAvailabilityRules: [
      {
        ruleKey: "rule_avail_a",
        routeKey: "route_a",
        when: {
          question: { moduleCode: "driving", questionKey: "q_licences" },
          operator: "includes",
          value: "opt_car",
        },
        available: true,
      },
    ],
    barriers: [
      {
        barrierKey: "barrier_a",
        blocking: true,
        relatedRequirementKeys: ["req_a"],
        relatedRouteKeys: ["route_a"],
        evidenceKeys: ["ev_a"],
      },
    ],
    barrierRules: [
      {
        ruleKey: "rule_barrier_a",
        barrierKey: "barrier_a",
        when: {
          question: { moduleCode: "qualifications", questionKey: "q_level" },
          operator: "not_equals",
          value: "opt_a",
        },
      },
    ],
    unresolvedChecks: [
      {
        checkKey: "check_a",
        relatedRequirementKeys: ["req_a"],
        relatedRouteKeys: ["route_a"],
        explanationKey: "internal_explanation_a",
      },
    ],
    unresolvedCheckRules: [
      {
        ruleKey: "rule_check_a",
        checkKey: "check_a",
        when: {
          question: { moduleCode: "qualifications", questionKey: "q_count" },
          operator: "unanswered",
        },
      },
    ],
    actions: [
      {
        actionKey: "action_a",
        relatedRouteKeys: ["route_a"],
        relatedRequirementKeys: ["req_a"],
        relatedBarrierKeys: ["barrier_a"],
        relatedUnresolvedCheckKeys: ["check_a"],
        evidenceKeys: ["ev_a"],
      },
    ],
    actionRules: [
      {
        ruleKey: "rule_action_a",
        actionKey: "action_a",
        when: {
          any: [
            {
              question: { moduleCode: "qualifications", questionKey: "q_count" },
              operator: "lt",
              value: 2,
            },
          ],
        },
      },
    ],
    evidence: [
      {
        evidenceKey: "ev_a",
        reference: { sourceId: SOURCE_ID, sourceRecordKey: "SRC/REC-1" },
      },
    ],
    rankingConfigs: [
      {
        rankingConfigKey: "ranking_a",
        factors: [
          {
            factorKey: "factor_first",
            preferWhen: {
              question: { moduleCode: "qualifications", questionKey: "q_count" },
              operator: "gte",
              value: 1,
            },
            routeKeys: ["route_a"],
          },
          {
            factorKey: "factor_second",
            preferWhen: {
              question: { moduleCode: "driving", questionKey: "q_licences" },
              operator: "answered",
            },
            routeKeys: [],
          },
        ],
      },
    ],
    localRequirements: [
      {
        localRequirementKey: "local_a",
        localFactKey: "local_fact_a",
        relatedRouteKeys: ["route_a"],
        purposes: ["route_availability"],
        unresolvedCheckKey: "check_a",
      },
    ],
    review: { reviewKey: "review_a", confidenceKey: "confidence_a" },
    scenarios: [
      {
        scenarioKey: "scenario_a",
        answers: [
          { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_a" },
          { question: { moduleCode: "qualifications", questionKey: "q_count" }, value: 3 },
          { question: { moduleCode: "driving", questionKey: "q_licences" }, value: ["opt_car"] },
        ],
        expect: [
          { kind: "judgement_is", judgement: "realistic_now" },
          { kind: "requirement_state_is", requirementKey: "req_a", state: "met" },
          { kind: "route_eligibility_is", routeKey: "route_a", eligibility: true },
          { kind: "route_practical_fit_is", routeKey: "route_a", practicalFit: null },
          { kind: "barrier_present", barrierKey: "barrier_a" },
          { kind: "unresolved_check_present", checkKey: "check_a" },
          { kind: "action_present", actionKey: "action_a" },
        ],
      },
    ],
  };
}
