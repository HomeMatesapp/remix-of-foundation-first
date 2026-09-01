/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";

import { hashCareerPackScenarioDefinition } from "../hash";
import {
  compareSemanticVersionPrecedence,
  governanceSemanticVersionSchema,
  isValidSemanticVersion,
  parseSemanticVersion,
} from "../semver";
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
import type { CareerPackScenarioRunAttestation, GovernanceActorContext } from "../schema";
import { careerPackLifecycleOrder, CAREER_PACK_LIFECYCLE_STATES } from "../codes";
import {
  approver,
  APPROVED_AT,
  author,
  AUTHORED_AT,
  ENGINE_VERSION,
  packInput,
  PUBLISHED_AT,
  RECORD_ID,
  reviewer,
  REVIEWED_AT,
  RUN_AT,
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

function approved(mutate?: (pack: any) => void) {
  return transitionCareerPackToApproved({
    record: transitionCareerPackToReviewed({
      record: draft(mutate),
      reviewer,
      reviewedAt: REVIEWED_AT,
    }),
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

function published(previous: unknown = null) {
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

/** Structurally corrupt a frozen record by rebuilding it as plain mutable data. */
function mutableClone<T>(record: T): any {
  return JSON.parse(JSON.stringify(record));
}

/* R1. SemVer 2.0.0 correctness -------------------------------------------- */

describe("R1. strict SemVer 2.0.0 validation and precedence", () => {
  it("rejects malformed prerelease and build identifiers", () => {
    for (const invalid of [
      "1.0.0-",
      "1.0.0+",
      "1.0.0-alpha..1",
      "1.0.0-alpha.",
      "1.0.0-01",
      "1.0.0-alpha+",
      "1.0.0-alpha+build..1",
      "1.0.0-alpha_1",
      "1.0.0+build_1",
      "01.0.0",
      "1.0",
      "1.0.0.0",
      "v1.0.0",
      "",
    ]) {
      expect(isValidSemanticVersion(invalid)).toBe(false);
      expect(parseSemanticVersion(invalid)).toBeNull();
      expect(governanceSemanticVersionSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("accepts valid prerelease and build metadata forms", () => {
    for (const valid of [
      "0.0.0",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-0.3.7",
      "1.0.0-x.7.z.92",
      "1.0.0-alpha-1",
      "1.0.0+20130313144700",
      "1.0.0-beta+exp.sha.5114f85",
    ]) {
      expect(isValidSemanticVersion(valid)).toBe(true);
      expect(governanceSemanticVersionSchema.safeParse(valid).success).toBe(true);
    }
  });

  it("compares large numeric identifiers exactly, without Number precision loss", () => {
    expect(
      compareSemanticVersionPrecedence("1.0.0-9007199254740993", "1.0.0-9007199254740992"),
    ).toBe(1);
    expect(compareSemanticVersionPrecedence("9007199254740993.0.0", "9007199254740992.0.0")).toBe(
      1,
    );
    expect(compareSemanticVersionPrecedence("1.0.0-10", "1.0.0-9")).toBe(1);
  });

  it("never lets build metadata affect precedence", () => {
    expect(compareSemanticVersionPrecedence("1.0.0+a", "1.0.0+b")).toBe(0);
    expect(compareSemanticVersionPrecedence("1.0.0-alpha+a", "1.0.0-alpha+b")).toBe(0);
  });

  it("rejects a loose engine version at the governance boundary", () => {
    const record = approved();
    const gate = validateCareerPackPublicationGate({
      record,
      decisionEngineVersion: "1.0.0-01",
      attestations: attestationsFor(record),
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.issues.some((issue) => issue.code === "invalid_engine_version")).toBe(true);
    }
  });
});

/* R2. gate strict-parses untrusted input ---------------------------------- */

describe("R2. publication gate treats every input as untrusted", () => {
  it("rejects non-record, non-array and non-string inputs without throwing", () => {
    const result = validateCareerPackPublicationGate({
      record: { state: "approved" },
      decisionEngineVersion: 1,
      attestations: "not-an-array",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an attestation array containing a non-object entry", () => {
    const record = approved();
    const gate = validateCareerPackPublicationGate({
      record,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: [null],
    });
    expect(gate.ok).toBe(false);
  });

  it("reports wrong_state for a valid non-approved record", () => {
    const gate = validateCareerPackPublicationGate({
      record: draft(),
      decisionEngineVersion: ENGINE_VERSION,
      attestations: [],
    });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.issues[0]?.code).toBe("wrong_state");
  });
});

/* R3 / R5. canonical pack integrity inside governance --------------------- */

describe("R3. governance never blesses a non-canonical embedded pack", () => {
  it("rejects a record whose embedded pack is referentially invalid", () => {
    const record = approved();
    const corrupt = mutableClone(record);
    // Point a requirement rule at a requirement key that does not exist.
    corrupt.pack.requirementRules[0].requirementKey = "requirement:does-not-exist";
    const validated = validateCareerPackGovernanceRecord(corrupt);
    expect(validated.valid).toBe(false);

    const gate = validateCareerPackPublicationGate({
      record: corrupt,
      decisionEngineVersion: ENGINE_VERSION,
      attestations: attestationsFor(record),
    });
    expect(gate.ok).toBe(false);
  });

  it("rejects a record whose contentHash no longer matches its pack", () => {
    const corrupt = mutableClone(approved());
    corrupt.contentHash = "0".repeat(64);
    const validated = validateCareerPackGovernanceRecord(corrupt);
    expect(validated.valid).toBe(false);
    if (!validated.valid) {
      expect(validated.issues.some((issue) => issue.code === "content_hash_mismatch")).toBe(true);
    }
  });
});

/* R4. transitions require a fully valid prior record ---------------------- */

describe("R4. a transition never starts from a semantically invalid record", () => {
  it("refuses to review a draft whose actor separation was forged", () => {
    const corrupt = mutableClone(draft());
    corrupt.contentHash = "1".repeat(64);
    expect(() =>
      transitionCareerPackToReviewed({ record: corrupt, reviewer, reviewedAt: REVIEWED_AT }),
    ).toThrow(CareerPackGovernanceError);
  });

  it("refuses to approve a reviewed record with reversed timestamps", () => {
    const corrupt = mutableClone(approved());
    corrupt.state = "reviewed";
    delete corrupt.approval;
    corrupt.review.reviewer.at = "2020-01-01T00:00:00Z";
    expect(() =>
      transitionCareerPackToApproved({ record: corrupt, approver, approvedAt: APPROVED_AT }),
    ).toThrow(/timestamp_reversal/);
  });

  it("refuses to withdraw a published record with invalid publication evidence", () => {
    const corrupt = mutableClone(published());
    corrupt.publication.attestations[0].passed = false;
    expect(() =>
      transitionCareerPackToWithdrawn({
        record: corrupt,
        actor: approver,
        withdrawnAt: WITHDRAWN_AT,
        reasonKey: "reason:superseded",
      }),
    ).toThrow(CareerPackGovernanceError);
  });

  it("reports wrong_state rather than a shape error for a mismatched state", () => {
    expect(() =>
      transitionCareerPackToApproved({ record: draft(), approver, approvedAt: APPROVED_AT }),
    ).toThrow(/wrong_state/);
  });
});

/* R6. lineage contract ---------------------------------------------------- */

describe("R6. lineage requires a complete pinned reference", () => {
  it("rejects a partial previous ref without a content hash", () => {
    const record = approved();
    const result = validateCareerPackVersionLineage({
      careerPackId: record.pack.careerPackId,
      candidateVersion: "2.0.0",
      previousPublishedRef: { id: record.pack.careerPackId, version: "1.0.0" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]?.code).toBe("invalid_lineage_ref");
  });

  it("rejects an extra field on the previous ref", () => {
    const record = approved();
    const result = validateCareerPackVersionLineage({
      careerPackId: record.pack.careerPackId,
      candidateVersion: "2.0.0",
      previousPublishedRef: {
        id: record.pack.careerPackId,
        version: "1.0.0",
        contentHash: "a".repeat(64),
        publishedAt: PUBLISHED_AT,
      },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid candidate version even with no previous ref", () => {
    const result = validateCareerPackVersionLineage({
      careerPackId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      candidateVersion: "1.0",
      previousPublishedRef: null,
    });
    expect(result.ok).toBe(false);
  });

  it("blocks publication when the previous ref is malformed", () => {
    expect(() =>
      published({ id: "not-a-uuid", version: "1.0.0", contentHash: "a".repeat(64) }),
    ).toThrow(CareerPackGovernanceError);
  });
});

/* R7. manifest is a validated derivative --------------------------------- */

describe("R7. projection manifest is a validated derivative only", () => {
  it("refuses to derive from a shape-valid but semantically invalid record", () => {
    const corrupt = mutableClone(published());
    corrupt.publication.attestations[0].careerPackContentHash = "b".repeat(64);
    expect(() => buildCareerPackProjectionManifest(corrupt)).toThrow(CareerPackGovernanceError);
  });

  it("refuses to derive from a non-published record", () => {
    expect(() => buildCareerPackProjectionManifest(approved())).toThrow(/wrong_state/);
  });

  it("satisfies its own runtime contract for a valid published record", () => {
    const manifest = buildCareerPackProjectionManifest(published());
    expect(manifest.source.contentHash).toHaveLength(64);
    expect(Object.isFrozen(manifest)).toBe(true);
  });
});

/* R8. actor context is runtime validated --------------------------------- */

describe("R8. actor context is strict-parsed before any authority decision", () => {
  const bad = (value: unknown) => value as unknown as GovernanceActorContext;

  it("rejects an empty role array", () => {
    expect(() =>
      createCareerPackDraft({
        candidatePack: packInput(),
        governanceRecordId: RECORD_ID,
        author: bad({ internalUserId: author.internalUserId, roles: [] }),
        authoredAt: AUTHORED_AT,
      }),
    ).toThrow(/invalid_actor_context/);
  });

  it("rejects duplicated roles, unknown roles, bad identity and extra fields", () => {
    for (const invalid of [
      { internalUserId: author.internalUserId, roles: ["editor", "editor"] },
      { internalUserId: author.internalUserId, roles: ["superuser"] },
      { internalUserId: "not-a-uuid", roles: ["editor"] },
      { internalUserId: author.internalUserId, roles: ["editor"], impersonating: true },
      { roles: ["editor"] },
      null,
    ]) {
      expect(() =>
        createCareerPackDraft({
          candidatePack: packInput(),
          governanceRecordId: RECORD_ID,
          author: bad(invalid),
          authoredAt: AUTHORED_AT,
        }),
      ).toThrow(/invalid_actor_context/);
    }
  });
});

/* R9. governed catalogue immutability ------------------------------------ */

describe("R9. lifecycle order is not mutable at runtime", () => {
  it("exposes order as a pure function over the frozen state tuple", () => {
    expect(careerPackLifecycleOrder("draft")).toBe(0);
    expect(careerPackLifecycleOrder("withdrawn")).toBe(4);
    expect(Object.isFrozen(CAREER_PACK_LIFECYCLE_STATES)).toBe(true);
    expect(() => {
      (CAREER_PACK_LIFECYCLE_STATES as unknown as string[]).push("reinstated");
    }).toThrow();
    expect(careerPackLifecycleOrder("published")).toBe(3);
  });
});
