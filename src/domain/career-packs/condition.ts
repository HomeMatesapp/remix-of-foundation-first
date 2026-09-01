import { z } from "zod";

import { questionRefSchema, type QuestionRef } from "../questions";

/**
 * Career Pack consequential condition DSL.
 *
 * DELIBERATELY SEPARATE from `dependencyRuleSchema` (Increment 4). Question
 * dependency rules are visibility-only forever and must never be used as
 * consequential eligibility/route/barrier logic. This DSL reuses only low-level
 * `QuestionRef` and answer-value shapes.
 *
 * This module defines STRUCTURE ONLY. There is no evaluator here: rule
 * application, precedence, defaults and guardrails are Increment 9/10. A missing
 * answer is never silently negative, and nothing here converts unknown to unmet.
 */

export const PACK_CONDITION_OPERATORS = Object.freeze([
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
export type PackConditionOperator = (typeof PACK_CONDITION_OPERATORS)[number];

export const PACK_PRESENCE_OPERATORS = Object.freeze(["answered", "unanswered"] as const);
export const PACK_EQUALITY_OPERATORS = Object.freeze(["equals", "not_equals"] as const);
export const PACK_LIST_OPERATORS = Object.freeze(["includes", "not_includes"] as const);
export const PACK_NUMERIC_OPERATORS = Object.freeze(["gt", "gte", "lt", "lte"] as const);

const presenceConditionSchema = z
  .object({ question: questionRefSchema, operator: z.enum(PACK_PRESENCE_OPERATORS) })
  .strict();

const equalityConditionSchema = z
  .object({
    question: questionRefSchema,
    operator: z.enum(PACK_EQUALITY_OPERATORS),
    value: z.union([z.boolean(), z.string(), z.number()]),
  })
  .strict();

const listConditionSchema = z
  .object({
    question: questionRefSchema,
    operator: z.enum(PACK_LIST_OPERATORS),
    value: z.string().min(1),
  })
  .strict();

const numericConditionSchema = z
  .object({
    question: questionRefSchema,
    operator: z.enum(PACK_NUMERIC_OPERATORS),
    value: z.number(),
  })
  .strict();

export const packConditionSchema = z.union([
  presenceConditionSchema,
  equalityConditionSchema,
  listConditionSchema,
  numericConditionSchema,
]);
export type PackCondition = z.infer<typeof packConditionSchema>;

/** Nested non-empty `all` / `any` groups only. No arbitrary predicates. */
export type PackRule = PackCondition | { all: readonly PackRule[] } | { any: readonly PackRule[] };

export const packRuleSchema: z.ZodType<PackRule> = z.lazy(() =>
  z.union([
    packConditionSchema,
    z.object({ all: z.array(packRuleSchema).min(1, "group must not be empty") }).strict(),
    z.object({ any: z.array(packRuleSchema).min(1, "group must not be empty") }).strict(),
  ]),
);

function isGroup(
  rule: PackRule,
): rule is { all: readonly PackRule[] } | { any: readonly PackRule[] } {
  return typeof rule === "object" && rule !== null && ("all" in rule || "any" in rule);
}

/** Collect every condition in a pack rule, in traversal order. */
export function collectPackConditions(rule: PackRule): readonly PackCondition[] {
  if (isGroup(rule)) {
    const children = "all" in rule ? rule.all : rule.any;
    return children.flatMap((child) => collectPackConditions(child));
  }
  return [rule];
}

/** Collect every question referenced by a pack rule, in traversal order. */
export function collectPackConditionRefs(rule: PackRule): readonly QuestionRef[] {
  return collectPackConditions(rule).map((condition) => condition.question);
}
