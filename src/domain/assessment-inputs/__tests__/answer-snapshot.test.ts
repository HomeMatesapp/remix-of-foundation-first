import { describe, expect, it } from "vitest";

import { hashCanonicalCareerPack } from "../../career-pack-governance/hash";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  answerSnapshotRef,
  createAnswerSnapshot,
  hashCanonicalAnswerSnapshot,
  pinnedCareerPackRef,
  safeParseCanonicalAnswerSnapshot,
  validateAnswerSnapshot,
} from "..";
import { hex, pack, PACK_ID, SNAPSHOT_ID } from "./fixtures";

const canonicalPack = pack();

function snapshotInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: SNAPSHOT_ID,
    careerPack: pinnedCareerPackRef(canonicalPack),
    answers: [
      { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_a" },
    ],
    ...overrides,
  };
}

function codes(issues: readonly { readonly code: string }[]): readonly string[] {
  return issues.map((issue) => issue.code);
}

describe("answer snapshot — exact Career Pack binding", () => {
  it("pins id, content version and recomputed content hash", () => {
    const ref = pinnedCareerPackRef(canonicalPack);
    expect(ref).toEqual({
      id: PACK_ID,
      version: "1.4.2",
      contentHash: hashCanonicalCareerPack(canonicalPack),
    });
  });

  it("rejects a caller-supplied hash that contradicts computed truth", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({ careerPack: { id: PACK_ID, version: "1.4.2", contentHash: hex("de") } }),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["career_pack_binding_mismatch"]);
  });

  it("rejects a mismatched pack version", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({
        careerPack: {
          id: PACK_ID,
          version: "9.9.9",
          contentHash: hashCanonicalCareerPack(canonicalPack),
        },
      }),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["career_pack_binding_mismatch"]);
  });

  it("never lets a caller inject the pinned ref through the builder", () => {
    const built = createAnswerSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: canonicalPack,
      answers: [
        { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_a" },
      ],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.careerPack.contentHash).toBe(hashCanonicalCareerPack(canonicalPack));
  });
});

describe("answer snapshot — strict document shape", () => {
  it("rejects undeclared top-level keys", () => {
    const result = validateAnswerSnapshot(snapshotInput({ participantId: PACK_ID }), canonicalPack);
    expect(codes(result.issues)).toEqual(["schema_invalid"]);
  });

  it("rejects result, judgement, generative and institution fields", () => {
    for (const key of [
      "judgement",
      "requirementStates",
      "routes",
      "barriers",
      "ranking",
      "interpretation",
      "userId",
      "institutionId",
      "contentHash",
    ]) {
      const result = validateAnswerSnapshot(snapshotInput({ [key]: "x" }), canonicalPack);
      expect(codes(result.issues)).toEqual(["schema_invalid"]);
    }
  });

  it("rejects undeclared keys inside an answer entry", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({
        answers: [
          {
            question: { moduleCode: "qualifications", questionKey: "q_level" },
            value: "opt_a",
            label: "Level 3",
          },
        ],
      }),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["schema_invalid"]);
  });
});

describe("answer snapshot — question integrity", () => {
  it("rejects duplicate question refs", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({
        answers: [
          { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_a" },
          { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_b" },
        ],
      }),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["duplicate_question"]);
  });

  it("rejects an answer for a question absent from the pack", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({
        answers: [
          { question: { moduleCode: "portfolio", questionKey: "q_absent" }, value: "opt_a" },
        ],
      }),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["unknown_question"]);
  });

  it("accepts a partial answer set without inventing missing answers", () => {
    const result = validateAnswerSnapshot(snapshotInput({ answers: [] }), canonicalPack);
    expect(result.valid).toBe(true);
  });
});

describe("answer snapshot — all seven input kinds", () => {
  const valid = [
    { question: { moduleCode: "qualifications", questionKey: "q_holds_level_3" }, value: true },
    { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_b" },
    { question: { moduleCode: "qualifications", questionKey: "q_count" }, value: 3 },
    {
      question: { moduleCode: "driving", questionKey: "q_licences" },
      value: ["opt_van", "opt_car"],
    },
    { question: { moduleCode: "finance", questionKey: "q_hourly_rate" }, value: 12.75 },
    { question: { moduleCode: "study_availability", questionKey: "q_note" }, value: "  keep me  " },
    { question: { moduleCode: "study_availability", questionKey: "q_start" }, value: "2024-02-29" },
  ];

  it("validates one confirmed answer of every kind", () => {
    const result = safeParseCanonicalAnswerSnapshot(
      snapshotInput({ answers: valid }),
      canonicalPack,
    );
    expect(result.ok).toBe(true);
  });

  it("preserves participant text verbatim", () => {
    const result = safeParseCanonicalAnswerSnapshot(
      snapshotInput({ answers: valid }),
      canonicalPack,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const note = result.snapshot.answers.find((entry) => entry.question.questionKey === "q_note");
    expect(note?.value).toBe("  keep me  ");
  });

  const invalid: readonly (readonly [string, unknown, string, string])[] = [
    ["boolean kind mismatch", "yes", "q_holds_level_3", "answer_kind_mismatch"],
    ["unknown select option", "opt_z", "q_level", "unknown_option_key"],
    ["non-integer integer", 2.5, "q_count", "answer_kind_mismatch"],
    ["integer above max", 11, "q_count", "value_out_of_range"],
    ["integer below min", -1, "q_count", "value_out_of_range"],
    ["blank text", "   ", "q_note", "text_invalid"],
    ["text below minLength", "ab", "q_note", "text_invalid"],
    ["text above maxLength", "x".repeat(21), "q_note", "text_invalid"],
    ["impossible calendar date", "2026-02-30", "q_start", "date_invalid"],
    ["malformed date", "26-02-01", "q_start", "date_invalid"],
  ];

  for (const [label, value, questionKey, code] of invalid) {
    it(`rejects ${label}`, () => {
      const moduleCode =
        questionKey === "q_note" || questionKey === "q_start"
          ? "study_availability"
          : "qualifications";
      const result = validateAnswerSnapshot(
        snapshotInput({ answers: [{ question: { moduleCode, questionKey }, value }] }),
        canonicalPack,
      );
      expect(codes(result.issues)).toEqual([code]);
    });
  }

  it("rejects a non-finite decimal at the value union boundary", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({
        answers: [
          {
            question: { moduleCode: "finance", questionKey: "q_hourly_rate" },
            value: Number.POSITIVE_INFINITY,
          },
        ],
      }),
      canonicalPack,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a decimal outside declared bounds", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({
        answers: [
          { question: { moduleCode: "finance", questionKey: "q_hourly_rate" }, value: 100.01 },
        ],
      }),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["value_out_of_range"]);
  });

  it("rejects an empty multi-select selection as unanswered", () => {
    const result = validateAnswerSnapshot(
      snapshotInput({
        answers: [{ question: { moduleCode: "driving", questionKey: "q_licences" }, value: [] }],
      }),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["empty_selection"]);
  });

  it("rejects duplicate and unknown multi-select option keys", () => {
    const duplicate = validateAnswerSnapshot(
      snapshotInput({
        answers: [
          {
            question: { moduleCode: "driving", questionKey: "q_licences" },
            value: ["opt_car", "opt_car"],
          },
        ],
      }),
      canonicalPack,
    );
    expect(codes(duplicate.issues)).toEqual(["duplicate_option_key"]);

    const unknown = validateAnswerSnapshot(
      snapshotInput({
        answers: [
          {
            question: { moduleCode: "driving", questionKey: "q_licences" },
            value: ["opt_car", "opt_zzz"],
          },
        ],
      }),
      canonicalPack,
    );
    expect(codes(unknown.issues)).toEqual(["unknown_option_key"]);
  });
});

describe("answer snapshot — deterministic canonicalisation", () => {
  const answersA = [
    { question: { moduleCode: "study_availability", questionKey: "q_note" }, value: "abc" },
    { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_a" },
    {
      question: { moduleCode: "driving", questionKey: "q_licences" },
      value: ["opt_bus", "opt_car"],
    },
  ];
  const answersB = [
    {
      question: { moduleCode: "driving", questionKey: "q_licences" },
      value: ["opt_car", "opt_bus"],
    },
    { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_a" },
    { question: { moduleCode: "study_availability", questionKey: "q_note" }, value: "abc" },
  ];

  it("produces identical documents, hashes and refs regardless of input order", () => {
    const first = safeParseCanonicalAnswerSnapshot(
      snapshotInput({ answers: answersA }),
      canonicalPack,
    );
    const second = safeParseCanonicalAnswerSnapshot(
      snapshotInput({ answers: answersB }),
      canonicalPack,
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.snapshot).toEqual(second.snapshot);
    expect(hashCanonicalAnswerSnapshot(first.snapshot)).toBe(
      hashCanonicalAnswerSnapshot(second.snapshot),
    );
    expect(answerSnapshotRef(first.snapshot)).toEqual(answerSnapshotRef(second.snapshot));
  });

  it("orders answers by the full question identity tuple", () => {
    const result = safeParseCanonicalAnswerSnapshot(
      snapshotInput({ answers: answersA }),
      canonicalPack,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.answers.map((entry) => entry.question.moduleCode)).toEqual([
      "driving",
      "qualifications",
      "study_availability",
    ]);
  });

  it("derives a SnapshotRef of exactly id plus content hash", () => {
    const result = safeParseCanonicalAnswerSnapshot(snapshotInput(), canonicalPack);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(answerSnapshotRef(result.snapshot)).toEqual({
      id: SNAPSHOT_ID,
      contentHash: hashCanonicalAnswerSnapshot(result.snapshot),
    });
    expect(Object.keys(result.snapshot).sort()).toEqual([
      "answers",
      "careerPack",
      "schemaVersion",
      "snapshotId",
    ]);
  });
});

describe("answer snapshot — immutability", () => {
  it("deep-freezes the document, answer array and multi-select arrays", () => {
    const result = safeParseCanonicalAnswerSnapshot(
      snapshotInput({
        answers: [
          {
            question: { moduleCode: "driving", questionKey: "q_licences" },
            value: ["opt_car", "opt_van"],
          },
        ],
      }),
      canonicalPack,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot = result.snapshot;
    const before = hashCanonicalAnswerSnapshot(snapshot);

    const mutable = snapshot as unknown as Record<string, unknown>;
    expect(() => {
      mutable["snapshotId"] = SNAPSHOT_ID.replace("a", "b");
    }).toThrow();
    expect(() => (snapshot.answers as unknown[]).push({})).toThrow();
    const selection = snapshot.answers[0]!.value as unknown as string[];
    expect(() => selection.push("opt_bus")).toThrow();
    expect(() => {
      selection[0] = "opt_bus";
    }).toThrow();
    expect(hashCanonicalAnswerSnapshot(snapshot)).toBe(before);
  });
});
