import { describe, expect, it } from "vitest";

import { parseCanonicalOccupationUniverse } from "../canonical";
import { resolveOccupationIntent, type OccupationResolution } from "../search";
import { collisionUniverse, record, reversedCollisionUniverse } from "./fixtures";

function resolved(result: OccupationResolution) {
  if (result.outcome !== "resolved") {
    throw new Error(`expected resolved, got ${result.outcome}`);
  }
  return result;
}

function clarification(result: OccupationResolution) {
  if (result.outcome !== "clarification_required") {
    throw new Error(`expected clarification_required, got ${result.outcome}`);
  }
  return result;
}

const universe = collisionUniverse();

describe("exact precedence and term categories", () => {
  it("resolves an exact canonical title with the highest precedence", () => {
    const result = resolved(resolveOccupationIntent(universe, "Software Engineer"));
    expect(result.occupationKey).toBe("software_engineer");
    expect(result.termCategory).toBe("canonical_title");
    expect(result.matchMode).toBe("exact");
    expect(result.canonicalTitle).toBe("Software Engineer");
    expect(result.matchedTerm).toBe("Software Engineer");
    expect(result.occupationId).toBe("00000001-0000-4000-8000-000000000000");
  });

  it("resolves an exact alias and reports alias", () => {
    const result = resolved(resolveOccupationIntent(universe, "Software Developer"));
    expect(result.occupationKey).toBe("software_engineer");
    expect(result.termCategory).toBe("alias");
  });

  it("resolves an exact specialism and reports specialism", () => {
    const result = resolved(resolveOccupationIntent(universe, "Structural Engineer"));
    expect(result.occupationKey).toBe("civil_engineer");
    expect(result.termCategory).toBe("specialism");
  });

  it("resolves an exact abbreviation and reports abbreviation", () => {
    const result = resolved(resolveOccupationIntent(universe, "SWE"));
    expect(result.occupationKey).toBe("software_engineer");
    expect(result.termCategory).toBe("abbreviation");
  });

  it("resolves an exact colloquial title and reports colloquial", () => {
    const result = resolved(resolveOccupationIntent(universe, "Copper"));
    expect(result.occupationKey).toBe("police_officer");
    expect(result.termCategory).toBe("colloquial");
  });

  it("resolves an exact emerging title and reports emerging", () => {
    const result = resolved(resolveOccupationIntent(universe, "Platform Engineer"));
    expect(result.occupationKey).toBe("software_engineer");
    expect(result.termCategory).toBe("emerging");
  });

  it("resolves case and whitespace normalised full titles deterministically", () => {
    for (const query of ["software engineer", "  SOFTWARE   engineer ", "Software\tEngineer"]) {
      const result = resolved(resolveOccupationIntent(universe, query));
      expect(result.occupationKey).toBe("software_engineer");
      expect(result.matchMode).toBe("normalised");
      expect(result.termCategory).toBe("canonical_title");
    }
  });

  it("returns clarification for an exact alias shared by two occupations", () => {
    const result = clarification(resolveOccupationIntent(universe, "Business Consultant"));
    expect(result.reason).toBe("exact_term_collision");
    expect(result.candidates.map((candidate) => candidate.occupationKey)).toEqual([
      "management_consultant",
      "recruitment_consultant",
    ]);
  });

  it("cannot let an alias steal a canonical title at search time", () => {
    const twoRecords = parseCanonicalOccupationUniverse([
      record({
        occupationId: "bbbbbbbb-0000-4000-8000-000000000001",
        occupationKey: "owner",
        canonicalTitle: "Marine Biologist",
      }),
      record({
        occupationId: "bbbbbbbb-0000-4000-8000-000000000002",
        occupationKey: "pretender",
        canonicalTitle: "Aquarium Keeper",
        /* Not equal to the canonical title, so authoring is legal; the extra
           word must still not defeat canonical ownership of the real title. */
        aliases: ["Junior Marine Biologist"],
      }),
    ]);
    const result = resolved(resolveOccupationIntent(twoRecords, "Marine Biologist"));
    expect(result.occupationKey).toBe("owner");
    expect(result.termCategory).toBe("canonical_title");
  });

  it("returns unmatched for a blank query", () => {
    const result = resolveOccupationIntent(universe, "   ");
    expect(result.outcome).toBe("unmatched");
    if (result.outcome !== "unmatched") throw new Error("unreachable");
    expect(result.reason).toBe("blank_query");
    expect(result.rawQuery).toBe("   ");
    expect(result.normalisedQuery).toBe("");
  });
});

describe("shared-word collision safety", () => {
  const generic = ["engineer", "consultant", "manager", "officer", "adviser", "advisor"];

  it("never auto-resolves a protected generic word", () => {
    for (const word of generic) {
      for (const query of [word, word.toUpperCase(), ` ${word} `]) {
        const result = resolveOccupationIntent(universe, query);
        expect(result.outcome, query).toBe("clarification_required");
        if (result.outcome !== "clarification_required") throw new Error("unreachable");
        expect(result.reason).toBe("generic_collision_word");
        expect(result.candidates.length).toBeGreaterThan(0);
      }
    }
  });

  it("never auto-resolves a protected generic word even with a single candidate", () => {
    const single = parseCanonicalOccupationUniverse([
      record({
        occupationId: "cccccccc-0000-4000-8000-000000000001",
        occupationKey: "software_engineer",
        canonicalTitle: "Software Engineer",
      }),
    ]);
    const result = clarification(resolveOccupationIntent(single, "engineer"));
    expect(result.candidates.map((candidate) => candidate.occupationKey)).toEqual([
      "software_engineer",
    ]);
  });

  it("returns unmatched for a protected generic word with no candidate at all", () => {
    const none = parseCanonicalOccupationUniverse([
      record({
        occupationId: "cccccccc-0000-4000-8000-000000000002",
        occupationKey: "photographer",
        canonicalTitle: "Photographer",
      }),
    ]);
    const result = resolveOccupationIntent(none, "engineer");
    expect(result.outcome).toBe("unmatched");
    if (result.outcome !== "unmatched") throw new Error("unreachable");
    expect(result.reason).toBe("no_match");
  });

  it("resolves specific full intent that contains a generic word", () => {
    const cases: readonly (readonly [string, string])[] = [
      ["Software Engineer", "software_engineer"],
      ["Civil Engineer", "civil_engineer"],
      ["Police Officer", "police_officer"],
      ["Prison Officer", "prison_officer"],
      ["Project Manager", "project_manager"],
      ["Retail Manager", "retail_manager"],
      ["Financial Adviser", "financial_adviser"],
      ["Careers Adviser", "careers_adviser"],
      ["Management Consultant", "management_consultant"],
    ];
    for (const [query, key] of cases) {
      expect(resolved(resolveOccupationIntent(universe, query)).occupationKey, query).toBe(key);
    }
  });

  it("resolves the authored advisor spelling as an alias, not the bare generic word", () => {
    const result = resolved(resolveOccupationIntent(universe, "Financial Advisor"));
    expect(result.occupationKey).toBe("financial_adviser");
    expect(result.termCategory).toBe("alias");
  });

  it("never resolves on token overlap, prefix containment or substring coincidence", () => {
    for (const query of [
      "engineer software",
      "software",
      "police",
      "manager of retail",
      "engineering",
      "soft",
    ]) {
      const result = resolveOccupationIntent(universe, query);
      expect(result.outcome, query).not.toBe("resolved");
    }
  });

  it("orders clarification candidates deterministically regardless of authored order", () => {
    const forward = clarification(resolveOccupationIntent(universe, "consultant"));
    const reversed = clarification(
      resolveOccupationIntent(reversedCollisionUniverse(), "consultant"),
    );
    expect(forward.candidates).toEqual(reversed.candidates);
    expect(forward.candidates.map((candidate) => candidate.occupationKey)).toEqual([
      "management_consultant",
      "recruitment_consultant",
    ]);
  });
});

describe("conservative fuzzy matching", () => {
  it("tolerates an obvious typo in a long unique full title", () => {
    for (const query of [
      "Veterinary Physiotherapost",
      "Veterinry Physiotherapist",
      "Veterinary Phsyiotherapist",
    ]) {
      const result = resolved(resolveOccupationIntent(universe, query));
      expect(result.occupationKey, query).toBe("veterinary_physiotherapist");
      expect(result.matchMode).toBe("fuzzy");
      expect(result.termCategory).toBe("canonical_title");
    }
  });

  it("does not fuzzy-expand short queries or abbreviations", () => {
    for (const query of ["SWF", "PN", "PJ", "coper", "Copers"]) {
      const result = resolveOccupationIntent(universe, query);
      expect(result.outcome, query).not.toBe("resolved");
    }
  });

  it("returns clarification when the best fuzzy candidates are equidistant", () => {
    /* Two real UK spellings, one edit apart from each other; the typo below is
       exactly one edit from BOTH, so no candidate may win silently. */
    const twins = parseCanonicalOccupationUniverse([
      record({
        occupationId: "dddddddd-0000-4000-8000-000000000001",
        occupationKey: "careers_adviser_uk",
        canonicalTitle: "Careers Adviser",
      }),
      record({
        occupationId: "dddddddd-0000-4000-8000-000000000002",
        occupationKey: "careers_advisor_uk",
        canonicalTitle: "Careers Advisor",
      }),
    ]);
    const result = clarification(resolveOccupationIntent(twins, "Careers Advisur"));
    expect(result.reason).toBe("fuzzy_collision");
    expect(result.candidates.map((candidate) => candidate.occupationKey)).toEqual([
      "careers_adviser_uk",
      "careers_advisor_uk",
    ]);
  });

  it("clarifies a non-tie near-runner: best distance 1, second occupation distance 2", () => {
    /* Query length 16 => budget 2. "Dental Hygeinist" is one adjacent
       transposition from the first title and two edits from the second, so the
       first must NOT silently win merely by being closer. */
    const neighbours = parseCanonicalOccupationUniverse([
      record({
        occupationId: "eeeeeeee-0000-4000-8000-000000000001",
        occupationKey: "dental_hygienist",
        canonicalTitle: "Dental Hygienist",
      }),
      record({
        occupationId: "eeeeeeee-0000-4000-8000-000000000002",
        occupationKey: "dental_hygienist_lead",
        canonicalTitle: "Dental Hygienists",
      }),
    ]);
    const result = clarification(resolveOccupationIntent(neighbours, "Dental Hygeinist"));
    expect(result.reason).toBe("fuzzy_collision");
    expect(result.candidates.map((candidate) => candidate.occupationKey)).toEqual([
      "dental_hygienist",
      "dental_hygienist_lead",
    ]);
  });

  it("resolves fuzzily only when one occupation is the sole plausible candidate in budget", () => {
    const sole = parseCanonicalOccupationUniverse([
      record({
        occupationId: "eeeeeeee-0000-4000-8000-000000000003",
        occupationKey: "dental_hygienist",
        canonicalTitle: "Dental Hygienist",
        /* A second term on the SAME occupation must not create ambiguity. */
        aliases: ["Dental Hygenist Practitioner"],
      }),
    ]);
    const result = resolved(resolveOccupationIntent(sole, "Dental Hygeinist"));
    expect(result.occupationKey).toBe("dental_hygienist");
    expect(result.termCategory).toBe("canonical_title");
    expect(result.matchMode).toBe("fuzzy");
  });

  it("returns unmatched below the conservative fuzzy threshold", () => {
    const result = resolveOccupationIntent(universe, "underwater basket weaver");
    expect(result.outcome).toBe("unmatched");
    if (result.outcome !== "unmatched") throw new Error("unreachable");
    expect(result.reason).toBe("below_fuzzy_threshold");
    expect(result.normalisedQuery).toBe("underwater basket weaver");
  });

  it("is invariant to authored occupation order", () => {
    const reversed = reversedCollisionUniverse();
    for (const query of ["Veterinary Physiotherapost", "Software Engneer", "Police Offcier"]) {
      expect(resolveOccupationIntent(universe, query), query).toEqual(
        resolveOccupationIntent(reversed, query),
      );
    }
  });

  it("is deterministic across repeated identical calls", () => {
    for (const query of ["Software Engineer", "consultant", "Veterinary Physiotherapost", "zzz"]) {
      expect(resolveOccupationIntent(universe, query)).toEqual(
        resolveOccupationIntent(universe, query),
      );
    }
  });

  it("exposes no confidence score in any result shape", () => {
    for (const query of ["Software Engineer", "consultant", "Veterinary Physiotherapost", "zzz"]) {
      const keys = Object.keys(resolveOccupationIntent(universe, query));
      for (const forbidden of ["score", "confidence", "distance", "weight", "similarity"]) {
        expect(keys, query).not.toContain(forbidden);
      }
    }
  });
});
