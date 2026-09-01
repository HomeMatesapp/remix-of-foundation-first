/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  careerPackSchema,
  careerPackUnresolvedCheckDefinitionSchema,
  parseCanonicalCareerPack,
  validateCareerPack,
} from "..";
import { basePack } from "./fixtures";

type Mutable = any;

function pack(mutate: (p: Mutable) => void): Mutable {
  const draft: Mutable = basePack();
  mutate(draft);
  return draft;
}

function codes(input: unknown): readonly string[] {
  return validateCareerPack(input).issues.map((issue) => issue.code);
}

const PACKAGE_DIR = join(import.meta.dirname, "..");

function packageSourceFiles(): readonly { readonly name: string; readonly text: string }[] {
  return readdirSync(PACKAGE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => ({
      name: entry.name,
      text: readFileSync(join(PACKAGE_DIR, entry.name), "utf8"),
    }));
}

function importSpecifiers(text: string): readonly string[] {
  const specs: string[] = [];
  const pattern = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) specs.push(match[1]!);
  const dynamic = /import\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = dynamic.exec(text)) !== null) specs.push(match[1]!);
  return specs;
}

/* R1 ---------------------------------------------------------------------- */

describe("R1. unresolved-check explanationKey is a stable internal machine key", () => {
  const base = {
    checkKey: "check_a",
    relatedRequirementKeys: [],
    relatedRouteKeys: [],
  };

  it("accepts a valid stable key, null or omission", () => {
    expect(
      careerPackUnresolvedCheckDefinitionSchema.safeParse({
        ...base,
        explanationKey: "internal_explanation_a",
      }).success,
    ).toBe(true);
    expect(
      careerPackUnresolvedCheckDefinitionSchema.safeParse({ ...base, explanationKey: null })
        .success,
    ).toBe(true);
    expect(careerPackUnresolvedCheckDefinitionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects prose, spaces, punctuation and other non-stable-key text", () => {
    for (const value of [
      "You will need to confirm this with the regulator.",
      "internal explanation a",
      "Internal-Explanation!",
      "_leading_underscore",
      "",
      "   ",
      "explanation key?",
    ]) {
      expect(
        careerPackUnresolvedCheckDefinitionSchema.safeParse({ ...base, explanationKey: value })
          .success,
      ).toBe(false);
    }
  });

  it("introduces no participant-facing explanation text field", () => {
    for (const field of [
      "explanation",
      "explanationText",
      "explanationCopy",
      "description",
      "label",
      "guidance",
      "message",
    ]) {
      expect(
        careerPackUnresolvedCheckDefinitionSchema.safeParse({ ...base, [field]: "some copy" })
          .success,
      ).toBe(false);
    }
  });

  it("still accepts the whole synthetic pack unchanged", () => {
    expect(validateCareerPack(basePack())).toEqual({ valid: true, issues: [] });
  });
});

/* R2 ---------------------------------------------------------------------- */

describe("R2. route requirement-purpose coherence fails closed", () => {
  it("accepts an eligibility-only requirement in the eligibility list", () => {
    expect(validateCareerPack(basePack()).valid).toBe(true);
  });

  it("accepts a practical-fit-only requirement in the practical-fit list", () => {
    const p = pack((draft) => {
      draft.requirements[1].purposes = ["practical_fit"];
      draft.routes[0].practicalFitRequirementKeys = ["req_b"];
    });
    expect(validateCareerPack(p).valid).toBe(true);
  });

  it("allows a dual-purpose requirement in either or both lists", () => {
    const both = pack((draft) => {
      draft.requirements[0].purposes = ["eligibility", "practical_fit"];
      draft.routes[0].eligibilityRequirementKeys = ["req_a"];
      draft.routes[0].practicalFitRequirementKeys = ["req_a", "req_b"];
    });
    expect(validateCareerPack(both).valid).toBe(true);

    const practicalOnlyList = pack((draft) => {
      draft.requirements[0].purposes = ["eligibility", "practical_fit"];
      draft.routes[0].eligibilityRequirementKeys = [];
      draft.routes[0].practicalFitRequirementKeys = ["req_a"];
    });
    expect(validateCareerPack(practicalOnlyList).valid).toBe(true);
  });

  it("rejects a practical-fit-only requirement listed as eligibility", () => {
    const p = pack((draft) => {
      draft.routes[0].eligibilityRequirementKeys = ["req_b"];
    });
    const result = validateCareerPack(p);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("reference_purpose_mismatch");
    expect(result.issues.map((i) => i.code)).not.toContain("missing_reference");
  });

  it("rejects an eligibility-only requirement listed as practical fit", () => {
    const p = pack((draft) => {
      draft.routes[0].practicalFitRequirementKeys = ["req_a"];
    });
    const result = validateCareerPack(p);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("reference_purpose_mismatch");
  });

  it("still reports a dangling requirement reference as missing_reference", () => {
    expect(codes(pack((p) => (p.routes[0].eligibilityRequirementKeys = ["nope"])))).toContain(
      "missing_reference",
    );
  });

  it("infers no assessment state, eligibility or practical-fit result", () => {
    const canonical = parseCanonicalCareerPack(basePack());
    expect(canonical.routes[0]).not.toHaveProperty("eligibility");
    expect(canonical.routes[0]).not.toHaveProperty("practicalFit");
    expect(canonical.requirements[0]).not.toHaveProperty("state");
  });
});

/* R3 ---------------------------------------------------------------------- */

describe("R3. route availability-rule ownership coherence", () => {
  it("accepts correct rule ownership", () => {
    expect(validateCareerPack(basePack()).valid).toBe(true);
  });

  it("allows a route with no availability rules", () => {
    const p = pack((draft) => {
      draft.routes[0].availabilityRuleKeys = [];
    });
    expect(validateCareerPack(p).valid).toBe(true);
  });

  it("rejects route A citing route B's availability rule", () => {
    const p = pack((draft) => {
      draft.routes.push({
        routeKey: "route_b",
        eligibilityRequirementKeys: [],
        practicalFitRequirementKeys: [],
        availabilityRuleKeys: ["rule_avail_a"],
        localRequirementKeys: [],
      });
    });
    const result = validateCareerPack(p);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain("reference_owner_mismatch");
    expect(result.issues.some((i) => i.at === "route:route_b")).toBe(true);
  });

  it("keeps availability-rule target existence checks intact", () => {
    expect(codes(pack((p) => (p.routes[0].availabilityRuleKeys = ["nope"])))).toContain(
      "missing_reference",
    );
    expect(codes(pack((p) => (p.routeAvailabilityRules[0].routeKey = "nope")))).toContain(
      "missing_reference",
    );
  });
});

/* R4 ---------------------------------------------------------------------- */

describe("R4. ruleKey uniqueness across the complete pack rule namespace", () => {
  it("accepts unique rule keys across all five rule collections", () => {
    expect(validateCareerPack(basePack()).valid).toBe(true);
  });

  it("rejects a duplicate within the same rule collection", () => {
    expect(codes(pack((p) => p.actionRules.push({ ...p.actionRules[0] })))).toContain(
      "duplicate_key",
    );
  });

  const crossCollision: readonly [string, (p: Mutable) => void][] = [
    [
      "requirementRule vs routeAvailabilityRule",
      (p) => (p.routeAvailabilityRules[0].ruleKey = p.requirementRules[0].ruleKey),
    ],
    [
      "requirementRule vs barrierRule",
      (p) => (p.barrierRules[0].ruleKey = p.requirementRules[0].ruleKey),
    ],
    [
      "barrierRule vs unresolvedCheckRule",
      (p) => (p.unresolvedCheckRules[0].ruleKey = p.barrierRules[0].ruleKey),
    ],
    [
      "unresolvedCheckRule vs actionRule",
      (p) => (p.actionRules[0].ruleKey = p.unresolvedCheckRules[0].ruleKey),
    ],
  ];

  for (const [label, mutate] of crossCollision) {
    it(`rejects the same ruleKey reused across collections (${label})`, () => {
      const p = pack(mutate);
      const result = validateCareerPack(p);
      expect(result.valid).toBe(false);
      expect(result.issues.map((i) => i.code)).toContain("duplicate_key");
      expect(result.issues.some((i) => i.at?.startsWith("rule:"))).toBe(true);
    });
  }

  it("fails closed at the canonical parse boundary for a cross-collection collision", () => {
    expect(() =>
      parseCanonicalCareerPack(
        pack((p) => (p.barrierRules[0].ruleKey = p.requirementRules[0].ruleKey)),
      ),
    ).toThrow();
  });
});

/* R5 ---------------------------------------------------------------------- */

describe("R5A. package source imports stay framework-independent", () => {
  const allowedRelative = new Set(["../contracts", "../archetypes", "../questions"]);

  it("imports only zod, sibling domain packages and internal pack files", () => {
    const offenders: string[] = [];
    for (const file of packageSourceFiles()) {
      for (const spec of importSpecifiers(file.text)) {
        const ok = spec === "zod" || spec.startsWith("./") || allowedRelative.has(spec);
        if (!ok) offenders.push(`${file.name} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("imports nothing from React, Supabase, UI, routes or integrations", () => {
    const forbidden = [
      "react",
      "react-dom",
      "@tanstack",
      "supabase",
      "@/integrations",
      "@/components",
      "@/routes",
      "@/hooks",
      "@/lib",
    ];
    const offenders: string[] = [];
    for (const file of packageSourceFiles()) {
      for (const spec of importSpecifiers(file.text)) {
        if (forbidden.some((f) => spec === f || spec.startsWith(`${f}/`))) {
          offenders.push(`${file.name} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("touches no browser or DOM globals in package source", () => {
    const offenders: string[] = [];
    for (const file of packageSourceFiles()) {
      for (const global of [
        "window.",
        "localStorage",
        "sessionStorage",
        "navigator.",
        "fetch(",
        "document.getElementById",
        "document.querySelector",
        "document.createElement",
      ]) {
        if (file.text.includes(global)) offenders.push(`${file.name} -> ${global}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("R5B. no future-scope implementation exists in this package", () => {
  it("exports only schema, validation, canonical parsing and catalogue values", async () => {
    const pkg = (await import("..")) as Record<string, unknown>;
    const forbidden = Object.keys(pkg).filter(
      (name) =>
        !name.endsWith("Schema") &&
        /evaluate|assess|decide|judge|score|weight|publish|withdraw|approve|workflow|registry|postcode|postgis|provider|vacancy|render|component/i.test(
          name,
        ),
    );
    expect(forbidden).toEqual([]);
    const callables = Object.entries(pkg)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(callables).toEqual([
      "CareerPackValidationError",
      "collectPackConditionRefs",
      "collectPackConditions",
      "packAnswerValueCompatibleWithInput",
      "parseCanonicalCareerPack",
      "safeParseCanonicalCareerPack",
      "validateCareerPack",
    ]);
  });

  it("produces no ranking execution: ranking output is authored order only", () => {
    const canonical = parseCanonicalCareerPack(basePack());
    const config = canonical.rankingConfigs[0]!;
    expect(config.factors.map((f) => f.factorKey)).toEqual(["factor_first", "factor_second"]);
    for (const factor of config.factors) {
      for (const field of ["weight", "score", "points", "rank", "position", "direction"]) {
        expect(factor).not.toHaveProperty(field);
      }
    }
  });

  it("accepts no publication lifecycle, approval, hash or engine field", () => {
    for (const field of [
      "publicationState",
      "publishedAt",
      "withdrawnAt",
      "approvedAt",
      "approverUserId",
      "contentHash",
      "engineVersion",
    ]) {
      expect(careerPackSchema.safeParse(pack((p) => (p[field] = "x"))).success).toBe(false);
    }
  });

  it("carries evidence references only, not registry state", () => {
    const canonical = parseCanonicalCareerPack(basePack());
    expect(Object.keys(canonical.evidence[0]!.reference).sort()).toEqual([
      "sourceId",
      "sourceRecordKey",
    ]);
    for (const field of [
      "sourceUrl",
      "withdrawn",
      "withdrawnAt",
      "supersededBy",
      "freshness",
      "reviewState",
    ]) {
      // the shared evidence reference boundary is strict: registry state on a
      // reference now fails closed instead of being silently stripped
      expect(
        careerPackSchema.safeParse(pack((p) => (p.evidence[0].reference[field] = "x"))).success,
      ).toBe(false);
      expect(careerPackSchema.safeParse(pack((p) => (p.evidence[0][field] = "x"))).success).toBe(
        false,
      );
    }
  });

  it("accepts no Local Reality implementation field", () => {
    for (const field of [
      "postcode",
      "latitude",
      "longitude",
      "radiusMiles",
      "providers",
      "vacancies",
      "snapshotId",
    ]) {
      expect(
        careerPackSchema.safeParse(pack((p) => (p.localRequirements[0][field] = 1))).success,
      ).toBe(false);
    }
  });

  it("ships no real career-specific pack instance in package source", () => {
    const offenders: string[] = [];
    for (const file of packageSourceFiles()) {
      for (const term of [
        "registered_nurse",
        "registeredNurse",
        "electrician",
        "solicitor",
        "photographer",
      ]) {
        if (file.text.includes(term)) offenders.push(`${file.name} -> ${term}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* R6 ---------------------------------------------------------------------- */

describe("R6. pack-level text and date structural compatibility", () => {
  const textCondition = (value: unknown) => ({
    question: { moduleCode: "study_availability", questionKey: "q_note" },
    operator: "equals",
    value,
  });
  const dateCondition = (value: unknown) => ({
    question: { moduleCode: "study_availability", questionKey: "q_start" },
    operator: "equals",
    value,
  });

  it("accepts a valid text condition value", () => {
    expect(
      validateCareerPack(pack((p) => (p.requirementRules[0].when = textCondition("abcd")))).valid,
    ).toBe(true);
  });

  it("rejects blank and length-violating text condition values", () => {
    for (const value of ["", "   ", "ab", "abcdefghijk"]) {
      expect(codes(pack((p) => (p.requirementRules[0].when = textCondition(value))))).toContain(
        "condition_value_incompatible",
      );
    }
  });

  it("accepts a valid calendar date condition value", () => {
    expect(
      validateCareerPack(pack((p) => (p.requirementRules[0].when = dateCondition("2026-02-28"))))
        .valid,
    ).toBe(true);
  });

  it("rejects malformed and impossible date condition values", () => {
    for (const value of [
      "2026-02-30",
      "2026-13-01",
      "2026-2-1",
      "28/02/2026",
      "2026-02-28T00:00Z",
    ]) {
      expect(codes(pack((p) => (p.requirementRules[0].when = dateCondition(value))))).toContain(
        "condition_value_incompatible",
      );
    }
  });

  it("applies the same structural validation to scenario text fixtures", () => {
    const valid = pack((p) =>
      p.scenarios[0].answers.push({
        question: { moduleCode: "study_availability", questionKey: "q_note" },
        value: "abcd",
      }),
    );
    expect(validateCareerPack(valid).valid).toBe(true);

    for (const value of ["", "ab", "abcdefghijk", 5]) {
      const invalid = pack((p) =>
        p.scenarios[0].answers.push({
          question: { moduleCode: "study_availability", questionKey: "q_note" },
          value,
        }),
      );
      expect(codes(invalid).join(",")).toMatch(/scenario_value_incompatible|invalid_pack_document/);
    }
  });

  it("applies the same structural validation to scenario date fixtures", () => {
    const valid = pack((p) =>
      p.scenarios[0].answers.push({
        question: { moduleCode: "study_availability", questionKey: "q_start" },
        value: "2024-02-29",
      }),
    );
    expect(validateCareerPack(valid).valid).toBe(true);

    for (const value of ["2026-02-30", "2023-02-29", "not-a-date"]) {
      const invalid = pack((p) =>
        p.scenarios[0].answers.push({
          question: { moduleCode: "study_availability", questionKey: "q_start" },
          value,
        }),
      );
      expect(codes(invalid)).toContain("scenario_value_incompatible");
    }
  });
});
