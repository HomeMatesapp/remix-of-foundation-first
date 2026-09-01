import { z } from "zod";

import { stableKeySchema } from "../contracts";
import { QUESTION_MODULE_CODES } from "./codes";
import { questionAnswerValueSchema, type QuestionAnswerValue } from "./input";

/**
 * Deterministic, serialisable dependency / visibility rules.
 *
 * A dependency decides only whether a later question should be ASKED. It never
 * decides whether a requirement is met, whether a route is available or whether
 * a career is realistic. Missing answers affect visibility only and are never
 * turned into a negative career fact.
 *
 * No arbitrary JavaScript predicates are permitted in definitions.
 */

export const DEPENDENCY_OPERATORS = Object.freeze([
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
] as const);
export type DependencyOperator = (typeof DEPENDENCY_OPERATORS)[number];

export const PRESENCE_OPERATORS = Object.freeze(["answered", "unanswered"] as const);
export const EQUALITY_OPERATORS = Object.freeze(["equals", "not_equals"] as const);
export const LIST_OPERATORS = Object.freeze(["includes", "not_includes"] as const);
export const NUMERIC_OPERATORS = Object.freeze(["gt", "gte", "lt", "lte"] as const);

/** Reference to a question by module code plus its stable internal key. */
export const questionRefSchema = z
  .object({
    moduleCode: z.enum(QUESTION_MODULE_CODES),
    questionKey: stableKeySchema,
  })
  .strict();
export type QuestionRef = z.infer<typeof questionRefSchema>;

/** Stable internal question address. Never participant-facing text. */
export function formatQuestionAddress(ref: QuestionRef): string {
  return `${ref.moduleCode}:${ref.questionKey}`;
}

const presenceConditionSchema = z
  .object({ question: questionRefSchema, operator: z.enum(PRESENCE_OPERATORS) })
  .strict();

const equalityConditionSchema = z
  .object({
    question: questionRefSchema,
    operator: z.enum(EQUALITY_OPERATORS),
    value: z.union([z.boolean(), z.string(), z.number()]),
  })
  .strict();

const listConditionSchema = z
  .object({
    question: questionRefSchema,
    operator: z.enum(LIST_OPERATORS),
    value: z.string().min(1),
  })
  .strict();

const numericConditionSchema = z
  .object({
    question: questionRefSchema,
    operator: z.enum(NUMERIC_OPERATORS),
    value: z.number(),
  })
  .strict();

export const dependencyConditionSchema = z.union([
  presenceConditionSchema,
  equalityConditionSchema,
  listConditionSchema,
  numericConditionSchema,
]);
export type DependencyCondition = z.infer<typeof dependencyConditionSchema>;

export type DependencyRule =
  DependencyCondition | { all: readonly DependencyRule[] } | { any: readonly DependencyRule[] };

export const dependencyRuleSchema: z.ZodType<DependencyRule> = z.lazy(() =>
  z.union([
    dependencyConditionSchema,
    z.object({ all: z.array(dependencyRuleSchema).min(1, "group must not be empty") }).strict(),
    z.object({ any: z.array(dependencyRuleSchema).min(1, "group must not be empty") }).strict(),
  ]),
);

/** Confirmed answers, addressed by `formatQuestionAddress`. */
export type AnswerMap = Readonly<Record<string, QuestionAnswerValue | undefined>>;

export const answerMapSchema = z.record(z.string(), questionAnswerValueSchema);

function isGroup(rule: DependencyRule): rule is
  | { all: readonly DependencyRule[] }
  | {
      any: readonly DependencyRule[];
    } {
  return typeof rule === "object" && rule !== null && ("all" in rule || "any" in rule);
}

function isAnswered(value: QuestionAnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Collect every question referenced by a dependency rule, in traversal order. */
export function collectDependencyRefs(rule: DependencyRule): readonly QuestionRef[] {
  if (isGroup(rule)) {
    const children = "all" in rule ? rule.all : rule.any;
    return children.flatMap((child) => collectDependencyRefs(child));
  }
  return [rule.question];
}

/** Collect every condition in a dependency rule, in traversal order. */
export function collectDependencyConditions(rule: DependencyRule): readonly DependencyCondition[] {
  if (isGroup(rule)) {
    const children = "all" in rule ? rule.all : rule.any;
    return children.flatMap((child) => collectDependencyConditions(child));
  }
  return [rule];
}

function evaluateCondition(condition: DependencyCondition, answers: AnswerMap): boolean {
  const value = answers[formatQuestionAddress(condition.question)];
  const answered = isAnswered(value);

  switch (condition.operator) {
    case "answered":
      return answered;
    case "unanswered":
      return !answered;
    default:
      break;
  }

  // Any comparison against a missing answer is simply not satisfied. It never
  // becomes an assessment, requirement or eligibility state.
  if (!answered) return false;

  switch (condition.operator) {
    case "equals":
      return !Array.isArray(value) && value === condition.value;
    case "not_equals":
      return !Array.isArray(value) && value !== condition.value;
    case "includes":
      return Array.isArray(value) && value.includes(condition.value);
    case "not_includes":
      return Array.isArray(value) && !value.includes(condition.value);
    case "gt":
      return typeof value === "number" && value > condition.value;
    case "gte":
      return typeof value === "number" && value >= condition.value;
    case "lt":
      return typeof value === "number" && value < condition.value;
    case "lte":
      return typeof value === "number" && value <= condition.value;
  }
}

/** Pure deterministic evaluation of a dependency rule against confirmed answers. */
export function evaluateDependencyRule(rule: DependencyRule, answers: AnswerMap): boolean {
  if (isGroup(rule)) {
    if ("all" in rule) return rule.all.every((child) => evaluateDependencyRule(child, answers));
    return rule.any.some((child) => evaluateDependencyRule(child, answers));
  }
  return evaluateCondition(rule, answers);
}
