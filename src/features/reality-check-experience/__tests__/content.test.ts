import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { ARCHITECTURE_TEST_QUESTION_COPY } from "../../../content/reality-check-question-copy/architecture-tests";
import { formatQuestionAddress } from "../../../domain/questions";
import {
  careerQuestionCopyByOccupationKey,
  careerQuestionCopySchema,
  parseCareerQuestionCopySet,
} from "../content-schema";
import { orderedPackQuestions } from "../flow";

/**
 * Increment 15 question presentation content validation.
 *
 * Presentation copy must cover the real packs exactly: no invented question, no
 * missing question, and exact option-key parity. Copy is never truth.
 */

describe("reality check question copy", () => {
  it("covers exactly the four architecture-test occupations", () => {
    expect(ARCHITECTURE_TEST_QUESTION_COPY.map((entry) => entry.occupationKey).sort()).toEqual([
      "electrician",
      "photographer",
      "registered_nurse",
      "solicitor_england_wales",
    ]);
    expect(ARCHITECTURE_TEST_QUESTION_COPY).toHaveLength(ARCHITECTURE_TEST_PACKS.length);
  });

  it("binds each copy set to the exact Career Pack id and canonical title", () => {
    for (const copy of ARCHITECTURE_TEST_QUESTION_COPY) {
      const pack = ARCHITECTURE_TEST_PACKS.find(
        (candidate) => candidate.occupation.occupationKey === copy.occupationKey,
      );
      expect(pack, copy.occupationKey).toBeDefined();
      expect(copy.careerPackId).toBe(pack?.careerPackId);
      const occupation = ARCHITECTURE_TEST_OCCUPATIONS.find(
        (record) => record.occupationKey === copy.occupationKey,
      );
      expect(copy.careerTitle).toBe(occupation?.canonicalTitle);
    }
  });

  it("gives every Career Pack question exactly one presentation entry", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const copy = careerQuestionCopyByOccupationKey(
        ARCHITECTURE_TEST_QUESTION_COPY,
        pack.occupation.occupationKey,
      );
      expect(copy, pack.occupation.occupationKey).toBeDefined();
      const packAddresses = orderedPackQuestions(pack).map((question) =>
        formatQuestionAddress(question),
      );
      const copyAddresses = (copy?.questions ?? []).map((entry) =>
        formatQuestionAddress(entry.question),
      );
      expect(copyAddresses.slice().sort()).toEqual(packAddresses.slice().sort());
      expect(new Set(copyAddresses).size).toBe(copyAddresses.length);
    }
  });

  it("maps option labels one-to-one onto exact declared option keys", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const copy = careerQuestionCopyByOccupationKey(
        ARCHITECTURE_TEST_QUESTION_COPY,
        pack.occupation.occupationKey,
      );
      for (const question of orderedPackQuestions(pack)) {
        const entry = copy?.questions.find(
          (candidate) =>
            formatQuestionAddress(candidate.question) === formatQuestionAddress(question),
        );
        const declared =
          question.input.kind === "single_select" || question.input.kind === "multi_select"
            ? question.input.optionKeys
            : undefined;
        if (!declared) {
          expect(entry?.options, formatQuestionAddress(question)).toBeUndefined();
          continue;
        }
        expect((entry?.options ?? []).map((option) => option.optionKey)).toEqual([...declared]);
      }
    }
  });

  it("never exposes a stable module, question or option key as participant copy", () => {
    /* Stable keys are snake_case; participant copy is plain English prose. */
    for (const copy of ARCHITECTURE_TEST_QUESTION_COPY) {
      for (const entry of copy.questions) {
        const address = formatQuestionAddress(entry.question);
        for (const text of [entry.prompt, entry.helpText ?? "", entry.whyWeAsk ?? ""]) {
          expect(text, address).not.toMatch(/[a-z0-9]+_[a-z0-9_]+/);
          expect(text, address).not.toContain(entry.question.questionKey);
        }
        for (const option of entry.options ?? []) {
          expect(option.label, address).not.toBe(option.optionKey);
          expect(option.label, address).not.toMatch(/[a-z0-9]+_[a-z0-9_]+/);
        }
      }
    }
  });

  it("declares no route, judgement, requirement or evidence-strength field", () => {
    const forbidden = [
      "routeKey",
      "routes",
      "judgement",
      "requirementKey",
      "requirements",
      "evidenceStrength",
      "eligibility",
      "score",
      "confidence",
      "threshold",
      "weight",
      "consequences",
    ];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }
      if (value === null || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        expect(forbidden).not.toContain(key);
        walk(child);
      }
    };
    walk(ARCHITECTURE_TEST_QUESTION_COPY);
  });

  it("is deep frozen", () => {
    const first = ARCHITECTURE_TEST_QUESTION_COPY[0];
    expect(Object.isFrozen(ARCHITECTURE_TEST_QUESTION_COPY)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first?.questions[0])).toBe(true);
    expect(Object.isFrozen(first?.questions[0]?.options)).toBe(true);
  });

  it("rejects a duplicate question presentation entry", () => {
    const entry = {
      question: { moduleCode: "driving", questionKey: "flag" },
      prompt: "Do you drive?",
      options: [
        { optionKey: "yes", label: "Yes" },
        { optionKey: "no", label: "No" },
      ],
    };
    expect(() =>
      careerQuestionCopySchema.parse({
        occupationKey: "synthetic_role",
        careerPackId: "11111111-1111-4111-8111-111111111111",
        careerTitle: "Synthetic Role",
        questions: [entry, entry],
      }),
    ).toThrow();
  });

  it("rejects an option label that is the internal option key", () => {
    expect(() =>
      parseCareerQuestionCopySet([
        {
          occupationKey: "synthetic_role",
          careerPackId: "11111111-1111-4111-8111-111111111111",
          careerTitle: "Synthetic Role",
          questions: [
            {
              question: { moduleCode: "driving", questionKey: "flag" },
              prompt: "Do you drive?",
              options: [
                { optionKey: "not_held", label: "not_held" },
                { optionKey: "held", label: "Yes" },
              ],
            },
          ],
        },
      ]),
    ).toThrow();
  });

  it("rejects a duplicate occupation key in the set", () => {
    const one = {
      occupationKey: "synthetic_role",
      careerPackId: "11111111-1111-4111-8111-111111111111",
      careerTitle: "Synthetic Role",
      questions: [
        {
          question: { moduleCode: "driving", questionKey: "flag" },
          prompt: "Do you drive?",
        },
      ],
    };
    expect(() => parseCareerQuestionCopySet([one, one])).toThrow();
  });
});
