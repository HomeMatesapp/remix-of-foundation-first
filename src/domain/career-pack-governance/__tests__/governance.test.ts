/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";

import { parseCanonicalCareerPack } from "../../career-packs";
import {
  CAREER_PACK_LIFECYCLE_STATES,
  INTERNAL_GOVERNANCE_ROLES,
  GOVERNANCE_CAPABILITY_ROLES,
} from "../codes";
import { canonicalJsonStringify, CanonicalJsonError } from "../canonical-json";
import { hashCanonicalCareerPack, hashCareerPackScenarioDefinition, sha256Hex } from "../hash";
import { compareSemanticVersionPrecedence, isStrictlyGreaterVersion } from "../semver";
import {
  careerPackDraftRecordSchema,
  careerPackGovernanceRecordSchema,
  careerPackPublishedRecordSchema,
  type CareerPackScenarioRunAttestation,
} from "../schema";
import { validateCareerPackPublicationGate } from "../publication-gate";
import {
  CareerPackGovernanceError,
  createCareerPackDraft,
  transitionCareerPackToApproved,
  transitionCareerPackToPublished,
  transitionCareerPackToReviewed,
  transitionCareerPackToWithdrawn,
  validateCareerPackGovernanceRecord,
  validateCareerPackVersionLineage,
} from "../lifecycle";
import { buildCareerPackProjectionManifest } from "../projection";
import {
  admin,
  approver,
  APPROVED_AT,
  APPROVER_ID,
  author,
  AUTHOR_ID,
  AUTHORED_AT,
  ENGINE_VERSION,
  packInput,
  PUBLISHED_AT,
  RECORD_ID,
  reviewer,
  REVIEWER_ID,
  REVIEWED_AT,
  RUN_AT,
  viewer,
  WITHDRAWN_AT,
} from "./fixtures";

/* Helpers ----------------------------------------------------------------- */

function draft(mutate?: (pack: any) => void) {
  return createCareerPackDraft({
    candidatePack: packInput(mutate),
    governanceRecordId: RECORD_ID,
    author,
    authoredAt: AUTHORED_AT,
  });
}

function reviewed(mutate?: (pack: any) => void) {
  return transitionCareerPackToReviewed({
    record: draft(mutate),
    reviewer,
    reviewedAt: REVIEWED_AT,
  });
}

function approved(mutate?: (pack: any) => void) {
  return transitionCareerPackToApproved({
    record: reviewed(mutate),
    approver,
    approvedAt: APPROVED_AT,
  });
}

function attestationsFor(
  record: ReturnType<typeof approved>,
  override: Partial<CareerPackScenarioRunAttestation> = {},
): CareerPackScenarioRunAttestation[] {
  return record.pack.scenarios.map((scenario) => ({
    scenarioKey: scenario.scenarioKey,
    scenarioDefinitionHash: hashCareerPackScenarioDefinition(scenario),
    careerPackContentHash: record.contentHash,
    decisionEngineVersion: ENGINE_VERSION,
    passed: true,
    runAt: RUN_AT,
    ...override,
  }));
}

function published(previous: { id: string; version: string; contentHash: string } | null = null) {
  const record = approved();
  return transitionCareerPackToPublished({
    record,
    publisher: approver,
    publishedAt: PUBLISHED_AT,
    decisionEngineVersion: ENGINE_VERSION,
    attestations: attestationsFor(record),
    previousPublishedRef: previous,
  });
}

/* A. lifecycle catalogue -------------------------------------------------- */

describe("A. lifecycle state catalogue", () => {
  it("contains exactly the five approved states in order", () => {
    expect(CAREER_PACK_LIFECYCLE_STATES).toEqual([
      "draft",
      "reviewed",
      "approved",
      "published",
      "withdrawn",
    ]);
  });

  it("is frozen against cast-based mutation", () => {
    const mutable = CAREER_PACK_LIFECYCLE_STATES as unknown as string[];
    expect(() => mutable.push("archived")).toThrow();
    expect(CAREER_PACK_LIFECYCLE_STATES).toHaveLength(5);
    expect(CAREER_PACK_LIFECYCLE_STATES as readonly string[]).not.toContain("in_review");
    expect(CAREER_PACK_LIFECYCLE_STATES as readonly string[]).not.toContain("rejected");
  });
});

/* B. role catalogue ------------------------------------------------------- */

describe("B. internal governance role catalogue", () => {
  it("is exactly the Increment 1 internal role set", () => {
    expect(INTERNAL_GOVERNANCE_ROLES).toEqual([
      "viewer",
      "editor",
      "reviewer",
      "approver",
      "admin",
    ]);
  });

  it("leaks no institution role", () => {
    for (const role of ["adviser", "careers_lead", "institution_admin", "read_only"]) {
      expect(INTERNAL_GOVERNANCE_ROLES as readonly string[]).not.toContain(role);
    }
  });

  it("is frozen against cast-based mutation", () => {
    const mutable = INTERNAL_GOVERNANCE_ROLES as unknown as string[];
    expect(() => mutable.push("publisher")).toThrow();
    expect(INTERNAL_GOVERNANCE_ROLES).toHaveLength(5);
    expect(() => (GOVERNANCE_CAPABILITY_ROLES as any).publish.push("viewer")).toThrow();
  });
});

/* C. role authority ------------------------------------------------------- */

describe("C. role authority", () => {
  it("requires editor or admin to create a draft", () => {
    expect(draft().state).toBe("draft");
    expect(() =>
      createCareerPackDraft({
        candidatePack: packInput(),
        governanceRecordId: RECORD_ID,
        author: viewer,
        authoredAt: AUTHORED_AT,
      }),
    ).toThrow(CareerPackGovernanceError);
    expect(
      createCareerPackDraft({
        candidatePack: packInput(),
        governanceRecordId: RECORD_ID,
        author: admin(AUTHOR_ID),
        authoredAt: AUTHORED_AT,
      }).author.authorityRole,
    ).toBe("admin");
  });

  it("requires reviewer or admin to review, and denies viewer", () => {
    expect(reviewed().state).toBe("reviewed");
    expect(() =>
      transitionCareerPackToReviewed({
        record: draft(),
        reviewer: viewer,
        reviewedAt: REVIEWED_AT,
      }),
    ).toThrow(/unauthorised_role/);
    expect(() =>
      transitionCareerPackToReviewed({
        record: draft(),
        reviewer: author,
        reviewedAt: REVIEWED_AT,
      }),
    ).toThrow(/unauthorised_role|actor_separation/);
  });

  it("requires approver or admin to approve, publish and withdraw", () => {
    expect(approved().state).toBe("approved");
    expect(() =>
      transitionCareerPackToApproved({
        record: reviewed(),
        approver: viewer,
        approvedAt: APPROVED_AT,
      }),
    ).toThrow(/unauthorised_role/);

    const record = approved();
    expect(() =>
      transitionCareerPackToPublished({
        record,
        publisher: viewer,
        publishedAt: PUBLISHED_AT,
        decisionEngineVersion: ENGINE_VERSION,
        attestations: attestationsFor(record),
        previousPublishedRef: null,
      }),
    ).toThrow(/unauthorised_role/);

    expect(() =>
      transitionCareerPackToWithdrawn({
        record: published(),
        actor: viewer,
        withdrawnAt: WITHDRAWN_AT,
        reasonKey: "reason_superseded",
      }),
    ).toThrow(/unauthorised_role/);
  });

  it("records the narrowest authority role actually held", () => {
    expect(reviewed().review.reviewer.authorityRole).toBe("reviewer");
    expect(approved().approval.approver.authorityRole).toBe("approver");
  });
});

/* D. admin cannot bypass separation --------------------------------------- */

describe("D. admin has capability but never bypasses actor separation", () => {
  it("blocks an admin author from reviewing their own draft", () => {
    const record = createCareerPackDraft({
      candidatePack: packInput(),
      governanceRecordId: RECORD_ID,
      author: admin(AUTHOR_ID),
      authoredAt: AUTHORED_AT,
    });
    expect(() =>
      transitionCareerPackToReviewed({
        record,
        reviewer: admin(AUTHOR_ID),
        reviewedAt: REVIEWED_AT,
      }),
    ).toThrow(/actor_separation_violation/);
  });

  it("blocks admin self-approval by the author or the reviewer", () => {
    const record = reviewed();
    expect(() =>
      transitionCareerPackToApproved({
        record,
        approver: admin(AUTHOR_ID),
        approvedAt: APPROVED_AT,
      }),
    ).toThrow(/actor_separation_violation/);
    expect(() =>
      transitionCareerPackToApproved({
        record,
        approver: admin(REVIEWER_ID),
        approvedAt: APPROVED_AT,
      }),
    ).toThrow(/actor_separation_violation/);
  });
});

/* E. strict state schemas ------------------------------------------------- */

describe("E. strict state schemas reject impossible combinations", () => {
  it("rejects a draft carrying approval or publication data", () => {
    const record = { ...draft(), approval: { approver: approved().approval.approver } };
    expect(careerPackDraftRecordSchema.safeParse(record).success).toBe(false);
    expect(careerPackGovernanceRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects a reviewed record carrying publication data", () => {
    const record = { ...reviewed(), publication: published().publication };
    expect(careerPackGovernanceRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects an approved record missing review", () => {
    const record: Record<string, unknown> = { ...approved() };
    delete record["review"];
    expect(careerPackGovernanceRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects a published record missing approval", () => {
    const record: Record<string, unknown> = { ...published() };
    delete record["approval"];
    expect(careerPackPublishedRecordSchema.safeParse(record).success).toBe(false);
  });

  it("does not silently strip unknown top-level governance fields", () => {
    const result = careerPackGovernanceRecordSchema.safeParse({
      ...draft(),
      publishedByAi: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects bad ids, timestamps, hashes, versions and roles", () => {
    const base = draft();
    const bad: Record<string, unknown>[] = [
      { ...base, governanceRecordId: "not-a-uuid" },
      { ...base, contentHash: "ABC" },
      { ...base, author: { ...base.author, at: "2026-01-01" } },
      { ...base, author: { ...base.author, authorityRole: "viewer" } },
      { ...base, author: { ...base.author, authorityRole: "adviser" } },
    ];
    for (const record of bad) {
      expect(careerPackGovernanceRecordSchema.safeParse(record).success).toBe(false);
    }
  });
});

/* F. timestamps ----------------------------------------------------------- */

describe("F. timestamps must be monotonic", () => {
  it("rejects review before authoring", () => {
    expect(() =>
      transitionCareerPackToReviewed({
        record: draft(),
        reviewer,
        reviewedAt: "2025-12-31T00:00:00Z",
      }),
    ).toThrow(/timestamp_reversal/);
  });

  it("rejects approval before review and publication before approval", () => {
    expect(() =>
      transitionCareerPackToApproved({
        record: reviewed(),
        approver,
        approvedAt: AUTHORED_AT,
      }),
    ).toThrow(/timestamp_reversal/);
    const record = approved();
    expect(() =>
      transitionCareerPackToPublished({
        record,
        publisher: approver,
        publishedAt: REVIEWED_AT,
        decisionEngineVersion: ENGINE_VERSION,
        attestations: attestationsFor(record),
        previousPublishedRef: null,
      }),
    ).toThrow(/timestamp_reversal/);
  });

  it("rejects withdrawal before publication", () => {
    expect(() =>
      transitionCareerPackToWithdrawn({
        record: published(),
        actor: approver,
        withdrawnAt: APPROVED_AT,
        reasonKey: "reason_a",
      }),
    ).toThrow(/timestamp_reversal/);
  });

  it("detects timestamp reversal in an externally supplied record", () => {
    const record = reviewed();
    const tampered = {
      ...record,
      review: { reviewer: { ...record.review.reviewer, at: "2025-01-01T00:00:00Z" } },
    };
    const result = validateCareerPackGovernanceRecord(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((i) => i.code)).toContain("timestamp_reversal");
    }
  });
});

/* G/H/I. hashing ---------------------------------------------------------- */

describe("G. deterministic canonical hashing", () => {
  it("is stable and a valid lowercase SHA-256", () => {
    const a = hashCanonicalCareerPack(parseCanonicalCareerPack(packInput()));
    const b = hashCanonicalCareerPack(parseCanonicalCareerPack(packInput()));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("changes when consequential content changes", () => {
    const base = hashCanonicalCareerPack(parseCanonicalCareerPack(packInput()));
    const changed = hashCanonicalCareerPack(
      parseCanonicalCareerPack(packInput((p) => (p.requirements[0].severity = "contextual"))),
    );
    expect(changed).not.toBe(base);
  });

  it("rejects non-JSON-safe values in the canonical serialiser", () => {
    expect(() => canonicalJsonStringify({ a: Number.NaN })).toThrow(CanonicalJsonError);
    expect(() => canonicalJsonStringify({ a: Infinity })).toThrow(CanonicalJsonError);
    expect(() => canonicalJsonStringify({ a: new Date() })).toThrow(CanonicalJsonError);
    expect(() => canonicalJsonStringify({ a: 1n })).toThrow(CanonicalJsonError);
    expect(() => canonicalJsonStringify([undefined])).toThrow(CanonicalJsonError);
  });

  it("omits undefined properties exactly like JSON", () => {
    expect(canonicalJsonStringify({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("H. key order irrelevant, array order relevant", () => {
  it("ignores object insertion order", () => {
    expect(canonicalJsonStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJsonStringify({ a: { c: 3, d: 2 }, b: 1 }),
    );
    const forward = parseCanonicalCareerPack(packInput());
    const reordered = parseCanonicalCareerPack(
      packInput((p) => {
        const entries = Object.entries(p).reverse();
        for (const key of Object.keys(p)) delete p[key];
        for (const [key, value] of entries) p[key] = value;
      }),
    );
    expect(hashCanonicalCareerPack(reordered)).toBe(hashCanonicalCareerPack(forward));
  });

  it("treats authored array order as canonical data", () => {
    const base = hashCanonicalCareerPack(parseCanonicalCareerPack(packInput()));
    const flipped = hashCanonicalCareerPack(
      parseCanonicalCareerPack(packInput((p) => p.rankingConfigs[0].factors.reverse())),
    );
    expect(flipped).not.toBe(base);
    expect(canonicalJsonStringify([1, 2])).not.toBe(canonicalJsonStringify([2, 1]));
  });
});

describe("I. omitted vs defaulted canonical fields", () => {
  it("hash identically after canonical parsing", () => {
    const withExplicitDefault = hashCanonicalCareerPack(parseCanonicalCareerPack(packInput()));
    const omitted = hashCanonicalCareerPack(
      parseCanonicalCareerPack(
        packInput((p) => {
          delete p.requirements[1].evidenceKeys;
        }),
      ),
    );
    expect(omitted).toBe(withExplicitDefault);
  });
});

/* J/K. content binding and purity ---------------------------------------- */

describe("J. content changes invalidate prior stage records", () => {
  it("detects a tampered pack under a reviewed record", () => {
    const record = reviewed();
    const tampered = {
      ...record,
      pack: { ...record.pack, version: "9.9.9" },
    };
    const result = validateCareerPackGovernanceRecord(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.issues.map((i) => i.code)).toContain("content_hash_mismatch");
  });

  it("blocks review when the stored hash no longer matches the pack", () => {
    const record = reviewed();
    const badDraft = {
      governanceRecordId: record.governanceRecordId,
      state: "draft" as const,
      pack: record.pack,
      contentHash: sha256Hex("something else"),
      author: record.author,
    };
    expect(() =>
      transitionCareerPackToReviewed({ record: badDraft, reviewer, reviewedAt: REVIEWED_AT }),
    ).toThrow(/content_hash_mismatch/);
  });

  it("carries the same hash and record id through every transition", () => {
    const d = draft();
    const r = transitionCareerPackToReviewed({ record: d, reviewer, reviewedAt: REVIEWED_AT });
    const a = transitionCareerPackToApproved({ record: r, approver, approvedAt: APPROVED_AT });
    const p = transitionCareerPackToPublished({
      record: a,
      publisher: approver,
      publishedAt: PUBLISHED_AT,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: attestationsFor(a),
      previousPublishedRef: null,
    });
    const w = transitionCareerPackToWithdrawn({
      record: p,
      actor: approver,
      withdrawnAt: WITHDRAWN_AT,
      reasonKey: "reason_a",
    });
    for (const record of [d, r, a, p, w]) {
      expect(record.contentHash).toBe(d.contentHash);
      expect(record.governanceRecordId).toBe(RECORD_ID);
      expect(record.pack.version).toBe(d.pack.version);
    }
  });
});

describe("K. transitions are pure and expose no mutation API", () => {
  it("leaves the input record unchanged and frozen", () => {
    const d = draft();
    const snapshot = canonicalJsonStringify(JSON.parse(JSON.stringify(d)) as unknown);
    transitionCareerPackToReviewed({ record: d, reviewer, reviewedAt: REVIEWED_AT });
    expect(canonicalJsonStringify(JSON.parse(JSON.stringify(d)) as unknown)).toBe(snapshot);
    expect(Object.isFrozen(d)).toBe(true);
    expect(d.state).toBe("draft");
  });

  it("exports no updateDraft or edit API", async () => {
    const pkg = (await import("..")) as Record<string, unknown>;
    for (const name of Object.keys(pkg)) {
      expect(name).not.toMatch(/^(updateDraft|editPack|mutate|setState|patchRecord)/);
    }
  });
});

/* L/M/N. semver lineage --------------------------------------------------- */

describe("L. SemVer precedence", () => {
  it("orders releases and prereleases per SemVer 2.0.0", () => {
    expect(compareSemanticVersionPrecedence("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemanticVersionPrecedence("2.0.0", "1.9.9")).toBe(1);
    expect(compareSemanticVersionPrecedence("1.0.0", "1.0.1")).toBe(-1);
    expect(compareSemanticVersionPrecedence("1.0.0-alpha", "1.0.0")).toBe(-1);
    expect(compareSemanticVersionPrecedence("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
    expect(compareSemanticVersionPrecedence("1.0.0-alpha.1", "1.0.0-alpha.beta")).toBe(-1);
    expect(compareSemanticVersionPrecedence("1.0.0-beta.2", "1.0.0-beta.11")).toBe(-1);
    expect(compareSemanticVersionPrecedence("1.0.0-rc.1", "1.0.0")).toBe(-1);
  });

  it("ignores build metadata for precedence", () => {
    expect(compareSemanticVersionPrecedence("1.0.0+build.1", "1.0.0+build.9")).toBe(0);
    expect(isStrictlyGreaterVersion("1.0.0+b2", "1.0.0+b1")).toBe(false);
  });
});

describe("M/N. publication lineage rules", () => {
  const previous = (version: string) => ({
    id: published().pack.careerPackId,
    version,
    contentHash: sha256Hex("previous"),
  });

  it("allows a strictly greater version", () => {
    expect(published(previous("2.3.0")).state).toBe("published");
  });

  it("blocks the same, lower and build-only-different version", () => {
    for (const version of ["2.3.1", "2.4.0", "2.3.1+build.7"]) {
      expect(() => published(previous(version))).toThrow(/version_not_greater/);
    }
  });

  it("allows first publication with no previous ref", () => {
    expect(published(null).publication.previousPublishedRef).toBeNull();
  });

  it("rejects a previous ref for a different careerPackId", () => {
    expect(() =>
      published({
        id: "99999999-9999-4999-8999-999999999999",
        version: "1.0.0",
        contentHash: sha256Hex("other"),
      }),
    ).toThrow(/lineage_pack_mismatch/);
  });

  it("does not permit version reuse after withdrawal", () => {
    const lineage = validateCareerPackVersionLineage({
      careerPackId: published().pack.careerPackId,
      candidateVersion: "2.3.1",
      previousPublishedRef: { id: published().pack.careerPackId, version: "2.3.1" },
    });
    expect(lineage.ok).toBe(false);
  });
});

/* O–U. publication gate --------------------------------------------------- */

describe("O–U. publication gate", () => {
  it("accepts only an approved record", () => {
    const gate = validateCareerPackPublicationGate({
      record: reviewed() as never,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: [],
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.issues[0]!.code).toBe("wrong_state");
  });

  it("blocks a pack with zero scenarios", () => {
    const record = approved((p) => (p.scenarios = []));
    const gate = validateCareerPackPublicationGate({
      record,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: [],
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.issues.map((i) => i.code)).toContain("no_scenarios");
  });

  const cases: Array<
    [string, string, (record: ReturnType<typeof approved>) => CareerPackScenarioRunAttestation[]]
  > = [
    ["missing attestation", "scenario_missing_attestation", () => []],
    [
      "duplicate attestation",
      "scenario_duplicate_attestation",
      (record) => [...attestationsFor(record), ...attestationsFor(record)],
    ],
    [
      "unknown scenario attestation",
      "scenario_unknown_attestation",
      (record) => [
        ...attestationsFor(record),
        { ...attestationsFor(record)[0]!, scenarioKey: "scenario_ghost" },
      ],
    ],
    [
      "failed attestation",
      "scenario_not_passed",
      (record) => attestationsFor(record, { passed: false }),
    ],
    [
      "wrong scenario definition hash",
      "scenario_definition_hash_mismatch",
      (record) => attestationsFor(record, { scenarioDefinitionHash: sha256Hex("wrong") }),
    ],
    [
      "wrong pack content hash",
      "scenario_pack_hash_mismatch",
      (record) => attestationsFor(record, { careerPackContentHash: sha256Hex("wrong") }),
    ],
    [
      "wrong engine version",
      "scenario_engine_version_mismatch",
      (record) => attestationsFor(record, { decisionEngineVersion: "2.0.0" }),
    ],
  ];

  for (const [label, code, build] of cases) {
    it(`blocks publication on ${label}`, () => {
      const record = approved();
      const gate = validateCareerPackPublicationGate({
        record,
        decisionEngineVersion: ENGINE_VERSION,
        attestations: build(record),
      });
      expect(gate.ok).toBe(false);
      if (!gate.ok) expect(gate.issues.map((i) => i.code)).toContain(code);

      expect(() =>
        transitionCareerPackToPublished({
          record,
          publisher: approver,
          publishedAt: PUBLISHED_AT,
          decisionEngineVersion: ENGINE_VERSION,
          attestations: build(record),
          previousPublishedRef: null,
        }),
      ).toThrow(CareerPackGovernanceError);
    });
  }

  it("blocks an invalid Decision Engine version", () => {
    const record = approved();
    const gate = validateCareerPackPublicationGate({
      record,
      decisionEngineVersion: "v1",
      attestations: attestationsFor(record, { decisionEngineVersion: "v1" as never }),
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.issues.map((i) => i.code)).toContain("invalid_engine_version");
  });

  it("passes with the exact complete passing attestation set", () => {
    const record = approved();
    const gate = validateCareerPackPublicationGate({
      record,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: attestationsFor(record),
    });
    expect(gate).toEqual({ ok: true });
  });
});

/* V/W. publication output ------------------------------------------------- */

describe("V/W. publication output", () => {
  it("preserves the exact pack, version and hash and is deeply frozen", () => {
    const record = approved();
    const result = transitionCareerPackToPublished({
      record,
      publisher: approver,
      publishedAt: PUBLISHED_AT,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: attestationsFor(record),
      previousPublishedRef: null,
    });
    expect(result.contentHash).toBe(record.contentHash);
    expect(result.pack.version).toBe(record.pack.version);
    expect(hashCanonicalCareerPack(result.pack)).toBe(record.contentHash);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.publication.attestations)).toBe(true);
    expect(Object.isFrozen(result.pack.routes[0])).toBe(true);
  });

  it("allows the publisher to be the approver and imposes no publisher separation", () => {
    const record = approved();
    const byApprover = transitionCareerPackToPublished({
      record,
      publisher: approver,
      publishedAt: PUBLISHED_AT,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: attestationsFor(record),
      previousPublishedRef: null,
    });
    expect(byApprover.publication.publisher.internalUserId).toBe(APPROVER_ID);

    const byOther = transitionCareerPackToPublished({
      record,
      publisher: { internalUserId: "f1f1f1f1-6666-4666-8666-f1f1f1f1f1f1", roles: ["approver"] },
      publishedAt: PUBLISHED_AT,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: attestationsFor(record),
      previousPublishedRef: null,
    });
    expect(byOther.state).toBe("published");
  });

  it("records the exact engine version and attestation order", () => {
    const record = published();
    expect(record.publication.decisionEngineVersion).toBe(ENGINE_VERSION);
    expect(record.publication.attestations.map((a) => a.scenarioKey)).toEqual(
      record.pack.scenarios.map((s) => s.scenarioKey),
    );
  });
});

/* 13. published immutability --------------------------------------------- */

describe("13. published and withdrawn immutability", () => {
  it("resists cast-based mutation of every governed field", () => {
    const record = published() as any;
    const before = JSON.parse(JSON.stringify(record)) as unknown;
    const attempts = [
      () => (record.state = "draft"),
      () => (record.contentHash = sha256Hex("x")),
      () => (record.pack.version = "9.9.9"),
      () => (record.pack.routes[0].routeKey = "hacked"),
      () => record.pack.routes.push({}),
      () => (record.author.internalUserId = APPROVER_ID),
      () => (record.publication.decisionEngineVersion = "9.9.9"),
      () => (record.publication.attestations[0].passed = false),
      () => record.publication.attestations.push({}),
    ];
    for (const attempt of attempts) expect(attempt).toThrow();
    expect(JSON.parse(JSON.stringify(record))).toEqual(before);
  });

  it("freezes a withdrawn record too", () => {
    const record = transitionCareerPackToWithdrawn({
      record: published(),
      actor: approver,
      withdrawnAt: WITHDRAWN_AT,
      reasonKey: "reason_superseded",
    }) as any;
    expect(() => (record.withdrawal.reasonKey = "other")).toThrow();
    expect(Object.isFrozen(record.publication.attestations[0])).toBe(true);
  });
});

/* X. withdrawal ----------------------------------------------------------- */

describe("X. withdrawal preserves history", () => {
  const source = published();
  const record = transitionCareerPackToWithdrawn({
    record: source,
    actor: approver,
    withdrawnAt: WITHDRAWN_AT,
    reasonKey: "reason_superseded",
  });

  it("keeps the same pack, hash and every prior stage", () => {
    expect(record.state).toBe("withdrawn");
    expect(record.contentHash).toBe(source.contentHash);
    expect(record.pack).toEqual(source.pack);
    expect(record.review).toEqual(source.review);
    expect(record.approval).toEqual(source.approval);
    expect(record.publication).toEqual(source.publication);
    expect(record.withdrawal.reasonKey).toBe("reason_superseded");
  });

  it("exposes no delete or reinstate transition", async () => {
    const pkg = (await import("..")) as Record<string, unknown>;
    for (const name of Object.keys(pkg)) {
      expect(name).not.toMatch(/delete|reinstate|unwithdraw|restore|republish/i);
    }
  });
});

/* Y. projection manifest -------------------------------------------------- */

describe("Y. projection manifest", () => {
  it("is derived only from a published record", () => {
    for (const record of [draft(), reviewed(), approved()]) {
      expect(() => buildCareerPackProjectionManifest(record)).toThrow(CareerPackGovernanceError);
    }
    const withdrawn = transitionCareerPackToWithdrawn({
      record: published(),
      actor: approver,
      withdrawnAt: WITHDRAWN_AT,
      reasonKey: "reason_a",
    });
    expect(() => buildCareerPackProjectionManifest(withdrawn)).toThrow();
    expect(buildCareerPackProjectionManifest(published()).source.contentHash).toBe(
      published().contentHash,
    );
  });

  it("is deterministic, hash-pinned, ordered and frozen", () => {
    const record = published();
    const a = buildCareerPackProjectionManifest(record);
    const b = buildCareerPackProjectionManifest(record);
    expect(canonicalJsonStringify(a)).toBe(canonicalJsonStringify(b));
    expect(a.source).toEqual({
      id: record.pack.careerPackId,
      version: record.pack.version,
      contentHash: record.contentHash,
    });
    expect(a.keys.rankingConfigKeys).toEqual(
      record.pack.rankingConfigs.map((c) => c.rankingConfigKey),
    );
    expect(a.keys.routeKeys).toEqual(record.pack.routes.map((r) => r.routeKey));
    expect(Object.isFrozen(a)).toBe(true);
    expect(() => ((a as any).keys.routeKeys as string[]).push("x")).toThrow();
  });

  it("carries no authoring content and no table/DDL naming", () => {
    const manifest = buildCareerPackProjectionManifest(published());
    const serialised = canonicalJsonStringify(manifest);
    for (const token of [
      "when",
      "operator",
      "severity",
      "expect",
      "answers",
      "create table",
      "insert into",
      "select ",
      "public.",
    ]) {
      expect(serialised.toLowerCase()).not.toContain(token);
    }
    expect(Object.keys(manifest).sort()).toEqual([
      "decisionEngineVersion",
      "governanceRecordId",
      "keys",
      "occupationId",
      "occupationKey",
      "schemaVersion",
      "source",
    ]);
  });
});

/* 9. attestation contract boundary --------------------------------------- */

describe("9. scenario attestation contract carries no engine execution", () => {
  it("accepts only the six approved fields", () => {
    const record = approved();
    const attestation = attestationsFor(record)[0]!;
    expect(Object.keys(attestation).sort()).toEqual([
      "careerPackContentHash",
      "decisionEngineVersion",
      "passed",
      "runAt",
      "scenarioDefinitionHash",
      "scenarioKey",
    ]);
  });

  it("rejects model, prompt or result payload fields", () => {
    const record = approved();
    const attestation = { ...attestationsFor(record)[0]!, model: "gpt", result: {} };
    const gate = validateCareerPackPublicationGate({
      record,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: [attestation as never],
    });
    // The gate itself strict-parses every attestation: an extra `model`,
    // `prompt` or `result` field FAILS the gate rather than being ignored.
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.issues.some((issue) => issue.code === "schema_invalid")).toBe(true);
    }
    expect(() =>
      transitionCareerPackToPublished({
        record,
        publisher: approver,
        publishedAt: PUBLISHED_AT,
        decisionEngineVersion: ENGINE_VERSION,
        attestations: [attestation as never],
        previousPublishedRef: null,
      }),
    ).toThrow(/schema_invalid/);
  });
});
