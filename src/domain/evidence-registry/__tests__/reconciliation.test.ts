import { describe, expect, it } from "vitest";

import { parseCanonicalEvidenceRegistry } from "../canonical";
import { evaluateEvidenceFreshness } from "../freshness";
import { compareInstants, instantIsBefore, instantsEqual } from "../instant";
import {
  collectRecordRevisions,
  findExactRecordRevision,
  resolveCurrentUsableRevision,
  resolveRecordLineage,
} from "../lookup";
import { resolveEvidenceReference } from "../reference";
import {
  evidenceIdentityKey,
  evidenceIdentitySlotKey,
  evidenceRevisionKey,
  evidenceRecordIdentitySchema,
  evidenceRecordRevisionSchema,
} from "../schema";
import { validateEvidenceRegistry } from "../validation";
import { hex, ref, registry, revision, RECORD_KEY, SOURCE_A_ID } from "./fixtures";

/* -------------------------------------------------------------------------- */
/* R1. Collision-safe deterministic addressing                                */
/* -------------------------------------------------------------------------- */

const NUL_KEY = "ofqual\u0000600/1234/5";
const HOSTILE_KEYS = [
  NUL_KEY,
  "a#b@c+d",
  "a\tb c",
  "ünïcode/ключ/键",
  "\u0000leading",
  "trailing\u0000",
];

describe("collision-safe evidence addressing", () => {
  it("accepts and preserves a sourceRecordKey containing an embedded NUL verbatim", () => {
    const parsed = evidenceRecordRevisionSchema.parse(revision({ sourceRecordKey: NUL_KEY }));
    expect(parsed.sourceRecordKey).toBe(NUL_KEY);
    expect(parsed.sourceRecordKey.length).toBe(NUL_KEY.length);
  });

  it("encodes distinct identities distinctly for arbitrary hostile sourceRecordKeys", () => {
    // Two VALID registry identities: same valid UUID sourceId, different
    // arbitrary external keys. No reachable collision, and every hostile key
    // encodes to its own deterministic identity key.
    const left = evidenceIdentityKey({ sourceId: SOURCE_A_ID, sourceRecordKey: "a\u0000b" });
    const right = evidenceIdentityKey({ sourceId: SOURCE_A_ID, sourceRecordKey: "a\u0000b\u0000" });
    expect(left).not.toBe(right);

    const encoded = new Set(
      HOSTILE_KEYS.map((sourceRecordKey) =>
        evidenceIdentityKey({ sourceId: SOURCE_A_ID, sourceRecordKey }),
      ),
    );
    expect(encoded.size).toBe(HOSTILE_KEYS.length);
    for (const sourceRecordKey of HOSTILE_KEYS) {
      const identity = { sourceId: SOURCE_A_ID, sourceRecordKey };
      expect(evidenceRecordIdentitySchema.safeParse(identity).success).toBe(true);
      expect(evidenceIdentityKey(identity)).toBe(evidenceIdentityKey({ ...identity }));
    }
  });

  it("is a generic tuple-encoding property: unambiguous even for schema-invalid tuples", () => {
    // NOTE: the right-hand tuple below is NOT a valid registry identity —
    // `sourceId` must be a UUID, so this collision is unreachable in the
    // validated domain. It only documents the encoder's tuple-level property.
    const invalid = { sourceId: `${SOURCE_A_ID}\u0000a`, sourceRecordKey: "b" };
    expect(evidenceRecordIdentitySchema.safeParse(invalid).success).toBe(false);
    expect(evidenceIdentityKey({ sourceId: SOURCE_A_ID, sourceRecordKey: "a\u0000b" })).not.toBe(
      evidenceIdentityKey(invalid),
    );
  });

  it("keeps revision tuples and identity slot keys distinct for separator-like keys", () => {
    const keys = new Set(
      HOSTILE_KEYS.map((sourceRecordKey) =>
        evidenceRevisionKey({
          sourceId: SOURCE_A_ID,
          sourceRecordKey,
          recordVersion: "1.0.0",
          recordContentHash: hex("a1"),
        }),
      ),
    );
    expect(keys.size).toBe(HOSTILE_KEYS.length);

    const slots = new Set([
      evidenceIdentitySlotKey({ sourceId: SOURCE_A_ID, sourceRecordKey: "a" }, "1.0.0"),
      evidenceIdentitySlotKey({ sourceId: SOURCE_A_ID, sourceRecordKey: "a\u00001.0.0" }, ""),
      evidenceIdentitySlotKey({ sourceId: SOURCE_A_ID, sourceRecordKey: "a" }, "2.0.0"),
    ]);
    expect(slots.size).toBe(3);
  });

  it("resolves lineage, current revision and exact lookup for a hostile key", () => {
    const canonical = parseCanonicalEvidenceRegistry(
      registry([
        revision({ sourceRecordKey: NUL_KEY }),
        revision({
          sourceRecordKey: NUL_KEY,
          recordVersion: "2.0.0",
          recordContentHash: hex("b2"),
          supersedes: ref("1.0.0", hex("a1"), { sourceRecordKey: NUL_KEY }),
        }),
        revision({ sourceRecordKey: "a#b@c+d", recordContentHash: hex("c3") }),
      ]),
    );
    const identity = { sourceId: SOURCE_A_ID, sourceRecordKey: NUL_KEY };
    expect(validateEvidenceRegistry(canonical).valid).toBe(true);
    expect(collectRecordRevisions(canonical, identity)).toHaveLength(2);
    expect(resolveRecordLineage(canonical, identity)?.map((r) => r.recordVersion)).toEqual([
      "1.0.0",
      "2.0.0",
    ]);
    expect(resolveCurrentUsableRevision(canonical, identity)?.recordContentHash).toBe(hex("b2"));
    expect(
      findExactRecordRevision(canonical, {
        sourceId: SOURCE_A_ID,
        sourceRecordKey: "a#b@c+d",
        recordVersion: "1.0.0",
        recordContentHash: hex("c3"),
      })?.sourceRecordKey,
    ).toBe("a#b@c+d");

    const resolved = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: NUL_KEY,
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) expect(resolved.revision.recordVersion).toBe("2.0.0");
  });

  it("leaves ordinary identities behaving unchanged", () => {
    const canonical = parseCanonicalEvidenceRegistry(registry([revision()]));
    const identity = { sourceId: SOURCE_A_ID, sourceRecordKey: RECORD_KEY };
    expect(resolveCurrentUsableRevision(canonical, identity)?.recordVersion).toBe("1.0.0");
    expect(validateEvidenceRegistry(canonical).valid).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* R2. Exact instant comparison                                               */
/* -------------------------------------------------------------------------- */

describe("exact instant comparison", () => {
  it("distinguishes instants differing by one nanosecond", () => {
    expect(instantsEqual("2026-02-01T00:00:00.123456789Z", "2026-02-01T00:00:00.123456788Z")).toBe(
      false,
    );
    expect(
      compareInstants("2026-02-01T00:00:00.123456788Z", "2026-02-01T00:00:00.123456789Z"),
    ).toBe(-1);
  });

  it("treats offset-equivalent nanosecond instants as equal", () => {
    expect(
      instantsEqual("2026-02-01T00:00:00.123456789Z", "2026-02-01T01:00:00.123456789+01:00"),
    ).toBe(true);
    expect(
      instantsEqual("2026-02-01T00:00:00.123456789Z", "2026-01-31T18:30:00.123456789-05:30"),
    ).toBe(true);
  });

  it("orders pre-epoch and epoch-boundary instants exactly through public comparison", () => {
    expect(instantIsBefore("1969-12-31T23:59:59.999999999Z", "1970-01-01T00:00:00Z")).toBe(true);
    expect(instantIsBefore("1970-01-01T00:00:00Z", "1970-01-01T00:00:00.000000001Z")).toBe(true);
    expect(
      instantsEqual("1969-12-31T23:59:59.999999999Z", "1969-12-31T23:59:59.999999999+00:00"),
    ).toBe(true);
  });

  it("compares four-digit years 0000-0099 exactly instead of remapping them to 1900-1999", () => {
    // Date.UTC would map year 0 to 1900 and year 99 to 1999.
    expect(instantsEqual("0000-01-01T00:00:00Z", "1900-01-01T00:00:00Z")).toBe(false);
    expect(instantIsBefore("0000-01-01T00:00:00Z", "1900-01-01T00:00:00Z")).toBe(true);
    expect(instantsEqual("0099-01-01T00:00:00Z", "1999-01-01T00:00:00Z")).toBe(false);
    expect(instantIsBefore("0099-01-01T00:00:00Z", "1999-01-01T00:00:00Z")).toBe(true);
  });

  it("orders early-year boundaries and offsets exactly", () => {
    expect(instantIsBefore("0099-12-31T23:59:59.999999999Z", "0100-01-01T00:00:00Z")).toBe(true);
    expect(compareInstants("0100-01-01T00:00:00Z", "0099-12-31T23:59:59.999999999Z")).toBe(1);
    expect(
      instantsEqual("0004-02-29T00:00:00.123456789Z", "0004-02-29T01:00:00.123456789+01:00"),
    ).toBe(true);
    expect(instantsEqual("0000-01-01T00:00:00.000000001Z", "0000-01-01T00:00:00.000000002Z")).toBe(
      false,
    );
  });

  it("accepts reviewDueAt exactly equal to retrievedAt and rejects one nanosecond earlier", () => {
    const at = "2026-01-01T00:00:00.123456789Z";
    expect(
      evidenceRecordRevisionSchema.safeParse(revision({ retrievedAt: at, reviewDueAt: at }))
        .success,
    ).toBe(true);
    expect(
      evidenceRecordRevisionSchema.safeParse(
        revision({ retrievedAt: at, reviewDueAt: "2026-01-01T00:00:00.123456788Z" }),
      ).success,
    ).toBe(false);
  });

  it("accepts withdrawnAt exactly equal to retrievedAt and rejects one nanosecond earlier", () => {
    const at = "2026-01-01T00:00:00.123456789Z";
    expect(
      evidenceRecordRevisionSchema.safeParse(
        revision({
          retrievedAt: at,
          withdrawal: { withdrawnAt: at, reasonKey: "source.retracted" },
        }),
      ).success,
    ).toBe(true);
    expect(
      evidenceRecordRevisionSchema.safeParse(
        revision({
          retrievedAt: at,
          withdrawal: {
            withdrawnAt: "2026-01-01T00:00:00.123456788Z",
            reasonKey: "source.retracted",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("evaluates freshness exactly at nanosecond precision", () => {
    const parsed = evidenceRecordRevisionSchema.parse(
      revision({
        retrievedAt: "2026-01-01T00:00:00Z",
        reviewDueAt: "2026-06-01T00:00:00.123456789Z",
      }),
    );
    expect(evaluateEvidenceFreshness(parsed, "2026-06-01T00:00:00.123456788Z").reviewDue).toBe(
      false,
    );
    expect(evaluateEvidenceFreshness(parsed, "2026-06-01T00:00:00.123456789Z").reviewDue).toBe(
      true,
    );
    expect(evaluateEvidenceFreshness(parsed, "2026-06-01T01:00:00.123456789+01:00").reviewDue).toBe(
      true,
    );
  });

  it("fails an evidence reference whose retrievedAt differs by one nanosecond", () => {
    const canonical = parseCanonicalEvidenceRegistry(
      registry([revision({ retrievedAt: "2026-01-01T00:00:00.123456789Z" })]),
    );
    const mismatch = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      retrievedAt: "2026-01-01T00:00:00.123456788Z",
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.issues.map((i) => i.code)).toContain("retrieved_at_mismatch");

    const offsetEquivalent = resolveEvidenceReference(canonical, {
      sourceId: SOURCE_A_ID,
      sourceRecordKey: RECORD_KEY,
      retrievedAt: "2026-01-01T01:00:00.123456789+01:00",
    });
    expect(offsetEquivalent.ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* R4. Exact instant arithmetic for early four-digit years                    */
/* -------------------------------------------------------------------------- */

describe("exact instant arithmetic for years 0000-0099", () => {
  it("agrees with the absolute instant oracle for 0099 (Date.parse used as oracle only)", () => {
    const oracleMs = Date.parse("0099-01-01T00:00:00Z");
    expect(Number.isFinite(oracleMs)).toBe(true);
    // Same absolute instant expressed via the oracle's own round-trip.
    const oracleIso = new Date(oracleMs).toISOString().replace(".000Z", "Z");
    expect(instantsEqual("0099-01-01T00:00:00Z", oracleIso)).toBe(true);
    expect(compareInstants("0099-01-01T00:00:00Z", oracleIso)).toBe(0);
  });

  it("does not conflate 0099 with 1999", () => {
    expect(instantsEqual("0099-01-01T00:00:00Z", "1999-01-01T00:00:00Z")).toBe(false);
    expect(instantIsBefore("0099-01-01T00:00:00Z", "1999-01-01T00:00:00Z")).toBe(true);
  });

  it("treats year 0000 consistently under offset-equivalent forms", () => {
    expect(instantsEqual("0000-01-01T00:00:00Z", "0000-01-01T01:00:00+01:00")).toBe(true);
    expect(instantsEqual("0000-01-01T00:00:00Z", "0000-12-31T23:00:00-01:00")).toBe(false);
    expect(instantIsBefore("0000-01-01T00:00:00Z", "0099-01-01T00:00:00Z")).toBe(true);
    expect(compareInstants("0000-01-01T00:00:00.000000001Z", "0000-01-01T00:00:00Z")).toBe(1);
  });
});
