import type { CareerPack } from "../../domain/career-packs";
import {
  formatQuestionAddress,
  isQuestionAsked,
  type AnswerMap,
  type QuestionAnswerValue,
  type QuestionDefinition,
  type QuestionRef,
} from "../../domain/questions";
import type { CoveragePackRef } from "../../domain/universal-coverage";

import { questionCopyFor, type CareerQuestionCopy, type QuestionCopy } from "./content-schema";
import { validateAnswerValue, type AnswerValidation } from "./validation";

/**
 * Increment 15 — pure Reality Check question-flow logic.
 *
 * It owns COLLECTION and CONFIRMATION of participant answers only. It never
 * runs the Decision Engine, never creates an Evidence Context, never derives a
 * requirement state, route outcome, score or judgement, and never touches the
 * network, a database, a clock or a browser API.
 *
 * Visibility comes from the CLOSED Increment 4 dependency semantics via
 * `isQuestionAsked`; there is deliberately no second dependency evaluator here.
 */

export interface AnswerEntry {
  readonly question: QuestionRef;
  readonly value: QuestionAnswerValue;
}

/* -------------------------------------------------------------------------- */
/* Canonical order and visibility                                             */
/* -------------------------------------------------------------------------- */

/**
 * Canonical authored question order: the Career Pack's declared
 * `questionModules` order, and within each module its declared question order.
 * No reordering, grouping or prioritisation is applied.
 */
export function orderedPackQuestions(pack: CareerPack): readonly QuestionDefinition[] {
  return pack.questionModules.flatMap((module) => module.questions);
}

export function toAnswerMap(entries: readonly AnswerEntry[]): AnswerMap {
  const map: Record<string, QuestionAnswerValue> = {};
  for (const entry of entries) map[formatQuestionAddress(entry.question)] = entry.value;
  return map;
}

export function answerFor(
  entries: readonly AnswerEntry[],
  ref: QuestionRef,
): QuestionAnswerValue | undefined {
  return entries.find(
    (entry) =>
      entry.question.moduleCode === ref.moduleCode &&
      entry.question.questionKey === ref.questionKey,
  )?.value;
}

/** Questions currently ASKED, in canonical order, using Increment 4 semantics. */
export function askedQuestions(
  pack: CareerPack,
  entries: readonly AnswerEntry[],
): readonly QuestionDefinition[] {
  const answers = toAnswerMap(entries);
  return orderedPackQuestions(pack).filter((question) => isQuestionAsked(question, answers));
}

/* -------------------------------------------------------------------------- */
/* Stale hidden answer pruning                                                */
/* -------------------------------------------------------------------------- */

export interface PruneResult {
  /** Still-visible answers, value-for-value unchanged, in canonical order. */
  readonly entries: readonly AnswerEntry[];
  /** Answers removed because their question is no longer asked. */
  readonly removed: readonly QuestionRef[];
}

/**
 * Removes answers to questions that are no longer asked, repeatedly until a
 * fixed point is reached, so a multi-level dependency chain cannot leave a
 * hidden answer behind to contaminate later assessment.
 *
 * Surviving answers are preserved exactly: no trimming, coercion or rewriting.
 */
export function pruneStaleAnswers(pack: CareerPack, entries: readonly AnswerEntry[]): PruneResult {
  const ordered = orderedPackQuestions(pack);
  const byAddress = new Map(ordered.map((question) => [formatQuestionAddress(question), question]));

  /* Answers for refs absent from this pack can never be kept. */
  let current = entries.filter((entry) => byAddress.has(formatQuestionAddress(entry.question)));
  const removed: QuestionRef[] = entries
    .filter((entry) => !byAddress.has(formatQuestionAddress(entry.question)))
    .map((entry) => entry.question);

  for (;;) {
    const answers = toAnswerMap(current);
    const visible = new Set(
      ordered
        .filter((question) => isQuestionAsked(question, answers))
        .map((question) => formatQuestionAddress(question)),
    );
    const next = current.filter((entry) => visible.has(formatQuestionAddress(entry.question)));
    if (next.length === current.length) break;
    for (const entry of current) {
      if (!visible.has(formatQuestionAddress(entry.question))) removed.push(entry.question);
    }
    current = next;
  }

  const order = new Map(ordered.map((question, index) => [formatQuestionAddress(question), index]));
  const sorted = current
    .slice()
    .sort(
      (left, right) =>
        (order.get(formatQuestionAddress(left.question)) ?? 0) -
        (order.get(formatQuestionAddress(right.question)) ?? 0),
    );

  return { entries: sorted, removed };
}

/* -------------------------------------------------------------------------- */
/* Answer application                                                         */
/* -------------------------------------------------------------------------- */

export type ApplyAnswerResult =
  | {
      readonly ok: true;
      readonly entries: readonly AnswerEntry[];
      readonly removed: readonly QuestionRef[];
    }
  | { readonly ok: false; readonly validation: AnswerValidation };

/**
 * Validates a candidate answer against the exact pack question input and, on
 * success, returns the pruned draft answer set.
 */
export function applyAnswer(
  pack: CareerPack,
  entries: readonly AnswerEntry[],
  ref: QuestionRef,
  value: QuestionAnswerValue,
): ApplyAnswerResult {
  const question = orderedPackQuestions(pack).find(
    (candidate) =>
      candidate.moduleCode === ref.moduleCode && candidate.questionKey === ref.questionKey,
  );
  if (!question) return { ok: false, validation: { ok: false, code: "unknown_question_ref" } };

  const validation = validateAnswerValue(question.input, value);
  if (!validation.ok) return { ok: false, validation };

  const others = entries.filter(
    (entry) => formatQuestionAddress(entry.question) !== formatQuestionAddress(ref),
  );
  const pruned = pruneStaleAnswers(pack, [
    ...others,
    { question: { moduleCode: question.moduleCode, questionKey: question.questionKey }, value },
  ]);
  return { ok: true, entries: pruned.entries, removed: pruned.removed };
}

/* -------------------------------------------------------------------------- */
/* Review and confirmation                                                    */
/* -------------------------------------------------------------------------- */

export interface ReviewItem {
  readonly question: QuestionRef;
  readonly prompt: string;
  /** Human-readable confirmed answer. Never an internal key. */
  readonly answerLabel: string;
  /**
   * True only when the participant selected a declared option whose PRESENTATION
   * meaning is "not sure". It is never derived from a requirement, rule or
   * assessment outcome.
   */
  readonly uncertain: boolean;
}

/**
 * Declared option keys whose authored presentation meaning is uncertainty.
 * Nothing is inferred from any other option.
 */
export const UNCERTAIN_OPTION_KEYS: readonly string[] = Object.freeze([
  "unsure",
  "not_sure",
  "do_not_know",
  "dont_know",
]);

function isUncertainValue(value: QuestionAnswerValue): boolean {
  if (typeof value === "string") return UNCERTAIN_OPTION_KEYS.includes(value);
  if (Array.isArray(value)) return value.some((entry) => UNCERTAIN_OPTION_KEYS.includes(entry));
  return false;
}

/** Human-readable display for a confirmed answer value. */
export function formatAnswerLabel(
  copy: QuestionCopy | undefined,
  value: QuestionAnswerValue,
): string {
  const labelFor = (key: string): string =>
    copy?.options?.find((option) => option.optionKey === key)?.label ?? key;

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map((entry) => labelFor(entry)).join(", ");
  if (typeof value === "number") {
    return copy?.valueHint ? `${value} ${copy.valueHint.toLowerCase()}` : String(value);
  }
  return labelFor(value);
}

/**
 * Every currently asked question that has a confirmed answer, in canonical
 * order. Answers to hidden questions are never included.
 */
export function buildReviewItems(
  pack: CareerPack,
  copy: CareerQuestionCopy,
  entries: readonly AnswerEntry[],
): readonly ReviewItem[] {
  return askedQuestions(pack, entries).flatMap((question) => {
    const ref = { moduleCode: question.moduleCode, questionKey: question.questionKey };
    const value = answerFor(entries, ref);
    if (value === undefined) return [];
    const questionCopy = questionCopyFor(copy, ref);
    return [
      {
        question: ref,
        prompt: questionCopy?.prompt ?? "",
        answerLabel: formatAnswerLabel(questionCopy, value),
        uncertain: isUncertainValue(value),
      },
    ];
  });
}

/**
 * Question keys whose declared purpose is the UK nation / jurisdiction a route
 * is assessed against. Only a genuinely answered question of this kind can
 * produce assessment context; nothing is defaulted to any nation.
 */
const JURISDICTION_QUESTION_KEYS: readonly string[] = Object.freeze([
  "uk_nation",
  "nation",
  "jurisdiction",
]);

/**
 * Truthful assessment context derived ONLY from governed data: the canonical
 * career title plus, where the pack genuinely asks it, the participant's own
 * answer to a nation/jurisdiction question. Never a fabricated default.
 */
export function deriveAssessmentContext(
  pack: CareerPack,
  copy: CareerQuestionCopy,
  entries: readonly AnswerEntry[],
): { readonly careerTitle: string; readonly jurisdictionLabel: string | undefined } {
  for (const question of askedQuestions(pack, entries)) {
    if (!JURISDICTION_QUESTION_KEYS.includes(question.questionKey)) continue;
    const ref = { moduleCode: question.moduleCode, questionKey: question.questionKey };
    const value = answerFor(entries, ref);
    if (value === undefined) continue;
    return {
      careerTitle: copy.careerTitle,
      jurisdictionLabel: formatAnswerLabel(questionCopyFor(copy, ref), value),
    };
  }
  return { careerTitle: copy.careerTitle, jurisdictionLabel: undefined };
}

/** Immutable feature-local confirmed answer set. Not a persisted artefact. */
export interface ConfirmedAnswerSet {
  readonly occupationKey: string;
  readonly pack: CoveragePackRef;
  readonly answers: readonly AnswerEntry[];
}

export type ConfirmationResult =
  | { readonly ok: true; readonly confirmed: ConfirmedAnswerSet }
  | { readonly ok: false; readonly missing: readonly QuestionRef[] };

/**
 * Final confirmation. Every currently asked question must carry one structurally
 * valid answer. This produces an answer set only: no evaluation, no evidence
 * context and no judgement.
 */
export function confirmAnswers(input: {
  readonly pack: CareerPack;
  readonly packRef: CoveragePackRef;
  readonly occupationKey: string;
  readonly entries: readonly AnswerEntry[];
}): ConfirmationResult {
  const pruned = pruneStaleAnswers(input.pack, input.entries);
  const missing: QuestionRef[] = [];

  for (const question of askedQuestions(input.pack, pruned.entries)) {
    const ref = { moduleCode: question.moduleCode, questionKey: question.questionKey };
    const value = answerFor(pruned.entries, ref);
    if (value === undefined || !validateAnswerValue(question.input, value).ok) missing.push(ref);
  }
  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    confirmed: Object.freeze({
      occupationKey: input.occupationKey,
      pack: Object.freeze({ ...input.packRef }),
      answers: Object.freeze(
        pruned.entries.map((entry) =>
          Object.freeze({
            question: Object.freeze({ ...entry.question }),
            value: Array.isArray(entry.value) ? Object.freeze([...entry.value]) : entry.value,
          }),
        ),
      ) as readonly AnswerEntry[],
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Resume and traversal targets                                               */
/* -------------------------------------------------------------------------- */

/**
 * Where the participant should be placed. Pure: the controller renders it and
 * derives no independent sequencing of its own.
 */
export type FlowTarget =
  { readonly stage: "review" } | { readonly stage: "questions"; readonly index: number };

function indexOfFirstUnanswered(
  questions: readonly QuestionDefinition[],
  entries: readonly AnswerEntry[],
  after = -1,
): number {
  return questions.findIndex(
    (question, index) =>
      index > after &&
      answerFor(entries, {
        moduleCode: question.moduleCode,
        questionKey: question.questionKey,
      }) === undefined,
  );
}

/**
 * Resume target for a restored browser-session draft.
 *
 * A stored current-question ref is a HINT, never authority: it is honoured only
 * when that exact question exists in this pack, is currently asked after
 * pruning, and no earlier currently asked question is unanswered-and-skippable.
 * A saved `review` stage is honoured ONLY when every CURRENTLY asked question
 * still carries an answer. Anything absent, hidden, stale or unknown falls back
 * safely to the first missing visible question, or review when complete.
 */
export function resolveResumeTarget(input: {
  readonly pack: CareerPack;
  readonly entries: readonly AnswerEntry[];
  readonly savedStage: "questions" | "review" | undefined;
  readonly savedCurrent?: QuestionRef | undefined;
}): FlowTarget {
  const asked = askedQuestions(input.pack, input.entries);
  const missing = indexOfFirstUnanswered(asked, input.entries);
  /* A saved review stage cannot survive a draft that is no longer complete. */
  if (missing === -1 && input.savedStage === "review") return { stage: "review" };

  if (input.savedCurrent) {
    const savedAddress = formatQuestionAddress(input.savedCurrent);
    const storedIndex = asked.findIndex(
      (question) => formatQuestionAddress(question) === savedAddress,
    );
    /*
     * The stored position may only move the participant BACK to or onto the
     * first unanswered visible question; it can never skip one.
     */
    if (storedIndex !== -1 && (missing === -1 || storedIndex <= missing)) {
      return { stage: "questions", index: storedIndex };
    }
  }

  return { stage: "questions", index: missing === -1 ? Math.max(asked.length - 1, 0) : missing };
}

/**
 * Target after an answer is applied.
 *
 * The next currently asked unanswered question after the answered one wins; if
 * there is none, any earlier unanswered asked question (which an edit may have
 * revealed) wins; only when nothing visible is unanswered does review follow.
 */
export function resolveNextTarget(input: {
  readonly pack: CareerPack;
  readonly entries: readonly AnswerEntry[];
  readonly answered: QuestionRef;
}): FlowTarget {
  const asked = askedQuestions(input.pack, input.entries);
  const answeredIndex = asked.findIndex(
    (question) => formatQuestionAddress(question) === formatQuestionAddress(input.answered),
  );
  const after = indexOfFirstUnanswered(asked, input.entries, answeredIndex);
  if (after !== -1) return { stage: "questions", index: after };
  const anywhere = indexOfFirstUnanswered(asked, input.entries);
  if (anywhere !== -1) return { stage: "questions", index: anywhere };
  return { stage: "review" };
}
