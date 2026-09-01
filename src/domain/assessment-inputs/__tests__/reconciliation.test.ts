import { describe, expect, it } from "vitest";

import { hashCanonicalCareerPack } from "../../career-pack-governance/hash";
import type { CareerPack } from "../../career-packs";
import { deepFreezeDocument } from "../canonical";
import { EVIDENCE_CONTEXT_SCHEMA_VERSION } from "../codes";
import {
  createEvidenceContextSnapshot,
  safeParseCanonicalEvidenceContextSnapshot,
  validateEvidenceContextSnapshot,
} from "../evidence-context";
import {
  HOSTILE_RECORD_KEY,
  pack,
  packInput,
  RECORD_KEY_A,
  registry,
  revision,
  SNAPSHOT_ID,
  SOURCE_B_ID,
  SOURCE_ID,
  hex,
} from "./fixtures";

type ExactType<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;

function expectType<T extends true>(): void {
  expect(true).toBe(true);
}

/* -------------------------------------------------------------------------- */
/* R1 — deepFreezeDocument recurses through already-frozen parents            */
/* -------------------------------------------------------------------------- */

describe("R1 deepFreezeDocument recursion through a pre-frozen parent", () => {
  it("freezes a nested mutable child even when the outer object is already frozen", () => {
    const outer = { child: { mutable: 1 } };
    Object.freeze(outer);

    expect(Object.isFrozen(outer)).toBe(true);
    expect(Object.isFrozen(outer.child)).toBe(false);

    deepFreezeDocument(outer);

    expect(Object.isFrozen(outer.child)).toBe(true);
    expect(() => {
      (outer.child as { mutable: number }).mutable = 999;
    }).toThrow();
    expect(outer.child.mutable).toBe(1);
  });

  it("freezes nested arrays and deeper descendants under a pre-frozen parent", () => {
    const outer = { list: [{ deep: { value: "a" } }] };
    Object.freeze(outer);

    deepFreezeDocument(outer);

    expect(Object.isFrozen(outer.list)).toBe(true);
    expect(Object.isFrozen(outer.list[0])).toBe(true);
    expect(Object.isFrozen(outer.list[0]!.deep)).toBe(true);
    expect(() => {
      (outer.list as { deep: { value: string } }[]).push({ deep: { value: "b" } });
    }).toThrow();
    expect(outer.list).toHaveLength(1);
  });

  it("terminates on a self-referential structure and still freezes it", () => {
    const cyclic: Record<string, unknown> = { name: "root" };
    cyclic["self"] = cyclic;

    expect(() => deepFreezeDocument(cyclic)).not.toThrow();
    expect(Object.isFrozen(cyclic)).toBe(true);
  });

  it("returns null and primitives unchanged", () => {
    expect(deepFreezeDocument(null)).toBeNull();
    expect(deepFreezeDocument(7)).toBe(7);
    expect(deepFreezeDocument("text")).toBe("text");
  });
});

/* -------------------------------------------------------------------------- */
/* R3 — deepFreezeDocument keeps cycle tracking private                       */
/* -------------------------------------------------------------------------- */

describe("R3 deepFreezeDocument public contract", () => {
  it("exposes one public argument and ignores hostile runtime cycle-tracker injection", () => {
    type PublicParameters = Parameters<typeof deepFreezeDocument>;
    expectType<ExactType<PublicParameters, [value: unknown]>>();
    expect(deepFreezeDocument.length).toBe(1);

    const outer = { child: { mutable: 1 } };
    const hostileVisited = new WeakSet<object>([outer, outer.child]);

    (
      deepFreezeDocument as unknown as (
        value: typeof outer,
        visited: WeakSet<object>,
      ) => typeof outer
    )(outer, hostileVisited);

    expect(Object.isFrozen(outer)).toBe(true);
    expect(Object.isFrozen(outer.child)).toBe(true);
    expect(() => {
      (outer.child as { mutable: number }).mutable = 999;
    }).toThrow();
    expect(outer.child.mutable).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* R2 — supplied entries must satisfy the Career Pack evidence reference      */
/* -------------------------------------------------------------------------- */

/** Pack whose `ev_a` declaration can pin extra reference fields. */
function packWithEvARef(reference: Record<string, unknown>): CareerPack {
  return pack({
    evidence: [
      { evidenceKey: "ev_b", reference: { sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY_A } },
      { evidenceKey: "ev_a", reference },
    ],
  });
}

function suppliedDocument(
  target: CareerPack,
  entries: readonly { readonly evidenceKey: string; readonly revision: unknown }[],
): Record<string, unknown> {
  return {
    schemaVersion: EVIDENCE_CONTEXT_SCHEMA_VERSION,
    snapshotId: SNAPSHOT_ID,
    careerPack: {
      id: target.careerPackId,
      version: target.version,
      contentHash: hashCanonicalCareerPack(target),
    },
    entries: [...entries],
  };
}

/** The revision that correctly satisfies the plain fixture `ev_a` identity. */
function boundEvARevision(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return revision({
    sourceId: SOURCE_B_ID,
    sourceRecordKey: HOSTILE_RECORD_KEY,
    recordContentHash: hex("c3"),
    grade: "A",
    participantClassification: "confirmed_requirement",
    ...overrides,
  });
}

function boundEvBRevision(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return revision({ sourceId: SOURCE_ID, sourceRecordKey: RECORD_KEY_A, ...overrides });
}

function expectMismatch(target: CareerPack, evARevision: unknown): void {
  const document = suppliedDocument(target, [
    { evidenceKey: "ev_a", revision: evARevision },
    { evidenceKey: "ev_b", revision: boundEvBRevision() },
  ]);

  const validation = validateEvidenceContextSnapshot(document, target);
  expect(validation.valid).toBe(false);
  expect(validation.issues.map((issue) => issue.code)).toContain(
    "evidence_revision_reference_mismatch",
  );
  expect(validation.issues.some((issue) => issue.at === "ev_a")).toBe(true);

  const parsed = safeParseCanonicalEvidenceContextSnapshot(document, target);
  expect(parsed.ok).toBe(false);
}

describe("R2 supplied Evidence Context entry binding", () => {
  it("accepts a correctly bound supplied document", () => {
    const target = pack();
    const parsed = safeParseCanonicalEvidenceContextSnapshot(
      suppliedDocument(target, [
        { evidenceKey: "ev_a", revision: boundEvARevision() },
        { evidenceKey: "ev_b", revision: boundEvBRevision() },
      ]),
      target,
    );
    expect(parsed.ok).toBe(true);
  });

  it("1. rejects a wrong sourceId under a correct evidenceKey", () => {
    expectMismatch(pack(), boundEvARevision({ sourceId: SOURCE_ID }));
  });

  it("2. rejects a wrong sourceRecordKey", () => {
    expectMismatch(pack(), boundEvARevision({ sourceRecordKey: RECORD_KEY_A }));
  });

  it("3. rejects a pinned recordVersion mismatch", () => {
    const target = packWithEvARef({
      sourceId: SOURCE_B_ID,
      sourceRecordKey: HOSTILE_RECORD_KEY,
      recordVersion: "2.0.0",
    });
    expectMismatch(target, boundEvARevision({ recordVersion: "1.0.0" }));
  });

  it("4. rejects a pinned recordContentHash mismatch", () => {
    const target = packWithEvARef({
      sourceId: SOURCE_B_ID,
      sourceRecordKey: HOSTILE_RECORD_KEY,
      recordContentHash: hex("c3"),
    });
    expectMismatch(target, boundEvARevision({ recordContentHash: hex("d4") }));
  });

  it("5. rejects a declared grade mismatch", () => {
    const target = packWithEvARef({
      sourceId: SOURCE_B_ID,
      sourceRecordKey: HOSTILE_RECORD_KEY,
      grade: "A",
    });
    expectMismatch(target, boundEvARevision({ grade: "C" }));
  });

  it("6. rejects a declared participantClassification mismatch", () => {
    const target = packWithEvARef({
      sourceId: SOURCE_B_ID,
      sourceRecordKey: HOSTILE_RECORD_KEY,
      participantClassification: "confirmed_requirement",
    });
    expectMismatch(target, boundEvARevision({ participantClassification: "provider_dependent" }));
  });

  it("7. rejects a declared retrievedAt mismatch but accepts the same exact instant", () => {
    const target = packWithEvARef({
      sourceId: SOURCE_B_ID,
      sourceRecordKey: HOSTILE_RECORD_KEY,
      retrievedAt: "2026-01-01T00:00:00Z",
    });

    expectMismatch(target, boundEvARevision({ retrievedAt: "2026-01-02T00:00:00Z" }));

    // Different representation, identical instant: Increment 7 instant equality.
    const equivalent = safeParseCanonicalEvidenceContextSnapshot(
      suppliedDocument(target, [
        {
          evidenceKey: "ev_a",
          revision: boundEvARevision({ retrievedAt: "2025-12-31T19:00:00-05:00" }),
        },
        { evidenceKey: "ev_b", revision: boundEvBRevision() },
      ]),
      target,
    );
    expect(equivalent.ok).toBe(true);
  });

  it("8. accepts a correctly bound historical revision carrying withdrawal metadata", () => {
    const target = pack();
    const parsed = safeParseCanonicalEvidenceContextSnapshot(
      suppliedDocument(target, [
        {
          evidenceKey: "ev_a",
          revision: boundEvARevision({
            withdrawal: { withdrawnAt: "2026-02-01T00:00:00Z", reasonKey: "source_retired" },
          }),
        },
        { evidenceKey: "ev_b", revision: boundEvBRevision() },
      ]),
      target,
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const entry = parsed.snapshot.entries.find((item) => item.evidenceKey === "ev_a");
      expect(entry?.revision.withdrawal?.reasonKey).toBe("source_retired");
    }
  });

  it("reports mismatch separately from missing and unknown coverage codes", () => {
    const target = pack();
    const validation = validateEvidenceContextSnapshot(
      suppliedDocument(target, [
        { evidenceKey: "ev_a", revision: boundEvBRevision() },
        { evidenceKey: "ev_b", revision: boundEvBRevision() },
      ]),
      target,
    );
    const codes = validation.issues.map((issue) => issue.code);
    expect(codes).toContain("evidence_revision_reference_mismatch");
    expect(codes).not.toContain("missing_evidence_entry");
    expect(codes).not.toContain("unknown_evidence_entry");
  });

  it("does not consult any registry when validating a supplied document", () => {
    const target = pack();
    // No registry argument exists on the supplied-document API at all.
    expect(validateEvidenceContextSnapshot.length).toBe(2);
    expect(
      validateEvidenceContextSnapshot(
        suppliedDocument(target, [
          { evidenceKey: "ev_a", revision: boundEvARevision() },
          { evidenceKey: "ev_b", revision: boundEvBRevision() },
        ]),
        target,
      ).valid,
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Builder behaviour preserved                                                */
/* -------------------------------------------------------------------------- */

describe("R2 builder rules remain unchanged", () => {
  it("9. resolves every pack reference against the registry", () => {
    const target = pack();
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: registry(),
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      for (const entry of built.snapshot.entries) {
        const declared = target.evidence.find((item) => item.evidenceKey === entry.evidenceKey);
        expect(entry.revision.sourceId).toBe(declared?.reference.sourceId);
        expect(entry.revision.sourceRecordKey).toBe(declared?.reference.sourceRecordKey);
      }
    }
  });

  it("10. still refuses a withdrawn revision as NEW current input", () => {
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: pack(),
      registry: registry({
        recordBOverrides: {
          withdrawal: { withdrawnAt: "2026-02-01T00:00:00Z", reasonKey: "source_retired" },
        },
      }),
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.issues.some((issue) => issue.at === "ev_a")).toBe(true);
    }
  });

  it("11. still fails closed on an unresolved reference", () => {
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: pack(),
      registry: registry({ records: [revision()] }),
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.issues.map((issue) => issue.code)).toContain("evidence_reference_unresolved");
    }
  });

  it("11b. still fails closed on a contradictory pinned reference", () => {
    const target = packWithEvARef({
      sourceId: SOURCE_B_ID,
      sourceRecordKey: HOSTILE_RECORD_KEY,
      grade: "D",
    });
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: registry(),
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.issues.map((issue) => issue.code)).toContain("evidence_reference_unresolved");
    }
  });

  it("builder output still satisfies the reconciled supplied-document validator", () => {
    const target = pack();
    const built = createEvidenceContextSnapshot({
      snapshotId: SNAPSHOT_ID,
      pack: target,
      registry: registry(),
    });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(validateEvidenceContextSnapshot(built.snapshot, target).valid).toBe(true);
    }
  });
});

/* Keeps the unused-import guard honest for the packInput helper re-export. */
describe("fixture sanity", () => {
  it("exposes the canonical fixture pack input", () => {
    expect(packInput()["careerPackId"]).toBeTypeOf("string");
  });
});
