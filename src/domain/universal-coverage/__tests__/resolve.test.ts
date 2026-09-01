import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { hashCanonicalCareerPack } from "../../career-pack-governance";
import {
  parseCanonicalOccupationUniverse,
  resolveOccupationIntent,
  type OccupationUniverse,
} from "../../occupation-universe";
import { buildCareerPackCoverageCatalogue } from "../catalogue";
import { resolveRealityCheckCoverageFromPacks, type RealityCheckCoverage } from "../resolve";
import type { CareerPackCoverageCatalogue } from "../schema";
import { MIXED_UNIVERSE, syntheticOccupationInputs } from "./fixtures";

function catalogueFor(
  universe: OccupationUniverse,
  packs: readonly unknown[],
): CareerPackCoverageCatalogue {
  const built = buildCareerPackCoverageCatalogue(universe, packs);
  if (!built.ok) throw new Error(`unexpected catalogue failure: ${JSON.stringify(built.issues)}`);
  return built.catalogue;
}

function coverageFor(
  universe: OccupationUniverse,
  packs: readonly unknown[],
  query: string,
): RealityCheckCoverage {
  const result = resolveRealityCheckCoverageFromPacks({
    occupationResolution: resolveOccupationIntent(universe, query),
    universe,
    availablePacks: packs,
  });
  if (!result.ok) throw new Error(`unexpected coverage failure: ${JSON.stringify(result.issues)}`);
  return result.coverage;
}

describe("full engine-backed coverage", () => {
  for (const pack of ARCHITECTURE_TEST_PACKS) {
    const occupation = ARCHITECTURE_TEST_OCCUPATIONS.find(
      (record) => record.occupationKey === pack.occupation.occupationKey,
    );

    it(`offers a full assessment for ${pack.occupation.occupationKey}`, () => {
      expect(occupation).toBeDefined();
      const coverage = coverageFor(
        ARCHITECTURE_TEST_OCCUPATIONS,
        ARCHITECTURE_TEST_PACKS,
        occupation!.canonicalTitle,
      );
      expect(coverage.outcome).toBe("full_assessment_available");
      if (coverage.outcome !== "full_assessment_available") return;
      expect(coverage.supportDepth).toBe("exact_career_pack");
      expect(coverage.occupation.occupationId).toBe(occupation!.occupationId);
      expect(coverage.pack.careerPackId).toBe(pack.careerPackId);
      expect(coverage.pack.version).toBe(pack.version);
      expect(coverage.pack.contentHash).toBe(hashCanonicalCareerPack(pack));
      expect(coverage.engineExecuted).toBe(false);
    });
  }

  it("resolves a specialism term to the owning occupation's full support", () => {
    const coverage = coverageFor(
      ARCHITECTURE_TEST_OCCUPATIONS,
      ARCHITECTURE_TEST_PACKS,
      "Wedding Photographer",
    );
    expect(coverage.outcome).toBe("full_assessment_available");
  });

  it("returns deeply frozen coverage output", () => {
    const coverage = coverageFor(
      ARCHITECTURE_TEST_OCCUPATIONS,
      ARCHITECTURE_TEST_PACKS,
      "Electrician",
    );
    expect(Object.isFrozen(coverage)).toBe(true);
    expect(() => {
      (coverage as unknown as Record<string, unknown>)["outcome"] = "tampered";
    }).toThrow();
  });
});

describe("provisional safe coverage", () => {
  it("offers a provisional plan for a recognised occupation with no pack", () => {
    const coverage = coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "Marine Pilot");
    expect(coverage.outcome).toBe("provisional_assessment_available");
    if (coverage.outcome !== "provisional_assessment_available") return;
    expect(coverage.occupation.occupationKey).toBe("synthetic_supported_none_a");
    expect(coverage.plan.engineBacked).toBe(false);
    expect(coverage.plan.declaresIntakeQuestions).toBe(false);
    expect(coverage.plan.verificationRequiredBeforeCareerSpecificCertainty).toBe(true);
    expect(coverage.plan.requiredEscalations).toContain("content_review_needed");
    expect(coverage.plan.requiredEscalations).toContain("adviser_escalation_needed");
  });

  it("carries no pack identity, judgement, requirement state, route or evidence vocabulary", () => {
    const coverage = coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "Quantity Surveyor");
    if (coverage.outcome !== "provisional_assessment_available") throw new Error("wrong outcome");
    const serialised = JSON.stringify(coverage.plan);

    for (const forbidden of [
      "careerPackId",
      "contentHash",
      "realistic_now",
      "realistic_with_conditions",
      "not_realistic_yet",
      "more_information_needed",
      "requirementState",
      '"met"',
      '"unmet"',
      "archetype",
      "routeKey",
      "evidenceKey",
      "sourceId",
      "strength",
      "salary",
      "postcode",
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it("is deterministic for identical occupation identity", () => {
    const a = coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "Marine Pilot");
    const b = coverageFor(
      parseCanonicalOccupationUniverse([...MIXED_UNIVERSE].reverse()),
      [...ARCHITECTURE_TEST_PACKS].reverse(),
      "Marine Pilot",
    );
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("freezes the provisional plan", () => {
    const coverage = coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "Marine Pilot");
    if (coverage.outcome !== "provisional_assessment_available") throw new Error("wrong outcome");
    expect(Object.isFrozen(coverage.plan)).toBe(true);
    expect(Object.isFrozen(coverage.plan.limitations)).toBe(true);
  });
});

describe("ambiguity and unrecognised intent", () => {
  it("keeps bare Nurse non-resolved and creates no assessment state", () => {
    const coverage = coverageFor(ARCHITECTURE_TEST_OCCUPATIONS, ARCHITECTURE_TEST_PACKS, "Nurse");
    expect(coverage.outcome).toBe("demand_capture_required");
    expect(JSON.stringify(coverage)).not.toContain("registered_nurse");
  });

  it("keeps bare Solicitor non-resolved and never silently becomes England & Wales", () => {
    const coverage = coverageFor(
      ARCHITECTURE_TEST_OCCUPATIONS,
      ARCHITECTURE_TEST_PACKS,
      "Solicitor",
    );
    expect(coverage.outcome).toBe("demand_capture_required");
    expect(JSON.stringify(coverage)).not.toContain("solicitor_england_wales");
  });

  for (const word of ["engineer", "manager", "officer", "consultant", "adviser", "advisor"]) {
    it(`never creates an assessment offer for the protected generic word ${word}`, () => {
      const coverage = coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, word);
      expect(["clarification_required", "demand_capture_required"]).toContain(coverage.outcome);
    });
  }

  it("passes Increment 12 clarification through with deterministic candidates", () => {
    const universe = parseCanonicalOccupationUniverse([
      {
        occupationId: "aa000000-0000-4000-8000-000000000001",
        occupationKey: "synthetic_collide_b",
        canonicalTitle: "Site Engineer",
        specialisms: [],
        aliases: [],
        abbreviations: [],
        colloquialTitles: [],
        emergingTitles: [],
      },
      {
        occupationId: "aa000000-0000-4000-8000-000000000002",
        occupationKey: "synthetic_collide_a",
        canonicalTitle: "Network Engineer",
        specialisms: [],
        aliases: [],
        abbreviations: [],
        colloquialTitles: [],
        emergingTitles: [],
      },
    ]);
    const coverage = coverageFor(universe, [], "engineer");
    expect(coverage.outcome).toBe("clarification_required");
    if (coverage.outcome !== "clarification_required") return;
    expect(coverage.reason).toBe("generic_collision_word");
    expect(coverage.candidates.map((candidate) => candidate.occupationKey)).toEqual([
      "synthetic_collide_a",
      "synthetic_collide_b",
    ]);
  });

  it("captures unrecognised intent preserving raw and normalised query", () => {
    const coverage = coverageFor(
      MIXED_UNIVERSE,
      ARCHITECTURE_TEST_PACKS,
      "  Interstellar   Whale Herder  ",
    );
    expect(coverage.outcome).toBe("demand_capture_required");
    if (coverage.outcome !== "demand_capture_required") return;
    expect(coverage.capture.recognisedOccupation).toBe(false);
    expect(coverage.capture.rawQuery).toBe("  Interstellar   Whale Herder  ");
    expect(coverage.capture.normalisedQuery).toBe("interstellar whale herder");
    expect(coverage.capture.requiredEscalations).toContain("unrecognised_intent_capture_needed");
  });

  it("captures blank intent without inventing an occupation", () => {
    const coverage = coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "   ");
    expect(coverage.outcome).toBe("demand_capture_required");
    if (coverage.outcome !== "demand_capture_required") return;
    expect(coverage.capture.unmatchedReason).toBe("blank_query");
  });
});

describe("fuzzy safety carried into coverage", () => {
  it("lets a fuzzy-safe unique match proceed based on pack availability", () => {
    const full = coverageFor(ARCHITECTURE_TEST_OCCUPATIONS, ARCHITECTURE_TEST_PACKS, "Electricain");
    expect(full.outcome).toBe("full_assessment_available");

    const provisional = coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "Quantiy Surveyor");
    expect(provisional.outcome).toBe("provisional_assessment_available");
  });

  it("keeps a fuzzy collision as clarification", () => {
    const universe = parseCanonicalOccupationUniverse([
      {
        occupationId: "bb000000-0000-4000-8000-000000000001",
        occupationKey: "synthetic_fuzzy_a",
        canonicalTitle: "Marine Pilotage",
        specialisms: [],
        aliases: [],
        abbreviations: [],
        colloquialTitles: [],
        emergingTitles: [],
      },
      {
        occupationId: "bb000000-0000-4000-8000-000000000002",
        occupationKey: "synthetic_fuzzy_b",
        canonicalTitle: "Marine Pilotave",
        specialisms: [],
        aliases: [],
        abbreviations: [],
        colloquialTitles: [],
        emergingTitles: [],
      },
    ]);
    const coverage = coverageFor(universe, [], "Marine Pilotate");
    expect(coverage.outcome).toBe("clarification_required");
  });
});

describe("data-driven scalability", () => {
  it("resolves a large synthetic universe without occupation-specific branching", () => {
    const universe = parseCanonicalOccupationUniverse([
      ...ARCHITECTURE_TEST_OCCUPATIONS,
      ...syntheticOccupationInputs(120),
    ]);
    const catalogue = catalogueFor(universe, ARCHITECTURE_TEST_PACKS);
    expect(catalogue).toHaveLength(4);

    for (const index of [0, 57, 119]) {
      const suffix = String(index).padStart(4, "0");
      const coverage = coverageFor(
        universe,
        ARCHITECTURE_TEST_PACKS,
        `Synthetic Scale Occupation ${suffix}`,
      );
      expect(coverage.outcome).toBe("provisional_assessment_available");
    }
  });
});

describe("one-step convenience form", () => {
  it("resolves coverage from raw available packs", () => {
    const result = resolveRealityCheckCoverageFromPacks({
      occupationResolution: resolveOccupationIntent(
        ARCHITECTURE_TEST_OCCUPATIONS,
        "Registered Nurse",
      ),
      universe: ARCHITECTURE_TEST_OCCUPATIONS,
      availablePacks: ARCHITECTURE_TEST_PACKS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.coverage.outcome).toBe("full_assessment_available");
  });

  it("fails closed on catalogue integrity problems instead of degrading to provisional", () => {
    const first = ARCHITECTURE_TEST_PACKS[0]!;
    const result = resolveRealityCheckCoverageFromPacks({
      occupationResolution: resolveOccupationIntent(
        ARCHITECTURE_TEST_OCCUPATIONS,
        first.occupation.occupationKey === "registered_nurse" ? "Registered Nurse" : "Electrician",
      ),
      universe: ARCHITECTURE_TEST_OCCUPATIONS,
      availablePacks: [first, { ...structuredClone(first), version: "2.0.0" }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("no identity or persistence leakage", () => {
  it("emits no participant, user or institution identity field (escalation codes aside)", () => {
    const serialised = JSON.stringify([
      coverageFor(ARCHITECTURE_TEST_OCCUPATIONS, ARCHITECTURE_TEST_PACKS, "Electrician"),
      coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "Marine Pilot"),
      coverageFor(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS, "Nurse"),
    ]);
    for (const forbidden of [
      "participantId",
      "appUser",
      "userId",
      "institution",
      "cohort",
      "authUser",
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});
