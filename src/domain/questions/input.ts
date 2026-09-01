import { z } from "zod";

import { stableKeySchema } from "../contracts";

/**
 * Typed input specifications.
 *
 * Structural DATA shapes only. Validation metadata is input-shape validation; it
 * must never imply eligibility, requirement or route rules. No participant-facing
 * labels, prompts, help text or option labels exist here.
 */

/** Stable internal option key. Never a participant-facing option label. */
export const questionOptionKeySchema = stableKeySchema;

const optionKeysSchema = z
  .array(questionOptionKeySchema)
  .min(1, "must declare at least one option key")
  .refine((keys) => new Set(keys).size === keys.length, "option keys must be unique");

const numericBounds = {
  /** Structural lower bound for accepted input values. Not an eligibility threshold. */
  min: z.number().optional(),
  /** Structural upper bound for accepted input values. Not an eligibility threshold. */
  max: z.number().optional(),
  /** Stable internal unit key (e.g. `gbp`, `hours_per_week`). Not a display unit. */
  unitKey: stableKeySchema.optional(),
};

function boundsOrdered(value: { min?: number | undefined; max?: number | undefined }): boolean {
  if (value.min === undefined || value.max === undefined) return true;
  return value.min <= value.max;
}

export const booleanInputSchema = z.object({ kind: z.literal("boolean") }).strict();

export const singleSelectInputSchema = z
  .object({ kind: z.literal("single_select"), optionKeys: optionKeysSchema })
  .strict();

export const multiSelectInputSchema = z
  .object({ kind: z.literal("multi_select"), optionKeys: optionKeysSchema })
  .strict();

export const integerInputSchema = z
  .object({ kind: z.literal("integer"), ...numericBounds })
  .strict()
  .refine((v) => v.min === undefined || Number.isInteger(v.min), "min must be an integer")
  .refine((v) => v.max === undefined || Number.isInteger(v.max), "max must be an integer")
  .refine(boundsOrdered, "min must not exceed max");

export const decimalInputSchema = z
  .object({ kind: z.literal("decimal"), ...numericBounds })
  .strict()
  .refine(boundsOrdered, "min must not exceed max");

export const textInputSchema = z
  .object({
    kind: z.literal("text"),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (v) => v.minLength === undefined || v.maxLength === undefined || v.minLength <= v.maxLength,
    "minLength must not exceed maxLength",
  );

/**
 * Date is carried as a structural kind only. No date arithmetic, timezone
 * handling or age derivation exists in this framework.
 */
export const dateInputSchema = z.object({ kind: z.literal("date") }).strict();

/**
 * A plain union (not a discriminated union) because several variants carry
 * structural bound refinements.
 */
export const questionInputSchema = z.union([
  booleanInputSchema,
  singleSelectInputSchema,
  multiSelectInputSchema,
  integerInputSchema,
  decimalInputSchema,
  textInputSchema,
  dateInputSchema,
]);
export type QuestionInput = z.infer<typeof questionInputSchema>;

/**
 * Framework-level answer value union, aligned with the input kinds and
 * sufficient for dependency evaluation only. This is NOT an answer snapshot,
 * persistence or versioning contract.
 */
export const questionAnswerValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number(),
  z.array(z.string()),
]);
export type QuestionAnswerValue = z.infer<typeof questionAnswerValueSchema>;

/** Input kinds whose answers are numeric. */
export const NUMERIC_INPUT_KINDS = ["integer", "decimal"] as const;
/** Input kinds whose answers are lists of stable option keys. */
export const LIST_INPUT_KINDS = ["multi_select"] as const;
