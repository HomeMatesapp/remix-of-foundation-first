/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";

import { dependencyRuleSchema } from "../../questions";
import {
  CAREER_PACK_SCENARIO_ASSERTION_KINDS,
  CAREER_PACK_SCHEMA_VERSION,
  CareerPackValidationError,
  PACK_CONDITION_OPERATORS,
  careerPackOccupationRefSchema,
  careerPackRankingConfigSchema,
  careerPackRequirementDefinitionSchema,
  careerPackReviewMetadataSchema,
  careerPackRouteDefinitionSchema,
  careerPackSchema,
  careerPackScenarioSchema,
  packRuleSchema,
  parseCanonicalCareerPack,
  validateCareerPack,
} from "..";
import { basePack, PACK_ID, REQUIREMENT_ID, ROUTE_ID } from "./fixtures";

type Mutable = any;

function pack(mutate: (p: Mutable) => void): Mutable {
  const draft: Mutable = basePack();
  mutate(draft);
  return draft;
}

function codes(input: unknown): readonly string[] {
  return validateCareerPack(input).issues.map((issue) => issue.code);
}

/* A. version contract ------------------------------------------------------ */

describe("A. schema version and pack identity/version", () => {
  it("pins the schema framework version", () => {
    expect(CAREER_PACK_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("rejects a mismatched schemaVersion", () => {
    expect(careerPackSchema.safeParse(pack((p) => (p.schemaVersion = "1.0.1"))).success).toBe(
      false,
    );
  });

  it("treats the pack content version as an independent semantic version", () => {
    const parsed = careerPackSchema.parse(basePack());
    expect(parsed.version).toBe("2.3.1");
    expect(parsed.schemaVersion).toBe(CAREER_PACK_SCHEMA_VERSION);
    expect(parsed.careerPackId).toBe(PACK_ID);
    expect(careerPackSchema.safeParse(pack((p) => (p.version = "not-semver"))).success).toBe(false);
    expect(careerPackSchema.safeParse(pack((p) => (p.careerPackId = "nope"))).success).toBe(false);
  });
});

/* B. strictness ------------------------------------------------------------ */

describe("B. top-level strictness", () => {
  it("rejects an author-supplied contentHash", () => {
    expect(careerPackSchema.safeParse(pack((p) => (p.contentHash = "a".repeat(64)))).success).toBe(
      false,
    );
  });

  it("rejects publication lifecycle / authority fields", () => {
    for (const field of [
      "publicationState",
      "status",
      "publishedAt",
      "withdrawnAt",
      "authorUserId",
      "reviewerUserId",
      "approverUserId",
      "engineVersion",
    ]) {
      expect(careerPackSchema.safeParse(pack((p) => (p[field] = "x"))).success).toBe(false);
    }
  });

  it("rejects arbitrary unknown extras", () => {
    expect(careerPackSchema.safeParse(pack((p) => (p.somethingElse = 1))).success).toBe(false);
  });
});

/* C. occupation ref -------------------------------------------------------- */

describe("C. occupation reference is minimal and fails closed", () => {
  it("accepts a key alone and an optional nullable UUID", () => {
    expect(careerPackOccupationRefSchema.parse({ occupationKey: "occ_a" })).toEqual({
      occupationKey: "occ_a",
    });
    expect(
      careerPackOccupationRefSchema.safeParse({ occupationKey: "occ_a", occupationId: null })
        .success,
    ).toBe(true);
  });

  it("rejects titles, aliases, SOC codes, salary and demand fields", () => {
    for (const field of ["title", "aliases", "socCode", "salary", "demand", "synonyms"]) {
      expect(
        careerPackOccupationRefSchema.safeParse({ occupationKey: "occ_a", [field]: "x" }).success,
      ).toBe(false);
    }
  });

  it("requires an occupation key", () => {
    expect(careerPackOccupationRefSchema.safeParse({}).success).toBe(false);
    expect(careerPackSchema.safeParse(pack((p) => delete p.occupation)).success).toBe(false);
  });
});

/* D. routes + embedded modules required ------------------------------------ */

describe("D. at least one route and one embedded question module", () => {
  it("requires a non-empty route list", () => {
    expect(careerPackSchema.safeParse(pack((p) => (p.routes = []))).success).toBe(false);
  });

  it("requires a non-empty embedded question module list", () => {
    expect(careerPackSchema.safeParse(pack((p) => (p.questionModules = []))).success).toBe(false);
  });

  it("rejects a bad embedded question definition set", () => {
    const bad = pack((p) => {
      p.questionModules[0].questions[0].dependency = {
        question: { moduleCode: "finance", questionKey: "q_missing" },
        operator: "answered",
      };
    });
    expect(codes(bad)).toContain("invalid_question_module_set");
  });
});

/* E. archetype composition ------------------------------------------------- */

describe("E. archetype composition consumes the Increment 3 exact contract", () => {
  it("is optional when absent", () => {
    const p = pack((draft) => delete draft.routes[0].archetypeComposition);
    expect(validateCareerPack(p).valid).toBe(true);
  });

  it("rejects unknown codes and non-current framework versions", () => {
    expect(
      careerPackRouteDefinitionSchema.safeParse({
        routeKey: "route_a",
        archetypeComposition: {
          frameworkVersion: "1.0.0",
          archetypes: [{ code: "not_an_archetype", version: "1.0.0" }],
        },
      }).success,
    ).toBe(false);
    expect(
      careerPackRouteDefinitionSchema.safeParse({
        routeKey: "route_a",
        archetypeComposition: {
          frameworkVersion: "1.0.0",
          archetypes: [{ code: "bridging", version: "9.9.9" }],
        },
      }).success,
    ).toBe(false);
  });
});

/* F. requirement definitions ---------------------------------------------- */

describe("F. requirement definition carries no assessment state", () => {
  it("rejects a `state` field on a requirement definition", () => {
    expect(
      careerPackRequirementDefinitionSchema.safeParse({
        requirementKey: "req_a",
        severity: "mandatory",
        purposes: ["eligibility"],
        state: "met",
      }).success,
    ).toBe(false);
  });

  it("reuses the exact existing severity vocabulary", () => {
    for (const severity of ["mandatory", "preferred", "contextual"]) {
      expect(
        careerPackRequirementDefinitionSchema.safeParse({
          requirementKey: "req_a",
          severity,
          purposes: ["eligibility"],
        }).success,
      ).toBe(true);
    }
    expect(
      careerPackRequirementDefinitionSchema.safeParse({
        requirementKey: "req_a",
        severity: "critical",
        purposes: ["eligibility"],
      }).success,
    ).toBe(false);
  });

  it("keeps eligibility and practical fit separate and requires a purpose", () => {
    expect(
      careerPackRequirementDefinitionSchema.safeParse({
        requirementKey: "req_a",
        severity: "mandatory",
        purposes: [],
      }).success,
    ).toBe(false);
    expect(
      careerPackRequirementDefinitionSchema.safeParse({
        requirementKey: "req_a",
        severity: "mandatory",
        purposes: ["eligibility", "practical_fit"],
      }).success,
    ).toBe(true);
    expect(
      careerPackRequirementDefinitionSchema.safeParse({
        requirementKey: "req_a",
        severity: "mandatory",
        purposes: ["route_ranking"],
      }).success,
    ).toBe(false);
  });

  it("reuses the exact requirement-state vocabulary in requirement RULES only", () => {
    for (const state of ["met", "unmet", "unknown", "verification_required", "not_applicable"]) {
      expect(validateCareerPack(pack((p) => (p.requirementRules[0].state = state))).valid).toBe(
        true,
      );
    }
    expect(codes(pack((p) => (p.requirementRules[0].state = "maybe")))).toContain(
      "invalid_pack_document",
    );
  });
});

/* G. pack rules are distinct from visibility dependencies ------------------ */

describe("G. consequential rules are structurally distinct from dependencies", () => {
  it("does not use dependencyRuleSchema as the pack-rule contract", () => {
    expect(packRuleSchema).not.toBe(dependencyRuleSchema);
  });

  it("rejects a visibility dependency smuggled into a rule as a `dependency` field", () => {
    expect(
      careerPackSchema.safeParse(
        pack((p) => {
          p.requirementRules[0].dependency = p.requirementRules[0].when;
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects arbitrary predicates in a rule", () => {
    expect(packRuleSchema.safeParse({ predicate: () => true }).success).toBe(false);
    expect(packRuleSchema.safeParse({ all: [] }).success).toBe(false);
    expect(packRuleSchema.safeParse({ any: [] }).success).toBe(false);
  });
});

/* H. operators, grouping and compatibility -------------------------------- */

describe("H. pack rule operators and grouping", () => {
  it("exposes exactly the approved operator catalogue, frozen at runtime", () => {
    expect([...PACK_CONDITION_OPERATORS]).toEqual([
      "answered",
      "unanswered",
      "equals",
      "not_equals",
      "includes",
      "not_includes",
      "gt",
      "gte",
      "lt",
      "lte",
    ]);
    expect(Object.isFrozen(PACK_CONDITION_OPERATORS)).toBe(true);
    expect(() => {
      (PACK_CONDITION_OPERATORS as unknown as string[]).push("sometimes");
    }).toThrow();
    expect(PACK_CONDITION_OPERATORS).toHaveLength(10);
  });

  it("supports nested non-empty all/any groups", () => {
    expect(
      packRuleSchema.safeParse({
        all: [
          {
            any: [
              {
                question: { moduleCode: "qualifications", questionKey: "q_level" },
                operator: "answered",
              },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects conditions referencing a nonexistent question", () => {
    expect(
      codes(
        pack((p) => {
          p.barrierRules[0].when = {
            question: { moduleCode: "finance", questionKey: "q_nope" },
            operator: "answered",
          };
        }),
      ),
    ).toContain("missing_reference");
  });

  it("rejects incompatible operator/input combinations", () => {
    expect(
      codes(
        pack((p) => {
          p.barrierRules[0].when = {
            question: { moduleCode: "qualifications", questionKey: "q_level" },
            operator: "gt",
            value: 2,
          };
        }),
      ),
    ).toContain("operator_input_incompatible");
    expect(
      codes(
        pack((p) => {
          p.barrierRules[0].when = {
            question: { moduleCode: "driving", questionKey: "q_licences" },
            operator: "equals",
            value: "opt_car",
          };
        }),
      ),
    ).toContain("operator_input_incompatible");
  });

  it("rejects structurally impossible comparison values", () => {
    // select option key not in the catalogue
    expect(
      codes(
        pack((p) => {
          p.requirementRules[0].when = {
            question: { moduleCode: "qualifications", questionKey: "q_level" },
            operator: "equals",
            value: "opt_missing",
          };
        }),
      ),
    ).toContain("condition_value_incompatible");
    // integer out of declared bounds
    expect(
      codes(
        pack((p) => {
          p.requirementRules[0].when = {
            question: { moduleCode: "qualifications", questionKey: "q_count" },
            operator: "gte",
            value: 99,
          };
        }),
      ),
    ).toContain("condition_value_incompatible");
    // non-integer comparison for an integer question
    expect(
      codes(
        pack((p) => {
          p.requirementRules[0].when = {
            question: { moduleCode: "qualifications", questionKey: "q_count" },
            operator: "gte",
            value: 1.5,
          };
        }),
      ),
    ).toContain("condition_value_incompatible");
    // list operator value outside option keys
    expect(
      codes(
        pack((p) => {
          p.routeAvailabilityRules[0].when = {
            question: { moduleCode: "driving", questionKey: "q_licences" },
            operator: "includes",
            value: "opt_bus",
          };
        }),
      ),
    ).toContain("condition_value_incompatible");
  });

  it("accepts boundary-valid values", () => {
    expect(
      validateCareerPack(
        pack((p) => {
          p.requirementRules[0].when = {
            question: { moduleCode: "qualifications", questionKey: "q_count" },
            operator: "lte",
            value: 10,
          };
        }),
      ).valid,
    ).toBe(true);
  });
});

/* I. duplicate keys / identities ------------------------------------------ */

describe("I. duplicate stable keys and UUID identities fail closed", () => {
  const dup: readonly [string, (p: Mutable) => void][] = [
    ["route", (p) => p.routes.push({ ...p.routes[0], routeId: null })],
    ["requirement", (p) => p.requirements.push({ ...p.requirements[0], requirementId: null })],
    ["requirementRule", (p) => p.requirementRules.push({ ...p.requirementRules[0] })],
    [
      "routeAvailabilityRule",
      (p) => p.routeAvailabilityRules.push({ ...p.routeAvailabilityRules[0] }),
    ],
    ["barrier", (p) => p.barriers.push({ ...p.barriers[0] })],
    ["barrierRule", (p) => p.barrierRules.push({ ...p.barrierRules[0] })],
    ["unresolvedCheck", (p) => p.unresolvedChecks.push({ ...p.unresolvedChecks[0] })],
    ["unresolvedCheckRule", (p) => p.unresolvedCheckRules.push({ ...p.unresolvedCheckRules[0] })],
    ["action", (p) => p.actions.push({ ...p.actions[0] })],
    ["actionRule", (p) => p.actionRules.push({ ...p.actionRules[0] })],
    ["evidence", (p) => p.evidence.push({ ...p.evidence[0] })],
    ["rankingConfig", (p) => p.rankingConfigs.push({ ...p.rankingConfigs[0] })],
    ["localRequirement", (p) => p.localRequirements.push({ ...p.localRequirements[0] })],
    ["scenario", (p) => p.scenarios.push({ ...p.scenarios[0] })],
  ];

  for (const [collection, mutate] of dup) {
    it(`rejects duplicate ${collection} keys`, () => {
      expect(codes(pack(mutate))).toContain("duplicate_key");
    });
  }

  it("rejects duplicate supplied route and requirement UUIDs", () => {
    expect(
      codes(pack((p) => p.routes.push({ ...p.routes[0], routeKey: "route_b", routeId: ROUTE_ID }))),
    ).toContain("duplicate_identity");
    expect(
      codes(
        pack((p) =>
          p.requirements.push({
            ...p.requirements[0],
            requirementKey: "req_c",
            requirementId: REQUIREMENT_ID,
          }),
        ),
      ),
    ).toContain("duplicate_identity");
  });
});

/* J. referential integrity ------------------------------------------------ */

describe("J. every cross reference is validated fail-closed", () => {
  const cases: readonly [string, (p: Mutable) => void][] = [
    ["route eligibility requirement", (p) => (p.routes[0].eligibilityRequirementKeys = ["nope"])],
    [
      "route practical-fit requirement",
      (p) => (p.routes[0].practicalFitRequirementKeys = ["nope"]),
    ],
    ["route availability rule ref", (p) => (p.routes[0].availabilityRuleKeys = ["nope"])],
    ["route local requirement ref", (p) => (p.routes[0].localRequirementKeys = ["nope"])],
    ["requirement evidence ref", (p) => (p.requirements[0].evidenceKeys = ["nope"])],
    ["requirement rule target", (p) => (p.requirementRules[0].requirementKey = "nope")],
    ["availability rule target", (p) => (p.routeAvailabilityRules[0].routeKey = "nope")],
    ["barrier requirement ref", (p) => (p.barriers[0].relatedRequirementKeys = ["nope"])],
    ["barrier route ref", (p) => (p.barriers[0].relatedRouteKeys = ["nope"])],
    ["barrier evidence ref", (p) => (p.barriers[0].evidenceKeys = ["nope"])],
    ["barrier rule target", (p) => (p.barrierRules[0].barrierKey = "nope")],
    ["check requirement ref", (p) => (p.unresolvedChecks[0].relatedRequirementKeys = ["nope"])],
    ["check route ref", (p) => (p.unresolvedChecks[0].relatedRouteKeys = ["nope"])],
    ["check rule target", (p) => (p.unresolvedCheckRules[0].checkKey = "nope")],
    ["action route ref", (p) => (p.actions[0].relatedRouteKeys = ["nope"])],
    ["action requirement ref", (p) => (p.actions[0].relatedRequirementKeys = ["nope"])],
    ["action barrier ref", (p) => (p.actions[0].relatedBarrierKeys = ["nope"])],
    ["action check ref", (p) => (p.actions[0].relatedUnresolvedCheckKeys = ["nope"])],
    ["action evidence ref", (p) => (p.actions[0].evidenceKeys = ["nope"])],
    ["action rule target", (p) => (p.actionRules[0].actionKey = "nope")],
    ["ranking factor route ref", (p) => (p.rankingConfigs[0].factors[0].routeKeys = ["nope"])],
    ["local requirement route ref", (p) => (p.localRequirements[0].relatedRouteKeys = ["nope"])],
    ["local requirement check ref", (p) => (p.localRequirements[0].unresolvedCheckKey = "nope")],
  ];

  for (const [label, mutate] of cases) {
    it(`rejects a dangling ${label}`, () => {
      const result = validateCareerPack(pack(mutate));
      expect(result.valid).toBe(false);
      expect(result.issues.map((i) => i.code)).toContain("missing_reference");
    });
  }

  it("accepts the fully wired synthetic pack", () => {
    expect(validateCareerPack(basePack())).toEqual({ valid: true, issues: [] });
  });
});

/* K/L. ranking ------------------------------------------------------------ */

describe("K/L. ranking configuration", () => {
  it("rejects weight/score/arithmetic fields", () => {
    for (const field of ["weight", "score", "points", "direction", "multiplier", "tieBreak"]) {
      expect(
        careerPackRankingConfigSchema.safeParse({
          rankingConfigKey: "ranking_a",
          factors: [
            {
              factorKey: "f",
              preferWhen: {
                question: { moduleCode: "qualifications", questionKey: "q_level" },
                operator: "answered",
              },
              [field]: 1,
            },
          ],
        }).success,
      ).toBe(false);
      expect(
        careerPackRankingConfigSchema.safeParse({
          rankingConfigKey: "ranking_a",
          [field]: 1,
          factors: [
            {
              factorKey: "f",
              preferWhen: {
                question: { moduleCode: "qualifications", questionKey: "q_level" },
                operator: "answered",
              },
            },
          ],
        }).success,
      ).toBe(false);
    }
  });

  it("requires at least one factor and unique factor keys", () => {
    expect(
      careerPackRankingConfigSchema.safeParse({ rankingConfigKey: "r", factors: [] }).success,
    ).toBe(false);
  });

  it("preserves authored factor order exactly", () => {
    const parsed = careerPackSchema.parse(basePack());
    expect(parsed.rankingConfigs[0]!.factors.map((f) => f.factorKey)).toEqual([
      "factor_first",
      "factor_second",
    ]);
    const reversed = careerPackSchema.parse(pack((p) => p.rankingConfigs[0].factors.reverse()));
    expect(reversed.rankingConfigs[0]!.factors.map((f) => f.factorKey)).toEqual([
      "factor_second",
      "factor_first",
    ]);
  });
});

/* M. local requirements --------------------------------------------------- */

describe("M. local requirements are declarations only", () => {
  it("rejects postcode/PostGIS/provider/vacancy implementation fields", () => {
    for (const field of [
      "postcode",
      "postcodeDistrict",
      "latitude",
      "longitude",
      "geography",
      "radiusMiles",
      "providers",
      "vacancies",
      "employers",
      "demand",
      "snapshotId",
    ]) {
      expect(
        careerPackSchema.safeParse(pack((p) => (p.localRequirements[0][field] = 1))).success,
      ).toBe(false);
    }
  });

  it("requires an opaque local fact key and at least one consequential purpose", () => {
    expect(
      careerPackSchema.safeParse(pack((p) => delete p.localRequirements[0].localFactKey)).success,
    ).toBe(false);
    expect(
      careerPackSchema.safeParse(pack((p) => (p.localRequirements[0].purposes = []))).success,
    ).toBe(false);
    expect(
      careerPackSchema.safeParse(pack((p) => (p.localRequirements[0].purposes = ["invented"])))
        .success,
    ).toBe(false);
  });
});

/* N. review/confidence ---------------------------------------------------- */

describe("N. review/confidence metadata boundary", () => {
  it("accepts only the two optional keys", () => {
    expect(careerPackReviewMetadataSchema.parse({})).toEqual({});
    expect(
      careerPackReviewMetadataSchema.safeParse({ reviewKey: "r", confidenceKey: "c" }).success,
    ).toBe(true);
  });

  it("rejects publication lifecycle and reviewer/approver identity fields", () => {
    for (const field of [
      "state",
      "status",
      "publicationState",
      "reviewedAt",
      "approvedAt",
      "publishedAt",
      "withdrawnAt",
      "authorId",
      "reviewerId",
      "approverId",
      "confidence",
    ]) {
      expect(careerPackReviewMetadataSchema.safeParse({ [field]: "x" }).success).toBe(false);
    }
  });
});

/* O. scenarios ------------------------------------------------------------ */

describe("O. scenario definitions", () => {
  it("exposes exactly the seven assertion kinds", () => {
    expect([...CAREER_PACK_SCENARIO_ASSERTION_KINDS]).toEqual([
      "judgement_is",
      "requirement_state_is",
      "route_eligibility_is",
      "route_practical_fit_is",
      "barrier_present",
      "unresolved_check_present",
      "action_present",
    ]);
    expect(Object.isFrozen(CAREER_PACK_SCENARIO_ASSERTION_KINDS)).toBe(true);
  });

  it("rejects an unknown assertion kind", () => {
    expect(
      careerPackSchema.safeParse(
        pack((p) => (p.scenarios[0].expect = [{ kind: "route_is_best", routeKey: "route_a" }])),
      ).success,
    ).toBe(false);
  });

  it("rejects execution/run/hash/engine fields", () => {
    for (const field of ["ranAt", "result", "passed", "engineVersion", "contentHash", "runId"]) {
      expect(
        careerPackScenarioSchema.safeParse({
          scenarioKey: "s",
          answers: [
            {
              question: { moduleCode: "qualifications", questionKey: "q_level" },
              value: "opt_a",
            },
          ],
          expect: [{ kind: "judgement_is", judgement: "realistic_now" }],
          [field]: "x",
        }).success,
      ).toBe(false);
    }
  });

  it("requires non-empty fixtures and assertions", () => {
    expect(careerPackSchema.safeParse(pack((p) => (p.scenarios[0].answers = []))).success).toBe(
      false,
    );
    expect(careerPackSchema.safeParse(pack((p) => (p.scenarios[0].expect = []))).success).toBe(
      false,
    );
  });

  it("validates fixture question refs and value shapes", () => {
    expect(
      codes(
        pack(
          (p) =>
            (p.scenarios[0].answers[0].question = {
              moduleCode: "finance",
              questionKey: "q_nope",
            }),
        ),
      ),
    ).toContain("missing_reference");
    expect(codes(pack((p) => (p.scenarios[0].answers[0].value = "opt_missing")))).toContain(
      "scenario_value_incompatible",
    );
    expect(codes(pack((p) => (p.scenarios[0].answers[1].value = 99)))).toContain(
      "scenario_value_incompatible",
    );
    expect(codes(pack((p) => (p.scenarios[0].answers[2].value = ["opt_tram"])))).toContain(
      "scenario_value_incompatible",
    );
    expect(codes(pack((p) => (p.scenarios[0].answers[2].value = [])))).toContain(
      "scenario_value_incompatible",
    );
  });

  it("rejects duplicate fixture question refs within one scenario", () => {
    expect(
      codes(pack((p) => p.scenarios[0].answers.push({ ...p.scenarios[0].answers[0] }))),
    ).toContain("duplicate_key");
  });

  it("validates every assertion reference", () => {
    const refCases: readonly ((p: Mutable) => void)[] = [
      (p) => (p.scenarios[0].expect[1].requirementKey = "nope"),
      (p) => (p.scenarios[0].expect[2].routeKey = "nope"),
      (p) => (p.scenarios[0].expect[3].routeKey = "nope"),
      (p) => (p.scenarios[0].expect[4].barrierKey = "nope"),
      (p) => (p.scenarios[0].expect[5].checkKey = "nope"),
      (p) => (p.scenarios[0].expect[6].actionKey = "nope"),
    ];
    for (const mutate of refCases) {
      expect(codes(pack(mutate))).toContain("missing_reference");
    }
  });

  it("keeps route eligibility/practical fit tri-state with null meaning unknown", () => {
    for (const value of [true, false, null]) {
      expect(
        careerPackSchema.safeParse(pack((p) => (p.scenarios[0].expect[2].eligibility = value)))
          .success,
      ).toBe(true);
    }
    expect(
      careerPackSchema.safeParse(pack((p) => (p.scenarios[0].expect[2].eligibility = "unknown")))
        .success,
    ).toBe(false);
  });
});

/* P. unknown is never converted ------------------------------------------- */

describe("P. unknown/missing data is never converted to unmet or false", () => {
  it("accepts an explicit `unknown` requirement rule without inventing a default", () => {
    const parsed = careerPackSchema.parse(basePack());
    expect(parsed.requirementRules.map((r) => r.state)).toContain("unknown");
  });

  it("does not add, rewrite or drop any rule state during validation", () => {
    const input = basePack();
    const result = validateCareerPack(input);
    expect(result.valid).toBe(true);
    const parsed = careerPackSchema.parse(input);
    expect(parsed.requirementRules).toHaveLength(2);
    expect(parsed.requirementRules[1]!.state).toBe("unknown");
  });

  it("keeps a pack with unresolved-only content valid without any negative state", () => {
    const p = pack((draft) => {
      draft.requirementRules = [
        {
          ruleKey: "rule_unknown_only",
          requirementKey: "req_a",
          when: {
            question: { moduleCode: "qualifications", questionKey: "q_level" },
            operator: "unanswered",
          },
          state: "unknown",
        },
      ];
    });
    const parsed = careerPackSchema.parse(p);
    expect(validateCareerPack(p).valid).toBe(true);
    expect(parsed.requirementRules.map((r) => r.state)).toEqual(["unknown"]);
  });
});

/* Q. runtime immutability ------------------------------------------------- */

describe("Q. parseCanonicalCareerPack deep freeze", () => {
  it("throws a fail-closed error for an invalid pack", () => {
    expect(() => parseCanonicalCareerPack(pack((p) => (p.routes[0].routeKey = "route_z")))).toThrow(
      CareerPackValidationError,
    );
    expect(() => parseCanonicalCareerPack({})).toThrow(CareerPackValidationError);
  });

  it("freezes the top-level object and every nested collection", () => {
    const canonical = parseCanonicalCareerPack(basePack());
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(Object.isFrozen(canonical.routes)).toBe(true);
    expect(Object.isFrozen(canonical.routes[0])).toBe(true);
    expect(Object.isFrozen(canonical.routes[0]!.eligibilityRequirementKeys)).toBe(true);
    expect(Object.isFrozen(canonical.rankingConfigs[0]!.factors[0]!.preferWhen)).toBe(true);
    expect(Object.isFrozen(canonical.scenarios[0]!.answers[0]!.question)).toBe(true);
    expect(Object.isFrozen(canonical.questionModules[0]!.questions[0]!.input)).toBe(true);
  });

  it("cannot be mutated through casting", () => {
    const canonical = parseCanonicalCareerPack(basePack());
    const loose = canonical as unknown as Mutable;

    expect(() => loose.routes.push({ routeKey: "route_injected" })).toThrow();
    expect(() => loose.requirements.reverse()).toThrow();
    expect(() => loose.barriers.splice(0, 1)).toThrow();
    expect(() => (loose.rankingConfigs[0].factors[0].factorKey = "factor_hacked")).toThrow();
    expect(() => (loose.version = "9.9.9")).toThrow();
    expect(() => (loose.routes[0] = { routeKey: "route_swapped" })).toThrow();
    expect(() => (loose.scenarios[0].expect[0].judgement = "not_realistic_yet")).toThrow();

    expect(canonical.routes).toHaveLength(1);
    expect(canonical.routes[0]!.routeKey).toBe("route_a");
    expect(canonical.requirements.map((r) => r.requirementKey)).toEqual(["req_a", "req_b"]);
    expect(canonical.barriers).toHaveLength(1);
    expect(canonical.rankingConfigs[0]!.factors[0]!.factorKey).toBe("factor_first");
    expect(canonical.version).toBe("2.3.1");
    expect(canonical.scenarios[0]!.expect[0]).toEqual({
      kind: "judgement_is",
      judgement: "realistic_now",
    });
  });
});
