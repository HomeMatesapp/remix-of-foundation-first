import type { AnswerSnapshot } from "../assessment-inputs";
import {
  PACK_EQUALITY_OPERATORS,
  PACK_LIST_OPERATORS,
  PACK_NUMERIC_OPERATORS,
  type PackCondition,
  type PackRule,
} from "../career-packs";
import { formatQuestionAddress, type QuestionAnswerValue } from "../questions";
import { questionIdentityKey } from "./canonical";
import { engineIssue, type DecisionEngineIssue } from "./codes";

/**
 * Consequential Career Pack rule truth: STRICT three-valued (Kleene) logic.
 *
 * `null` means unknown. A missing answer is unknown, never false, so missing data
 * can never independently create a negative consequential outcome.
 *
 * This evaluator is DELIBERATELY SEPARATE from question visibility dependency
 * evaluation (Increment 4). Visibility logic must never become consequential
 * eligibility logic, so nothing here imports or reuses it.
 */

export type Truth = boolean | null;

export type TruthResult =
  | { readonly ok: true; readonly value: Truth }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] };

/** Confirmed answers indexed by exact question identity. */
export type AnswerIndex = ReadonlyMap<string, QuestionAnswerValue>;

export function buildAnswerIndex(snapshot: AnswerSnapshot): AnswerIndex {
  const index = new Map<string, QuestionAnswerValue>();
  for (const entry of snapshot.answers) {
    index.set(questionIdentityKey(entry.question), entry.value);
  }
  return index;
}

function isGroup(
  rule: PackRule,
): rule is { all: readonly PackRule[] } | { any: readonly PackRule[] } {
  return typeof rule === "object" && rule !== null && ("all" in rule || "any" in rule);
}

function incompatible(condition: PackCondition, detail: string, at: string): TruthResult {
  return {
    ok: false,
    issues: [
      engineIssue(
        "operator_input_incompatible",
        `operator ${condition.operator} cannot be applied to the confirmed answer: ${detail}`,
        at,
      ),
    ],
  };
}

/**
 * Evaluate one condition against confirmed answers.
 *
 * A type incompatibility that survived Career Pack validation and Answer Snapshot
 * validation is an internal contradiction: it fails CLOSED as an engine issue and
 * is never silently reported as `false` or `unknown`.
 */
export function evaluatePackCondition(condition: PackCondition, answers: AnswerIndex): TruthResult {
  const at = formatQuestionAddress(condition.question);
  const key = questionIdentityKey(condition.question);
  const present = answers.has(key);
  const answer = answers.get(key);

  if (condition.operator === "answered") return { ok: true, value: present };
  if (condition.operator === "unanswered") return { ok: true, value: !present };

  /* Every remaining operator is unknown-preserving on a missing answer. */
  if (!present || answer === undefined) return { ok: true, value: null };

  /* Narrow to operators that carry a comparison value. */
  if (!("value" in condition)) return incompatible(condition, "unsupported operator", at);

  if ((PACK_EQUALITY_OPERATORS as readonly string[]).includes(condition.operator)) {
    if (Array.isArray(answer)) {
      return incompatible(condition, "confirmed answer is a selection list", at);
    }
    const equal = answer === condition.value;
    return { ok: true, value: condition.operator === "equals" ? equal : !equal };
  }

  if ((PACK_LIST_OPERATORS as readonly string[]).includes(condition.operator)) {
    if (!Array.isArray(answer)) {
      return incompatible(condition, "confirmed answer is not a selection list", at);
    }
    const contains = answer.includes(condition.value as string);
    return { ok: true, value: condition.operator === "includes" ? contains : !contains };
  }

  if ((PACK_NUMERIC_OPERATORS as readonly string[]).includes(condition.operator)) {
    if (typeof answer !== "number") {
      return incompatible(condition, "confirmed answer is not numeric", at);
    }
    const value = condition.value as number;
    switch (condition.operator) {
      case "gt":
        return { ok: true, value: answer > value };
      case "gte":
        return { ok: true, value: answer >= value };
      case "lt":
        return { ok: true, value: answer < value };
      case "lte":
        return { ok: true, value: answer <= value };
      default:
        return incompatible(condition, "unsupported numeric operator", at);
    }
  }

  return incompatible(condition, "unsupported operator", at);
}

/**
 * Kleene `all` / `any`.
 *
 * `all`: false if any child is false; else unknown if any child is unknown; else true.
 * `any`: true if any child is true; else unknown if any child is unknown; else false.
 */
export function evaluatePackRule(rule: PackRule, answers: AnswerIndex): TruthResult {
  if (!isGroup(rule)) return evaluatePackCondition(rule, answers);

  const conjunction = "all" in rule;
  const children = conjunction ? rule.all : rule.any;

  const issues: DecisionEngineIssue[] = [];
  let sawUnknown = false;
  let sawDominant = false;

  /* Every child is evaluated so that all internal contradictions surface. */
  for (const child of children) {
    const outcome = evaluatePackRule(child, answers);
    if (!outcome.ok) {
      issues.push(...outcome.issues);
      continue;
    }
    if (outcome.value === null) sawUnknown = true;
    else if (outcome.value === !conjunction) sawDominant = true;
  }

  if (issues.length > 0) return { ok: false, issues };
  if (sawDominant) return { ok: true, value: !conjunction };
  if (sawUnknown) return { ok: true, value: null };
  return { ok: true, value: conjunction };
}
