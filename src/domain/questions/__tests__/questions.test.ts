import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { calendarDateSchema, isCalendarDate } from "../calendar-date";
import {
  QUESTION_CONSEQUENCE_CODES,
  QUESTION_INPUT_KINDS,
  QUESTION_MODULE_CODES,
  QUESTION_MODULE_FRAMEWORK_VERSION,
} from "../codes";
import {
  DEPENDENCY_OPERATORS,
  evaluateDependencyRule,
  formatQuestionAddress,
  questionRefSchema,
  type AnswerMap,
  type DependencyRule,
} from "../dependency";
import {
  decimalInputSchema,
  integerInputSchema,
  multiSelectInputSchema,
  questionInputSchema,
  singleSelectInputSchema,
  textInputSchema,
} from "../input";
import { listQuestionModules, resolveQuestionModule, isKnownQuestionModuleRef } from "../catalogue";
import {
  questionDefinitionSchema,
  questionModuleDefinitionSchema,
  questionModuleRefSchema,
  type QuestionModuleDefinition,
} from "../schema";
import { validateQuestionDefinitionSet } from "../validation";
import { isQuestionAsked } from "../visibility";

const V = "1.0.0" as const;

function q(
  moduleCode: (typeof QUESTION_MODULE_CODES)[number],
  questionKey: string,
  input: unknown,
  extra: Record<string, unknown> = {},
) {
  return questionDefinitionSchema.parse({
    moduleCode,
    questionKey,
    input,
    consequences: ["eligibility"],
    ...extra,
  });
}

function mod(
  moduleCode: (typeof QUESTION_MODULE_CODES)[number],
  questions: unknown[],
): QuestionModuleDefinition {
  return questionModuleDefinitionSchema.parse({
    moduleCode,
    frameworkVersion: V,
    questions,
  });
}

describe("A/B. governed catalogue", () => {
  it("declares exactly the 13 approved module codes with no extras or aliases", () => {
    expect([...QUESTION_MODULE_CODES]).toEqual([
      "qualifications",
      "experience",
      "employment_income",
      "study_availability",
      "finance",
      "postcode_geography",
      "travel_relocation",
      "caring_practical",
      "driving",
      "portfolio",
      "registration",
      "background_checks",
      "physical_work_pattern",
    ]);
    expect(QUESTION_MODULE_CODES).toHaveLength(13);
    expect(listQuestionModules().map((m) => m.moduleCode)).toEqual([...QUESTION_MODULE_CODES]);
  });

  it("pins the framework version to 1.0.0", () => {
    expect(QUESTION_MODULE_FRAMEWORK_VERSION).toBe("1.0.0");
    for (const descriptor of listQuestionModules()) {
      expect(descriptor.frameworkVersion).toBe("1.0.0");
    }
  });

  it("resolves module refs exactly and fails closed", () => {
    expect(resolveQuestionModule("finance", V)?.moduleCode).toBe("finance");
    expect(resolveQuestionModule("finance", "1.0.1")).toBeUndefined();
    expect(resolveQuestionModule("Finance", V)).toBeUndefined();
    expect(resolveQuestionModule("housing", V)).toBeUndefined();
    expect(isKnownQuestionModuleRef({ moduleCode: "driving", frameworkVersion: V })).toBe(true);
  });

  it("catalogue contains no invented participant questions", () => {
    for (const descriptor of listQuestionModules()) {
      expect(Object.keys(descriptor).sort()).toEqual(["frameworkVersion", "moduleCode"]);
    }
  });
});

describe("C. reference schemas fail closed", () => {
  it("rejects unknown module codes and wrong framework versions", () => {
    expect(
      questionModuleRefSchema.safeParse({ moduleCode: "finance", frameworkVersion: V }).success,
    ).toBe(true);
    expect(
      questionModuleRefSchema.safeParse({ moduleCode: "finance", frameworkVersion: "2.0.0" })
        .success,
    ).toBe(false);
    expect(
      questionModuleRefSchema.safeParse({ moduleCode: "housing", frameworkVersion: V }).success,
    ).toBe(false);
    expect(
      questionModuleRefSchema.safeParse({
        moduleCode: "finance",
        frameworkVersion: V,
        label: "Money",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed question keys and unknown modules", () => {
    expect(
      questionRefSchema.safeParse({ moduleCode: "finance", questionKey: "savings_amount" }).success,
    ).toBe(true);
    expect(questionRefSchema.safeParse({ moduleCode: "finance", questionKey: "" }).success).toBe(
      false,
    );
    expect(
      questionRefSchema.safeParse({ moduleCode: "finance", questionKey: "bad key!" }).success,
    ).toBe(false);
    expect(questionRefSchema.safeParse({ moduleCode: "nope", questionKey: "x" }).success).toBe(
      false,
    );
  });

  it("formats a stable internal question address", () => {
    expect(formatQuestionAddress({ moduleCode: "driving", questionKey: "licence_held" })).toBe(
      "driving:licence_held",
    );
  });
});

describe("D. consequential-purpose contract", () => {
  it("exposes exactly the seven approved consequence codes", () => {
    expect([...QUESTION_CONSEQUENCE_CODES]).toEqual([
      "eligibility",
      "practical_fit",
      "route_availability",
      "route_ranking",
      "barrier",
      "unresolved_check",
      "next_action",
    ]);
  });

  it("requires at least one consequence and rejects duplicates or unknown codes", () => {
    const base = { moduleCode: "driving", questionKey: "licence_held", input: { kind: "boolean" } };
    expect(questionDefinitionSchema.safeParse({ ...base, consequences: [] }).success).toBe(false);
    expect(questionDefinitionSchema.safeParse({ ...base }).success).toBe(false);
    expect(
      questionDefinitionSchema.safeParse({ ...base, consequences: ["barrier", "barrier"] }).success,
    ).toBe(false);
    expect(
      questionDefinitionSchema.safeParse({ ...base, consequences: ["curiosity"] }).success,
    ).toBe(false);
    expect(
      questionDefinitionSchema.safeParse({ ...base, consequences: ["barrier", "next_action"] })
        .success,
    ).toBe(true);
  });

  it("rejects policy, copy and engine vocabulary on a question definition", () => {
    const base = {
      moduleCode: "finance",
      questionKey: "savings",
      input: { kind: "integer" },
      consequences: ["eligibility"],
    };
    for (const field of [
      "required",
      "blocking",
      "severity",
      "weight",
      "score",
      "verdict",
      "prompt",
      "label",
      "helpText",
      "evidenceStrength",
      "rule",
    ]) {
      expect(
        questionDefinitionSchema.safeParse({ ...base, [field]: "x" }).success,
        `field ${field} must be rejected`,
      ).toBe(false);
    }
  });
});

describe("E. typed input specifications", () => {
  it("declares exactly the seven approved input kinds", () => {
    expect([...QUESTION_INPUT_KINDS]).toEqual([
      "boolean",
      "single_select",
      "multi_select",
      "integer",
      "decimal",
      "text",
      "date",
    ]);
    for (const kind of QUESTION_INPUT_KINDS) {
      const candidate =
        kind === "single_select" || kind === "multi_select"
          ? { kind, optionKeys: ["a", "b"] }
          : { kind };
      expect(questionInputSchema.safeParse(candidate).success, kind).toBe(true);
    }
  });

  it("requires non-empty unique option keys for select inputs", () => {
    expect(
      singleSelectInputSchema.safeParse({ kind: "single_select", optionKeys: [] }).success,
    ).toBe(false);
    expect(
      multiSelectInputSchema.safeParse({ kind: "multi_select", optionKeys: ["a", "a"] }).success,
    ).toBe(false);
    expect(
      multiSelectInputSchema.safeParse({ kind: "multi_select", optionKeys: ["a", ""] }).success,
    ).toBe(false);
    expect(
      multiSelectInputSchema.safeParse({
        kind: "multi_select",
        optionKeys: ["a"],
        optionLabels: ["A"],
      }).success,
    ).toBe(false);
  });

  it("validates numeric and text structural bounds only", () => {
    expect(
      integerInputSchema.safeParse({ kind: "integer", min: 0, max: 10, unitKey: "years" }).success,
    ).toBe(true);
    expect(integerInputSchema.safeParse({ kind: "integer", min: 10, max: 0 }).success).toBe(false);
    expect(integerInputSchema.safeParse({ kind: "integer", min: 1.5 }).success).toBe(false);
    expect(decimalInputSchema.safeParse({ kind: "decimal", min: 0.5, max: 1.5 }).success).toBe(
      true,
    );
    expect(textInputSchema.safeParse({ kind: "text", minLength: 1, maxLength: 10 }).success).toBe(
      true,
    );
    expect(textInputSchema.safeParse({ kind: "text", minLength: 10, maxLength: 1 }).success).toBe(
      false,
    );
    expect(integerInputSchema.safeParse({ kind: "integer", threshold: 5 }).success).toBe(false);
    expect(questionInputSchema.safeParse({ kind: "postcode" }).success).toBe(false);
  });
});

describe("F/G. dependency evaluation", () => {
  it("implements exactly the ten approved operators", () => {
    expect([...DEPENDENCY_OPERATORS]).toEqual([
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
  });

  const answers: AnswerMap = {
    "driving:licence_held": true,
    "finance:savings": 1200,
    "qualifications:levels_held": ["level_3", "level_4"],
    "experience:role_key": "assistant",
    "study_availability:blank": "   ",
  };

  const ref = (moduleCode: string, questionKey: string) => ({ moduleCode, questionKey }) as never;

  it("handles presence, equality, list and numeric operators", () => {
    const cases: Array<[DependencyRule, boolean]> = [
      [{ question: ref("driving", "licence_held"), operator: "answered" }, true],
      [{ question: ref("driving", "missing"), operator: "answered" }, false],
      [{ question: ref("driving", "missing"), operator: "unanswered" }, true],
      [{ question: ref("study_availability", "blank"), operator: "answered" }, false],
      [{ question: ref("driving", "licence_held"), operator: "equals", value: true }, true],
      [{ question: ref("driving", "licence_held"), operator: "not_equals", value: false }, true],
      [{ question: ref("experience", "role_key"), operator: "equals", value: "assistant" }, true],
      [
        { question: ref("qualifications", "levels_held"), operator: "includes", value: "level_3" },
        true,
      ],
      [
        {
          question: ref("qualifications", "levels_held"),
          operator: "not_includes",
          value: "level_6",
        },
        true,
      ],
      [{ question: ref("finance", "savings"), operator: "gt", value: 1000 }, true],
      [{ question: ref("finance", "savings"), operator: "gte", value: 1200 }, true],
      [{ question: ref("finance", "savings"), operator: "lt", value: 1000 }, false],
      [{ question: ref("finance", "savings"), operator: "lte", value: 1200 }, true],
    ];
    for (const [rule, expected] of cases) {
      expect(evaluateDependencyRule(rule, answers), JSON.stringify(rule)).toBe(expected);
    }
  });

  it("supports all/any grouping including nesting", () => {
    const rule: DependencyRule = {
      all: [
        { question: ref("driving", "licence_held"), operator: "equals", value: true },
        {
          any: [
            { question: ref("finance", "savings"), operator: "gt", value: 5000 },
            {
              question: ref("qualifications", "levels_held"),
              operator: "includes",
              value: "level_4",
            },
          ],
        },
      ],
    };
    expect(evaluateDependencyRule(rule, answers)).toBe(true);
    expect(
      evaluateDependencyRule(
        { all: [rule, { question: ref("x", "y"), operator: "answered" } as never] },
        answers,
      ),
    ).toBe(false);
  });

  it("treats missing answers as visibility-only and never as a negative fact", () => {
    const missing: AnswerMap = {};
    const question = q(
      "finance",
      "loan_amount",
      { kind: "integer" },
      {
        dependency: {
          question: { moduleCode: "finance", questionKey: "savings" },
          operator: "gt",
          value: 100,
        },
      },
    );
    // Not asked, and the result is a plain boolean — no requirement/judgement state.
    const asked = isQuestionAsked(question, missing);
    expect(asked).toBe(false);
    expect(typeof asked).toBe("boolean");
    // The unanswered branch is the only thing missing data can assert.
    expect(
      evaluateDependencyRule(
        { question: { moduleCode: "finance", questionKey: "savings" }, operator: "unanswered" },
        missing,
      ),
    ).toBe(true);
  });

  it("asks a question with no dependency", () => {
    expect(isQuestionAsked(q("driving", "licence_held", { kind: "boolean" }), {})).toBe(true);
  });
});

describe("H/I/J. definition-set validation", () => {
  it("accepts a valid cross-module dependency set", () => {
    const result = validateQuestionDefinitionSet([
      mod("driving", [q("driving", "licence_held", { kind: "boolean" })]),
      mod("travel_relocation", [
        q(
          "travel_relocation",
          "max_commute_minutes",
          { kind: "integer", min: 0 },
          {
            dependency: {
              question: { moduleCode: "driving", questionKey: "licence_held" },
              operator: "equals",
              value: true,
            },
          },
        ),
      ]),
    ]);
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("rejects duplicate module definitions and duplicate question refs", () => {
    const dupModule = validateQuestionDefinitionSet([
      mod("driving", [q("driving", "a", { kind: "boolean" })]),
      mod("driving", [q("driving", "b", { kind: "boolean" })]),
    ]);
    expect(dupModule.valid).toBe(false);
    expect(dupModule.issues.map((i) => i.code)).toContain("duplicate_module_definition");

    // Raw (unparsed) module carrying a local contradiction: the set validator must
    // still fail closed, now reporting it as an invalid module definition.
    const dupQuestion = validateQuestionDefinitionSet([
      {
        moduleCode: "driving",
        frameworkVersion: V,
        questions: [q("driving", "a", { kind: "boolean" }), q("driving", "a", { kind: "boolean" })],
      } as never,
    ]);
    expect(dupQuestion.valid).toBe(false);
    expect(dupQuestion.issues.map((i) => i.code)).toContain("invalid_module_definition");
  });

  it("rejects dangling dependency refs and self-dependency", () => {
    const dangling = validateQuestionDefinitionSet([
      mod("finance", [
        q(
          "finance",
          "loan",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "finance", questionKey: "not_there" },
              operator: "answered",
            },
          },
        ),
      ]),
    ]);
    expect(dangling.issues.map((i) => i.code)).toContain("dependency_target_missing");

    const selfDep = validateQuestionDefinitionSet([
      mod("finance", [
        q(
          "finance",
          "loan",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "finance", questionKey: "loan" },
              operator: "answered",
            },
          },
        ),
      ]),
    ]);
    expect(selfDep.issues.map((i) => i.code)).toContain("self_dependency");
  });

  it("rejects dependency cycles, including cross-module cycles", () => {
    const cycle = validateQuestionDefinitionSet([
      mod("finance", [
        q(
          "finance",
          "a",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "driving", questionKey: "b" },
              operator: "answered",
            },
          },
        ),
      ]),
      mod("driving", [
        q(
          "driving",
          "b",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "finance", questionKey: "a" },
              operator: "answered",
            },
          },
        ),
      ]),
    ]);
    expect(cycle.valid).toBe(false);
    expect(cycle.issues.map((i) => i.code)).toContain("dependency_cycle");
  });

  it("rejects operator/type incompatibilities", () => {
    const includesOnBoolean = validateQuestionDefinitionSet([
      mod("driving", [
        q("driving", "licence_held", { kind: "boolean" }),
        q(
          "driving",
          "x",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "driving", questionKey: "licence_held" },
              operator: "includes",
              value: "a",
            },
          },
        ),
      ]),
    ]);
    expect(includesOnBoolean.issues.map((i) => i.code)).toContain("operator_input_incompatible");

    const numericOnText = validateQuestionDefinitionSet([
      mod("experience", [
        q("experience", "summary", { kind: "text" }),
        q(
          "experience",
          "y",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "experience", questionKey: "summary" },
              operator: "gte",
              value: 3,
            },
          },
        ),
      ]),
    ]);
    expect(numericOnText.issues.map((i) => i.code)).toContain("operator_input_incompatible");

    const equalityOnMultiSelect = validateQuestionDefinitionSet([
      mod("qualifications", [
        q("qualifications", "levels", { kind: "multi_select", optionKeys: ["level_3"] }),
        q(
          "qualifications",
          "z",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "qualifications", questionKey: "levels" },
              operator: "equals",
              value: "level_3",
            },
          },
        ),
      ]),
    ]);
    expect(equalityOnMultiSelect.issues.map((i) => i.code)).toContain(
      "operator_input_incompatible",
    );

    const includesOnMultiSelectOk = validateQuestionDefinitionSet([
      mod("qualifications", [
        q("qualifications", "levels", { kind: "multi_select", optionKeys: ["level_3"] }),
        q(
          "qualifications",
          "z",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "qualifications", questionKey: "levels" },
              operator: "includes",
              value: "level_3",
            },
          },
        ),
      ]),
    ]);
    expect(includesOnMultiSelectOk.valid).toBe(true);
  });

  it("rejects dependency comparison values that cannot match the referenced input", () => {
    const unknownOption = validateQuestionDefinitionSet([
      mod("qualifications", [
        q("qualifications", "levels", { kind: "multi_select", optionKeys: ["level_3"] }),
        q(
          "qualifications",
          "z",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "qualifications", questionKey: "levels" },
              operator: "includes",
              value: "level_9",
            },
          },
        ),
      ]),
    ]);
    expect(unknownOption.issues.map((i) => i.code)).toContain("dependency_value_incompatible");

    const nonIntegerBound = validateQuestionDefinitionSet([
      mod("finance", [
        q("finance", "savings", { kind: "integer" }),
        q(
          "finance",
          "z",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "finance", questionKey: "savings" },
              operator: "gt",
              value: 10.5,
            },
          },
        ),
      ]),
    ]);
    expect(nonIntegerBound.issues.map((i) => i.code)).toContain("dependency_value_incompatible");

    const boolValueMismatch = validateQuestionDefinitionSet([
      mod("driving", [
        q("driving", "licence_held", { kind: "boolean" }),
        q(
          "driving",
          "z",
          { kind: "boolean" },
          {
            dependency: {
              question: { moduleCode: "driving", questionKey: "licence_held" },
              operator: "equals",
              value: "yes",
            },
          },
        ),
      ]),
    ]);
    expect(boolValueMismatch.issues.map((i) => i.code)).toContain("dependency_value_incompatible");
  });

  it("rejects a structurally invalid module definition set", () => {
    const invalid = validateQuestionDefinitionSet([
      { moduleCode: "driving", frameworkVersion: "2.0.0", questions: [] } as never,
    ]);
    expect(invalid.valid).toBe(false);
    expect(invalid.issues[0]!.code).toBe("invalid_module_definition");
  });
});

describe("K. runtime immutability", () => {
  it("cannot be mutated to change later reads", () => {
    const first = listQuestionModules();
    expect(() => {
      (first as unknown as { push: (v: unknown) => void }).push({ moduleCode: "hacked" });
    }).toThrow();
    try {
      (first[0] as unknown as Record<string, unknown>)["moduleCode"] = "hacked";
    } catch {
      // frozen in strict mode
    }
    expect(listQuestionModules()[0]!.moduleCode).toBe("qualifications");
    expect(listQuestionModules().map((m) => m.moduleCode)).toEqual([...QUESTION_MODULE_CODES]);
    expect(resolveQuestionModule("hacked", V)).toBeUndefined();
  });
});

describe("L/M. package boundary", () => {
  const PACKAGE_DIR = join(process.cwd(), "src/domain/questions");

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return sourceFiles(full);
      return full.endsWith(".ts") ? [full] : [];
    });
  }

  const files = sourceFiles(PACKAGE_DIR).filter((f) => !f.includes("__tests__"));

  it("has source files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("imports nothing from React, Supabase, UI, routes or the database", () => {
    const forbiddenImports =
      /from\s+["'](react|react-dom|@tanstack\/[^"']+|@supabase\/[^"']+|@\/integrations\/[^"']+|@\/components\/[^"']+|@\/routes\/[^"']+)["']/;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(forbiddenImports.test(source), `${file} has a forbidden import`).toBe(false);
      expect(/\b(window|document|localStorage|fetch\()/.test(source), file).toBe(false);
    }
  });

  it("only imports zod and the shared contracts layer", () => {
    const allowed = new Set([
      "zod",
      "../contracts",
      "./codes",
      "./calendar-date",
      "./input",
      "./dependency",
      "./schema",
      "./catalogue",
      "./validation",
      "./visibility",
    ]);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        expect(allowed.has(match[1]!), `${file} imports ${match[1]}`).toBe(true);
      }
    }
  });

  it("contains no Career Pack, Decision Engine, verdict, ranking-score or career-specific code", () => {
    const forbidden =
      /\b(careerPack|career_pack|decisionEngine|decision_engine|realistic_now|not_realistic_yet|rankingWeight|ranking_weight|evidenceGrade|nursing|electrician|solicitor|photographer)\b/i;
    for (const file of files) {
      expect(
        forbidden.test(readFileSync(file, "utf8")),
        `${file} leaks later-increment scope`,
      ).toBe(false);
    }
  });
});

describe("R1. module definition local invariants fail closed at schema level", () => {
  it("rejects a child question declaring a different module code", () => {
    const parsed = questionModuleDefinitionSchema.safeParse({
      moduleCode: "driving",
      frameworkVersion: V,
      questions: [q("finance", "savings", { kind: "integer" })],
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("declares module finance");
  });

  it("rejects duplicate question keys within the same module", () => {
    const parsed = questionModuleDefinitionSchema.safeParse({
      moduleCode: "driving",
      frameworkVersion: V,
      questions: [
        q("driving", "licence_held", { kind: "boolean" }),
        q("driving", "licence_held", { kind: "boolean" }),
      ],
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("duplicate question reference");
  });

  it("still accepts a locally consistent module definition", () => {
    expect(
      questionModuleDefinitionSchema.safeParse({
        moduleCode: "driving",
        frameworkVersion: V,
        questions: [
          q("driving", "licence_held", { kind: "boolean" }),
          q("driving", "licence_categories", {
            kind: "multi_select",
            optionKeys: ["b", "c1"],
          }),
        ],
      }).success,
    ).toBe(true);
  });
});

describe("R2. structurally impossible dependency comparison values", () => {
  function issueCodes(input: unknown, dependency: unknown) {
    return validateQuestionDefinitionSet([
      mod("finance", [
        q("finance", "target", input),
        q("finance", "gated", { kind: "boolean" }, { dependency }),
      ]),
    ]).issues.map((i) => i.code);
  }

  const dep = (operator: string, value: unknown) => ({
    question: { moduleCode: "finance", questionKey: "target" },
    operator,
    value,
  });

  it("rejects integer comparison values outside declared min/max and accepts boundaries", () => {
    const input = { kind: "integer", min: 0, max: 10 };
    expect(issueCodes(input, dep("gt", 11))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("lt", -1))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("equals", 25))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("equals", 0))).toEqual([]);
    expect(issueCodes(input, dep("lte", 10))).toEqual([]);
  });

  it("rejects decimal comparison values outside declared min/max", () => {
    const input = { kind: "decimal", min: 0.5, max: 1.5 };
    expect(issueCodes(input, dep("gte", 2.5))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("equals", 0.25))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("equals", 1.5))).toEqual([]);
  });

  it("rejects blank, too-short and too-long text dependency values", () => {
    const input = { kind: "text", minLength: 2, maxLength: 5 };
    expect(issueCodes(input, dep("equals", ""))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("equals", "   "))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("not_equals", "a"))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("equals", "abcdef"))).toContain("dependency_value_incompatible");
    expect(issueCodes(input, dep("equals", "abcd"))).toEqual([]);
    expect(issueCodes({ kind: "text" }, dep("equals", "any value"))).toEqual([]);
    expect(issueCodes({ kind: "text" }, dep("equals", " "))).toContain(
      "dependency_value_incompatible",
    );
  });

  it("rejects malformed and impossible calendar dates, accepts a valid YYYY-MM-DD value", () => {
    const input = { kind: "date" };
    for (const bad of [
      "2026-02-30",
      "2025-02-29",
      "2026-13-01",
      "2026-00-10",
      "01-01-2026",
      "2026-1-1",
      "not-a-date",
      "2026-04-31",
    ]) {
      expect(issueCodes(input, dep("equals", bad)), bad).toContain("dependency_value_incompatible");
    }
    expect(issueCodes(input, dep("equals", "2026-02-28"))).toEqual([]);
    expect(issueCodes(input, dep("not_equals", "2024-02-29"))).toEqual([]);
    expect(isCalendarDate("2026-02-28")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(calendarDateSchema.safeParse("2026-12-31").success).toBe(true);
    expect(calendarDateSchema.safeParse("2026-12-32").success).toBe(false);
  });

  it("preserves select and boolean compatibility semantics", () => {
    expect(
      issueCodes({ kind: "single_select", optionKeys: ["a", "b"] }, dep("equals", "a")),
    ).toEqual([]);
    expect(
      issueCodes({ kind: "single_select", optionKeys: ["a", "b"] }, dep("equals", "z")),
    ).toContain("dependency_value_incompatible");
    expect(issueCodes({ kind: "multi_select", optionKeys: ["a"] }, dep("includes", "a"))).toEqual(
      [],
    );
    expect(
      issueCodes({ kind: "multi_select", optionKeys: ["a"] }, dep("not_includes", "z")),
    ).toContain("dependency_value_incompatible");
    expect(issueCodes({ kind: "boolean" }, dep("equals", true))).toEqual([]);
    expect(issueCodes({ kind: "boolean" }, dep("equals", "true"))).toContain(
      "dependency_value_incompatible",
    );
  });
});

describe("R3. preserved dependency semantics", () => {
  const ref = { moduleCode: "finance", questionKey: "savings" } as never;

  it("does not satisfy comparisons against a missing answer", () => {
    for (const rule of [
      { question: ref, operator: "equals", value: 1 },
      { question: ref, operator: "not_equals", value: 1 },
      { question: ref, operator: "gt", value: 1 },
      { question: ref, operator: "lte", value: 1 },
      { question: ref, operator: "includes", value: "a" },
      { question: ref, operator: "not_includes", value: "a" },
    ] as DependencyRule[]) {
      expect(evaluateDependencyRule(rule, {}), JSON.stringify(rule)).toBe(false);
    }
  });

  it("lets unanswered match missing or blank data and returns a plain boolean", () => {
    const rule: DependencyRule = { question: ref, operator: "unanswered" };
    expect(evaluateDependencyRule(rule, {})).toBe(true);
    expect(evaluateDependencyRule(rule, { "finance:savings": "  " })).toBe(true);
    expect(typeof evaluateDependencyRule(rule, {})).toBe("boolean");
  });
});
