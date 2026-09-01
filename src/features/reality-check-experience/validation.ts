import { isCalendarDate } from "../../domain/questions";
import type { QuestionAnswerValue, QuestionInput } from "../../domain/questions";

/**
 * Increment 15 input-boundary answer validation.
 *
 * This is presentation/input-boundary validation only. It enforces exactly the
 * structural facts the frozen Career Pack question input already declares and
 * invents nothing: no eligibility rule, no threshold, no requirement state and
 * no judgement. Values that fail here never enter the draft.
 *
 * It deliberately mirrors Increment 8 answer-value semantics rather than forking
 * or widening any closed domain API.
 */

export const ANSWER_REJECTION_CODES = Object.freeze([
  "unknown_question_ref",
  "kind_mismatch",
  "undeclared_option",
  "empty_multi_select",
  "duplicate_multi_select",
  "non_integer",
  "non_finite",
  "out_of_bounds",
  "blank_text",
  "text_length_invalid",
  "invalid_date",
] as const);
export type AnswerRejectionCode = (typeof ANSWER_REJECTION_CODES)[number];

export type AnswerValidation =
  { readonly ok: true } | { readonly ok: false; readonly code: AnswerRejectionCode };

const REJECT = (code: AnswerRejectionCode): AnswerValidation => ({ ok: false, code });
const ACCEPT: AnswerValidation = { ok: true };

function validateNumber(
  value: QuestionAnswerValue,
  bounds: { readonly min?: number | undefined; readonly max?: number | undefined },
  requireInteger: boolean,
): AnswerValidation {
  if (typeof value !== "number") return REJECT("kind_mismatch");
  if (!Number.isFinite(value)) return REJECT("non_finite");
  if (requireInteger && !Number.isInteger(value)) return REJECT("non_integer");
  if (bounds.min !== undefined && value < bounds.min) return REJECT("out_of_bounds");
  if (bounds.max !== undefined && value > bounds.max) return REJECT("out_of_bounds");
  return ACCEPT;
}

/**
 * Validates one candidate answer against the exact declared input.
 *
 * Typed text is only ever a valid answer to a question whose declared kind is
 * `text`. It is never converted into a boolean, option key, number or date.
 */
export function validateAnswerValue(
  input: QuestionInput,
  value: QuestionAnswerValue,
): AnswerValidation {
  switch (input.kind) {
    case "boolean":
      return typeof value === "boolean" ? ACCEPT : REJECT("kind_mismatch");

    case "single_select": {
      if (typeof value !== "string") return REJECT("kind_mismatch");
      return input.optionKeys.includes(value) ? ACCEPT : REJECT("undeclared_option");
    }

    case "multi_select": {
      if (!Array.isArray(value)) return REJECT("kind_mismatch");
      if (value.length === 0) return REJECT("empty_multi_select");
      if (new Set(value).size !== value.length) return REJECT("duplicate_multi_select");
      for (const entry of value) {
        if (typeof entry !== "string") return REJECT("kind_mismatch");
        if (!input.optionKeys.includes(entry)) return REJECT("undeclared_option");
      }
      return ACCEPT;
    }

    case "integer":
      return validateNumber(value, input, true);

    case "decimal":
      return validateNumber(value, input, false);

    case "text": {
      if (typeof value !== "string") return REJECT("kind_mismatch");
      if (value.trim().length === 0) return REJECT("blank_text");
      if (input.minLength !== undefined && value.length < input.minLength) {
        return REJECT("text_length_invalid");
      }
      if (input.maxLength !== undefined && value.length > input.maxLength) {
        return REJECT("text_length_invalid");
      }
      return ACCEPT;
    }

    case "date": {
      if (typeof value !== "string") return REJECT("kind_mismatch");
      return isCalendarDate(value) ? ACCEPT : REJECT("invalid_date");
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Participant-facing correction messages                                     */
/* -------------------------------------------------------------------------- */

function rangeClause(input: {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}): string {
  if (input.min !== undefined && input.max !== undefined) {
    return ` between ${input.min} and ${input.max}`;
  }
  if (input.min !== undefined) return ` of ${input.min} or more`;
  if (input.max !== undefined) return ` of ${input.max} or less`;
  return "";
}

/**
 * Plain-English statement of the constraints the declared input ALREADY carries.
 *
 * This restates declared structure only. It never adds a bound, rule or
 * eligibility meaning of its own.
 */
export function describeInputConstraint(input: QuestionInput): string | undefined {
  switch (input.kind) {
    case "integer":
      return `Enter a whole number${rangeClause(input)}.`;
    case "decimal":
      return `Enter a number${rangeClause(input)}.`;
    case "date":
      return "Enter a real calendar date.";
    case "text": {
      if (input.minLength !== undefined && input.maxLength !== undefined) {
        return `Enter between ${input.minLength} and ${input.maxLength} characters.`;
      }
      if (input.minLength !== undefined) return `Enter at least ${input.minLength} characters.`;
      if (input.maxLength !== undefined) return `Enter up to ${input.maxLength} characters.`;
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * Field-adjacent correction message for a rejected typed answer.
 *
 * It explains only how to satisfy the declared input. It never states whether an
 * answer is good, sufficient or acceptable for any career requirement.
 */
export function describeAnswerRejection(input: QuestionInput, code: AnswerRejectionCode): string {
  const constraint = describeInputConstraint(input);
  switch (code) {
    case "non_integer":
      return `That needs to be a whole number.${constraint ? ` ${constraint}` : ""}`;
    case "out_of_bounds":
      return constraint ?? "That amount is outside the range this question accepts.";
    case "non_finite":
      return constraint ?? "Enter a number.";
    case "invalid_date":
      return "That is not a real calendar date. Enter a date such as 2026-03-14.";
    case "blank_text":
      return "Enter an answer before continuing.";
    case "text_length_invalid":
      return constraint ?? "That answer is the wrong length.";
    default:
      return constraint ?? "That answer cannot be accepted as it stands. Please check it.";
  }
}
