import { describe, expect, it } from "vitest";

import {
  answerSnapshotRef,
  buildDeterministicProvenance,
  createAnswerSnapshot,
  createEvidenceContextSnapshot,
  evidenceContextSnapshotRef,
  hashCanonicalAnswerSnapshot,
  hashCanonicalEvidenceContextSnapshot,
  parseDeterministicProvenance,
} from "..";
import { hex, OTHER_SNAPSHOT_ID, pack, PACK_ID, registry, SNAPSHOT_ID } from "./fixtures";

const canonicalPack = pack();
const canonicalRegistry = registry();

function answers() {
  const built = createAnswerSnapshot({
    snapshotId: SNAPSHOT_ID,
    pack: canonicalPack,
    answers: [
      { question: { moduleCode: "qualifications", questionKey: "q_level" }, value: "opt_a" },
    ],
  });
  if (!built.ok) throw new Error("fixture answer snapshot must be valid");
  return built.snapshot;
}

function evidence(withPack = canonicalPack) {
  const built = createEvidenceContextSnapshot({
    snapshotId: OTHER_SNAPSHOT_ID,
    pack: withPack,
    registry: canonicalRegistry,
  });
  if (!built.ok) throw new Error("fixture evidence context must be valid");
  return built.snapshot;
}

describe("deterministic provenance assembly", () => {
  it("emits exactly the existing deterministic provenance fields", () => {
    const result = buildDeterministicProvenance({
      answerSnapshot: answers(),
      evidenceContext: evidence(),
      decisionEngineVersion: "0.1.0",
      evaluatedAt: "2026-05-01T09:30:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.provenance).sort()).toEqual([
      "answerSnapshot",
      "careerPackContentHash",
      "careerPackId",
      "careerPackVersion",
      "decisionEngineVersion",
      "evaluatedAt",
      "evidenceContext",
    ]);
    expect(result.provenance.careerPackId).toBe(PACK_ID);
  });

  it("carries snapshot refs that match the computed content hashes", () => {
    const answerSnapshot = answers();
    const evidenceContext = evidence();
    const result = buildDeterministicProvenance({
      answerSnapshot,
      evidenceContext,
      decisionEngineVersion: "1.0.0",
      evaluatedAt: "2026-05-01T09:30:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.answerSnapshot).toEqual({
      id: SNAPSHOT_ID,
      contentHash: hashCanonicalAnswerSnapshot(answerSnapshot),
    });
    expect(result.provenance.evidenceContext).toEqual({
      id: OTHER_SNAPSHOT_ID,
      contentHash: hashCanonicalEvidenceContextSnapshot(evidenceContext),
    });
    expect(result.provenance.answerSnapshot).toEqual(answerSnapshotRef(answerSnapshot));
    expect(result.provenance.evidenceContext).toEqual(evidenceContextSnapshotRef(evidenceContext));
  });

  it("fails closed when the two snapshots bind to different Career Packs", () => {
    const otherPack = pack({ version: "2.0.0" });
    const result = buildDeterministicProvenance({
      answerSnapshot: answers(),
      evidenceContext: evidence(otherPack),
      decisionEngineVersion: "1.0.0",
      evaluatedAt: "2026-05-01T09:30:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.code)).toEqual(["career_pack_binding_mismatch"]);
  });

  it("accepts an opaque local snapshot ref without defining Local Reality", () => {
    const result = buildDeterministicProvenance({
      answerSnapshot: answers(),
      evidenceContext: evidence(),
      decisionEngineVersion: "1.0.0",
      evaluatedAt: "2026-05-01T09:30:00Z",
      localSnapshot: { id: OTHER_SNAPSHOT_ID, contentHash: hex("ef") },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.localSnapshot).toEqual({
      id: OTHER_SNAPSHOT_ID,
      contentHash: hex("ef"),
    });
  });

  it("accepts an explicit null local snapshot", () => {
    const result = buildDeterministicProvenance({
      answerSnapshot: answers(),
      evidenceContext: evidence(),
      decisionEngineVersion: "1.0.0",
      evaluatedAt: "2026-05-01T09:30:00Z",
      localSnapshot: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.localSnapshot).toBeNull();
  });

  it("rejects an invalid engine semantic version", () => {
    const result = buildDeterministicProvenance({
      answerSnapshot: answers(),
      evidenceContext: evidence(),
      decisionEngineVersion: "v1",
      evaluatedAt: "2026-05-01T09:30:00Z",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.at)).toEqual(["decisionEngineVersion"]);
  });

  it("rejects an invalid evaluatedAt instant", () => {
    for (const evaluatedAt of ["2026-02-30T00:00:00Z", "2026-05-01 09:30:00", "not-a-time"]) {
      const result = buildDeterministicProvenance({
        answerSnapshot: answers(),
        evidenceContext: evidence(),
        decisionEngineVersion: "1.0.0",
        evaluatedAt,
      });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects undeclared keys, including generative metadata, on strict parse", () => {
    const base = buildDeterministicProvenance({
      answerSnapshot: answers(),
      evidenceContext: evidence(),
      decisionEngineVersion: "1.0.0",
      evaluatedAt: "2026-05-01T09:30:00Z",
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    for (const key of ["modelName", "promptId", "interpretation", "judgement", "userId"]) {
      expect(() => parseDeterministicProvenance({ ...base.provenance, [key]: "x" })).toThrow();
    }
  });

  it("deep-freezes the provenance envelope", () => {
    const result = buildDeterministicProvenance({
      answerSnapshot: answers(),
      evidenceContext: evidence(),
      decisionEngineVersion: "1.0.0",
      evaluatedAt: "2026-05-01T09:30:00Z",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(() => {
      (result.provenance as unknown as Record<string, unknown>)["evaluatedAt"] =
        "2020-01-01T00:00:00Z";
    }).toThrow();
    expect(() => {
      (result.provenance.answerSnapshot as unknown as Record<string, unknown>)["contentHash"] =
        hex("00");
    }).toThrow();
  });
});
