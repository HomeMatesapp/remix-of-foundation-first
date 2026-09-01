import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DECISION_ENGINE_VERSION } from "../codes";
import { safeEvaluateRealityCheck } from "../engine";
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

/**
 * INCREMENT 10 — DECISION ENGINE GUARDRAILS.
 *
 * Hostile regression suite for the approved guardrails, asserted against the
 * EXISTING Increment 9 runtime. Nothing here changes engine behaviour: every case
 * proves a structural protection rather than an implementation detail.
 *
 * Guardrails proven:
 *  G1  missing/unanswered data never becomes `unmet` or `false`;
 *  G2  an unresolved competing rule is never overridden by a determinate rule;
 *  G3  conflicting determinate rules fail closed, order-independently;
 *  G4  evidence strength caps positive AND negative certainty;
 *  G5  provider-dependent evidence is never generalised;
 *  G6  every declared route is considered before `not_realistic_yet`;
 *  G7  a declared bridging route is an ordinary declared route;
 *  G8  unresolved local requirements cannot become negative facts;
 *  G9  barriers are not secret eligibility failures;
 *  G10 scenario-level regression over the frozen assertion kinds;
 *  G11 determinism under non-semantic authored reordering;
 *  G12 no AI/provider/local/career-specific authority leakage.
 */

/* -------------------------------------------------------------------------- */
/* Shared synthetic vocabulary                                                */
/* -------------------------------------------------------------------------- */

const TRUE_RULE = { question: q("q_flag"), operator: "answered" as const };
const TRUE_RULE_EQUALS = { question: q("q_flag"), operator: "equals" as const, value: true };
const FALSE_RULE = { question: q("q_flag"), operator: "unanswered" as const };
/** Unknown: `q_other` is never answered, so every comparison stays unresolved. */
const UNKNOWN_TRUE = { question: q("q_other"), operator: "equals" as const, value: true };
/** The hostile boolean pair: a missing answer must not satisfy either branch. */
const UNKNOWN_FALSE = { question: q("q_other"), operator: "equals" as const, value: false };
const FLAG = [{ question: q("q_flag"), value: true }] as const;

const BRIDGING_COMPOSITION = {
  frameworkVersion: "1.0.0",
  archetypes: [{ code: "bridging", version: "1.0.0" }],
};

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

function unavailableWhen(ruleKey: string, routeKey: string, when: unknown) {
  return { ruleKey, routeKey, when, available: false };
}

type Entries = Parameters<typeof answers>[1];

function run(
  overrides: Record<string, unknown>,
  entries: Entries = [],
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

function runWithdrawn(overrides: Record<string, unknown>, entries: Entries = []) {
  const target = pack(overrides);
  return safeEvaluateRealityCheck({
    pack: target,
    answerSnapshot: answers(target, entries),
    evidenceContext: withdrawnEvidenceContext(target),
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

function candidate(evaluation: ReturnType<typeof ok>, routeKey: string) {
  return evaluation.result.candidateRoutes.find((entry) => entry.route.routeKey === routeKey);
}

function availabilityOf(evaluation: ReturnType<typeof ok>, routeKey: string) {
  return evaluation.result.judgement === undefined
    ? undefined
    : evaluation.routeAvailability.find((entry) => entry.route.routeKey === routeKey)?.available;
}

function eligibilityStateOf(evaluation: ReturnType<typeof ok>, routeKey: string, key: string) {
  return candidate(evaluation, routeKey)?.eligibility.requirementAssessments.find(
    (entry) => entry.requirement.requirementKey === key,
  )?.state;
}

function practicalFitStateOf(evaluation: ReturnType<typeof ok>, routeKey: string, key: string) {
  return candidate(evaluation, routeKey)?.practicalFit.requirementAssessments.find(
    (entry) => entry.requirement.requirementKey === key,
  )?.state;
}

/* -------------------------------------------------------------------------- */
/* G1 — missing data never becomes unmet                                      */
/* -------------------------------------------------------------------------- */

describe("G1 missing or unanswered data never becomes unmet", () => {
  const base = {
    requirements: [requirement("req_a")],
    routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
    requirementRules: [
      { ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_TRUE, state: "unmet" },
    ],
  };

  it("leaves the requirement unknown, eligibility null and the judgement non-negative", () => {
    const evaluation = ok(run(base, [...FLAG]));
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("unknown");
    expect(candidate(evaluation, "route_a")?.eligibility.satisfied).toBeNull();
    expect(candidate(evaluation, "route_a")?.eligibility.satisfied).not.toBe(false);
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("leaves BOTH eligibility and practical fit null for one missing mandatory requirement", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_a", { purposes: ["eligibility", "practical_fit"] })],
          routes: [
            route("route_a", {
              eligibilityRequirementKeys: ["req_a"],
              practicalFitRequirementKeys: ["req_a"],
            }),
          ],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_TRUE, state: "unmet" },
          ],
        },
        [...FLAG],
      ),
    );
    const target = candidate(evaluation, "route_a");
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("unknown");
    expect(practicalFitStateOf(evaluation, "route_a", "req_a")).toBe("unknown");
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).not.toBe("unmet");
    expect(practicalFitStateOf(evaluation, "route_a", "req_a")).not.toBe("unmet");
    expect(target?.eligibility.satisfied).toBeNull();
    expect(target?.eligibility.satisfied).not.toBe(false);
    expect(target?.practicalFit.satisfied).toBeNull();
    expect(target?.practicalFit.satisfied).not.toBe(false);
    expect(evaluation.result.judgement).toBe("more_information_needed");
    expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
  });

  it("never treats a missing boolean answer as false and never takes the opposite branch", () => {
    const evaluation = ok(
      run(
        {
          ...base,
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_TRUE, state: "met" },
            { ruleKey: "r2", requirementKey: "req_a", when: UNKNOWN_FALSE, state: "unmet" },
          ],
        },
        [...FLAG],
      ),
    );
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("unknown");
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("never makes a route unavailable because an answer is absent", () => {
    const evaluation = ok(
      run(
        {
          routes: [route("route_a", { availabilityRuleKeys: ["av1"] })],
          routeAvailabilityRules: [unavailableWhen("av1", "route_a", UNKNOWN_TRUE)],
        },
        [...FLAG],
      ),
    );
    expect(availabilityOf(evaluation, "route_a")).toBeNull();
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });
});

/* -------------------------------------------------------------------------- */
/* G2 — unresolved competing rule wins over a determinate one                 */
/* -------------------------------------------------------------------------- */

describe("G2 an unresolved competing rule is never overridden", () => {
  const rules = [
    { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
    { ruleKey: "r2", requirementKey: "req_a", when: UNKNOWN_TRUE, state: "met" },
  ];

  function evaluateWith(order: readonly unknown[]) {
    return ok(
      run(
        {
          requirements: [requirement("req_a")],
          routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
          requirementRules: order,
        },
        [...FLAG],
      ),
    );
  }

  it("collapses the determinate unmet to unknown irrespective of authored order", () => {
    for (const order of [rules, [...rules].reverse()]) {
      const evaluation = evaluateWith(order);
      expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("unknown");
      expect(candidate(evaluation, "route_a")?.eligibility.satisfied).toBeNull();
      expect(evaluation.result.judgement).toBe("more_information_needed");
      expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* G3 — conflicting determinate rules fail closed                             */
/* -------------------------------------------------------------------------- */

describe("G3 conflicting determinate rules fail closed", () => {
  const requirementConflict = [
    { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
    { ruleKey: "r2", requirementKey: "req_a", when: TRUE_RULE_EQUALS, state: "met" },
  ];

  it("rejects conflicting requirement rules in either authored order", () => {
    for (const order of [requirementConflict, [...requirementConflict].reverse()]) {
      expect(
        issueCodes(
          run(
            {
              requirements: [requirement("req_a")],
              routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
              requirementRules: order,
            },
            [...FLAG],
          ),
        ),
      ).toContain("conflicting_requirement_rules");
    }
  });

  const availabilityConflict = [
    { ruleKey: "av1", routeKey: "route_a", when: TRUE_RULE, available: false },
    { ruleKey: "av2", routeKey: "route_a", when: TRUE_RULE_EQUALS, available: true },
  ];

  it("rejects conflicting route availability rules in either authored order", () => {
    for (const order of [availabilityConflict, [...availabilityConflict].reverse()]) {
      expect(
        issueCodes(
          run(
            {
              routes: [route("route_a", { availabilityRuleKeys: ["av1", "av2"] })],
              routeAvailabilityRules: order,
            },
            [...FLAG],
          ),
        ),
      ).toContain("conflicting_route_availability_rules");
    }
  });
});

/* -------------------------------------------------------------------------- */
/* G4 — evidence strength ceiling, positive and negative                      */
/* -------------------------------------------------------------------------- */

describe("G4 evidence authority caps both positive and negative certainty", () => {
  function evidencedPack(state: "met" | "unmet") {
    return {
      requirements: [requirement("req_a", { evidenceKeys: ["ev_a"] })],
      routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
      requirementRules: [{ ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state }],
    };
  }

  it.each(["A", "B", "C"])("grade %s confirmed evidence preserves a determinate met", (grade) => {
    const evaluation = ok(run(evidencedPack("met"), [...FLAG], { grade }));
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("met");
  });

  it.each(["A", "B", "C"])("grade %s confirmed evidence preserves a determinate unmet", (grade) => {
    const evaluation = ok(run(evidencedPack("unmet"), [...FLAG], { grade }));
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("unmet");
  });

  const WEAK: readonly Parameters<typeof evidenceContext>[1][] = [
    { grade: "D" },
    { participantClassification: "provider_dependent" },
    { participantClassification: "general_guidance" },
    { participantClassification: "needs_verification" },
  ];

  it("caps a would-be met on weak, non-confirming evidence", () => {
    for (const overrides of WEAK) {
      const evaluation = ok(run(evidencedPack("met"), [...FLAG], overrides));
      expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("verification_required");
    }
  });

  it("caps a would-be unmet symmetrically and never concludes not_realistic_yet", () => {
    for (const overrides of WEAK) {
      const evaluation = ok(run(evidencedPack("unmet"), [...FLAG], overrides));
      expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("verification_required");
      expect(candidate(evaluation, "route_a")?.eligibility.satisfied).toBeNull();
      expect(evaluation.result.judgement).toBe("more_information_needed");
      expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
    }
  });

  it("caps withdrawn confirmed grade A evidence while keeping it attached", () => {
    const evaluation = ok(runWithdrawn(evidencedPack("unmet"), [...FLAG]));
    const assessment = candidate(evaluation, "route_a")?.eligibility.requirementAssessments[0];
    expect(assessment?.state).toBe("verification_required");
    expect(assessment?.evidenceGrade).toBe("A");
    expect(assessment?.evidence.length).toBe(1);
    expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
  });
});

/* -------------------------------------------------------------------------- */
/* G5 — provider-dependent evidence is never generalised                      */
/* -------------------------------------------------------------------------- */

describe("G5 provider-dependent evidence is never generalised", () => {
  it("keeps a would-be unmet at verification_required with null eligibility", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_a", { evidenceKeys: ["ev_a"] })],
          routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
          ],
        },
        [...FLAG],
        { grade: "A", participantClassification: "provider_dependent" },
      ),
    );
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("verification_required");
    expect(candidate(evaluation, "route_a")?.eligibility.satisfied).toBeNull();
    expect(candidate(evaluation, "route_a")?.eligibility.satisfied).not.toBe(false);
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("never gives a sibling route a negative consequence", () => {
    const evaluation = ok(
      run(
        {
          requirements: [requirement("req_a", { evidenceKeys: ["ev_a"] }), requirement("req_b")],
          routes: [
            route("route_a", { eligibilityRequirementKeys: ["req_a"] }),
            route("route_b", { eligibilityRequirementKeys: ["req_b"] }),
          ],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
            { ruleKey: "r2", requirementKey: "req_b", when: TRUE_RULE, state: "met" },
          ],
        },
        [...FLAG],
        { grade: "A", participantClassification: "provider_dependent" },
      ),
    );
    expect(eligibilityStateOf(evaluation, "route_a", "req_a")).toBe("verification_required");
    expect(eligibilityStateOf(evaluation, "route_b", "req_b")).toBe("met");
    expect(candidate(evaluation, "route_b")?.eligibility.satisfied).toBe(true);
    expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
  });
});

/* -------------------------------------------------------------------------- */
/* G6 — every declared route is considered before a negative conclusion       */
/* -------------------------------------------------------------------------- */

describe("G6 every declared route is considered before not_realistic_yet", () => {
  /** route_a is definitively blocked by a determinate unavailability rule. */
  const blockedRouteA = {
    routes: [
      route("route_a", { availabilityRuleKeys: ["av1"] }),
      route("route_b", { eligibilityRequirementKeys: ["req_b"] }),
    ],
    routeAvailabilityRules: [unavailableWhen("av1", "route_a", TRUE_RULE)],
    requirements: [requirement("req_b")],
  };

  it("forbids a negative conclusion when a sibling has unresolved mandatory eligibility", () => {
    const evaluation = ok(
      run(
        {
          ...blockedRouteA,
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_b", when: UNKNOWN_TRUE, state: "unmet" },
          ],
        },
        [...FLAG],
      ),
    );
    expect(availabilityOf(evaluation, "route_a")).toBe(false);
    expect(candidate(evaluation, "route_a")).toBeUndefined();
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("forbids a negative conclusion when a sibling has unresolved availability", () => {
    const evaluation = ok(
      run(
        {
          routes: [
            route("route_a", { availabilityRuleKeys: ["av1"] }),
            route("route_b", { availabilityRuleKeys: ["av2"] }),
          ],
          routeAvailabilityRules: [
            unavailableWhen("av1", "route_a", TRUE_RULE),
            unavailableWhen("av2", "route_b", UNKNOWN_TRUE),
          ],
        },
        [...FLAG],
      ),
    );
    expect(availabilityOf(evaluation, "route_a")).toBe(false);
    expect(availabilityOf(evaluation, "route_b")).toBeNull();
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });

  it("forbids a negative conclusion when a sibling is definitely feasible", () => {
    const evaluation = ok(
      run(
        {
          ...blockedRouteA,
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_b", when: TRUE_RULE, state: "met" },
          ],
        },
        [...FLAG],
      ),
    );
    expect(availabilityOf(evaluation, "route_a")).toBe(false);
    expect(evaluation.result.judgement).toBe("realistic_now");
  });

  it("permits not_realistic_yet only when every declared route is definitively blocked", () => {
    const evaluation = ok(
      run(
        {
          routes: [
            route("route_a", { availabilityRuleKeys: ["av1"] }),
            route("route_b", { availabilityRuleKeys: ["av2"] }),
          ],
          routeAvailabilityRules: [
            unavailableWhen("av1", "route_a", TRUE_RULE),
            unavailableWhen("av2", "route_b", TRUE_RULE_EQUALS),
          ],
        },
        [...FLAG],
      ),
    );
    expect(availabilityOf(evaluation, "route_a")).toBe(false);
    expect(availabilityOf(evaluation, "route_b")).toBe(false);
    expect(evaluation.result.candidateRoutes).toHaveLength(0);
    expect(evaluation.result.judgement).toBe("not_realistic_yet");
  });
});

/* -------------------------------------------------------------------------- */
/* G7 — a declared bridging route is an ordinary declared route               */
/* -------------------------------------------------------------------------- */

describe("G7 declared bridging routes are considered, never skipped", () => {
  const direct = route("route_direct", { availabilityRuleKeys: ["av_direct"] });
  const blockDirect = unavailableWhen("av_direct", "route_direct", TRUE_RULE);

  function bridgingPack(bridgeExtra: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    const bridge = route("route_bridge", {
      archetypeComposition: BRIDGING_COMPOSITION,
      ...bridgeExtra,
    });
    return {
      forward: { routes: [direct, bridge], routeAvailabilityRules: [blockDirect], ...extra },
      reversed: { routes: [bridge, direct], routeAvailabilityRules: [blockDirect], ...extra },
    };
  }

  function judgementsFor(variants: { forward: object; reversed: object }) {
    return [variants.forward, variants.reversed].map(
      (overrides) => ok(run(overrides as Record<string, unknown>, [...FLAG])).result.judgement,
    );
  }

  it("A: a feasible bridging route forbids a negative judgement", () => {
    const judgements = judgementsFor(bridgingPack({}));
    expect(judgements).toEqual(["realistic_now", "realistic_now"]);
  });

  it("B: an unresolved bridging route yields more_information_needed", () => {
    const judgements = judgementsFor(
      bridgingPack(
        { eligibilityRequirementKeys: ["req_bridge"] },
        {
          requirements: [requirement("req_bridge")],
          requirementRules: [
            { ruleKey: "r1", requirementKey: "req_bridge", when: UNKNOWN_TRUE, state: "unmet" },
          ],
        },
      ),
    );
    expect(judgements).toEqual(["more_information_needed", "more_information_needed"]);
  });

  it("C: a definitively blocked bridging route permits not_realistic_yet", () => {
    const judgements = judgementsFor(
      bridgingPack(
        { availabilityRuleKeys: ["av_bridge"] },
        {
          routeAvailabilityRules: [
            blockDirect,
            unavailableWhen("av_bridge", "route_bridge", TRUE_RULE_EQUALS),
          ],
        },
      ),
    );
    expect(judgements).toEqual(["not_realistic_yet", "not_realistic_yet"]);
  });
});

/* -------------------------------------------------------------------------- */
/* G8 — unresolved local facts cannot become negative                         */
/* -------------------------------------------------------------------------- */

describe("G8 unresolved local requirements never become negative facts", () => {
  it("surfaces the declared unresolved check and preserves uncertainty", () => {
    const evaluation = ok(
      run(
        {
          routes: [route("route_a", { localRequirementKeys: ["local_a"] })],
          localRequirements: [
            {
              localRequirementKey: "local_a",
              localFactKey: "fact_a",
              relatedRouteKeys: ["route_a"],
              purposes: ["eligibility"],
              unresolvedCheckKey: "chk_local",
            },
          ],
          unresolvedChecks: [
            { checkKey: "chk_local", relatedRouteKeys: ["route_a"], relatedRequirementKeys: [] },
          ],
        },
        [...FLAG],
      ),
    );
    expect(availabilityOf(evaluation, "route_a")).toBe(true);
    expect(candidate(evaluation, "route_a")?.eligibility.satisfied).toBe(true);
    expect(candidate(evaluation, "route_a")?.unresolvedChecks.map((c) => c.checkKey)).toContain(
      "chk_local",
    );
    expect(evaluation.result.judgement).toBe("more_information_needed");
    expect(evaluation.result.judgement).not.toBe("not_realistic_yet");
  });
});

/* -------------------------------------------------------------------------- */
/* G9 — barriers are not secret eligibility failures                          */
/* -------------------------------------------------------------------------- */

describe("G9 blocking barriers are not secret eligibility failures", () => {
  it("keeps eligibility true and returns realistic_with_conditions", () => {
    const evaluation = ok(
      run(
        {
          routes: [route("route_a")],
          barriers: [
            {
              barrierKey: "bar_a",
              blocking: true,
              relatedRouteKeys: ["route_a"],
              relatedRequirementKeys: [],
              evidenceKeys: [],
            },
          ],
          barrierRules: [{ ruleKey: "br1", barrierKey: "bar_a", when: TRUE_RULE }],
        },
        [...FLAG],
      ),
    );
    expect(candidate(evaluation, "route_a")?.eligibility.satisfied).toBe(true);
    expect(candidate(evaluation, "route_a")?.practicalFit.satisfied).toBe(true);
    expect(candidate(evaluation, "route_a")?.barriers[0]?.blocking).toBe(true);
    expect(evaluation.result.judgement).toBe("realistic_with_conditions");
  });

  it("returns more_information_needed for an unresolved check on a viable route", () => {
    const evaluation = ok(
      run(
        {
          routes: [route("route_a")],
          unresolvedChecks: [
            { checkKey: "chk_a", relatedRouteKeys: ["route_a"], relatedRequirementKeys: [] },
          ],
          unresolvedCheckRules: [{ ruleKey: "cr1", checkKey: "chk_a", when: TRUE_RULE }],
        },
        [...FLAG],
      ),
    );
    expect(candidate(evaluation, "route_a")?.eligibility.satisfied).toBe(true);
    expect(evaluation.result.judgement).toBe("more_information_needed");
  });
});

/* -------------------------------------------------------------------------- */
/* G10 — scenario-level regression over the frozen assertion kinds            */
/* -------------------------------------------------------------------------- */

describe("G10 scenario-level guardrail regression", () => {
  function runScenario(overrides: Record<string, unknown>, scenarioKey: string) {
    const target = pack(overrides);
    const outcome = runCareerPackScenario({
      pack: target,
      scenarioKey,
      answerSnapshotId: ANSWER_SNAPSHOT_ID,
      evidenceContext: evidenceContext(target),
      evaluatedAt: EVALUATED_AT,
    });
    if (!outcome.ok) throw new Error(`expected scenario run: ${JSON.stringify(outcome.issues)}`);
    return outcome.outcome;
  }

  it("an unknown mandatory fact expects more_information_needed and null eligibility", () => {
    const outcome = runScenario(
      {
        requirements: [requirement("req_a")],
        routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
        requirementRules: [
          { ruleKey: "r1", requirementKey: "req_a", when: UNKNOWN_TRUE, state: "unmet" },
        ],
        scenarios: [
          {
            scenarioKey: "sc_unknown",
            answers: [{ question: q("q_flag"), value: true }],
            expect: [
              { kind: "judgement_is", judgement: "more_information_needed" },
              { kind: "route_eligibility_is", routeKey: "route_a", eligibility: null },
              { kind: "requirement_state_is", requirementKey: "req_a", state: "unknown" },
            ],
          },
        ],
      },
      "sc_unknown",
    );
    expect(outcome.failures).toEqual([]);
    expect(outcome.passed).toBe(true);
  });

  it("all declared routes blocked by strong confirmed evidence expects not_realistic_yet", () => {
    const outcome = runScenario(
      {
        requirements: [requirement("req_a", { evidenceKeys: ["ev_a"] })],
        routes: [route("route_a", { eligibilityRequirementKeys: ["req_a"] })],
        requirementRules: [
          { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "unmet" },
        ],
        scenarios: [
          {
            scenarioKey: "sc_blocked",
            answers: [{ question: q("q_flag"), value: true }],
            expect: [
              { kind: "judgement_is", judgement: "not_realistic_yet" },
              { kind: "route_eligibility_is", routeKey: "route_a", eligibility: false },
              { kind: "requirement_state_is", requirementKey: "req_a", state: "unmet" },
            ],
          },
        ],
      },
      "sc_blocked",
    );
    expect(outcome.failures).toEqual([]);
    expect(outcome.passed).toBe(true);
  });

  it("a viable bridging route while the direct route is blocked expects a non-negative judgement", () => {
    const outcome = runScenario(
      {
        requirements: [requirement("req_direct")],
        routes: [
          route("route_direct", { eligibilityRequirementKeys: ["req_direct"] }),
          route("route_bridge", { archetypeComposition: BRIDGING_COMPOSITION }),
        ],
        requirementRules: [
          { ruleKey: "r1", requirementKey: "req_direct", when: TRUE_RULE, state: "unmet" },
        ],
        scenarios: [
          {
            scenarioKey: "sc_bridge",
            answers: [{ question: q("q_flag"), value: true }],
            expect: [
              { kind: "judgement_is", judgement: "realistic_now" },
              { kind: "route_eligibility_is", routeKey: "route_direct", eligibility: false },
              { kind: "route_eligibility_is", routeKey: "route_bridge", eligibility: true },
            ],
          },
        ],
      },
      "sc_bridge",
    );
    expect(outcome.failures).toEqual([]);
    expect(outcome.passed).toBe(true);
    expect(outcome.evaluation.result.judgement).not.toBe("not_realistic_yet");
  });
});

/* -------------------------------------------------------------------------- */
/* G11 — determinism under non-semantic reordering                            */
/* -------------------------------------------------------------------------- */

describe("G11 non-semantic authored reordering never changes consequential truth", () => {
  const requirements = [requirement("req_a"), requirement("req_b")];
  const routes = [
    route("route_a", { eligibilityRequirementKeys: ["req_a"] }),
    route("route_b", { eligibilityRequirementKeys: ["req_b"] }),
  ];
  const rules = [
    { ruleKey: "r1", requirementKey: "req_a", when: TRUE_RULE, state: "met" },
    { ruleKey: "r2", requirementKey: "req_a", when: FALSE_RULE, state: "unmet" },
    { ruleKey: "r3", requirementKey: "req_b", when: UNKNOWN_TRUE, state: "unmet" },
  ];

  it("produces byte-equivalent consequential output for reversed authored arrays", () => {
    const forward = ok(run({ requirements, routes, requirementRules: rules }, [...FLAG]));
    const reversed = ok(
      run(
        {
          requirements: [...requirements].reverse(),
          routes: [...routes].reverse(),
          requirementRules: [...rules].reverse(),
        },
        [...FLAG],
      ),
    );
    expect(reversed.result.judgement).toBe(forward.result.judgement);
    expect(JSON.stringify(reversed.result.candidateRoutes)).toBe(
      JSON.stringify(forward.result.candidateRoutes),
    );
    expect(JSON.stringify(reversed.routeAvailability)).toBe(
      JSON.stringify(forward.routeAvailability),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* G12 — no new authority leakage                                             */
/* -------------------------------------------------------------------------- */

describe("G12 Increment 10 introduces no new authority", () => {
  const PACKAGE_DIR = join(import.meta.dirname, "..");

  function runtimeSources(): readonly { readonly file: string; readonly text: string }[] {
    return readdirSync(PACKAGE_DIR)
      .filter((name) => name.endsWith(".ts"))
      .map((name) => ({ file: name, text: readFileSync(join(PACKAGE_DIR, name), "utf8") }));
  }

  it("keeps the shared engine version unchanged", () => {
    expect(DECISION_ENGINE_VERSION).toBe("1.0.0");
  });

  it("adds no bridging, provider, local or career-specific branch to runtime code", () => {
    for (const { file, text } of runtimeSources()) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/\bbridging\b/i);
      expect(code, file).not.toMatch(/archetypeComposition/);
      expect(code, file).not.toMatch(/provider_dependent|providerDependent/);
      expect(code, file).not.toMatch(/postcode|geograph|latitude|longitude/i);
      expect(code, file).not.toMatch(/\bscore\b|\bweight\b/i);
      expect(code, file).not.toMatch(/\bprompt\b|\bopenai\b|\bllm\b/i);
      expect(code, file).not.toMatch(/\bfetch\(|node:fs|process\.env|supabase/);
    }
  });
});
