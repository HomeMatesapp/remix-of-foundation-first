import { z } from "zod";

import { QUESTION_MODULE_CODES } from "../../domain/questions";

/**
 * Increment 15 — participant-facing Reality Check QUESTION presentation content.
 *
 * The frozen Increment 4 question framework and the frozen Increment 5 canonical
 * Career Pack deliberately carry NO participant prompts and NO option labels.
 * This separate presentation layer supplies that copy, keyed by exact
 * `{ moduleCode, questionKey }` question identity, exactly as Increment 14 keyed
 * career overview copy by canonical occupation identity.
 *
 * Hard boundaries encoded here:
 * - presentation copy is NEVER assessment truth;
 * - no requirement, route, judgement, score, confidence or threshold field;
 * - option labels map one-to-one onto the Career Pack's own stable option keys;
 *   a label can never carry a value different from its key;
 * - no participant-facing exposure of internal module/question/option keys.
 */

const NON_BLANK = z.string().trim().min(1);
const PROMPT = NON_BLANK.max(220);
const HELP = NON_BLANK.max(300);
const LABEL = NON_BLANK.max(160);
const STABLE_KEY = z.string().regex(/^[a-z][a-z0-9_]*$/, "stable keys are lower snake_case");

/** Exact question identity, matching the frozen Increment 4 question reference. */
export const questionCopyRefSchema = z
  .object({ moduleCode: z.enum(QUESTION_MODULE_CODES), questionKey: STABLE_KEY })
  .strict();
export type QuestionCopyRef = z.infer<typeof questionCopyRefSchema>;

/**
 * One participant option label bound to one exact declared option key.
 *
 * The key is the ONLY value that can ever become an answer; the label is display
 * copy and is never parsed back into meaning.
 */
export const questionOptionCopySchema = z.object({ optionKey: STABLE_KEY, label: LABEL }).strict();
export type QuestionOptionCopy = z.infer<typeof questionOptionCopySchema>;

/** Participant presentation content for exactly one Career Pack question. */
export const questionCopySchema = z
  .object({
    question: questionCopyRefSchema,
    prompt: PROMPT,
    /** Short plain-English clarification of what the question means. */
    helpText: HELP.optional(),
    /** Honest explanation of why the question is consequential. */
    whyWeAsk: HELP.optional(),
    /**
     * Reviewed participant-facing wording stating whether anything may need to
     * be confirmed or evidenced later. Presentation only: it is never assessment
     * truth, never a requirement, and can never change a canonical answer value
     * or any Decision Engine semantics. Deliberately reviewed wording rather
     * than a boolean, so nothing here can overclaim.
     */
    evidenceLater: HELP,
    /** Exact one-to-one labels for select inputs. Absent for other kinds. */
    options: z.array(questionOptionCopySchema).min(2).max(12).optional(),

    /** Display hint for numeric/date inputs, e.g. `Years`. Never a bound. */
    valueHint: LABEL.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = (value.options ?? []).map((option) => option.optionKey);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "option keys must be unique",
      });
    }
    const labels = (value.options ?? []).map((option) => option.label.toLowerCase());
    if (new Set(labels).size !== labels.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "option labels must be distinct",
      });
    }
    for (const [index, option] of (value.options ?? []).entries()) {
      /* A stable key must never be shown to a participant as its own label. */
      if (option.label.trim() === option.optionKey) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options", index, "label"],
          message: "option label must not be the internal option key",
        });
      }
    }
  });
export type QuestionCopy = z.infer<typeof questionCopySchema>;

/** All question presentation content for exactly one supported occupation. */
export const careerQuestionCopySchema = z
  .object({
    occupationKey: STABLE_KEY,
    careerPackId: z.string().uuid(),
    /** Participant-facing career title, matching the canonical occupation title. */
    careerTitle: LABEL,
    questions: z.array(questionCopySchema).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, entry] of value.questions.entries()) {
      const address = `${entry.question.moduleCode}:${entry.question.questionKey}`;
      if (seen.has(address)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "question"],
          message: `duplicate question presentation entry ${address}`,
        });
      }
      seen.add(address);
    }
  });
export type CareerQuestionCopy = z.infer<typeof careerQuestionCopySchema>;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

/** Parses and deep-freezes authored question copy. Fails closed on any defect. */
export function parseCareerQuestionCopySet(
  input: readonly unknown[],
): readonly CareerQuestionCopy[] {
  const parsed = input.map((entry) => careerQuestionCopySchema.parse(entry));
  const keys = parsed.map((entry) => entry.occupationKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error("duplicate occupationKey in question copy set");
  }
  return deepFreeze(parsed) as readonly CareerQuestionCopy[];
}

/** Exact occupation lookup. Never a fuzzy or partial match. */
export function careerQuestionCopyByOccupationKey(
  set: readonly CareerQuestionCopy[],
  occupationKey: string,
): CareerQuestionCopy | undefined {
  return set.find((entry) => entry.occupationKey === occupationKey);
}

/** Exact question lookup within one career's authored copy. */
export function questionCopyFor(
  copy: CareerQuestionCopy,
  ref: QuestionCopyRef,
): QuestionCopy | undefined {
  return copy.questions.find(
    (entry) =>
      entry.question.moduleCode === ref.moduleCode &&
      entry.question.questionKey === ref.questionKey,
  );
}
