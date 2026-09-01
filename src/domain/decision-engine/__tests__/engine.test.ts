import { describe, expect, it } from "vitest";

import { realityCheckResultSchema } from "../../contracts";
import { DECISION_ENGINE_VERSION, DecisionEngineError } from "../codes";
import { evaluateRealityCheck, safeEvaluateRealityCheck } from "../engine";
import { runCareerPackScenario } from "../scenario";
import {
  ANSWER_SNAPSHOT_ID,
  EVALUATED_AT,
  answers,
  evidenceContext,
  pack,
  q,
  withdrawnEvidenceContext,
} from "./fixtures";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function run(
  overrides: Record<string, unknown>,
  entries: Parameters<typeof answers>[1] = [],
  evidenceOverrides: Parameters<typeof evidenceContext>[1] = {},
) {
  const target = pack(overrides);
  return safeEvaluateRealityCheck({
    pack: target,
    answerSnapshot: answers(target, entries),
    evidenceContext: evidenceContext(target, evidenceOverrides),
    evaluatedAt: EVALUATED_AT,
  });
}

function ok(outcome: ReturnType<typeof run>) {
  if (!outcome.ok) throw new Error(`expected success: ${JSON.stringify(outcome.issues)}`);
  return outcome.evaluation;
}

function issueCodes(outcome: ReturnType<typeof run>): readonly string[] {
  if (outcome.ok) throw new Error("expected failure");
  return outcome.issues.map((issue) => issue.code);
}

const TRUE_RULE = { question: q("q_flag"), operator: "answered" as const };
const FALSE_RULE = { question: q("q_flag"), operator: "unanswered" as const };
/** Unknown: the answer for `q_other` is absent, so comparison stays unresolved. */
const UNKNOWN_RULE = { question: q("q_other"), operator: "equals" as const, value: true };
const FLAG = [{ question: q("q_flag"), value: true }] as const;

function route(routeKey: string, extra: Record<string, unknown> = {}) {
  return {
    routeKey,
    eligibilityRequirementKeys: [],
    practicalFitRequirementKeys: [],
    availabilityRuleKeys: [],
    localRequirementKeys: [],
    ...extra,
  };
}

function requirement(requirementKey: string, extra: Record<string, unknown> = {}) {
  return {
    requirementKey,
    severity: "mandatory",
    purposes: ["eligibility"],
    evidenceKeys: [],
    ...extra,
  };
}

/* -------------------------------------------------------------------------- */
/* Boundary and purity                                                        */
/* -------------------------------------------------------------------------- */

describe("engine boundary", () => {
  it("returns a frozen envelope whose result parses the frozen contract", () => {
    const evaluation = ok(run({}, [...FLAG]));
    expect(evaluation.decisionEngineVersion).toBe(DECISION_ENGINE_VERSION);
    expect(realityCheckResultSchema.safeParse(evaluation.result).success).toBe(true);
    expect(Object.isFrozen(evaluation)).toBe(true);
    expect(Object.isFrozen(evaluation.result)).toBe(true);
    expect(Object.isFrozen(evaluation.result.provenance)).toBe(true);
    expect(evaluation.result.provenance.decisionEngineVersion).toBe(DECISION_ENGINE_VERSION);
  });

  it("is deterministic for identical exact inputs", () => {
    const target = pack({});
    const input = {
      pack: target,
      answerSnapshot: answers(target, [...FLAG]),
      evidenceContext: evidenceContext(target),
      evaluatedAt: EVALUATED_AT,
    };
    const first = safeEvaluateRealityCheck(input);
    const second = safeEvaluateRealityCheck(input);
    expect(first).toEqual(second);
    if (!first.ok || !second.ok) throw new Error("expected success");
    expect(JSON.stringify(first.evaluation)).toBe(JSON.stringify(second.evaluation));
  });

  it("fails closed on an invalid pack, snapshot binding and evaluatedAt", () => {
    const target = pack({});
    const other = pack({ version: "2.0.0" });
    expect(
      issueCodes(
        safeEvaluateRealityCheck({
          pack: target,
          /* Snapshot bound to a DIFFERENT exact pack. */
          answerSnapshot: answers(other, []),
          evidenceContext: evidenceContext(target),
          evaluatedAt: EVALUATED_AT,
        }),
      ),
    ).toContain("invalid_answer_snapshot");

    expect(
      issueCodes(
        safeEvaluateRealityCheck({
          pack: { schemaVersion: "nope" },
          answerSnapshot: answers(target, []),
          evidenceContext: evidenceContext(target),
          evaluatedAt: EVALUATED_AT,
        }),
      ),
    ).toContain("invalid_career_pack");

    expect(
      issueCodes(
        safeEvaluateRealityCheck({
          pack: target,
          answerSnapshot: answers(target, []),
          evidenceContext: evidenceContext(target),
          evaluatedAt: "not-a-timestamp",
        }),
      ),
    ).toContain("invalid_evaluated_at");
  });

  it("fails closed on an Evidence Context Snapshot bound to a different exact pack", () => {
    const target = pack({});
    const other = pack({ version: "2.0.0" });
    expect(
      issueCodes(
        safeEvaluateRealityCheck({
          pack: target,
          answerSnapshot: answers(target, []),
          /* Evidence context bound to a DIFFERENT exact pack version/hash. */
          evidenceContext: evidenceContext(other),
          evaluatedAt: EVALUATED_AT,
        }),
      ),
    ).toContain("invalid_evidence_context");
  });

  it("throws a DecisionEngineError from the throwing variant", () => {
    expect(() =>
      evaluateRealityCheck({
        pack: { schemaVersion: "nope" },
        answerSnapshot: {},
        evidenceContext: {},
        evaluatedAt: EVALUATED_AT,
      }),
    ).toThrow(DecisionEngineError);
  });
});

/* -------------------------------------------------------------------------- */
/* Requirement states                                                         */
/* -------------------------------------------------------------------------- */

describe("requirement state resolution", () => {
  const base = {
    requirements: [requirement("req_a")],
    routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
  };

  function stateOf(rules: readonly unknown[], entries: Parameters<typeof answers>[1] = []) {
    const evaluation = ok(run({ ...base, requirementRules: rules }, entries));
    const candidate = evaluation.result.candidateRoutes[0];
    return candidate?.eligibility.requirementAssessments[0]?.state;
  }

  it("no true rule leaves the requirement unknown", () => {
    expect(
      stateOf(
        [{ ruleKey: "r1", requirementKey: "req_a", when: FALSE_RULE, state: "unmet" }],
        [...FLAG],
      ),
    ).toBe("unknown");
  });

  it("missing data can never independently create unmet", () => {
    expect(
      stateOf([{ ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_RULE, state: "unmet" }]),
    ).toBe("unknown");
  });

  it("a determinately true rule asserts its declared state", () => {
    expect(
      stateOf(
        [{ ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" }],
        [...FLAG],
      ),
    ).toBe("met");
    expect(
      stateOf(
        [{ ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "not_applicable" }],
        [...FLAG],
      ),
    ).toBe("not_applicable");
  });

  it("rule order never changes the outcome", () => {
    const rules = [
      { ruleKey: "r1", requirementKey: "req_a", when: FALSE_RULE, state: "unmet" },
      { ruleKey: "r2", requirementKey: "req_a", when: TRUE_RULE, state: "met" },
    ];
    expect(stateOf(rules, [...FLAG])).toBe("met");
    expect(stateOf([...rules].reverse(), [...FLAG])).toBe("met");
  });

  it("two true rules asserting different states fail closed", () => {
    const outcome = run(
      {
        ...base,
        requirementRules: [
          { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" },
          { ruleKey: "r2", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
        ],
      },
      [...FLAG],
    );
    expect(issueCodes(outcome)).toContain("conflicting_requirement_rules");
  });

  it("an unresolved competing state turns a concrete state unknown, but an agreeing one does not", () => {
    expect(
      stateOf(
        [
          { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" },
          { ruleKey: "r2", requirementKey: "req_a", when: UNKNOWN_RULE, state: "unmet" },
        ],
        [...FLAG],
      ),
    ).toBe("unknown");
    expect(
      stateOf(
        [
          { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" },
          { ruleKey: "r2", requirementKey: "req_a", when: UNKNOWN_RULE, state: "met" },
        ],
        [...FLAG],
      ),
    ).toBe("met");
  });
});

/* -------------------------------------------------------------------------- */
/* Evidence ceiling                                                           */
/* -------------------------------------------------------------------------- */

describe("evidence strength ceiling", () => {
  const withEvidence = {
    requirements: [requirement("req_a", { evidenceKeys: ["ev_a"] })],
    requirementRules: [{ ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" }],
    routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
  };

  function assessment(evidenceOverrides: Parameters<typeof evidenceContext>[1] = {}) {
    const evaluation = ok(run(withEvidence, [...FLAG], evidenceOverrides));
    return evaluation.result.candidateRoutes[0]?.eligibility.requirementAssessments[0];
  }

  for (const grade of ["A", "B", "C"] as const) {
    it(`confirmed grade ${grade} evidence permits a consequential state and reports the grade`, () => {
      const entry = assessment({ grade, participantClassification: "confirmed_requirement" });
      expect(entry?.state).toBe("met");
      expect(entry?.evidenceGrade).toBe(grade);
    });
  }

  it("grade D or non-confirming evidence caps the state at verification_required", () => {
    expect(
      assessment({ grade: "D", participantClassification: "confirmed_requirement" })?.state,
    ).toBe("verification_required");
    expect(assessment({ grade: "A", participantClassification: "provider_dependent" })?.state).toBe(
      "verification_required",
    );
    expect(assessment({ grade: "A", participantClassification: "general_guidance" })?.state).toBe(
      "verification_required",
    );
    expect(assessment({ grade: "A", participantClassification: "needs_verification" })?.state).toBe(
      "verification_required",
    );
  });

  it("withdrawn confirmed grade A evidence caps the state but stays attached", () => {
    const target = pack(withEvidence);
    const outcome = safeEvaluateRealityCheck({
      pack: target,
      answerSnapshot: answers(target, [...FLAG]),
      evidenceContext: withdrawnEvidenceContext(target),
      evaluatedAt: EVALUATED_AT,
    });
    const entry = ok(outcome).result.candidateRoutes[0]?.eligibility.requirementAssessments[0];
    expect(entry?.state).toBe("verification_required");
    /* Withdrawal weakens authority; it never erases historical evidence. */
    expect(entry?.evidence).toHaveLength(1);
    expect(entry?.evidenceGrade).toBe("A");
    expect(entry?.evidence[0]?.participantClassification).toBe("confirmed_requirement");
    expect(entry?.evidence[0]?.recordVersion).toBe("1.0.0");
  });

  it("caps a would-be unmet on weak evidence and never concludes not_realistic_yet", () => {
    for (const evidenceOverrides of [
      { grade: "D", participantClassification: "confirmed_requirement" },
      { grade: "A", participantClassification: "provider_dependent" },
    ] as const) {
      const evaluation = ok(
        run(
          {
            requirements: [requirement("req_a", { evidenceKeys: ["ev_a"] })],
            requirementRules: [
              { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
            ],
            routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
          },
          [...FLAG],
          evidenceOverrides,
        ),
      );
      const candidate = evaluation.result.candidateRoutes[0];
      expect(candidate?.eligibility.requirementAssessments[0]?.state).toBe("verification_required");
      expect(candidate?.eligibility.satisfied).toBeNull();
      expect(evaluation.result.judgement).toBe("more_information_needed");
    }
  });

  it("a requirement declaring no evidence is never capped", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_a")],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" },
          ],
          routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.candidateRoutes[0]?.eligibility.requirementAssessments[0]?.state).toBe(
      "met",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Route availability                                                         */
/* -------------------------------------------------------------------------- */

describe("route availability", () => {
  it("no availability rules means available", () => {
    const evaluation = ok(run({}, [...FLAG]));
    expect(evaluation.routeAvailability).toEqual([
      { route: { routeKey: "route_a" }, available: true },
    ]);
  });

  it("only a determinately false assertion removes a route from candidates", () => {
    const overrides = {
      routes: [route("route_a", { availabilityRuleKeys: ["ar1"] })],
      routeAvailabilityRules: [
        { ruleKey: "ar1", routeKey: "route_a", when: TRUE_RULE, available: false },
      ],
    };
    const evaluation = ok(run(overrides, [...FLAG]));
    expect(evaluation.result.candidateRoutes).toHaveLength(0);
    expect(evaluation.routeAvailability[0]?.available).toBe(false);
  });

  it("a missing answer never removes a route; availability stays unresolved", () => {
    const evaluation = ok(
      run({
        routes: [route("route_a", { availabilityRuleKeys: ["ar1"] })],
        routeAvailabilityRules: [
          { ruleKey: "ar1", routeKey: "route_a", when: UNKNOWN_RULE, available: false },
        ],
      }),
    );
    expect(evaluation.routeAvailability[0]?.available).toBeNull();
    expect(evaluation.result.candidateRoutes).toHaveLength(1);
  });

  it("conflicting determinate availability assertions fail closed", () => {
    const outcome = run(
      {
        routes: [route("route_a", { availabilityRuleKeys: ["ar1", "ar2"] })],
        routeAvailabilityRules: [
          { ruleKey: "ar1", routeKey: "route_a", when: TRUE_RULE, available: false },
          { ruleKey: "ar2", routeKey: "route_a", when: TRUE_RULE, available: true },
        ],
      },
      [...FLAG],
    );
    expect(issueCodes(outcome)).toContain("conflicting_route_availability_rules");
  });
});

/* -------------------------------------------------------------------------- */
/* Eligibility vs practical fit                                               */
/* -------------------------------------------------------------------------- */

describe("eligibility and practical fit are separate", () => {
  it("an unmet eligibility requirement never touches practical fit", () => {
    const evaluation = ok(
      run(
        {
          requirements: [
            requirement("req_elig"),
            requirement("req_fit", { purposes: ["practical_fit"] }),
          ],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_elig", when: TRUE_RULE, state: "unmet" },
            { ruleKey: "r2", requirementKey: "req_fit", when: TRUE_RULE, state: "met" },
          ],
          routes: [
            route("route_a", {
              eligibilityRequirementKeys: ["req_elig"],
              practicalFitRequirementKeys: ["req_fit"],
            }),
          ],
        },
        [...FLAG],
      ),
    );
    const candidate = evaluation.result.candidateRoutes[0];
    expect(candidate?.eligibility.satisfied).toBe(false);
    expect(candidate?.practicalFit.satisfied).toBe(true);
  });

  it("preferred requirements never make a purpose false or unresolved", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_pref", { severity: "preferred" })],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_pref", when: TRUE_RULE, state: "unmet" },
          ],
          routes: [route("route_a", { eligibilityRequirementKeys: ["req_pref"] })],
        },
        [...FLAG],
      ),
    );
    const candidate = evaluation.result.candidateRoutes[0];
    expect(candidate?.eligibility.satisfied).toBe(true);
    expect(candidate?.eligibility.requirementAssessments[0]?.state).toBe("unmet");
  });

  it("a mandatory unknown requirement leaves the purpose unresolved", () => {
    const evaluation = ok(
      run({
        requirements: [requirement("req_a")],
        requirementRules: [
          { ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_RULE, state: "met" },
        ],
        routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
      }),
    );
    expect(evaluation.result.candidateRoutes[0]?.eligibility.satisfied).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Barriers, checks, actions                                                  */
/* -------------------------------------------------------------------------- */

describe("barriers, unresolved checks and actions", () => {
  it("a true barrier rule surfaces the declared blocking value; unknown surfaces blocking null", () => {
    const truthy = ok(
      run(
        {
          barriers: [{ barrierKey: "b_one", blocking: true }],
          barrierRules: [{ ruleKey: "br1", barrierKey: "b_one", when: TRUE_RULE }],
        },
        [...FLAG],
      ),
    );
    expect(truthy.result.barriers).toEqual([
      { barrierKey: "b_one", blocking: true, relatedRequirementKeys: [] },
    ]);

    const unresolved = ok(
      run({
        barriers: [{ barrierKey: "b_one", blocking: true }],
        barrierRules: [{ ruleKey: "br1", barrierKey: "b_one", when: UNKNOWN_RULE }],
      }),
    );
    expect(unresolved.result.barriers[0]?.blocking).toBeNull();
  });

  it("an all-false barrier is absent", () => {
    const evaluation = ok(
      run(
        {
          barriers: [{ barrierKey: "b_one", blocking: true }],
          barrierRules: [{ ruleKey: "br1", barrierKey: "b_one", when: FALSE_RULE }],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.barriers).toHaveLength(0);
  });

  it("route-related barriers attach to the route only", () => {
    const evaluation = ok(
      run(
        {
          barriers: [{ barrierKey: "b_one", blocking: true, relatedRouteKeys: ["route_a"] }],
          barrierRules: [{ ruleKey: "br1", barrierKey: "b_one", when: TRUE_RULE }],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.barriers).toHaveLength(0);
    expect(evaluation.result.candidateRoutes[0]?.barriers[0]?.barrierKey).toBe("b_one");
  });

  it("auto-surfaces a declared check for an unknown related requirement", () => {
    const evaluation = ok(
      run({
        requirements: [requirement("req_a")],
        requirementRules: [
          { ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_RULE, state: "met" },
        ],
        routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
        unresolvedChecks: [
          { checkKey: "c_one", relatedRequirementKeys: ["req_a"], explanationKey: "exp_one" },
        ],
      }),
    );
    expect(evaluation.result.unresolvedChecks[0]?.checkKey).toBe("c_one");
    const assessment = evaluation.result.candidateRoutes[0]?.eligibility.requirementAssessments[0];
    expect(assessment?.unresolvedCheckKeys).toEqual(["c_one"]);
    expect(assessment?.explanationKey).toBe("exp_one");
  });

  it("surfaces the exact declared check key for an attached local requirement", () => {
    const evaluation = ok(
      run(
        {
          routes: [route("route_a", { localRequirementKeys: ["lr_one"] })],
          localRequirements: [
            {
              localRequirementKey: "lr_one",
              localFactKey: "fact_one",
              purposes: ["practical_fit"],
              unresolvedCheckKey: "c_local",
            },
          ],
          unresolvedChecks: [{ checkKey: "c_local" }],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.unresolvedChecks.map((check) => check.checkKey)).toEqual(["c_local"]);
  });

  it("only determinately true action rules trigger, canonically deduplicated", () => {
    const evaluation = ok(
      run(
        {
          actions: [{ actionKey: "a_two" }, { actionKey: "a_one" }, { actionKey: "a_none" }],
          actionRules: [
            { ruleKey: "ar1", actionKey: "a_two", when: TRUE_RULE },
            { ruleKey: "ar2", actionKey: "a_one", when: TRUE_RULE },
            { ruleKey: "ar3", actionKey: "a_one", when: TRUE_RULE },
            { ruleKey: "ar4", actionKey: "a_none", when: UNKNOWN_RULE },
          ],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.triggeredActionKeys).toEqual(["a_one", "a_two"]);
  });
});

/* -------------------------------------------------------------------------- */
/* Ranking                                                                    */
/* -------------------------------------------------------------------------- */

describe("ranking", () => {
  const twoRoutes = [route("route_b"), route("route_a")];

  it("zero ranking configurations leaves candidates in canonical order and no metadata", () => {
    const evaluation = ok(run({ routes: twoRoutes }, [...FLAG]));
    expect(evaluation.result.candidateRoutes.map((entry) => entry.route.routeKey)).toEqual([
      "route_a",
      "route_b",
    ]);
    expect(evaluation.result.candidateRoutes[0]?.ranking).toBeNull();
  });

  it("more than one ranking configuration fails closed", () => {
    const outcome = run(
      {
        routes: twoRoutes,
        rankingConfigs: [
          { rankingConfigKey: "rank_one", factors: [{ factorKey: "f1", preferWhen: TRUE_RULE }] },
          { rankingConfigKey: "rank_two", factors: [{ factorKey: "f2", preferWhen: TRUE_RULE }] },
        ],
      },
      [...FLAG],
    );
    expect(issueCodes(outcome)).toContain("ambiguous_ranking_configuration");
  });

  it("ranks lexicographically over authored factor order and never demerits unknown", () => {
    const evaluation = ok(
      run(
        {
          routes: twoRoutes,
          rankingConfigs: [
            {
              rankingConfigKey: "rank_one",
              factors: [
                { factorKey: "f_first", preferWhen: TRUE_RULE, routeKeys: ["route_b"] },
                { factorKey: "f_second", preferWhen: TRUE_RULE, routeKeys: ["route_a"] },
                { factorKey: "f_unknown", preferWhen: UNKNOWN_RULE },
              ],
            },
          ],
        },
        [...FLAG],
      ),
    );
    const order = evaluation.result.candidateRoutes.map((entry) => entry.route.routeKey);
    expect(order).toEqual(["route_b", "route_a"]);
    expect(evaluation.result.candidateRoutes[0]?.ranking).toEqual({
      rankingConfigKey: "rank_one",
      factorKeys: ["f_first"],
      position: 1,
    });
    expect(evaluation.result.candidateRoutes[1]?.ranking?.factorKeys).toEqual(["f_second"]);
  });

  it("exact ties fall back to canonical route key order", () => {
    const evaluation = ok(
      run(
        {
          routes: twoRoutes,
          rankingConfigs: [
            {
              rankingConfigKey: "rank_one",
              factors: [{ factorKey: "f_all", preferWhen: TRUE_RULE }],
            },
          ],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.candidateRoutes.map((entry) => entry.route.routeKey)).toEqual([
      "route_a",
      "route_b",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Protected judgement                                                        */
/* -------------------------------------------------------------------------- */

describe("protected judgement", () => {
  it("realistic_now when a feasible route has nothing outstanding", () => {
    expect(ok(run({}, [...FLAG])).result.judgement).toBe("realistic_now");
  });

  it("realistic_with_conditions for a known blocking barrier on a feasible route", () => {
    const evaluation = ok(
      run(
        {
          barriers: [{ barrierKey: "b_one", blocking: true }],
          barrierRules: [{ ruleKey: "br1", barrierKey: "b_one", when: TRUE_RULE }],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.judgement).toBe("realistic_with_conditions");
  });

  it("realistic_with_conditions for a known preferred-requirement condition gap", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_pref", { severity: "preferred" })],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_pref", when: TRUE_RULE, state: "unmet" },
          ],
          routes: [route("route_a", { eligibilityRequirementKeys: ["req_pref"] })],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.judgement).toBe("realistic_with_conditions");
  });

  it("more_information_needed when a mandatory requirement is unresolved", () => {
    const evaluation = ok(
      run({
        requirements: [requirement("req_a")],
        requirementRules: [
          { ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_RULE, state: "met" },
        ],
        routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
      }),
    );
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("more_information_needed when availability itself is unresolved", () => {
    const evaluation = ok(
      run({
        routes: [route("route_a", { availabilityRuleKeys: ["ar1"] })],
        routeAvailabilityRules: [
          { ruleKey: "ar1", routeKey: "route_a", when: UNKNOWN_RULE, available: false },
        ],
      }),
    );
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("not_realistic_yet only when every declared route is definitively blocked", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_a")],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
          ],
          routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.judgement).toBe("not_realistic_yet");
  });

  it("a blocking barrier alone never produces not_realistic_yet", () => {
    const evaluation = ok(
      run(
        {
          routes: [route("route_a"), route("route_b")],
          barriers: [{ barrierKey: "b_one", blocking: true }],
          barrierRules: [{ ruleKey: "br1", barrierKey: "b_one", when: TRUE_RULE }],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.judgement).toBe("realistic_with_conditions");
  });

  it("one blocked route does not overrule another feasible route", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_a")],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
          ],
          routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] }), route("route_b")],
        },
        [...FLAG],
      ),
    );
    expect(evaluation.result.judgement).toBe("realistic_now");
  });

  it("unknown on a still-viable route outranks a blocked sibling route", () => {
    /* route_a is definitively blocked; route_b has unresolved mandatory eligibility. */
    const unresolvedEligibility = ok(
      run(
        {
          requirements: [requirement("req_blocked"), requirement("req_unknown")],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_blocked", when: TRUE_RULE, state: "unmet" },
            { ruleKey: "r2", requirementKey: "req_unknown", when: UNKNOWN_RULE, state: "met" },
          ],
          routes: [
            route("route_a", { eligibilityRequirementKeys: ["req_blocked"] }),
            route("route_b", { eligibilityRequirementKeys: ["req_unknown"] }),
          ],
        },
        [...FLAG],
      ),
    );
    expect(unresolvedEligibility.result.judgement).toBe("more_information_needed");

    /* Same shape, but route_b's uncertainty is unresolved availability instead. */
    const unresolvedAvailability = ok(
      run(
        {
          requirements: [requirement("req_blocked")],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_blocked", when: TRUE_RULE, state: "unmet" },
          ],
          routes: [
            route("route_a", { eligibilityRequirementKeys: ["req_blocked"] }),
            route("route_b", { availabilityRuleKeys: ["ar1"] }),
          ],
          routeAvailabilityRules: [
            { ruleKey: "ar1", routeKey: "route_b", when: UNKNOWN_RULE, available: false },
          ],
        },
        [...FLAG],
      ),
    );
    expect(unresolvedAvailability.result.judgement).toBe("more_information_needed");
  });
});

/* -------------------------------------------------------------------------- */
/* Scenario runner                                                            */
/* -------------------------------------------------------------------------- */

describe("scenario runner", () => {
  const scenarioPack = {
    requirements: [requirement("req_a")],
    requirementRules: [{ ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" }],
    routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
    barriers: [{ barrierKey: "b_one", blocking: false }],
    barrierRules: [{ ruleKey: "br1", barrierKey: "b_one", when: TRUE_RULE }],
    unresolvedChecks: [{ checkKey: "c_one" }],
    unresolvedCheckRules: [{ ruleKey: "cr1", checkKey: "c_one", when: TRUE_RULE }],
    actions: [{ actionKey: "a_one" }],
    actionRules: [{ ruleKey: "arl1", actionKey: "a_one", when: TRUE_RULE }],
    scenarios: [
      {
        scenarioKey: "sc_all_kinds",
        answers: [{ question: q("q_flag"), value: true }],
        expect: [
          { kind: "judgement_is", judgement: "more_information_needed" },
          { kind: "requirement_state_is", requirementKey: "req_a", state: "met" },
          { kind: "route_eligibility_is", routeKey: "route_a", eligibility: true },
          { kind: "route_practical_fit_is", routeKey: "route_a", practicalFit: true },
          { kind: "barrier_present", barrierKey: "b_one" },
          { kind: "unresolved_check_present", checkKey: "c_one" },
          { kind: "action_present", actionKey: "a_one" },
        ],
      },
    ],
  };

  function runScenario(overrides: Record<string, unknown>, scenarioKey = "sc_all_kinds") {
    const target = pack(overrides);
    return runCareerPackScenario({
      pack: target,
      scenarioKey,
      answerSnapshotId: ANSWER_SNAPSHOT_ID,
      evidenceContext: evidenceContext(target),
      evaluatedAt: EVALUATED_AT,
    });
  }

  it("passes every frozen assertion kind", () => {
    const outcome = runScenario(scenarioPack);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
    expect(outcome.outcome.failures).toEqual([]);
    expect(outcome.outcome.passed).toBe(true);
  });

  it("reports stable failed assertion indexes without writing anything", () => {
    const outcome = runScenario({
      ...scenarioPack,
      scenarios: [
        {
          ...scenarioPack.scenarios[0],
          expect: [
            { kind: "judgement_is", judgement: "realistic_now" },
            { kind: "requirement_state_is", requirementKey: "req_a", state: "unmet" },
          ],
        },
      ],
    });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
    expect(outcome.outcome.passed).toBe(false);
    expect(outcome.outcome.failures).toEqual([
      { index: 0, kind: "judgement_is" },
      { index: 1, kind: "requirement_state_is", key: "req_a" },
    ]);
  });

  it("fails closed on an unknown scenario key", () => {
    const outcome = runScenario(scenarioPack, "sc_missing");
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.issues.map((issue) => issue.code)).toContain("unknown_scenario");
  });
});
