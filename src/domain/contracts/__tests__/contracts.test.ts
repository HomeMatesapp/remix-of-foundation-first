import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DOMAIN_CONTRACT_VERSION,
  candidateRouteEvaluationSchema,
  deterministicProvenanceSchema,
  internalEvidenceGradeSchema,
  isoTimestampSchema,
  participantEvidenceClassificationSchema,
  realityCheckJudgementSchema,
  realityCheckResultSchema,
  requirementAssessmentSchema,
  requirementSeveritySchema,
  requirementStateSchema,
  barrierResultItemSchema,
  evidenceReferenceSchema,
  rankingMetadataSchema,
  sourceRecordKeySchema,
  stableKeySchema,
  semanticVersionSchema,
  sha256HashSchema,
  uuidSchema,
} from "../index";

const UUID = "3f7b1c2e-8a4d-4c1b-9e2f-5a6b7c8d9e01";
const HASH = "a".repeat(64);

const provenance = {
  careerPackId: UUID,
  careerPackVersion: "1.2.3",
  careerPackContentHash: HASH,
  decisionEngineVersion: "0.1.0",
  answerSnapshot: { id: UUID, contentHash: "b".repeat(64) },
  evidenceContext: { id: UUID, contentHash: "c".repeat(64) },
  evaluatedAt: "2026-08-25T11:00:00.000Z",
};

describe("A. protected Reality Check judgement", () => {
  it("accepts exactly the four values", () => {
    expect(realityCheckJudgementSchema.options).toEqual([
      "realistic_now",
      "realistic_with_conditions",
      "not_realistic_yet",
      "more_information_needed",
    ]);
    for (const value of realityCheckJudgementSchema.options) {
      expect(realityCheckJudgementSchema.parse(value)).toBe(value);
    }
  });

  it.each(["realistic", "REALISTIC_NOW", "not_realistic", "unknown", "needs_more_information", ""])(
    "rejects %s",
    (value) => {
      expect(realityCheckJudgementSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("B. requirement vocabularies", () => {
  it("has the exact requirement states", () => {
    expect(requirementStateSchema.options).toEqual([
      "met",
      "unmet",
      "unknown",
      "verification_required",
      "not_applicable",
    ]);
  });

  it("has the exact severities", () => {
    expect(requirementSeveritySchema.options).toEqual(["mandatory", "preferred", "contextual"]);
  });

  it("keeps unknown distinct from unmet", () => {
    expect(requirementStateSchema.parse("unknown")).not.toBe(requirementStateSchema.parse("unmet"));
  });

  it.each(["required", "pending", "optional", "blocked"])("rejects %s", (value) => {
    expect(requirementStateSchema.safeParse(value).success).toBe(false);
    expect(requirementSeveritySchema.safeParse(value).success).toBe(false);
  });
});

describe("C. evidence vocabularies", () => {
  it("has exact internal grades", () => {
    expect(internalEvidenceGradeSchema.options).toEqual(["A", "B", "C", "D"]);
    expect(internalEvidenceGradeSchema.safeParse("E").success).toBe(false);
    expect(internalEvidenceGradeSchema.safeParse("a").success).toBe(false);
  });

  it("has exact participant-facing classifications", () => {
    expect(participantEvidenceClassificationSchema.options).toEqual([
      "confirmed_requirement",
      "provider_dependent",
      "general_guidance",
      "needs_verification",
    ]);
    expect(participantEvidenceClassificationSchema.safeParse("verified").success).toBe(false);
  });
});

describe("D. primitives reject malformed values", () => {
  it("uuid", () => {
    expect(uuidSchema.parse(UUID)).toBe(UUID);
    for (const bad of ["", "not-a-uuid", UUID.slice(0, -1), `${UUID}-extra`]) {
      expect(uuidSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("semver", () => {
    expect(semanticVersionSchema.parse("1.0.0")).toBe("1.0.0");
    for (const bad of ["1", "1.0", "v1.0.0", "01.0.0", "1.0.0.0", ""]) {
      expect(semanticVersionSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("sha-256", () => {
    expect(sha256HashSchema.parse(HASH)).toBe(HASH);
    for (const bad of ["A".repeat(64), "a".repeat(63), "z".repeat(64), ""]) {
      expect(sha256HashSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("iso timestamp", () => {
    expect(isoTimestampSchema.parse("2026-08-25T11:00:00Z")).toBe("2026-08-25T11:00:00Z");
    expect(isoTimestampSchema.safeParse("2026-08-25T11:00:00+01:00").success).toBe(true);
    for (const bad of [
      "2026-08-25",
      "2026-08-25 11:00:00",
      "2026-08-25T11:00:00",
      "25/08/2026",
      "2026-13-40T11:00:00Z",
      "",
    ]) {
      expect(isoTimestampSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe("E. deterministic provenance", () => {
  it("accepts a complete envelope", () => {
    expect(deterministicProvenanceSchema.parse(provenance).evaluatedAt).toBe(
      provenance.evaluatedAt,
    );
  });

  it.each([
    "careerPackVersion",
    "careerPackContentHash",
    "decisionEngineVersion",
    "answerSnapshot",
    "evidenceContext",
    "evaluatedAt",
  ])("rejects missing %s", (field) => {
    const partial: Record<string, unknown> = { ...provenance };
    delete partial[field];
    expect(deterministicProvenanceSchema.safeParse(partial).success).toBe(false);
  });

  it("allows an absent local snapshot but rejects a malformed one", () => {
    expect(
      deterministicProvenanceSchema.safeParse({ ...provenance, localSnapshot: null }).success,
    ).toBe(true);
    expect(
      deterministicProvenanceSchema.safeParse({
        ...provenance,
        localSnapshot: { id: UUID },
      }).success,
    ).toBe(false);
  });

  it("carries no AI model or prompt fields", () => {
    const parsed = deterministicProvenanceSchema.parse(provenance);
    for (const key of Object.keys(parsed)) {
      expect(key.toLowerCase()).not.toMatch(/model|prompt|llm|ai/);
    }
  });
});

const validRoute = {
  route: { routeKey: "regulated_undergraduate" },
  eligibility: {
    satisfied: null,
    requirementAssessments: [
      {
        requirement: { requirementKey: "nmc_registration" },
        state: "verification_required",
        severity: "mandatory",
      },
    ],
  },
  practicalFit: {
    satisfied: true,
    requirementAssessments: [],
  },
};

describe("F. valid overall result envelope", () => {
  it("parses", () => {
    const result = realityCheckResultSchema.parse({
      contractVersion: DOMAIN_CONTRACT_VERSION,
      judgement: "more_information_needed",
      candidateRoutes: [validRoute],
      unresolvedChecks: [{ checkKey: "confirm_gcse_maths" }],
      barriers: [{ barrierKey: "childcare", blocking: null }],
      provenance,
    });
    expect(result.judgement).toBe("more_information_needed");
    expect(result.candidateRoutes[0]?.eligibility.satisfied).toBeNull();
    expect(result.candidateRoutes[0]?.barriers).toEqual([]);
    expect(DOMAIN_CONTRACT_VERSION).toBe("1.0.0");
  });
});

describe("G. invalid structures fail", () => {
  it("rejects an invalid requirement state", () => {
    expect(
      requirementAssessmentSchema.safeParse({
        requirement: { requirementKey: "x" },
        state: "pending",
        severity: "mandatory",
      }).success,
    ).toBe(false);
  });

  it("rejects malformed provenance inside a result", () => {
    expect(
      realityCheckResultSchema.safeParse({
        contractVersion: DOMAIN_CONTRACT_VERSION,
        judgement: "realistic_now",
        provenance: { ...provenance, careerPackContentHash: "nope" },
      }).success,
    ).toBe(false);
  });

  it("rejects a candidate route with no route identity", () => {
    const { route: _route, ...withoutRoute } = validRoute;
    expect(candidateRouteEvaluationSchema.safeParse(withoutRoute).success).toBe(false);
    expect(candidateRouteEvaluationSchema.safeParse({ ...validRoute, route: {} }).success).toBe(
      false,
    );
  });
});

describe("H. eligibility and practical fit stay separate", () => {
  it("are independent fields with independent unknowns", () => {
    const parsed = candidateRouteEvaluationSchema.parse({
      ...validRoute,
      practicalFit: { satisfied: false, requirementAssessments: [] },
    });
    expect(parsed.eligibility.satisfied).toBeNull();
    expect(parsed.practicalFit.satisfied).toBe(false);
    expect(parsed.eligibility.requirementAssessments).not.toBe(
      parsed.practicalFit.requirementAssessments,
    );
  });

  it("does not derive eligibility from unknown requirement states", () => {
    const parsed = candidateRouteEvaluationSchema.parse(validRoute);
    expect(parsed.eligibility.requirementAssessments[0]?.state).toBe("verification_required");
    expect(parsed.eligibility.satisfied).toBeNull();
  });
});

describe("I. contract package has no framework or database dependencies", () => {
  const contractsDir = path.resolve(__dirname, "..");

  const sourceFiles = readdirSync(contractsDir)
    .filter((entry) => statSync(path.join(contractsDir, entry)).isFile())
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => path.join(contractsDir, entry));

  it("finds the contract source files", () => {
    expect(sourceFiles.length).toBeGreaterThan(5);
  });

  it.each([
    /from\s+["']react/,
    /from\s+["']@supabase/,
    /from\s+["']@tanstack/,
    /from\s+["']@\/integrations/,
    /from\s+["']@\/components/,
    /from\s+["']@\/routes/,
    /\bwindow\./,
    /\bdocument\./,
    /\blocalStorage\b/,
  ])("has no import or usage matching %s", (pattern) => {
    for (const file of sourceFiles) {
      expect(readFileSync(file, "utf8")).not.toMatch(pattern);
    }
  });

  it("imports only zod and sibling contract modules", () => {
    for (const file of sourceFiles) {
      const contents = readFileSync(file, "utf8");
      for (const match of contents.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = match[1]!;
        expect(specifier === "zod" || specifier.startsWith("./")).toBe(true);
      }
    }
  });
});

describe("J. contract version is pinned (reconciliation 1)", () => {
  const base = {
    judgement: "realistic_now" as const,
    provenance,
  };

  it("accepts exactly the current DOMAIN_CONTRACT_VERSION", () => {
    expect(DOMAIN_CONTRACT_VERSION).toBe("1.0.0");
    const parsed = realityCheckResultSchema.parse({
      ...base,
      contractVersion: DOMAIN_CONTRACT_VERSION,
    });
    expect(parsed.contractVersion).toBe("1.0.0");
  });

  it.each(["1.0.1", "1.1.0", "0.9.9", "v1.0.0", "latest", ""])("rejects %s", (value) => {
    expect(realityCheckResultSchema.safeParse({ ...base, contractVersion: value }).success).toBe(
      false,
    );
  });
});

describe("K. ranking metadata has no policy vocabulary (reconciliation 2)", () => {
  it("accepts ordered factor keys, config key and position", () => {
    const parsed = rankingMetadataSchema.parse({
      rankingConfigKey: "default",
      factorKeys: ["local_availability", "route_length"],
      position: 1,
    });
    expect(parsed.factorKeys).toEqual(["local_availability", "route_length"]);
    expect(parsed.position).toBe(1);
  });

  it("defaults factorKeys and allows an unranked null position", () => {
    const parsed = rankingMetadataSchema.parse({ position: null });
    expect(parsed.factorKeys).toEqual([]);
    expect(parsed.position).toBeNull();
  });

  it("exposes no outcome/score/weight/direction/tie-break keys", () => {
    const parsed = rankingMetadataSchema.parse({
      factorKeys: ["a"],
    }) as Record<string, unknown>;
    for (const key of Object.keys(parsed)) {
      expect(key.toLowerCase()).not.toMatch(
        /outcome|score|weight|direction|tiebreak|tie_break|priority|rank_value/,
      );
    }
    const source = readFileSync(path.resolve(__dirname, "..", "result.ts"), "utf8");
    const rankingBlock = source.slice(
      source.indexOf("export const rankingMetadataSchema"),
      source.indexOf("export type RankingMetadata"),
    );
    expect(rankingBlock).not.toMatch(/favoured|disfavoured|neutral|z\.enum/);
  });

  it("rejects previously invented factor outcome objects (fails closed)", () => {
    expect(
      rankingMetadataSchema.safeParse({
        factorKeys: ["a"],
        factors: [{ factorKey: "a", outcome: "favoured" }],
      }).success,
    ).toBe(false);
  });
});

describe("L. barrier item does not reuse requirement severity (reconciliation 3)", () => {
  it("parses without any severity field", () => {
    const parsed = barrierResultItemSchema.parse({
      barrierKey: "childcare",
      blocking: null,
    }) as Record<string, unknown>;
    expect(parsed["severity"]).toBeUndefined();
    expect(parsed["blocking"]).toBeNull();
    expect(parsed["relatedRequirementKeys"]).toEqual([]);
  });

  it("does not accept a requirement severity as barrier severity (fails closed)", () => {
    expect(
      barrierResultItemSchema.safeParse({
        barrierKey: "childcare",
        blocking: false,
        severity: "mandatory",
      }).success,
    ).toBe(false);
  });

  it("declares no barrier severity or priority vocabulary in source", () => {
    const source = readFileSync(path.resolve(__dirname, "..", "result.ts"), "utf8");
    const block = source.slice(
      source.indexOf("export const barrierResultItemSchema"),
      source.indexOf("export type BarrierResultItem"),
    );
    expect(block).not.toMatch(/severity|priority|requirementSeveritySchema/);
    expect(source).not.toMatch(/requirementSeveritySchema/);
  });
});

describe("M. external source record keys are not whitelisted (reconciliation 4)", () => {
  const externalKeys = [
    "OFQUAL/601 2345 6!",
    "urn:soc:2231 (nurse)",
    "record #42 — v2",
    "ключ-123",
  ];

  it.each(externalKeys)("preserves %s verbatim", (key) => {
    expect(sourceRecordKeySchema.parse(key)).toBe(key);
    expect(stableKeySchema.safeParse(key).success).toBe(false);
    const parsed = evidenceReferenceSchema.parse({
      sourceId: UUID,
      sourceRecordKey: key,
    });
    expect(parsed.sourceRecordKey).toBe(key);
  });

  it.each(["", " ", "\t\n"])("rejects blank key %j", (key) => {
    expect(sourceRecordKeySchema.safeParse(key).success).toBe(false);
    expect(
      evidenceReferenceSchema.safeParse({ sourceId: UUID, sourceRecordKey: key }).success,
    ).toBe(false);
  });

  it("does not trim or rewrite a padded external key", () => {
    expect(sourceRecordKeySchema.parse("  abc  ")).toBe("  abc  ");
  });
});

describe("N. provenance is closed to undeclared AI fields (reconciliation 5)", () => {
  it.each(["model", "prompt", "llm", "aiProvider", "temperature", "systemPrompt"])(
    "rejects provenance carrying %s",
    (field) => {
      const result = deterministicProvenanceSchema.safeParse({
        ...provenance,
        [field]: "gpt-whatever",
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects rather than strips, inside the overall result envelope", () => {
    expect(
      realityCheckResultSchema.safeParse({
        contractVersion: DOMAIN_CONTRACT_VERSION,
        judgement: "realistic_now",
        provenance: { ...provenance, prompt: "explain" },
      }).success,
    ).toBe(false);
  });
});
