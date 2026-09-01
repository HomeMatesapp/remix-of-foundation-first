import { describe, expect, it } from "vitest";

import { INTERNAL_EVIDENCE_GRADES, PARTICIPANT_EVIDENCE_CLASSIFICATIONS } from "../../contracts";
import {
  EVIDENCE_REGISTRY_SCHEMA_VERSION,
  collectRecordRevisions,
  evaluateEvidenceFreshness,
  evidenceRecordRevisionSchema,
  evidenceSourceDefinitionSchema,
  findExactRecordRevision,
  findEvidenceSource,
  findTerminalRecordRevision,
  isEvidenceReviewDue,
  parseCanonicalEvidenceRegistry,
  resolveCurrentUsableRevision,
  resolveEvidenceReference,
  resolveRecordLineage,
  safeParseCanonicalEvidenceRegistry,
  validateEvidenceRegistry,
  type EvidenceRegistry,
} from "..";
import {
  OTHER_RECORD_KEY,
  RECORD_KEY,
  SOURCE_A,
  SOURCE_A_ID,
  SOURCE_B,
  SOURCE_B_ID,
  UNKNOWN_SOURCE_ID,
  hex,
  lineageRegistry,
  ref,
  registry,
  revision,
} from "./fixtures";

const IDENTITY = { sourceId: SOURCE_A_ID, sourceRecordKey: RECORD_KEY };

function codes(input: unknown): readonly string[] {
  return validateEvidenceRegistry(input).issues.map((issue) => issue.code);
}

/* -------------------------------------------------------------------------- */
/* 1. Frozen vocabularies are consumed, not redefined                          */
/* -------------------------------------------------------------------------- */

describe("frozen evidence vocabularies", () => {
  it("uses exactly the shared A-D grades", () => {
    expect(INTERNAL_EVIDENCE_GRADES).toEqual(["A", "B", "C", "D"]);
    for (const grade of INTERNAL_EVIDENCE_GRADES) {
      expect(evidenceRecordRevisionSchema.safeParse(revision({ grade })).success).toBe(true);
    }
    expect(evidenceRecordRevisionSchema.safeParse(revision({ grade: "E" })).success).toBe(false);
    expect(evidenceRecordRevisionSchema.safeParse(revision({ grade: "a" })).success).toBe(false);
  });

  it("uses exactly the shared participant classifications", () => {
    expect(PARTICIPANT_EVIDENCE_CLASSIFICATIONS).toEqual([
      "confirmed_requirement",
      "provider_dependent",
      "general_guidance",
      "needs_verification",
    ]);
    for (const participantClassification of PARTICIPANT_EVIDENCE_CLASSIFICATIONS) {
      expect(
        evidenceRecordRevisionSchema.safeParse(revision({ participantClassification })).success,
      ).toBe(true);
    }
    expect(
      evidenceRecordRevisionSchema.safeParse(revision({ participantClassification: "confirmed" }))
        .success,
    ).toBe(false);
  });

  it("requires grade and classification on canonical records", () => {
    const withoutGrade = revision();
    delete withoutGrade["grade"];
    expect(evidenceRecordRevisionSchema.safeParse(withoutGrade).success).toBe(false);
    const withoutClassification = revision();
    delete withoutClassification["participantClassification"];
    expect(evidenceRecordRevisionSchema.safeParse(withoutClassification).success).toBe(false);
  });

  it("never upgrades a D-grade record", () => {
    const canonical = parseCanonicalEvidenceRegistry(
      registry([revision({ grade: "D", participantClassification: "needs_verification" })]),
    );
    const resolved = resolveCurrentUsableRevision(canonical, IDENTITY);
    expect(resolved?.grade).toBe("D");
    expect(resolved?.participantClassification).toBe("needs_verification");
  });

  it("pins the registry schema version", () => {
    expect(EVIDENCE_REGISTRY_SCHEMA_VERSION).toBe("1.0.0");
    expect(codes({ ...registry([]), registryVersion: "1.1.0" })).toContain("schema_invalid");
  });
});

/* -------------------------------------------------------------------------- */
/* 2-4. Source and record identity                                            */
/* -------------------------------------------------------------------------- */

describe("source and record identity", () => {
  it("rejects duplicate sourceId", () => {
    expect(codes(registry([], [SOURCE_A, { ...SOURCE_A, sourceKey: "source.other" }]))).toContain(
      "duplicate_source_id",
    );
  });

  it("rejects duplicate sourceKey", () => {
    expect(
      codes(registry([], [SOURCE_A, { ...SOURCE_B, sourceKey: SOURCE_A.sourceKey }])),
    ).toContain("duplicate_source_key");
  });

  it("rejects records for an undeclared source", () => {
    expect(codes(registry([revision({ sourceId: UNKNOWN_SOURCE_ID })]))).toContain(
      "unknown_source",
    );
  });

  it("keeps the source contract minimal and strict", () => {
    expect(
      evidenceSourceDefinitionSchema.safeParse({
        ...SOURCE_A,
        sourceUrl: "https://example.invalid",
      }).success,
    ).toBe(false);
  });

  it("preserves external sourceRecordKey characters verbatim", () => {
    const hostile = "  GB:ONS/urn?x=1&y=2 %20 Ω\t";
    const parsed = evidenceRecordRevisionSchema.parse(revision({ sourceRecordKey: hostile }));
    expect(parsed.sourceRecordKey).toBe(hostile);
    const canonical = parseCanonicalEvidenceRegistry(
      registry([revision({ sourceRecordKey: hostile })]),
    );
    expect(canonical.records[0]!.sourceRecordKey).toBe(hostile);
  });

  it("rejects a blank sourceRecordKey only", () => {
    expect(
      evidenceRecordRevisionSchema.safeParse(revision({ sourceRecordKey: "   " })).success,
    ).toBe(false);
    expect(evidenceRecordRevisionSchema.safeParse(revision({ sourceRecordKey: "-" })).success).toBe(
      true,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 5-13. Revisions and supersession lineage                                   */
/* -------------------------------------------------------------------------- */

describe("revision identity and supersession lineage", () => {
  it("rejects duplicate exact revisions", () => {
    expect(codes(registry([revision(), revision()]))).toContain("duplicate_revision");
  });

  it("accepts multiple historical versions of one record identity", () => {
    const canonical = parseCanonicalEvidenceRegistry(lineageRegistry());
    expect(collectRecordRevisions(canonical, IDENTITY)).toHaveLength(2);
  });

  it("accepts a valid supersession chain and orders it root -> terminal", () => {
    const canonical = parseCanonicalEvidenceRegistry(lineageRegistry());
    const lineage = resolveRecordLineage(canonical, IDENTITY);
    expect(lineage?.map((entry) => entry.recordVersion)).toEqual(["1.0.0", "2.0.0"]);
  });

  it("accepts a root revision with no supersedes (imported current state)", () => {
    expect(validateEvidenceRegistry(registry([revision()])).valid).toBe(true);
  });

  it("rejects supersession of a missing revision", () => {
    expect(
      codes(
        registry([
          revision({
            recordVersion: "2.0.0",
            recordContentHash: hex("b2"),
            supersedes: ref("1.0.0", hex("a1")),
          }),
        ]),
      ),
    ).toContain("unknown_supersedes_target");
  });

  it("rejects cross-source supersession", () => {
    expect(
      codes(
        registry([
          revision({ sourceId: SOURCE_B_ID }),
          revision({
            recordVersion: "2.0.0",
            recordContentHash: hex("b2"),
            supersedes: ref("1.0.0", hex("a1"), { sourceId: SOURCE_B_ID }),
          }),
        ]),
      ),
    ).toContain("supersedes_identity_mismatch");
  });

  it("rejects cross-record supersession", () => {
    expect(
      codes(
        registry([
          revision({ sourceRecordKey: OTHER_RECORD_KEY }),
          revision({
            recordVersion: "2.0.0",
            recordContentHash: hex("b2"),
            supersedes: ref("1.0.0", hex("a1"), { sourceRecordKey: OTHER_RECORD_KEY }),
          }),
        ]),
      ),
    ).toContain("supersedes_identity_mismatch");
  });

  it("rejects same-version supersession", () => {
    expect(
      codes(
        registry([
          revision(),
          revision({ recordContentHash: hex("b2"), supersedes: ref("1.0.0", hex("a1")) }),
        ]),
      ).some(
        (code) => code === "supersedes_version_not_greater" || code === "content_hash_conflict",
      ),
    ).toBe(true);
  });

  it("rejects lower-version supersession", () => {
    expect(
      codes(
        registry([
          revision({ recordVersion: "2.0.0", recordContentHash: hex("b2") }),
          revision({ supersedes: ref("2.0.0", hex("b2")) }),
        ]),
      ),
    ).toContain("supersedes_version_not_greater");
  });

  it("rejects prerelease precedence regression", () => {
    expect(
      codes(
        registry([
          revision({ recordVersion: "2.0.0", recordContentHash: hex("b2") }),
          revision({
            recordVersion: "2.0.0-rc.1",
            recordContentHash: hex("c3"),
            supersedes: ref("2.0.0", hex("b2")),
          }),
        ]),
      ),
    ).toContain("supersedes_version_not_greater");
  });

  it("rejects self supersession", () => {
    expect(codes(registry([revision({ supersedes: ref("1.0.0", hex("a1")) })]))).toContain(
      "schema_invalid",
    );
  });

  it("rejects a supersession cycle", () => {
    const issues = codes(
      registry([
        revision({ supersedes: ref("2.0.0", hex("b2")) }),
        revision({
          recordVersion: "2.0.0",
          recordContentHash: hex("b2"),
          supersedes: ref("1.0.0", hex("a1")),
        }),
      ]),
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues).toContain("supersedes_version_not_greater");
  });

  it("rejects branching successors", () => {
    expect(
      codes(
        registry([
          revision(),
          revision({
            recordVersion: "2.0.0",
            recordContentHash: hex("b2"),
            supersedes: ref("1.0.0", hex("a1")),
          }),
          revision({
            recordVersion: "3.0.0",
            recordContentHash: hex("c3"),
            supersedes: ref("1.0.0", hex("a1")),
          }),
        ]),
      ),
    ).toContain("supersession_branch");
  });

  it("rejects a content-hash contradiction for one version", () => {
    expect(codes(registry([revision(), revision({ recordContentHash: hex("b2") })]))).toContain(
      "content_hash_conflict",
    );
  });

  it("rejects identical content declared under two versions", () => {
    expect(
      codes(
        registry([
          revision(),
          revision({ recordVersion: "2.0.0", supersedes: ref("1.0.0", hex("a1")) }),
        ]),
      ),
    ).toContain("content_hash_conflict");
  });

  it("rejects multiple roots for one identity", () => {
    expect(
      codes(
        registry([revision(), revision({ recordVersion: "2.0.0", recordContentHash: hex("b2") })]),
      ),
    ).toContain("lineage_ambiguous");
  });

  it("accepts a valid connected multi-step lineage", () => {
    expect(
      codes(
        registry([
          revision(),
          revision({
            recordVersion: "2.0.0",
            recordContentHash: hex("b2"),
            supersedes: ref("1.0.0", hex("a1")),
          }),
          revision({
            recordVersion: "9.0.0",
            recordContentHash: hex("d4"),
            supersedes: ref("2.0.0", hex("b2")),
          }),
          revision({
            recordVersion: "9.1.0",
            recordContentHash: hex("e5"),
            supersedes: ref("9.0.0", hex("d4")),
          }),
        ]),
      ).length,
    ).toBe(0);
  });

  it("rejects a genuinely disconnected revision inside a lineage", () => {
    // 1.0.0 -> 2.0.0 is one chain; 8.0.0 -> 9.0.0 is a second, disconnected
    // chain for the same identity. Two roots, so the lineage fails closed.
    const issues = codes(
      registry([
        revision(),
        revision({
          recordVersion: "2.0.0",
          recordContentHash: hex("b2"),
          supersedes: ref("1.0.0", hex("a1")),
        }),
        revision({ recordVersion: "8.0.0", recordContentHash: hex("c3") }),
        revision({
          recordVersion: "9.0.0",
          recordContentHash: hex("d4"),
          supersedes: ref("8.0.0", hex("c3")),
        }),
      ]),
    );
    expect(issues).toContain("lineage_ambiguous");
  });
});

/* -------------------------------------------------------------------------- */
/* 14-16. Withdrawal and terminal selection                                   */
/* -------------------------------------------------------------------------- */

describe("withdrawal semantics", () => {
  const withdrawnTerminal = registry([
    revision(),
    revision({
      recordVersion: "2.0.0",
      recordContentHash: hex("b2"),
      retrievedAt: "2026-02-01T00:00:00Z",
      supersedes: ref("1.0.0", hex("a1")),
      withdrawal: { withdrawnAt: "2026-03-01T00:00:00Z", reasonKey: "source.retracted" },
    }),
  ]);

  it("keeps a withdrawn historical revision exactly resolvable", () => {
    const canonical = parseCanonicalEvidenceRegistry(withdrawnTerminal);
    const exact = findExactRecordRevision(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      recordVersion: "2.0.0",
      recordContentHash: hex("b2"),
    });
    expect(exact?.withdrawal?.reasonKey).toBe("source.retracted");
    expect(canonical.records).toHaveLength(2);
  });

  it("does not return a withdrawn terminal revision as usable current evidence", () => {
    const canonical = parseCanonicalEvidenceRegistry(withdrawnTerminal);
    expect(findTerminalRecordRevision(canonical, IDENTITY)?.recordVersion).toBe("2.0.0");
    expect(resolveCurrentUsableRevision(canonical, IDENTITY)).toBeNull();
  });

  it("rejects withdrawal free text and undeclared metadata", () => {
    expect(
      evidenceRecordRevisionSchema.safeParse(
        revision({
          withdrawal: {
            withdrawnAt: "2026-03-01T00:00:00Z",
            reasonKey: "source.retracted",
            note: "explained to participants",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects withdrawal earlier than retrieval", () => {
    expect(
      evidenceRecordRevisionSchema.safeParse(
        revision({
          withdrawal: { withdrawnAt: "2025-01-01T00:00:00Z", reasonKey: "source.retracted" },
        }),
      ).success,
    ).toBe(false);
  });

  it("selects the terminal revision from lineage, never array order", () => {
    const reordered = registry([
      revision({
        recordVersion: "2.0.0",
        recordContentHash: hex("b2"),
        retrievedAt: "2026-02-01T00:00:00Z",
        supersedes: ref("1.0.0", hex("a1")),
      }),
      revision({
        recordVersion: "3.0.0",
        recordContentHash: hex("c3"),
        retrievedAt: "2026-03-01T00:00:00Z",
        supersedes: ref("2.0.0", hex("b2")),
      }),
      revision(),
    ]);
    const canonical = parseCanonicalEvidenceRegistry(reordered);
    expect(resolveRecordLineage(canonical, IDENTITY)?.map((entry) => entry.recordVersion)).toEqual([
      "1.0.0",
      "2.0.0",
      "3.0.0",
    ]);
    expect(resolveCurrentUsableRevision(canonical, IDENTITY)?.recordVersion).toBe("3.0.0");
    expect(canonical.records[0]!.recordVersion).toBe("2.0.0");
  });
});

/* -------------------------------------------------------------------------- */
/* 17-19. Deterministic freshness                                             */
/* -------------------------------------------------------------------------- */

describe("deterministic freshness", () => {
  const withDeadline = evidenceRecordRevisionSchema.parse(
    revision({ reviewDueAt: "2026-06-01T00:00:00Z" }),
  );
  const withoutDeadline = evidenceRecordRevisionSchema.parse(revision());

  it("is not due before the deadline", () => {
    expect(isEvidenceReviewDue(withDeadline, "2026-05-31T23:59:59Z")).toBe(false);
  });

  it("is due exactly at the deadline", () => {
    expect(isEvidenceReviewDue(withDeadline, "2026-06-01T00:00:00Z")).toBe(true);
  });

  it("is due after the deadline", () => {
    expect(isEvidenceReviewDue(withDeadline, "2027-01-01T00:00:00+01:00")).toBe(true);
  });

  it("is not automatically due without a deadline", () => {
    expect(evaluateEvidenceFreshness(withoutDeadline, "2099-01-01T00:00:00Z")).toEqual({
      reviewDueAt: null,
      reviewDue: false,
    });
  });

  it("requires an explicit valid asOf instant", () => {
    expect(() => isEvidenceReviewDue(withDeadline, "not-a-date")).toThrow();
    expect(() => isEvidenceReviewDue(withDeadline, "2026-06-01T00:00:00")).toThrow();
  });

  it("rejects a deadline earlier than retrieval at schema level", () => {
    expect(
      evidenceRecordRevisionSchema.safeParse(revision({ reviewDueAt: "2025-12-31T23:59:59Z" }))
        .success,
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* 20-25. Reference resolution                                                */
/* -------------------------------------------------------------------------- */

describe("evidence reference resolution", () => {
  const canonical: EvidenceRegistry = parseCanonicalEvidenceRegistry(lineageRegistry());

  it("resolves stable identity alone to the current revision", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.revision.recordVersion).toBe("2.0.0");
  });

  it("resolves a pinned superseded historical revision", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      recordVersion: "1.0.0",
      recordContentHash: hex("a1"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.revision.recordVersion).toBe("1.0.0");
  });

  it("resolves a pinned withdrawn revision but refuses it as current", () => {
    const withWithdrawnTerminal = parseCanonicalEvidenceRegistry(
      registry([
        revision(),
        revision({
          recordVersion: "2.0.0",
          recordContentHash: hex("b2"),
          retrievedAt: "2026-02-01T00:00:00Z",
          supersedes: ref("1.0.0", hex("a1")),
          withdrawal: { withdrawnAt: "2026-04-01T00:00:00Z", reasonKey: "source.retracted" },
        }),
      ]),
    );
    const pinned = resolveEvidenceReference(withWithdrawnTerminal, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      recordVersion: "2.0.0",
      recordContentHash: hex("b2"),
    });
    expect(pinned.ok).toBe(true);
    const current = resolveEvidenceReference(withWithdrawnTerminal, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
    });
    expect(current.ok).toBe(false);
    if (!current.ok) expect(current.issues[0]!.code).toBe("current_revision_withdrawn");
  });

  it("rejects a grade mismatch", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      grade: "A",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain("grade_mismatch");
  });

  it("rejects a participant classification mismatch", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      participantClassification: "confirmed_requirement",
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.map((issue) => issue.code)).toContain(
        "participant_classification_mismatch",
      );
  });

  it("rejects a version / hash contradiction", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      recordVersion: "1.0.0",
      recordContentHash: hex("b2"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.code).toBe("content_hash_mismatch");
  });

  it("rejects an unknown pinned version and unknown pinned hash", () => {
    const badVersion = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      recordVersion: "9.9.9",
    });
    expect(badVersion.ok).toBe(false);
    if (!badVersion.ok) expect(badVersion.issues[0]!.code).toBe("version_mismatch");
    const badHash = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      recordContentHash: hex("f6"),
    });
    expect(badHash.ok).toBe(false);
    if (!badHash.ok) expect(badHash.issues[0]!.code).toBe("content_hash_mismatch");
  });

  it("rejects a contradicting retrievedAt", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      retrievedAt: "2020-01-01T00:00:00Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.code).toBe("retrieved_at_mismatch");
  });

  it("accepts an equivalent retrievedAt instant in another offset", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      retrievedAt: "2026-02-01T01:00:00+01:00",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown source and unknown sourceRecordKey", () => {
    const unknownSource = resolveEvidenceReference(canonical, {
      sourceId: UNKNOWN_SOURCE_ID,
      sourceRecordKey: RECORD_KEY,
    });
    expect(unknownSource.ok).toBe(false);
    if (!unknownSource.ok) expect(unknownSource.issues[0]!.code).toBe("unknown_source");
    const unknownRecord = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: OTHER_RECORD_KEY,
    });
    expect(unknownRecord.ok).toBe(false);
    if (!unknownRecord.ok) expect(unknownRecord.issues[0]!.code).toBe("unknown_record");
  });

  it("does not weaken reference strictness", () => {
    const result = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      participantCopy: "You will definitely qualify",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.code).toBe("reference_invalid");
  });
});

/* -------------------------------------------------------------------------- */
/* 26-30. Strictness, immutability, fail-closed                               */
/* -------------------------------------------------------------------------- */

describe("strictness, immutability and fail-closed behaviour", () => {
  it("rejects undeclared engine, copy and score fields on revisions", () => {
    for (const extra of [
      { promptText: "summarise" },
      { modelName: "some-engine" },
      { confidenceScore: 0.9 },
      { participantExplanation: "guaranteed" },
      { rawHtml: "<html></html>" },
    ]) {
      expect(evidenceRecordRevisionSchema.safeParse({ ...revision(), ...extra }).success).toBe(
        false,
      );
    }
  });

  it("rejects undeclared registry keys", () => {
    expect(codes({ ...registry([]), ingestionCredential: "secret" })).toContain("schema_invalid");
  });

  it("deep-freezes nested canonical registry data", () => {
    const canonical = parseCanonicalEvidenceRegistry(lineageRegistry());
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(Object.isFrozen(canonical.records)).toBe(true);
    expect(Object.isFrozen(canonical.records[1]!)).toBe(true);
    expect(Object.isFrozen(canonical.records[1]!.supersedes)).toBe(true);
    expect(Object.isFrozen(canonical.sources[0]!)).toBe(true);
  });

  it("keeps lookup outcomes stable under caller mutation attempts", () => {
    const canonical = parseCanonicalEvidenceRegistry(lineageRegistry());
    const mutable = canonical as unknown as {
      records: Record<string, unknown>[];
      sources: Record<string, unknown>[];
    };
    expect(() => mutable.records.reverse()).toThrow();
    expect(() => mutable.records.push(revision({ recordVersion: "5.0.0" }))).toThrow();
    expect(() => {
      mutable.records[1]!["grade"] = "A";
    }).toThrow();
    expect(() => {
      mutable.sources[0]!["sourceKey"] = "hijacked";
    }).toThrow();

    expect(resolveCurrentUsableRevision(canonical, IDENTITY)?.recordVersion).toBe("2.0.0");
    expect(resolveCurrentUsableRevision(canonical, IDENTITY)?.grade).toBe("B");
    expect(findEvidenceSource(canonical, SOURCE_A_ID)?.sourceKey).toBe("source.ofqual");
  });

  it("fails closed on a malformed registry instead of choosing a convenient record", () => {
    const malformed = registry([
      revision(),
      revision({ recordVersion: "2.0.0", recordContentHash: hex("b2") }),
    ]);
    expect(() => parseCanonicalEvidenceRegistry(malformed)).toThrow(/invalid canonical evidence/);
    const safe = safeParseCanonicalEvidenceRegistry(malformed);
    expect(safe.ok).toBe(false);
    if (!safe.ok) expect(safe.issues.map((issue) => issue.code)).toContain("lineage_ambiguous");
  });

  it("returns null rather than guessing for unknown identities", () => {
    const canonical = parseCanonicalEvidenceRegistry(lineageRegistry());
    expect(
      resolveCurrentUsableRevision(canonical, {
        sourceId: SOURCE_A_ID,
        sourceRecordKey: OTHER_RECORD_KEY,
      }),
    ).toBeNull();
    expect(
      findExactRecordRevision(canonical, {
        sourceId: SOURCE_A_ID,
        sourceRecordKey: RECORD_KEY,
        recordVersion: "1.0.0",
        recordContentHash: hex("f6"),
      }),
    ).toBeNull();
  });
});
