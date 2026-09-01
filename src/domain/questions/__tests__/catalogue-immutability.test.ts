import { describe, expect, it } from "vitest";

import { QUESTION_CONSEQUENCE_CODES, QUESTION_INPUT_KINDS, QUESTION_MODULE_CODES } from "../codes";
import {
  DEPENDENCY_OPERATORS,
  EQUALITY_OPERATORS,
  LIST_OPERATORS,
  NUMERIC_OPERATORS,
  PRESENCE_OPERATORS,
  dependencyConditionSchema,
  evaluateDependencyRule,
  type AnswerMap,
  type DependencyRule,
} from "../dependency";

/** Deliberate cast escape hatch used only to prove runtime immutability. */
function mutable(value: readonly unknown[]): unknown[] {
  return value as unknown[];
}

function attempt(action: () => void): void {
  try {
    action();
  } catch {
    // Frozen arrays throw in strict mode; a silent no-op is equally acceptable.
  }
}

const EXPECTED_MODULE_CODES = [
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
];

const EXPECTED_CONSEQUENCE_CODES = [
  "eligibility",
  "practical_fit",
  "route_availability",
  "route_ranking",
  "barrier",
  "unresolved_check",
  "next_action",
];

const EXPECTED_INPUT_KINDS = [
  "boolean",
  "single_select",
  "multi_select",
  "integer",
  "decimal",
  "text",
  "date",
];

const EXPECTED_DEPENDENCY_OPERATORS = [
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
];

describe("governed question catalogues are frozen at runtime", () => {
  it("keeps exactly the approved 13 module codes after mutation attempts", () => {
    attempt(() => mutable(QUESTION_MODULE_CODES).push("injected_module"));
    attempt(() => mutable(QUESTION_MODULE_CODES).reverse());
    attempt(() => mutable(QUESTION_MODULE_CODES).splice(0, 3));
    attempt(() => {
      mutable(QUESTION_MODULE_CODES)[0] = "tampered";
    });

    expect(Object.isFrozen(QUESTION_MODULE_CODES)).toBe(true);
    expect([...QUESTION_MODULE_CODES]).toEqual(EXPECTED_MODULE_CODES);
    expect(QUESTION_MODULE_CODES).toHaveLength(13);
  });

  it("keeps exactly the approved 7 consequence codes", () => {
    attempt(() => mutable(QUESTION_CONSEQUENCE_CODES).push("injected"));
    attempt(() => mutable(QUESTION_CONSEQUENCE_CODES).reverse());
    attempt(() => {
      mutable(QUESTION_CONSEQUENCE_CODES)[1] = "tampered";
    });

    expect(Object.isFrozen(QUESTION_CONSEQUENCE_CODES)).toBe(true);
    expect([...QUESTION_CONSEQUENCE_CODES]).toEqual(EXPECTED_CONSEQUENCE_CODES);
    expect(QUESTION_CONSEQUENCE_CODES).toHaveLength(7);
  });

  it("keeps exactly the approved 7 input kinds", () => {
    attempt(() => mutable(QUESTION_INPUT_KINDS).push("injected"));
    attempt(() => mutable(QUESTION_INPUT_KINDS).splice(0, 2));
    attempt(() => {
      mutable(QUESTION_INPUT_KINDS)[0] = "tampered";
    });

    expect(Object.isFrozen(QUESTION_INPUT_KINDS)).toBe(true);
    expect([...QUESTION_INPUT_KINDS]).toEqual(EXPECTED_INPUT_KINDS);
    expect(QUESTION_INPUT_KINDS).toHaveLength(7);
  });

  it("keeps the canonical operator sequences and classification sets", () => {
    for (const catalogue of [
      DEPENDENCY_OPERATORS,
      PRESENCE_OPERATORS,
      EQUALITY_OPERATORS,
      LIST_OPERATORS,
      NUMERIC_OPERATORS,
    ]) {
      attempt(() => mutable(catalogue).push("injected_operator"));
      attempt(() => mutable(catalogue).reverse());
      attempt(() => mutable(catalogue).splice(0, 1));
      attempt(() => {
        mutable(catalogue)[0] = "tampered";
      });
      expect(Object.isFrozen(catalogue)).toBe(true);
    }

    expect([...DEPENDENCY_OPERATORS]).toEqual(EXPECTED_DEPENDENCY_OPERATORS);
    expect([...PRESENCE_OPERATORS]).toEqual(["answered", "unanswered"]);
    expect([...EQUALITY_OPERATORS]).toEqual(["equals", "not_equals"]);
    expect([...LIST_OPERATORS]).toEqual(["includes", "not_includes"]);
    expect([...NUMERIC_OPERATORS]).toEqual(["gt", "gte", "lt", "lte"]);
  });

  it("cannot have dependency classification or evaluation changed by mutation attempts", () => {
    attempt(() => mutable(NUMERIC_OPERATORS).push("equals"));
    attempt(() => mutable(EQUALITY_OPERATORS).push("gt"));
    attempt(() => mutable(DEPENDENCY_OPERATORS).push("always_true"));

    // Injected operators are still rejected by the dependency contract.
    expect(
      dependencyConditionSchema.safeParse({
        question: { moduleCode: "driving", questionKey: "has_licence" },
        operator: "always_true",
      }).success,
    ).toBe(false);

    // Numeric semantics are unchanged.
    const rule = {
      all: [
        {
          question: { moduleCode: "employment_income", questionKey: "hours" },
          operator: "gte",
          value: 20,
        },
      ],
    } as unknown as DependencyRule;
    const answers: AnswerMap = { "employment_income:hours": 20 };
    expect(evaluateDependencyRule(rule, answers)).toBe(true);
    expect(evaluateDependencyRule(rule, { "employment_income:hours": 19 })).toBe(false);
    expect(evaluateDependencyRule(rule, {})).toBe(false);
  });
});
