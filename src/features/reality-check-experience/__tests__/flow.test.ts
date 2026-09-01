import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_QUESTION_COPY } from "../../../content/reality-check-question-copy/architecture-tests";
import { hashCanonicalCareerPack } from "../../../domain/career-pack-governance";
import { formatQuestionAddress } from "../../../domain/questions";
import { careerQuestionCopyByOccupationKey } from "../content-schema";
import {
  answerFor,
  applyAnswer,
  askedQuestions,
  buildReviewItems,
  confirmAnswers,
  orderedPackQuestions,
  pruneStaleAnswers,
  resolveNextTarget,
  resolveResumeTarget,
  type AnswerEntry,
} from "../flow";
import { validateAnswerValue } from "../validation";

import { ALL_KIND_QUESTIONS, CHAIN_QUESTIONS, syntheticPack } from "./fixtures";

const ELECTRICIAN = ARCHITECTURE_TEST_PACKS.find(
  (pack) => pack.occupation.occupationKey === "electrician",
);
if (!ELECTRICIAN) throw new Error("electrician architecture-test pack missing");

const PACK_REF = {
  careerPackId: ELECTRICIAN.careerPackId,
  version: ELECTRICIAN.version,
  /* Real recomputed truth, never an arbitrary fake hash. */
  contentHash: hashCanonicalCareerPack(ELECTRICIAN),
};

function answerEveryAskedQuestion(pack = ELECTRICIAN!): readonly AnswerEntry[] {
  let entries: readonly AnswerEntry[] = [];
  for (;;) {
    const next = askedQuestions(pack, entries).find(
      (question) =>
        answerFor(entries, {
          moduleCode: question.moduleCode,
          questionKey: question.questionKey,
        }) === undefined,
    );
    if (!next) return entries;
    const value =
      next.input.kind === "integer" || next.input.kind === "decimal"
        ? 3
        : next.input.kind === "single_select"
          ? next.input.optionKeys[0]!
          : next.input.kind === "multi_select"
            ? [next.input.optionKeys[0]!]
            : next.input.kind === "boolean"
              ? true
              : next.input.kind === "date"
                ? "2026-01-31"
                : "text answer";
    const result = applyAnswer(
      pack,
      entries,
      { moduleCode: next.moduleCode, questionKey: next.questionKey },
      value,
    );
    expect(result.ok).toBe(true);
    if (result.ok) entries = result.entries;
  }
}

describe("canonical order and visibility", () => {
  it("preserves the pack's declared module and question order", () => {
    const expected = ELECTRICIAN.questionModules.flatMap((module) =>
      module.questions.map((question) => formatQuestionAddress(question)),
    );
    expect(orderedPackQuestions(ELECTRICIAN).map((q) => formatQuestionAddress(q))).toEqual(
      expected,
    );
  });

  it("uses Increment 4 dependency semantics for visibility", () => {
    const pack = syntheticPack([{ moduleCode: "experience", questions: CHAIN_QUESTIONS }]);
    expect(askedQuestions(pack, []).map((q) => q.questionKey)).toEqual(["root", "always"]);

    const withRoot = applyAnswer(
      pack,
      [],
      { moduleCode: "experience", questionKey: "root" },
      "yes",
    );
    expect(withRoot.ok).toBe(true);
    if (!withRoot.ok) return;
    expect(askedQuestions(pack, withRoot.entries).map((q) => q.questionKey)).toEqual([
      "root",
      "level_two",
      "always",
    ]);
  });

  it("counts every asked question for the four real packs", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      /* No architecture-test pack declares a dependency, so all are asked. */
      expect(askedQuestions(pack, []).length).toBe(orderedPackQuestions(pack).length);
    }
  });
});

describe("stale hidden answer pruning", () => {
  const pack = syntheticPack([{ moduleCode: "experience", questions: CHAIN_QUESTIONS }]);

  it("removes a whole hidden dependency chain to a fixed point", () => {
    const entries: readonly AnswerEntry[] = [
      { question: { moduleCode: "experience", questionKey: "root" }, value: "no" },
      { question: { moduleCode: "experience", questionKey: "level_two" }, value: "yes" },
      { question: { moduleCode: "experience", questionKey: "level_three" }, value: 4 },
      { question: { moduleCode: "experience", questionKey: "always" }, value: "ok" },
    ];
    const pruned = pruneStaleAnswers(pack, entries);
    expect(pruned.entries.map((entry) => entry.question.questionKey)).toEqual(["root", "always"]);
    expect(pruned.removed.map((ref) => ref.questionKey).sort()).toEqual([
      "level_three",
      "level_two",
    ]);
  });

  it("prunes downstream answers when an earlier answer is edited back", () => {
    let entries: readonly AnswerEntry[] = [];
    for (const [key, value] of [
      ["root", "yes"],
      ["level_two", "yes"],
      ["level_three", 2],
      ["always", "ok"],
    ] as const) {
      const applied = applyAnswer(
        pack,
        entries,
        { moduleCode: "experience", questionKey: key },
        value,
      );
      expect(applied.ok).toBe(true);
      if (applied.ok) entries = applied.entries;
    }
    expect(entries).toHaveLength(4);

    const edited = applyAnswer(
      pack,
      entries,
      { moduleCode: "experience", questionKey: "root" },
      "no",
    );
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.entries.map((entry) => entry.question.questionKey)).toEqual(["root", "always"]);
    expect(
      answerFor(edited.entries, { moduleCode: "experience", questionKey: "level_three" }),
    ).toBe(undefined);
  });

  it("preserves still-visible answers value-for-value", () => {
    const kindPack = syntheticPack([{ moduleCode: "driving", questions: ALL_KIND_QUESTIONS }]);
    const entries: readonly AnswerEntry[] = [
      { question: { moduleCode: "driving", questionKey: "note" }, value: "  spaced text  " },
      { question: { moduleCode: "driving", questionKey: "multi" }, value: ["b", "a"] },
      { question: { moduleCode: "driving", questionKey: "amount" }, value: 12.5 },
    ];
    const pruned = pruneStaleAnswers(kindPack, entries);
    expect(answerFor(pruned.entries, { moduleCode: "driving", questionKey: "note" })).toBe(
      "  spaced text  ",
    );
    expect(answerFor(pruned.entries, { moduleCode: "driving", questionKey: "multi" })).toEqual([
      "b",
      "a",
    ]);
    expect(answerFor(pruned.entries, { moduleCode: "driving", questionKey: "amount" })).toBe(12.5);
  });

  it("drops answers for refs absent from the pack", () => {
    const pruned = pruneStaleAnswers(pack, [
      { question: { moduleCode: "experience", questionKey: "ghost" }, value: "x" },
    ]);
    expect(pruned.entries).toEqual([]);
    expect(pruned.removed.map((ref) => ref.questionKey)).toEqual(["ghost"]);
  });
});

describe("answer validation across all seven input kinds", () => {
  const kindPack = syntheticPack([{ moduleCode: "driving", questions: ALL_KIND_QUESTIONS }]);
  const byKey = new Map(ALL_KIND_QUESTIONS.map((question) => [question.questionKey, question]));

  it("accepts one valid value per kind", () => {
    const valid: readonly (readonly [string, boolean | string | number | string[]])[] = [
      ["flag", true],
      ["single", "a"],
      ["multi", ["a", "c"]],
      ["count", 3],
      ["amount", 12.5],
      ["note", "hello"],
      ["day", "2026-02-28"],
    ];
    for (const [key, value] of valid) {
      expect(validateAnswerValue(byKey.get(key)!.input, value).ok, key).toBe(true);
    }
    expect(valid).toHaveLength(7);
  });

  it("rejects every structural defect with its own code", () => {
    const cases: readonly (readonly [string, unknown, string])[] = [
      ["flag", "yes", "kind_mismatch"],
      ["single", "z", "undeclared_option"],
      ["multi", [], "empty_multi_select"],
      ["multi", ["a", "a"], "duplicate_multi_select"],
      ["multi", ["a", "z"], "undeclared_option"],
      ["count", 1.5, "non_integer"],
      ["count", 99, "out_of_bounds"],
      ["amount", Number.POSITIVE_INFINITY, "non_finite"],
      ["amount", -1, "out_of_bounds"],
      ["note", "   ", "blank_text"],
      ["note", "x", "text_length_invalid"],
      ["day", "2026-02-30", "invalid_date"],
      ["day", "28/02/2026", "invalid_date"],
    ];
    for (const [key, value, code] of cases) {
      const result = validateAnswerValue(
        byKey.get(key)!.input,
        value as Parameters<typeof validateAnswerValue>[1],
      );
      expect(result, `${key} ${String(value)}`).toEqual({ ok: false, code });
    }
  });

  it("rejects an unknown question ref", () => {
    const result = applyAnswer(kindPack, [], { moduleCode: "driving", questionKey: "nope" }, true);
    expect(result).toEqual({ ok: false, validation: { ok: false, code: "unknown_question_ref" } });
  });

  it("never converts typed text into a canonical option, boolean, number or date", () => {
    for (const key of ["single", "multi", "flag", "count", "amount", "day"] as const) {
      const result = applyAnswer(
        kindPack,
        [],
        { moduleCode: "driving", questionKey: key },
        "some words the participant typed",
      );
      expect(result.ok, key).toBe(false);
    }
    /* Text is only ever a valid answer to a declared `text` question. */
    const text = applyAnswer(
      kindPack,
      [],
      { moduleCode: "driving", questionKey: "note" },
      "a free text answer",
    );
    expect(text.ok).toBe(true);
    if (text.ok) {
      expect(answerFor(text.entries, { moduleCode: "driving", questionKey: "note" })).toBe(
        "a free text answer",
      );
    }
  });
});

describe("review and confirmation", () => {
  it("reviews all and only currently asked answered questions, in canonical order", () => {
    const copy = careerQuestionCopyByOccupationKey(ARCHITECTURE_TEST_QUESTION_COPY, "electrician")!;
    const entries = answerEveryAskedQuestion();
    const items = buildReviewItems(ELECTRICIAN, copy, entries);
    expect(items.map((item) => formatQuestionAddress(item.question))).toEqual(
      orderedPackQuestions(ELECTRICIAN).map((question) => formatQuestionAddress(question)),
    );
    for (const item of items) expect(item.prompt.length).toBeGreaterThan(0);
    expect(items.some((item) => item.answerLabel.includes("_"))).toBe(false);
  });

  it("never reviews an answer to a hidden question", () => {
    const pack = syntheticPack([{ moduleCode: "experience", questions: CHAIN_QUESTIONS }]);
    const copy = {
      occupationKey: "synthetic_role",
      careerPackId: "11111111-1111-4111-8111-111111111111",
      careerTitle: "Synthetic Role",
      questions: CHAIN_QUESTIONS.map((question) => ({
        question: { moduleCode: question.moduleCode, questionKey: question.questionKey },
        prompt: `Prompt for ${question.questionKey}`,
        evidenceLater: "You may need to confirm this later.",
      })),
    };
    const items = buildReviewItems(pack, copy, [
      { question: { moduleCode: "experience", questionKey: "root" }, value: "no" },
      { question: { moduleCode: "experience", questionKey: "level_two" }, value: "yes" },
    ]);
    expect(items.map((item) => item.question.questionKey)).toEqual(["root"]);
  });

  it("blocks confirmation until every currently asked question is answered", () => {
    const partial = confirmAnswers({
      pack: ELECTRICIAN,
      packRef: PACK_REF,
      occupationKey: "electrician",
      entries: [
        { question: { moduleCode: "travel_relocation", questionKey: "uk_nation" }, value: "wales" },
      ],
    });
    expect(partial.ok).toBe(false);
    if (!partial.ok)
      expect(partial.missing.length).toBe(orderedPackQuestions(ELECTRICIAN).length - 1);
  });

  it("produces an immutable confirmed answer set with exact values", () => {
    const entries = answerEveryAskedQuestion();
    const result = confirmAnswers({
      pack: ELECTRICIAN,
      packRef: PACK_REF,
      occupationKey: "electrician",
      entries,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.confirmed.occupationKey).toBe("electrician");
    expect(result.confirmed.pack).toEqual(PACK_REF);
    expect(Object.isFrozen(result.confirmed)).toBe(true);
    expect(Object.isFrozen(result.confirmed.answers)).toBe(true);
    expect(result.confirmed.answers).toHaveLength(orderedPackQuestions(ELECTRICIAN).length);
    expect(
      answerFor(result.confirmed.answers, {
        moduleCode: "travel_relocation",
        questionKey: "uk_nation",
      }),
    ).toBe("england");
  });

  it("confirms every architecture-test pack when all asked questions are answered", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const entries = answerEveryAskedQuestion(pack);
      const result = confirmAnswers({
        pack,
        packRef: {
          careerPackId: pack.careerPackId,
          version: pack.version,
          contentHash: hashCanonicalCareerPack(pack),
        },
        occupationKey: pack.occupation.occupationKey,
        entries,
      });
      expect(result.ok, pack.occupation.occupationKey).toBe(true);
    }
  });
});

describe("resume and traversal targets", () => {
  const CHAIN = syntheticPack([{ moduleCode: "experience", questions: CHAIN_QUESTIONS }]);
  const ROOT = { moduleCode: "experience", questionKey: "root" } as const;
  const LEVEL_TWO = { moduleCode: "experience", questionKey: "level_two" } as const;
  const ALWAYS = { moduleCode: "experience", questionKey: "always" } as const;

  function apply(
    entries: readonly AnswerEntry[],
    ref: { moduleCode: string; questionKey: string },
    value: string | number,
  ): readonly AnswerEntry[] {
    const result = applyAnswer(CHAIN, entries, ref as never, value);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("answer rejected by fixture pack");
    return result.entries;
  }

  /** root=yes, level_two=no (so level_three stays hidden), always=ok. */
  function complete(): readonly AnswerEntry[] {
    return apply(apply(apply([], ROOT, "yes"), LEVEL_TWO, "no"), ALWAYS, "ok");
  }

  function askedKeys(entries: readonly AnswerEntry[]): readonly string[] {
    return askedQuestions(CHAIN, entries).map((question) => question.questionKey);
  }

  it("resumes a COMPLETE saved review draft to review", () => {
    expect(resolveResumeTarget({ pack: CHAIN, entries: complete(), savedStage: "review" })).toEqual(
      { stage: "review" },
    );
  });

  it("resumes an incomplete saved review draft at the first missing visible question", () => {
    const partial = complete().filter(
      (entry) => formatQuestionAddress(entry.question) !== formatQuestionAddress(ALWAYS),
    );
    expect(resolveResumeTarget({ pack: CHAIN, entries: partial, savedStage: "review" })).toEqual({
      stage: "questions",
      index: askedKeys(partial).indexOf("always"),
    });
  });

  it("never claims review for a draft saved mid-questions", () => {
    expect(
      resolveResumeTarget({ pack: CHAIN, entries: complete(), savedStage: "questions" }).stage,
    ).toBe("questions");
  });

  it("traverses a question revealed by a review edit before returning to review", () => {
    const revealed = apply(complete(), LEVEL_TWO, "yes");
    expect(askedKeys(revealed)).toContain("level_three");
    const target = resolveNextTarget({ pack: CHAIN, entries: revealed, answered: LEVEL_TWO });
    expect(target.stage).toBe("questions");
    if (target.stage !== "questions") return;
    expect(askedKeys(revealed)[target.index]).toBe("level_three");
  });

  it("returns directly to review when an edit reveals nothing unanswered", () => {
    const edited = apply(complete(), ROOT, "no");
    expect(askedKeys(edited)).toEqual(["root", "always"]);
    expect(resolveNextTarget({ pack: CHAIN, entries: edited, answered: ROOT })).toEqual({
      stage: "review",
    });
  });
});
