import { z } from "zod";

import type { CareerPack } from "../../domain/career-packs";
import {
  QUESTION_MODULE_CODES,
  formatQuestionAddress,
  type QuestionRef,
} from "../../domain/questions";
import type { CoveragePackRef } from "../../domain/universal-coverage";

import { orderedPackQuestions, pruneStaleAnswers, type AnswerEntry } from "./flow";
import { validateAnswerValue } from "./validation";

/**
 * Increment 15 — narrowly scoped BROWSER-SESSION draft only.
 *
 * This is deliberately `sessionStorage`, never `localStorage`, never a cookie,
 * never IndexedDB and never a database or account-backed save. Durable
 * account-backed assessment persistence would require a new schema and an
 * explicit hard-gate decision, so it is out of scope here.
 *
 * The draft carries no participant, user or institution identity, no result,
 * judgement, evidence context or location data. It is keyed by exact occupation
 * plus the exact Career Pack content hash, so a changed pack can never silently
 * resume stale answers. Anything malformed, unknown or invalid is DISCARDED
 * rather than coerced.
 */

export const REALITY_CHECK_DRAFT_SCHEMA_VERSION = "1.0.0" as const;

const answerValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number(),
  z.array(z.string()).min(1),
]);

const draftSchema = z
  .object({
    draftSchemaVersion: z.literal(REALITY_CHECK_DRAFT_SCHEMA_VERSION),
    occupationKey: z.string().min(1),
    pack: z
      .object({
        careerPackId: z.string().uuid(),
        version: z.string().min(1),
        contentHash: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
    answers: z
      .array(
        z
          .object({
            question: z
              .object({
                /* An unknown module code can never be coerced into a valid ref. */
                moduleCode: z.enum(QUESTION_MODULE_CODES),
                questionKey: z.string().min(1),
              })
              .strict(),
            value: answerValueSchema,
          })
          .strict(),
      )
      .max(200)
      /* Duplicate question identities are MALFORMED, never merged or preferred. */
      .superRefine((answers, ctx) => {
        const seen = new Set<string>();
        for (const answer of answers) {
          const address = formatQuestionAddress(answer.question);
          if (seen.has(address)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "duplicate question ref in stored draft",
            });
            return;
          }
          seen.add(address);
        }
      }),
    /** Optional resume position only. Never a result or a stage claim. */
    stage: z.enum(["questions", "review"]).optional(),
    /**
     * Optional STABLE question identity the participant was last on. It is a
     * position hint only, never authority: it is reconciled against the exact
     * pack and current visibility on load, and never a raw index.
     */
    currentQuestion: z
      .object({ moduleCode: z.enum(QUESTION_MODULE_CODES), questionKey: z.string().min(1) })
      .strict()
      .optional(),
  })
  .strict();

export type RealityCheckDraft = z.infer<typeof draftSchema>;

/** Storage key bound to exact occupation plus exact pack content hash. */
export function draftStorageKey(occupationKey: string, packRef: CoveragePackRef): string {
  return `clear-routes:reality-check-draft:v${REALITY_CHECK_DRAFT_SCHEMA_VERSION}:${occupationKey}:${packRef.contentHash}`;
}

/** Session storage, or `null` when unavailable. Never throws. */
function session(): Storage | null {
  try {
    if (typeof globalThis.sessionStorage === "undefined") return null;
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export interface LoadedDraft {
  readonly answers: readonly AnswerEntry[];
  readonly stage: "questions" | "review" | undefined;
  /** Stored position hint, present only when it names a question of this pack. */
  readonly currentQuestion: QuestionRef | undefined;
}

/**
 * Loads a draft for exactly this occupation and pack ref, or `undefined`.
 *
 * Fails closed on: malformed JSON, wrong schema version, mismatched occupation
 * or pack ref, unknown question refs, and any structurally invalid answer value.
 */
export function loadDraft(input: {
  readonly occupationKey: string;
  readonly packRef: CoveragePackRef;
  readonly pack: CareerPack;
}): LoadedDraft | undefined {
  const store = session();
  if (!store) return undefined;

  let raw: string | null = null;
  try {
    raw = store.getItem(draftStorageKey(input.occupationKey, input.packRef));
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;

  let parsed: RealityCheckDraft;
  try {
    parsed = draftSchema.parse(JSON.parse(raw));
  } catch {
    discardDraft(input.occupationKey, input.packRef);
    return undefined;
  }

  const refMatches =
    parsed.occupationKey === input.occupationKey &&
    parsed.pack.careerPackId === input.packRef.careerPackId &&
    parsed.pack.version === input.packRef.version &&
    parsed.pack.contentHash === input.packRef.contentHash;
  if (!refMatches) {
    discardDraft(input.occupationKey, input.packRef);
    return undefined;
  }

  const byAddress = new Map(
    orderedPackQuestions(input.pack).map((question) => [formatQuestionAddress(question), question]),
  );
  const entries: AnswerEntry[] = [];
  for (const answer of parsed.answers) {
    const question = byAddress.get(formatQuestionAddress(answer.question));
    if (!question) {
      discardDraft(input.occupationKey, input.packRef);
      return undefined;
    }
    if (!validateAnswerValue(question.input, answer.value).ok) {
      discardDraft(input.occupationKey, input.packRef);
      return undefined;
    }
    entries.push({
      question: { moduleCode: question.moduleCode, questionKey: question.questionKey },
      value: answer.value,
    });
  }

  const pruned = pruneStaleAnswers(input.pack, entries);
  /*
   * An unknown stored ref is discarded rather than trusted; visibility and
   * staleness are reconciled by the pure resume resolver, not here.
   */
  const storedCurrent = parsed.currentQuestion
    ? byAddress.get(formatQuestionAddress(parsed.currentQuestion))
    : undefined;
  return {
    answers: pruned.entries,
    stage: parsed.stage,
    currentQuestion: storedCurrent
      ? { moduleCode: storedCurrent.moduleCode, questionKey: storedCurrent.questionKey }
      : undefined,
  };
}

/** Writes the current draft. Silently no-ops when storage is unavailable. */
export function saveDraft(input: {
  readonly occupationKey: string;
  readonly packRef: CoveragePackRef;
  readonly answers: readonly AnswerEntry[];
  readonly stage?: "questions" | "review" | undefined;
  readonly currentQuestion?: QuestionRef | undefined;
}): void {
  const store = session();
  if (!store) return;
  const payload: RealityCheckDraft = {
    draftSchemaVersion: REALITY_CHECK_DRAFT_SCHEMA_VERSION,
    occupationKey: input.occupationKey,
    pack: { ...input.packRef },
    answers: input.answers.map((entry) => ({
      question: { ...entry.question },
      value: Array.isArray(entry.value) ? [...entry.value] : entry.value,
    })),
    ...(input.stage ? { stage: input.stage } : {}),
    ...(input.currentQuestion ? { currentQuestion: { ...input.currentQuestion } } : {}),
  };
  try {
    store.setItem(
      draftStorageKey(input.occupationKey, input.packRef),
      JSON.stringify(draftSchema.parse(payload)),
    );
  } catch {
    /* Storage quota or unavailability must never break the flow. */
  }
}

/** Removes only this feature's draft for this exact occupation and pack ref. */
export function discardDraft(occupationKey: string, packRef: CoveragePackRef): void {
  const store = session();
  if (!store) return;
  try {
    store.removeItem(draftStorageKey(occupationKey, packRef));
  } catch {
    /* Nothing to recover: the draft is disposable by design. */
  }
}
