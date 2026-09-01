import { describe, expect, it } from "vitest";

import { buildAnswerIndex, evaluatePackCondition, evaluatePackRule } from "../truth";
import { answers, pack, q } from "./fixtures";

const P = pack();

function index(entries: Parameters<typeof answers>[1]) {
  return buildAnswerIndex(answers(P, entries));
}

const EMPTY = index([]);
const FLAG_TRUE = index([{ question: q("q_flag"), value: true }]);

describe("tri-state condition truth", () => {
  it("answered / unanswered are determinate presence operators", () => {
    expect(
      evaluatePackCondition({ question: q("q_flag"), operator: "answered" }, FLAG_TRUE),
    ).toEqual({
      ok: true,
      value: true,
    });
    expect(evaluatePackCondition({ question: q("q_flag"), operator: "answered" }, EMPTY)).toEqual({
      ok: true,
      value: false,
    });
    expect(evaluatePackCondition({ question: q("q_flag"), operator: "unanswered" }, EMPTY)).toEqual(
      {
        ok: true,
        value: true,
      },
    );
    expect(
      evaluatePackCondition({ question: q("q_flag"), operator: "unanswered" }, FLAG_TRUE),
    ).toEqual({ ok: true, value: false });
  });

  it("every comparison operator is unknown-preserving on a missing answer", () => {
    const conditions = [
      { question: q("q_flag"), operator: "equals" as const, value: true },
      { question: q("q_flag"), operator: "not_equals" as const, value: true },
      { question: q("q_list"), operator: "includes" as const, value: "opt_car" },
      { question: q("q_list"), operator: "not_includes" as const, value: "opt_car" },
      { question: q("q_count"), operator: "gt" as const, value: 1 },
      { question: q("q_count"), operator: "gte" as const, value: 1 },
      { question: q("q_count"), operator: "lt" as const, value: 1 },
      { question: q("q_count"), operator: "lte" as const, value: 1 },
    ];
    for (const condition of conditions) {
      expect(evaluatePackCondition(condition, EMPTY)).toEqual({ ok: true, value: null });
    }
  });

  it("present answers produce the exact operator result", () => {
    const answered = index([
      { question: q("q_flag"), value: true },
      { question: q("q_level"), value: "opt_a" },
      { question: q("q_list"), value: ["opt_car"] },
      { question: q("q_count"), value: 4 },
    ]);
    const cases: readonly [Parameters<typeof evaluatePackCondition>[0], boolean][] = [
      [{ question: q("q_flag"), operator: "equals", value: true }, true],
      [{ question: q("q_flag"), operator: "not_equals", value: true }, false],
      [{ question: q("q_level"), operator: "equals", value: "opt_b" }, false],
      [{ question: q("q_list"), operator: "includes", value: "opt_car" }, true],
      [{ question: q("q_list"), operator: "not_includes", value: "opt_van" }, true],
      [{ question: q("q_count"), operator: "gt", value: 4 }, false],
      [{ question: q("q_count"), operator: "gte", value: 4 }, true],
      [{ question: q("q_count"), operator: "lt", value: 5 }, true],
      [{ question: q("q_count"), operator: "lte", value: 3 }, false],
    ];
    for (const [condition, value] of cases) {
      expect(evaluatePackCondition(condition, answered)).toEqual({ ok: true, value });
    }
  });
});

describe("Kleene group truth tables", () => {
  const T = { question: q("q_flag"), operator: "answered" as const };
  const F = { question: q("q_flag"), operator: "unanswered" as const };
  const U = { question: q("q_other"), operator: "equals" as const, value: true };

  it("all: false dominates, then unknown, then true", () => {
    expect(evaluatePackRule({ all: [T, T] }, FLAG_TRUE)).toEqual({ ok: true, value: true });
    expect(evaluatePackRule({ all: [T, U] }, FLAG_TRUE)).toEqual({ ok: true, value: null });
    expect(evaluatePackRule({ all: [F, U] }, FLAG_TRUE)).toEqual({ ok: true, value: false });
    expect(evaluatePackRule({ all: [T, F] }, FLAG_TRUE)).toEqual({ ok: true, value: false });
  });

  it("any: true dominates, then unknown, then false", () => {
    expect(evaluatePackRule({ any: [F, T] }, FLAG_TRUE)).toEqual({ ok: true, value: true });
    expect(evaluatePackRule({ any: [F, U] }, FLAG_TRUE)).toEqual({ ok: true, value: null });
    expect(evaluatePackRule({ any: [F, F] }, FLAG_TRUE)).toEqual({ ok: true, value: false });
    expect(evaluatePackRule({ any: [T, U] }, FLAG_TRUE)).toEqual({ ok: true, value: true });
  });
});
