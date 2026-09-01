import { describe, expect, it } from "vitest";

import {
  createEvidenceContextSnapshot,
  EVIDENCE_CONTEXT_SCHEMA_VERSION,
  evidenceContextSnapshotRef,
  hashCanonicalEvidenceContextSnapshot,
  pinnedCareerPackRef,
  safeParseCanonicalEvidenceContextSnapshot,
  validateEvidenceContextSnapshot,
} from "..";
import { parseCanonicalEvidenceRegistry } from "../../evidence-registry";
import {
  hex,
  HOSTILE_RECORD_KEY,
  pack,
  PACK_ID,
  RECORD_KEY_A,
  registry,
  registryInput,
  revision,
  SNAPSHOT_ID,
  SOURCE_B_ID,
  SOURCE_ID,
} from "./fixtures";

const canonicalPack = pack();

function codes(issues: readonly { readonly code: string }[]): readonly string[] {
  return issues.map((issue) => issue.code);
}

function packWithReference(reference: Record<string, unknown>) {
  return pack({
    evidence: [{ evidenceKey: "ev_a", reference }],
  });
}

describe("evidence context — exact revision capture", () => {
  it("maps every pack evidenceKey to the exact resolved registry revision", () => {
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: canonicalPack,
      registry: registry(),
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.entries.map((entry) => entry.evidenceKey)).toEqual(["ev_a", "ev_b"]);
    const evB = built.snapshot.entries.find((entry) => entry.evidenceKey === "ev_b");
    expect(evB?.revision).toEqual({
      sourceId: SOURCE_ID,
      sourceRecordKey: RECORD_KEY_A,
      recordVersion: "1.0.0",
      recordContentHash: hex("a1"),
      grade: "B",
      participantClassification: "provider_dependent",
      retrievedAt: "2026-01-01T00:00:00Z",
    });
    expect(built.snapshot.careerPack).toEqual(pinnedCareerPackRef(canonicalPack));
    expect(built.snapshot.schemaVersion).toBe(EVIDENCE_CONTEXT_SCHEMA_VERSION);
  });

  it("preserves a hostile sourceRecordKey containing an embedded NUL verbatim", () => {
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: canonicalPack,
      registry: registry(),
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const evA = built.snapshot.entries.find((entry) => entry.evidenceKey === "ev_a");
    expect(evA?.revision.sourceRecordKey).toBe(HOSTILE_RECORD_KEY);
    expect(evA?.revision.sourceRecordKey).toContain("\u0000");
  });

  it("resolves a loose current reference to the current usable terminal revision", () => {
    const target = packWithReference({ sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY_A });
    const lineage = parseCanonicalEvidenceRegistry(
      registryInput([
        revision(),
        revision({
          recordVersion: "2.0.0",
          recordContentHash: hex("b2"),
          retrievedAt: "2026-03-01T00:00:00Z",
          supersedes: {
            sourceId: SOURCE_ID,
            sourceRecordKey: RECORD_KEY_A,
            recordVersion: "1.0.0",
            recordContentHash: hex("a1"),
          },
        }),
      ]),
    );
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: lineage,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.entries[0]!.revision.recordVersion).toBe("2.0.0");
  });

  it("resolves a pinned historical non-withdrawn revision exactly", () => {
    const target = packWithReference({
      sourceId: SOURCE_ID,
      sourceRecordKey: RECORD_KEY_A,
      recordVersion: "1.0.0",
      recordContentHash: hex("a1"),
    });
    const lineage = parseCanonicalEvidenceRegistry(
      registryInput([
        revision(),
        revision({
          recordVersion: "2.0.0",
          recordContentHash: hex("b2"),
          retrievedAt: "2026-03-01T00:00:00Z",
          supersedes: {
            sourceId: SOURCE_ID,
            sourceRecordKey: RECORD_KEY_A,
            recordVersion: "1.0.0",
            recordContentHash: hex("a1"),
          },
        }),
      ]),
    );
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: lineage,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.entries[0]!.revision.recordVersion).toBe("1.0.0");
  });
});

describe("evidence context — fail-closed resolution", () => {
  it("fails closed on a contradictory pack reference", () => {
    const target = packWithReference({
      sourceId: SOURCE_ID,
      sourceRecordKey: RECORD_KEY_A,
      recordVersion: "1.0.0",
      recordContentHash: hex("a1"),
      grade: "A",
    });
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: registry(),
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(codes(built.issues)).toEqual(["evidence_reference_unresolved"]);
    expect(built.issues[0]!.message).toContain("grade_mismatch");
    expect(built.issues[0]!.at).toBe("ev_a");
  });

  it("fails closed on an unknown source record", () => {
    const target = packWithReference({ sourceId: SOURCE_ID, sourceRecordKey: "src/absent" });
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: registry(),
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues[0]!.message).toContain("unknown_record");
  });

  it("refuses a withdrawn revision as NEW current input even when pinned", () => {
    const withdrawal = { withdrawnAt: "2026-04-01T00:00:00Z", reasonKey: "reason_superseded" };
    const target = packWithReference({
      sourceId: SOURCE_ID,
      sourceRecordKey: RECORD_KEY_A,
      recordVersion: "1.0.0",
      recordContentHash: hex("a1"),
    });
    const withdrawnRegistry = parseCanonicalEvidenceRegistry(
      registryInput([revision({ withdrawal })]),
    );
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: withdrawnRegistry,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(codes(built.issues)).toEqual(["withdrawn_revision_not_usable"]);
  });

  it("accepts a review-due revision: review-due alone is not unusable", () => {
    const target = packWithReference({ sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY_A });
    const dueRegistry = parseCanonicalEvidenceRegistry(
      registryInput([revision({ reviewDueAt: "2026-01-02T00:00:00Z" })]),
    );
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: dueRegistry,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.snapshot.entries[0]!.revision.reviewDueAt).toBe("2026-01-02T00:00:00Z");
  });
});

describe("evidence context — supplied document validation", () => {
  const goodRevision = {
    sourceId: SOURCE_ID,
    sourceRecordKey: RECORD_KEY_A,
    recordVersion: "1.0.0",
    recordContentHash: hex("a1"),
    grade: "B",
    participantClassification: "provider_dependent",
    retrievedAt: "2026-01-01T00:00:00Z",
  };
  const otherRevision = {
    sourceId: SOURCE_B_ID,
    sourceRecordKey: HOSTILE_RECORD_KEY,
    recordVersion: "1.0.0",
    recordContentHash: hex("c3"),
    grade: "A",
    participantClassification: "confirmed_requirement",
    retrievedAt: "2026-01-01T00:00:00Z",
  };

  function document(entries: readonly unknown[], overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: EVIDENCE_CONTEXT_SCHEMA_VERSION,
      snapshotId: SNAPSHOT_ID,
      careerPack: pinnedCareerPackRef(canonicalPack),
      entries,
      ...overrides,
    };
  }

  it("accepts exact coverage of every pack evidenceKey", () => {
    const result = validateEvidenceContextSnapshot(
      document([
        { evidenceKey: "ev_b", revision: goodRevision },
        { evidenceKey: "ev_a", revision: otherRevision },
      ]),
      canonicalPack,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a missing evidence mapping", () => {
    const result = validateEvidenceContextSnapshot(
      document([{ evidenceKey: "ev_b", revision: goodRevision }]),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["missing_evidence_entry"]);
  });

  it("rejects an extra evidence mapping", () => {
    const result = validateEvidenceContextSnapshot(
      document([
        { evidenceKey: "ev_b", revision: goodRevision },
        { evidenceKey: "ev_a", revision: otherRevision },
        { evidenceKey: "ev_extra", revision: goodRevision },
      ]),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["unknown_evidence_entry"]);
  });

  it("rejects a duplicate evidence mapping", () => {
    const result = validateEvidenceContextSnapshot(
      document([
        { evidenceKey: "ev_b", revision: goodRevision },
        { evidenceKey: "ev_b", revision: goodRevision },
        { evidenceKey: "ev_a", revision: otherRevision },
      ]),
      canonicalPack,
    );
    expect(codes(result.issues)).toEqual(["duplicate_evidence_entry"]);
  });

  it("rejects a Career Pack binding mismatch", () => {
    const result = validateEvidenceContextSnapshot(
      document([
        { evidenceKey: "ev_b", revision: goodRevision },
        { evidenceKey: "ev_a", revision: otherRevision },
      ]),
      pack({ careerPackId: PACK_ID, version: "9.9.9" }),
    );
    expect(codes(result.issues)).toContain("career_pack_binding_mismatch");
  });

  it("rejects undeclared keys, including provider or participant copy", () => {
    for (const overrides of [
      { sourceUrl: "https://example.invalid" },
      { providerName: "x" },
      { participantCopy: "x" },
      { contentHash: hex("ab") },
    ]) {
      const result = validateEvidenceContextSnapshot(
        document(
          [
            { evidenceKey: "ev_b", revision: goodRevision },
            { evidenceKey: "ev_a", revision: otherRevision },
          ],
          overrides,
        ),
        canonicalPack,
      );
      expect(codes(result.issues)).toEqual(["schema_invalid"]);
    }
  });

  it("produces identical canonical documents and hashes regardless of entry order", () => {
    const first = safeParseCanonicalEvidenceContextSnapshot(
      document([
        { evidenceKey: "ev_b", revision: goodRevision },
        { evidenceKey: "ev_a", revision: otherRevision },
      ]),
      canonicalPack,
    );
    const second = safeParseCanonicalEvidenceContextSnapshot(
      document([
        { evidenceKey: "ev_a", revision: otherRevision },
        { evidenceKey: "ev_b", revision: goodRevision },
      ]),
      canonicalPack,
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.snapshot).toEqual(second.snapshot);
    expect(hashCanonicalEvidenceContextSnapshot(first.snapshot)).toBe(
      hashCanonicalEvidenceContextSnapshot(second.snapshot),
    );
    expect(evidenceContextSnapshotRef(first.snapshot)).toEqual(
      evidenceContextSnapshotRef(second.snapshot),
    );
  });
});

describe("evidence context — immutability", () => {
  it("deep-freezes embedded revisions, supersedes and withdrawal state", () => {
    const target = packWithReference({ sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY_A });
    const lineage = parseCanonicalEvidenceRegistry(
      registryInput([
        revision(),
        revision({
          recordVersion: "2.0.0",
          recordContentHash: hex("b2"),
          retrievedAt: "2026-03-01T00:00:00Z",
          reviewDueAt: "2026-06-01T00:00:00Z",
          supersedes: {
            sourceId: SOURCE_ID,
            sourceRecordKey: RECORD_KEY_A,
            recordVersion: "1.0.0",
            recordContentHash: hex("a1"),
          },
        }),
      ]),
    );
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: lineage,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const snapshot = built.snapshot;
    const before = hashCanonicalEvidenceContextSnapshot(snapshot);

    expect(() => (snapshot.entries as unknown[]).push({})).toThrow();
    const entry = snapshot.entries[0]!;
    expect(() => {
      (entry as unknown as Record<string, unknown>)["evidenceKey"] = "ev_other";
    }).toThrow();
    expect(() => {
      (entry.revision as unknown as Record<string, unknown>)["grade"] = "A";
    }).toThrow();
    expect(() => {
      (entry.revision.supersedes as unknown as Record<string, unknown>)["recordVersion"] = "9.9.9";
    }).toThrow();
    expect(hashCanonicalEvidenceContextSnapshot(snapshot)).toBe(before);
  });

  it("does not alias caller registry objects", () => {
    const mutableRecords = [revision(), revision({ sourceId: SOURCE_B_ID })];
    const target = packWithReference({ sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY_A });
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: parseCanonicalEvidenceRegistry(registryInput(mutableRecords)),
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const before = hashCanonicalEvidenceContextSnapshot(built.snapshot);
    // The caller's plain fixture objects are separate from the frozen document.
    mutableRecords[0]!["grade"] = "D";
    expect(built.snapshot.entries[0]!.revision.grade).toBe("B");
    expect(hashCanonicalEvidenceContextSnapshot(built.snapshot)).toBe(before);
  });
});
