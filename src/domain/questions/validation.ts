import {
  EQUALITY_OPERATORS,
  LIST_OPERATORS,
  NUMERIC_OPERATORS,
  PRESENCE_OPERATORS,
  collectDependencyConditions,
  formatQuestionAddress,
  type DependencyCondition,
} from "./dependency";
import { isCalendarDate } from "./calendar-date";
import type { QuestionInput } from "./input";
import {
  questionModuleDefinitionSchema,
  type QuestionDefinition,
  type QuestionModuleDefinition,
} from "./schema";

/**
 * Pure definition-set integrity validation.
 *
 * Fails closed on structural contradictions across a supplied set of reusable
 * module definitions. Cross-module dependencies are legitimate and are validated
 * at this definition-set level.
 *
 * This is not an eligibility evaluator and produces no assessment outcome.
 */

export type DefinitionSetIssueCode =
  | "invalid_module_definition"
  | "duplicate_module_definition"
  | "duplicate_question"
  | "question_module_mismatch"
  | "dependency_target_missing"
  | "self_dependency"
  | "dependency_cycle"
  | "operator_input_incompatible"
  | "dependency_value_incompatible";

export interface DefinitionSetIssue {
  readonly code: DefinitionSetIssueCode;
  readonly message: string;
  /** Stable internal address of the question or module the issue concerns. */
  readonly at?: string;
}

export interface DefinitionSetValidationResult {
  readonly valid: boolean;
  readonly issues: readonly DefinitionSetIssue[];
}

function operatorAllowedForInput(
  operator: DependencyCondition["operator"],
  input: QuestionInput,
): boolean {
  if ((PRESENCE_OPERATORS as readonly string[]).includes(operator)) return true;
  if ((NUMERIC_OPERATORS as readonly string[]).includes(operator)) {
    return input.kind === "integer" || input.kind === "decimal";
  }
  if ((LIST_OPERATORS as readonly string[]).includes(operator)) {
    return input.kind === "multi_select";
  }
  if ((EQUALITY_OPERATORS as readonly string[]).includes(operator)) {
    return input.kind !== "multi_select";
  }
  return false;
}

function numericBoundsCheck(
  value: number,
  bounds: { min?: number | undefined; max?: number | undefined },
): true | string {
  if (bounds.min !== undefined && value < bounds.min) {
    return `value ${value} is below the referenced question's declared min ${bounds.min}`;
  }
  if (bounds.max !== undefined && value > bounds.max) {
    return `value ${value} is above the referenced question's declared max ${bounds.max}`;
  }
  return true;
}

function valueCompatibleWithInput(
  condition: DependencyCondition,
  input: QuestionInput,
): true | string {
  if (!("value" in condition)) return true;
  const { value } = condition;

  if ((LIST_OPERATORS as readonly string[]).includes(condition.operator)) {
    if (input.kind !== "multi_select") return "list operator requires a multi-select question";
    if (typeof value !== "string" || !input.optionKeys.includes(value)) {
      return `value must be one of the referenced question's option keys`;
    }
    return true;
  }

  const numericComparison = (NUMERIC_OPERATORS as readonly string[]).includes(condition.operator);

  if (numericComparison) {
    if (typeof value !== "number") return "numeric comparison requires a numeric value";
    if (input.kind === "integer" && !Number.isInteger(value)) {
      return "integer question requires an integer comparison value";
    }
    if (input.kind === "integer" || input.kind === "decimal") {
      return numericBoundsCheck(value, input);
    }
    return true;
  }

  // equality operators
  switch (input.kind) {
    case "boolean":
      return typeof value === "boolean" ? true : "boolean question requires a boolean value";
    case "single_select":
      return typeof value === "string" && input.optionKeys.includes(value)
        ? true
        : "value must be one of the referenced question's option keys";
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return "integer question requires an integer value";
      }
      return numericBoundsCheck(value, input);
    case "decimal":
      if (typeof value !== "number") return "decimal question requires a numeric value";
      return numericBoundsCheck(value, input);
    case "text": {
      if (typeof value !== "string") return "text question requires a string value";
      if (value.trim().length === 0) {
        return "blank text is treated as unanswered and can never be a confirmed answer";
      }
      if (input.minLength !== undefined && value.length < input.minLength) {
        return `value is shorter than the referenced question's declared minLength ${input.minLength}`;
      }
      if (input.maxLength !== undefined && value.length > input.maxLength) {
        return `value is longer than the referenced question's declared maxLength ${input.maxLength}`;
      }
      return true;
    }
    case "date":
      if (typeof value !== "string") return "date question requires a string value";
      return isCalendarDate(value)
        ? true
        : "date question requires a valid ISO calendar date in YYYY-MM-DD form";
    case "multi_select":
      return "multi-select questions cannot be compared with equality operators";
  }
}

/** Validate a supplied set of reusable module definitions. */
export function validateQuestionDefinitionSet(
  modules: readonly QuestionModuleDefinition[],
): DefinitionSetValidationResult {
  const issues: DefinitionSetIssue[] = [];
  const seenModules = new Set<string>();
  const questions = new Map<string, QuestionDefinition>();

  for (const module of modules) {
    const parsed = questionModuleDefinitionSchema.safeParse(module);
    if (!parsed.success) {
      issues.push({
        code: "invalid_module_definition",
        message: parsed.error.issues.map((i) => i.message).join("; "),
        at: String((module as { moduleCode?: string }).moduleCode ?? "unknown"),
      });
      continue;
    }

    const moduleKey = `${parsed.data.moduleCode}@${parsed.data.frameworkVersion}`;
    if (seenModules.has(moduleKey)) {
      issues.push({
        code: "duplicate_module_definition",
        message: `duplicate module definition for ${moduleKey}`,
        at: moduleKey,
      });
      continue;
    }
    seenModules.add(moduleKey);

    for (const question of parsed.data.questions) {
      if (question.moduleCode !== parsed.data.moduleCode) {
        issues.push({
          code: "question_module_mismatch",
          message: `question declares module ${question.moduleCode} inside ${parsed.data.moduleCode}`,
          at: formatQuestionAddress(question),
        });
        continue;
      }
      const address = formatQuestionAddress(question);
      if (questions.has(address)) {
        issues.push({
          code: "duplicate_question",
          message: `duplicate question reference ${address}`,
          at: address,
        });
        continue;
      }
      questions.set(address, question);
    }
  }

  // Dependency-level integrity.
  const edges = new Map<string, string[]>();
  for (const [address, question] of questions) {
    edges.set(address, []);
    if (!question.dependency) continue;

    for (const condition of collectDependencyConditions(question.dependency)) {
      const target = formatQuestionAddress(condition.question);
      if (target === address) {
        issues.push({
          code: "self_dependency",
          message: `${address} depends on itself`,
          at: address,
        });
        continue;
      }
      const targetQuestion = questions.get(target);
      if (!targetQuestion) {
        issues.push({
          code: "dependency_target_missing",
          message: `${address} depends on unknown question ${target}`,
          at: address,
        });
        continue;
      }
      edges.get(address)!.push(target);

      if (!operatorAllowedForInput(condition.operator, targetQuestion.input)) {
        issues.push({
          code: "operator_input_incompatible",
          message: `operator ${condition.operator} is not valid for ${targetQuestion.input.kind} question ${target}`,
          at: address,
        });
        continue;
      }
      const valueCheck = valueCompatibleWithInput(condition, targetQuestion.input);
      if (valueCheck !== true) {
        issues.push({
          code: "dependency_value_incompatible",
          message: `${address} -> ${target}: ${valueCheck}`,
          at: address,
        });
      }
    }
  }

  // Cycle detection (includes cross-module cycles).
  const state = new Map<string, 0 | 1 | 2>();
  const reported = new Set<string>();
  const visit = (node: string, stack: string[]): void => {
    if (state.get(node) === 2) return;
    if (state.get(node) === 1) {
      const cycle = [...stack.slice(stack.indexOf(node)), node];
      const signature = [...cycle].sort().join("|");
      if (!reported.has(signature)) {
        reported.add(signature);
        issues.push({
          code: "dependency_cycle",
          message: `dependency cycle: ${cycle.join(" -> ")}`,
          at: node,
        });
      }
      return;
    }
    state.set(node, 1);
    for (const next of edges.get(node) ?? []) visit(next, [...stack, node]);
    state.set(node, 2);
  };
  for (const address of edges.keys()) visit(address, []);

  return { valid: issues.length === 0, issues };
}
