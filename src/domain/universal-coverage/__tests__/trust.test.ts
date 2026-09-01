import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { hashCanonicalCareerPack } from "../../career-pack-governance";
import {
  parseCanonicalOccupationUniverse,
  resolveOccupationIntent,
  type OccupationRecord,
  type OccupationResolution,
} from "../../occupation-universe";
import { buildUnrecognisedIntentCapture } from "../capture";
import * as barrel from "../index";
import { freezeCoverageDocument, unrecognisedIntentCaptureSchema } from "../schema";
import { MIXED_UNIVERSE, SYNTHETIC_UNSUPPORTED_OCCUPATION } from "./fixtures";

/**
 * Hostile runtime trust-boundary regressions.
 *
 * TypeScript is not a runtime trust boundary: every test here hands the PUBLIC
 * package surface a forged object and requires a fail-closed result.
 */

const { resolveRealityCheckCoverageFromPacks } = barrel;

const REAL = ARCHITECTURE_TEST_OCCUPATIONS[0]!;
const OTHER = ARCHITECTURE_TEST_OCCUPATIONS[1]!;

function resolvedFor(record: OccupationRecord): OccupationResolution {
  return {
    outcome: "resolved",
    occupationId: record.occupationId,
    occupationKey: record.occupationKey,
    canonicalTitle: record.canonicalTitle,
    matchedTerm: record.canonicalTitle,
    termCategory: "canonical_title",
    matchMode: "exact",
  };
}

function attempt(
  occupationResolution: unknown,
  packs: readonly unknown[] = ARCHITECTURE_TEST_PACKS,
) {
  return resolveRealityCheckCoverageFromPacks({
    occupationResolution,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    availablePacks: packs,
  });
}

function codes(result: ReturnType<typeof attempt>): readonly string[] {
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("public API surface", () => {
  it("exports only the safe coverage constructor from the governed barrel", () => {
    expect("resolveRealityCheckCoverageFromPacks" in barrel).toBe(true);
    for (const unsafeName of [
      "buildProvisionalAssessmentPlan",
      "buildUnrecognisedIntentCapture",
      "verifyOccupationIntent",
      "buildCareerPackCoverageCatalogue",
      "catalogueEntryForOccupationId",
      "resolveRealityCheckCoverage",
    ]) {
      expect(unsafeName in barrel).toBe(false);
    }

    for (const name of Object.keys(barrel)) {
      expect(name).not.toMatch(/^resolveRealityCheckCoverage$/);
    }
  });

  it("cannot be given a fabricated catalogue entry to obtain full support", () => {
    const forgedCatalogue = [
      {
        occupation: {
          occupationId: SYNTHETIC_UNSUPPORTED_OCCUPATION.occupationId,
          occupationKey: SYNTHETIC_UNSUPPORTED_OCCUPATION.occupationKey,
          canonicalTitle: SYNTHETIC_UNSUPPORTED_OCCUPATION.canonicalTitle,
        },
        pack: {
          careerPackId: "99999999-8888-4777-8666-555544443333",
          version: "9.9.9",
          contentHash: "a".repeat(64),
        },
      },
    ];

    /* There is no public resolver that accepts a catalogue at all. The only
       public path re-establishes pack truth from raw packs. */
    for (const value of Object.values(barrel)) {
      if (typeof value !== "function") continue;
      let outcome: unknown;
      try {
        outcome = (value as (arg: unknown) => unknown)({
          occupationResolution: resolveOccupationIntent(MIXED_UNIVERSE, "Marine Pilot"),
          universe: MIXED_UNIVERSE,
          catalogue: forgedCatalogue,
          availablePacks: [],
        });
      } catch {
        continue;
      }
      expect(JSON.stringify(outcome ?? null)).not.toContain("full_assessment_available");
    }

    const result = resolveRealityCheckCoverageFromPacks({
      occupationResolution: resolveOccupationIntent(MIXED_UNIVERSE, "Marine Pilot"),
      universe: MIXED_UNIVERSE,
      availablePacks: [],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coverage.outcome).toBe("provisional_assessment_available");
  });
});

describe("forged resolved occupation", () => {
  it("accepts a genuine Increment 12 resolved output", () => {
    const result = attempt(
      resolveOccupationIntent(ARCHITECTURE_TEST_OCCUPATIONS, REAL.canonicalTitle),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coverage.outcome).toBe("full_assessment_available");
  });

  it("fails closed when the occupation is absent from the universe", () => {
    const result = attempt({
      outcome: "resolved",
      occupationId: "12345678-1234-4234-8234-123456789012",
      occupationKey: "totally_invented_occupation",
      canonicalTitle: "Invented Occupation",
      matchedTerm: "Invented Occupation",
      termCategory: "canonical_title",
      matchMode: "exact",
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_mismatch");
  });

  it("fails closed for a real id with the wrong key", () => {
    const result = attempt({
      ...resolvedFor(REAL),
      occupationId: REAL.occupationId,
      occupationKey: OTHER.occupationKey,
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_mismatch");
  });

  it("fails closed for a real id/key with a spoofed canonical title", () => {
    const result = attempt({
      ...resolvedFor(REAL),
      occupationId: REAL.occupationId,
      occupationKey: REAL.occupationKey,
      canonicalTitle: "Chief Everything Officer",
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_mismatch");
  });

  it("derives output identity from canonical truth for a legitimate resolution", () => {
    const result = attempt(resolvedFor(REAL));
    expect(result.ok).toBe(true);
    if (!result.ok || result.coverage.outcome !== "full_assessment_available") {
      throw new Error("expected full support");
    }
    expect(result.coverage.occupation.canonicalTitle).toBe(REAL.canonicalTitle);
  });

  it("fails closed when a resolved object carries an unknown extra key", () => {
    const result = attempt({ ...resolvedFor(REAL), trustedByCaller: true });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });

  it("fails closed on an invalid resolved term category", () => {
    const result = attempt({ ...resolvedFor(REAL), termCategory: "made_up_term_category" });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });

  it("fails closed on an invalid resolved match mode", () => {
    const result = attempt({ ...resolvedFor(REAL), matchMode: "semantic" });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });
});

describe("forged clarification and unmatched intent", () => {
  it("fails closed when a candidate is absent from the universe", () => {
    const result = attempt({
      outcome: "clarification_required",
      reason: "generic_collision_word",
      candidates: [
        {
          occupationId: REAL.occupationId,
          occupationKey: REAL.occupationKey,
          canonicalTitle: REAL.canonicalTitle,
        },
        {
          occupationId: "22222222-3333-4444-8555-666677778888",
          occupationKey: "forged_candidate",
          canonicalTitle: "Forged Candidate",
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_mismatch");
  });

  it("fails closed when a candidate title contradicts canonical truth", () => {
    const result = attempt({
      outcome: "clarification_required",
      reason: "exact_term_collision",
      candidates: [
        {
          occupationId: REAL.occupationId,
          occupationKey: REAL.occupationKey,
          canonicalTitle: "Spoofed Title",
        },
        {
          occupationId: OTHER.occupationId,
          occupationKey: OTHER.occupationKey,
          canonicalTitle: OTHER.canonicalTitle,
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_mismatch");
  });

  it("fails closed on an unknown clarification reason", () => {
    const result = attempt({
      outcome: "clarification_required",
      reason: "vibes_collision",
      candidates: [
        {
          occupationId: REAL.occupationId,
          occupationKey: REAL.occupationKey,
          canonicalTitle: REAL.canonicalTitle,
        },
        {
          occupationId: OTHER.occupationId,
          occupationKey: OTHER.occupationKey,
          canonicalTitle: OTHER.canonicalTitle,
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });

  it("fails closed when a clarification object carries an unknown extra key", () => {
    const result = attempt({
      outcome: "clarification_required",
      reason: "generic_collision_word",
      candidates: [
        {
          occupationId: REAL.occupationId,
          occupationKey: REAL.occupationKey,
          canonicalTitle: REAL.canonicalTitle,
        },
        {
          occupationId: OTHER.occupationId,
          occupationKey: OTHER.occupationKey,
          canonicalTitle: OTHER.canonicalTitle,
        },
      ],
      trustedByCaller: true,
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });

  it("fails closed when a clarification candidate carries an unknown extra key", () => {
    const result = attempt({
      outcome: "clarification_required",
      reason: "generic_collision_word",
      candidates: [
        {
          occupationId: REAL.occupationId,
          occupationKey: REAL.occupationKey,
          canonicalTitle: REAL.canonicalTitle,
          trustedByCaller: true,
        },
        {
          occupationId: OTHER.occupationId,
          occupationKey: OTHER.occupationKey,
          canonicalTitle: OTHER.canonicalTitle,
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });

  it("never narrows a legitimate clarification to a single candidate", () => {
    const result = attempt({
      outcome: "clarification_required",
      reason: "generic_collision_word",
      candidates: [
        {
          occupationId: OTHER.occupationId,
          occupationKey: OTHER.occupationKey,
          canonicalTitle: OTHER.canonicalTitle,
        },
        {
          occupationId: REAL.occupationId,
          occupationKey: REAL.occupationKey,
          canonicalTitle: REAL.canonicalTitle,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.coverage.outcome !== "clarification_required") {
      throw new Error("expected clarification");
    }
    expect(result.coverage.candidates).toHaveLength(2);
    expect(result.coverage.candidates.map((candidate) => candidate.occupationKey)).toEqual(
      [REAL.occupationKey, OTHER.occupationKey].sort(),
    );
  });

  it("fails closed on an unknown unmatched reason", () => {
    const result = attempt({
      outcome: "unmatched",
      reason: "made_up_reason",
      rawQuery: "x",
      normalisedQuery: "x",
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });

  it("fails closed when an unmatched object carries an unknown extra key", () => {
    const result = attempt({
      outcome: "unmatched",
      reason: "no_match",
      rawQuery: "x",
      normalisedQuery: "x",
      trustedByCaller: true,
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_resolution_invalid");
  });

  it("fails closed on a structurally invalid resolution", () => {
    expect(attempt(null).ok).toBe(false);
    expect(attempt({ outcome: "resolved" }).ok).toBe(false);
    expect(codes(attempt({ outcome: "nonsense" }))).toContain("occupation_resolution_invalid");
  });

  it("fails closed on a non-canonical universe", () => {
    const result = resolveRealityCheckCoverageFromPacks({
      occupationResolution: resolveOccupationIntent(ARCHITECTURE_TEST_OCCUPATIONS, "Electrician"),
      universe: [{ occupationId: "nope" }],
      availablePacks: [],
    });
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("occupation_universe_invalid");
  });
});

describe("capture reason contract", () => {
  it("rejects invalid unmatched reasons structurally", () => {
    expect(() =>
      unrecognisedIntentCaptureSchema.parse({
        kind: "unrecognised_intent_capture",
        recognisedOccupation: false,
        rawQuery: "x",
        normalisedQuery: "x",
        unmatchedReason: "invented_unmatched_reason",
        requiredEscalations: ["unrecognised_intent_capture_needed"],
      }),
    ).toThrow();

    expect(() =>
      buildUnrecognisedIntentCapture({
        rawQuery: "x",
        normalisedQuery: "x",
        unmatchedReason: "invented_unmatched_reason" as never,
      }),
    ).toThrow();
  });
});

describe("legitimate coverage is preserved", () => {
  it("still returns full support with recomputed hashes for all four real packs", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const occupation = ARCHITECTURE_TEST_OCCUPATIONS.find(
        (record) => record.occupationKey === pack.occupation.occupationKey,
      )!;
      const result = resolveRealityCheckCoverageFromPacks({
        occupationResolution: resolveOccupationIntent(
          ARCHITECTURE_TEST_OCCUPATIONS,
          occupation.canonicalTitle,
        ),
        universe: ARCHITECTURE_TEST_OCCUPATIONS,
        availablePacks: ARCHITECTURE_TEST_PACKS,
      });
      expect(result.ok).toBe(true);
      if (!result.ok || result.coverage.outcome !== "full_assessment_available") {
        throw new Error("expected full support");
      }
      expect(result.coverage.pack.contentHash).toBe(hashCanonicalCareerPack(pack));
    }
  });

  it("is invariant to universe and pack input order", () => {
    const forward = resolveRealityCheckCoverageFromPacks({
      occupationResolution: resolveOccupationIntent(MIXED_UNIVERSE, "Electrician"),
      universe: MIXED_UNIVERSE,
      availablePacks: ARCHITECTURE_TEST_PACKS,
    });
    const reversed = resolveRealityCheckCoverageFromPacks({
      occupationResolution: resolveOccupationIntent(MIXED_UNIVERSE, "Electrician"),
      universe: parseCanonicalOccupationUniverse([...MIXED_UNIVERSE].reverse()),
      availablePacks: [...ARCHITECTURE_TEST_PACKS].reverse(),
    });
    expect(JSON.stringify(reversed)).toBe(JSON.stringify(forward));
  });

  it("still returns a provisional safe plan for a recognised occupation with no pack", () => {
    const result = resolveRealityCheckCoverageFromPacks({
      occupationResolution: resolveOccupationIntent(MIXED_UNIVERSE, "Marine Pilot"),
      universe: MIXED_UNIVERSE,
      availablePacks: ARCHITECTURE_TEST_PACKS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.coverage.outcome !== "provisional_assessment_available") {
      throw new Error("expected provisional support");
    }
    expect(result.coverage.plan.engineBacked).toBe(false);
  });
});

describe("deep runtime immutability", () => {
  it("freezes nested children of an already frozen parent", () => {
    const child: Record<string, unknown> = { mutable: true };
    const parent = Object.freeze({ child });
    freezeCoverageDocument(parent);
    expect(Object.isFrozen(child)).toBe(true);
    expect(() => {
      child["mutable"] = false;
    }).toThrow();
    expect(child["mutable"]).toBe(true);
  });

  it("terminates on a cyclic structure and freezes everything reachable", () => {
    const inner: Record<string, unknown> = { leaf: { deep: 1 } };
    const outer: Record<string, unknown> = { inner };
    inner["back"] = outer;
    freezeCoverageDocument(outer);
    expect(Object.isFrozen(outer)).toBe(true);
    expect(Object.isFrozen(inner)).toBe(true);
    expect(Object.isFrozen(inner["leaf"])).toBe(true);
  });

  it("freezes failure issues returned from the public API", () => {
    const result = attempt({
      outcome: "unmatched",
      reason: "bogus",
      rawQuery: "",
      normalisedQuery: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.isFrozen(result.issues)).toBe(true);
    expect(Object.isFrozen(result.issues[0])).toBe(true);
  });
});
