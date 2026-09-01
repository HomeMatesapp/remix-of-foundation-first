import { describe, expect, it } from "vitest";
import {
  barrierResultItemSchema,
  candidateRouteEvaluationSchema,
  DOMAIN_CONTRACT_VERSION,
  deterministicProvenanceSchema,
  eligibilityOutcomeSchema,
  evidenceReferenceSchema,
  isoTimestampSchema,
  pinnedVersionedRefSchema,
  practicalFitOutcomeSchema,
  rankingMetadataSchema,
  realityCheckResultSchema,
  requirementAssessmentSchema,
  requirementRefSchema,
  routeRefSchema,
  snapshotRefSchema,
  unresolvedCheckItemSchema,
  versionedRefSchema,
} from "../index";

/**
 * Foundation audit reconciliation — Increment 2 contract corrections.
 *
 * R5: `explanationKey` is a machine key, never participant-facing prose.
 * R6: important canonical/reference boundaries fail closed on unknown fields.
 */

const UUID = "11111111-1111-4111-8111-111111111111";
const HASH = "a".repeat(64);
const TS = "2026-08-25T12:00:00Z";

const validRequirementAssessment = {
  requirement: { requirementKey: "qualification.maths_gcse" },
  state: "verification_required" as const,
  severity: "mandatory" as const,
  explanationKey: "qualification_needs_verification",
};

const validEvidenceRef = { sourceId: UUID, sourceRecordKey: "REG/2026/001" };

const validProvenance = {
  careerPackId: UUID,
  careerPackVersion: "1.0.0",
  careerPackContentHash: HASH,
  decisionEngineVersion: "1.0.0",
  answerSnapshot: { id: UUID, contentHash: HASH },
  evidenceContext: { id: UUID, contentHash: HASH },
  evaluatedAt: TS,
};

const validCandidateRoute = {
  route: { routeKey: "route.apprenticeship" },
  eligibility: { satisfied: null, requirementAssessments: [validRequirementAssessment] },
  practicalFit: { satisfied: null, requirementAssessments: [] },
};

const validResult = {
  contractVersion: DOMAIN_CONTRACT_VERSION,
  judgement: "more_information_needed" as const,
  candidateRoutes: [validCandidateRoute],
  provenance: validProvenance,
};

describe("R5. explanationKey is a stable machine key, not prose", () => {
  it("accepts a machine key on a requirement assessment", () => {
    const parsed = requirementAssessmentSchema.parse(validRequirementAssessment);
    expect(parsed.explanationKey).toBe("qualification_needs_verification");
  });

  it("accepts a machine key on an unresolved check", () => {
    const parsed = unresolvedCheckItemSchema.parse({
      checkKey: "check.dbs_status",
      explanationKey: "dbs_status_unknown",
    });
    expect(parsed.explanationKey).toBe("dbs_status_unknown");
  });

  it.each([
    "Your qualification needs verification",
    "needs verification",
    "qualification needs verification.",
    "!qualification",
    "качество ключа",
    "",
    " ",
  ])("rejects participant-facing / invalid machine-key form %j", (value) => {
    expect(
      requirementAssessmentSchema.safeParse({
        ...validRequirementAssessment,
        explanationKey: value,
      }).success,
    ).toBe(false);
    expect(
      unresolvedCheckItemSchema.safeParse({ checkKey: "check.dbs_status", explanationKey: value })
        .success,
    ).toBe(false);
  });

  it("still allows explicit null and omission", () => {
    expect(
      requirementAssessmentSchema.parse({
        ...validRequirementAssessment,
        explanationKey: null,
      }).explanationKey,
    ).toBeNull();
    const { explanationKey: _omitted, ...withoutKey } = validRequirementAssessment;
    expect(requirementAssessmentSchema.safeParse(withoutKey).success).toBe(true);
  });

  it("introduces no participant-facing copy field anywhere in the result envelope", () => {
    const forbidden = ["message", "text", "label", "description", "copy", "summary", "prose"];
    const parsed = realityCheckResultSchema.parse(validResult);
    const serialised = JSON.stringify(parsed);
    for (const field of forbidden) {
      expect(serialised).not.toContain(`"${field}"`);
    }
  });
});

describe("R6. important boundaries reject undeclared fields", () => {
  const cases: Array<
    [string, { safeParse: (v: unknown) => { success: boolean } }, object, object]
  > = [
    [
      "versionedRefSchema",
      versionedRefSchema,
      { id: UUID },
      { id: UUID, sourceOfTruth: "spreadsheet" },
    ],
    [
      "pinnedVersionedRefSchema",
      pinnedVersionedRefSchema,
      { id: UUID, version: "1.0.0", contentHash: HASH },
      { id: UUID, version: "1.0.0", contentHash: HASH, extraMetadata: { note: "unknown" } },
    ],
    [
      "snapshotRefSchema",
      snapshotRefSchema,
      { id: UUID, contentHash: HASH },
      { id: UUID, contentHash: HASH, unknownMetadata: 1 },
    ],
    [
      "evidenceReferenceSchema",
      evidenceReferenceSchema,
      validEvidenceRef,
      { ...validEvidenceRef, model: "gpt-x", claimText: "You are eligible" },
    ],
    [
      "requirementRefSchema",
      requirementRefSchema,
      { requirementKey: "qualification.maths_gcse" },
      { requirementKey: "qualification.maths_gcse", requirementName: "Maths GCSE" },
    ],
    [
      "requirementAssessmentSchema",
      requirementAssessmentSchema,
      validRequirementAssessment,
      { ...validRequirementAssessment, decision: "rejected" },
    ],
    [
      "routeRefSchema",
      routeRefSchema,
      { routeKey: "route.apprenticeship" },
      { routeKey: "route.apprenticeship", routeTitle: "Apprenticeship" },
    ],
    [
      "barrierResultItemSchema",
      barrierResultItemSchema,
      { barrierKey: "barrier.travel", blocking: null },
      { barrierKey: "barrier.travel", blocking: null, severity: "high" },
    ],
    [
      "unresolvedCheckItemSchema",
      unresolvedCheckItemSchema,
      { checkKey: "check.dbs_status" },
      { checkKey: "check.dbs_status", question: "Do you have a DBS?" },
    ],
    [
      "rankingMetadataSchema",
      rankingMetadataSchema,
      { factorKeys: ["factor.distance"] },
      { factorKeys: ["factor.distance"], weight: 0.5 },
    ],
    [
      "eligibilityOutcomeSchema",
      eligibilityOutcomeSchema,
      { satisfied: null },
      { satisfied: null, score: 42 },
    ],
    [
      "practicalFitOutcomeSchema",
      practicalFitOutcomeSchema,
      { satisfied: null },
      { satisfied: null, confidence: 0.9 },
    ],
    [
      "candidateRouteEvaluationSchema",
      candidateRouteEvaluationSchema,
      validCandidateRoute,
      { ...validCandidateRoute, score: 87 },
    ],
    [
      "realityCheckResultSchema",
      realityCheckResultSchema,
      validResult,
      { ...validResult, aiModel: "gpt-x" },
    ],
    [
      "deterministicProvenanceSchema (already strict, preserved)",
      deterministicProvenanceSchema,
      validProvenance,
      { ...validProvenance, promptTemplate: "explain" },
    ],
  ];

  it.each(cases)("%s accepts the declared shape", (_name, schema, valid) => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(cases)("%s rejects an undeclared field", (_name, schema, _valid, hostile) => {
    expect(schema.safeParse(hostile).success).toBe(false);
  });

  it("rejects undeclared fields nested deep inside a result", () => {
    expect(
      realityCheckResultSchema.safeParse({
        ...validResult,
        candidateRoutes: [
          {
            ...validCandidateRoute,
            eligibility: {
              satisfied: null,
              requirementAssessments: [
                { ...validRequirementAssessment, evidence: [{ ...validEvidenceRef, model: "ai" }] },
              ],
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* R5. isoTimestampSchema enforces real Gregorian calendar days               */
/* -------------------------------------------------------------------------- */

describe("isoTimestampSchema calendar validity", () => {
  it("accepts real leap days and ordinary dates", () => {
    for (const value of [
      "2024-02-29T00:00:00Z",
      "2000-02-29T00:00:00Z",
      "0000-02-29T00:00:00Z",
      "2026-01-31T23:59:59.999999999+01:00",
      "0099-01-01T00:00:00Z",
      "0000-01-01T00:00:00Z",
    ]) {
      expect(isoTimestampSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects impossible calendar days", () => {
    for (const value of [
      "2025-02-29T00:00:00Z",
      "2026-02-30T00:00:00Z",
      "1900-02-29T00:00:00Z",
      "2026-04-31T00:00:00Z",
      "2026-13-01T00:00:00Z",
      "2026-00-10T00:00:00Z",
      "2026-01-00T00:00:00Z",
      "2026-06-31T00:00:00Z",
    ]) {
      const result = isoTimestampSchema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("must be a real instant");
      }
    }
  });
});
