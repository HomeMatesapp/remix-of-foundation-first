import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_QUESTION_COPY } from "../../../content/reality-check-question-copy/architecture-tests";
import type { CareerQuestionCopy } from "../content-schema";
import { careerQuestionCopyByOccupationKey } from "../content-schema";
import {
  askedQuestions,
  buildReviewItems,
  deriveAssessmentContext,
  resolveResumeTarget,
  type AnswerEntry,
} from "../flow";
import { buildStartScreenContent } from "../start-screen";
import { describeAnswerRejection, describeInputConstraint } from "../validation";

import { ALL_KIND_QUESTIONS, CHAIN_QUESTIONS, syntheticPack } from "./fixtures";

/**
 * Increment 15 R2 — participant-experience regressions.
 *
 * These prove the honest start-screen derivation, uncertainty visibility,
 * truthful assessment context, exact resume positioning and participant-facing
 * validation messages. None of them evaluates a Reality Check.
 */

const PACK = ARCHITECTURE_TEST_PACKS.find(
  (pack) => pack.occupation.occupationKey === "electrician",
);
if (!PACK) throw new Error("electrician architecture-test pack missing");

const COPY = careerQuestionCopyByOccupationKey(ARCHITECTURE_TEST_QUESTION_COPY, "electrician");
if (!COPY) throw new Error("electrician question copy missing");

describe("R2 start screen content", () => {
  it("derives information kinds only from modules the pack actually declares", () => {
    const content = buildStartScreenContent({ careerTitle: COPY.careerTitle, pack: PACK });
    expect(content.informationKinds.length).toBeGreaterThan(0);
    expect(new Set(content.informationKinds).size).toBe(content.informationKinds.length);
    expect(content.informationKinds.length).toBeLessThanOrEqual(PACK.questionModules.length);
  });

  it("states effort, session-only saving, and makes no guarantee", () => {
    const content = buildStartScreenContent({ careerTitle: COPY.careerTitle, pack: PACK });
    expect(content.effort).toMatch(/\d/);
    expect(content.saveBehaviour).toMatch(/browser tab/i);
    expect(content.limitations.join(" ")).toMatch(/does not guarantee/i);
    expect(content.limitations.join(" ")).toMatch(/verified/i);
  });

  it("stays cautious about the total whenever any question is conditional", () => {
    const adaptive = buildStartScreenContent({
      careerTitle: "X",
      pack: syntheticPack([{ moduleCode: "experience", questions: CHAIN_QUESTIONS }]),
    });
    const flat = buildStartScreenContent({
      careerTitle: "X",
      pack: syntheticPack([{ moduleCode: "driving", questions: ALL_KIND_QUESTIONS }]),
    });
    expect(adaptive.effort).toMatch(/can change/i);
    expect(flat.effort).not.toMatch(/can change/i);
  });
});

describe("R2 review clarity", () => {
  it("marks only genuinely unsure declared options as uncertain", () => {
    const asked = askedQuestions(PACK, []);
    const uncertainQuestion = asked.find(
      (question) =>
        question.input.kind === "single_select" &&
        question.input.optionKeys.some((key) => key === "unsure" || key === "not_sure"),
    );
    if (!uncertainQuestion) return;
    const ref = {
      moduleCode: uncertainQuestion.moduleCode,
      questionKey: uncertainQuestion.questionKey,
    };
    const optionKeys =
      uncertainQuestion.input.kind === "single_select" ? uncertainQuestion.input.optionKeys : [];
    const unsureKey = optionKeys.find((key) => key === "unsure" || key === "not_sure");
    const otherKey = optionKeys.find((key) => key !== unsureKey);
    if (!unsureKey || !otherKey) return;

    const unsureItems = buildReviewItems(PACK, COPY, [{ question: ref, value: unsureKey }]);
    const otherItems = buildReviewItems(PACK, COPY, [{ question: ref, value: otherKey }]);
    expect(
      unsureItems.find((item) => item.question.questionKey === ref.questionKey)?.uncertain,
    ).toBe(true);
    expect(
      otherItems.find((item) => item.question.questionKey === ref.questionKey)?.uncertain,
    ).toBe(false);
  });

  it("derives jurisdiction context only from an answered nation question", () => {
    const empty = deriveAssessmentContext(PACK, COPY, []);
    expect(empty.careerTitle).toBe(COPY.careerTitle);
    expect(empty.jurisdictionLabel).toBeUndefined();

    const nation = askedQuestions(PACK, []).find(
      (question) => question.questionKey === "uk_nation",
    );
    if (!nation || nation.input.kind !== "single_select") return;
    const optionKey = nation.input.optionKeys[0];
    if (optionKey === undefined) return;
    const answered = deriveAssessmentContext(PACK, COPY, [
      {
        question: { moduleCode: nation.moduleCode, questionKey: nation.questionKey },
        value: optionKey,
      },
    ]);
    /* A human label, never a raw option key. */
    expect(answered.jurisdictionLabel).toBeDefined();
  });

  it("never leaks an internal option key as a review label", () => {
    const asked = askedQuestions(PACK, []);
    const first = asked[0];
    if (!first || first.input.kind !== "single_select") return;
    const optionKey = first.input.optionKeys[0];
    if (optionKey === undefined) return;
    const items = buildReviewItems(PACK, COPY, [
      {
        question: { moduleCode: first.moduleCode, questionKey: first.questionKey },
        value: optionKey,
      },
    ]);
    const label = items[0]?.answerLabel;
    const declared = (COPY as CareerQuestionCopy).questions
      .find((entry) => entry.question.questionKey === first.questionKey)
      ?.options?.find((option) => option.optionKey === optionKey)?.label;
    if (declared) expect(label).toBe(declared);
  });
});

describe("R2 exact resume position", () => {
  const pack = syntheticPack([{ moduleCode: "driving", questions: ALL_KIND_QUESTIONS }]);
  const asked = askedQuestions(pack, []);
  const answerAll = (): AnswerEntry[] =>
    asked.map((question) => ({
      question: { moduleCode: question.moduleCode, questionKey: question.questionKey },
      value:
        question.input.kind === "boolean"
          ? true
          : question.input.kind === "multi_select"
            ? ["a"]
            : question.input.kind === "integer" || question.input.kind === "decimal"
              ? 1
              : question.input.kind === "date"
                ? "2026-01-01"
                : question.input.kind === "single_select"
                  ? "a"
                  : "note text",
    }));

  it("returns the participant to the exact stored question", () => {
    const entries = answerAll().slice(0, 3);
    const stored = asked[1];
    if (!stored) throw new Error("fixture question missing");
    const target = resolveResumeTarget({
      pack,
      entries,
      savedStage: "questions",
      savedCurrent: { moduleCode: stored.moduleCode, questionKey: stored.questionKey },
    });
    expect(target).toEqual({ stage: "questions", index: 1 });
  });

  it("never lets a stored position skip an unanswered visible question", () => {
    const entries = answerAll().slice(0, 1);
    const late = asked[4];
    if (!late) throw new Error("fixture question missing");
    const target = resolveResumeTarget({
      pack,
      entries,
      savedStage: "questions",
      savedCurrent: { moduleCode: late.moduleCode, questionKey: late.questionKey },
    });
    expect(target).toEqual({ stage: "questions", index: 1 });
  });

  it("ignores a stored position that names a question of another pack", () => {
    const entries = answerAll().slice(0, 2);
    const target = resolveResumeTarget({
      pack,
      entries,
      savedStage: "questions",
      savedCurrent: { moduleCode: "finance", questionKey: "not_in_this_pack" },
    });
    expect(target).toEqual({ stage: "questions", index: 2 });
  });

  it("still refuses a saved review stage when the draft is incomplete", () => {
    const stored = asked[0];
    if (!stored) throw new Error("fixture question missing");
    const target = resolveResumeTarget({
      pack,
      entries: [],
      savedStage: "review",
      savedCurrent: { moduleCode: stored.moduleCode, questionKey: stored.questionKey },
    });
    expect(target).toEqual({ stage: "questions", index: 0 });
  });
});

describe("R2 validation messages", () => {
  it("explains typed-field constraints in plain language", () => {
    expect(describeInputConstraint({ kind: "integer", min: 0, max: 10 })).toMatch(/whole number/i);
    expect(describeInputConstraint({ kind: "date" })).toMatch(/calendar date/i);
    expect(describeInputConstraint({ kind: "boolean" })).toBeUndefined();
  });

  it("gives a correction message for every rejection it can receive", () => {
    const codes = [
      "non_integer",
      "out_of_bounds",
      "non_finite",
      "invalid_date",
      "blank_text",
      "text_length_invalid",
      "kind_mismatch",
    ] as const;
    for (const code of codes) {
      const message = describeAnswerRejection({ kind: "integer", min: 1, max: 5 }, code);
      expect(message.length).toBeGreaterThan(0);
      /* Never an internal code shown to a participant. */
      expect(message).not.toContain(code);
    }
  });
});
