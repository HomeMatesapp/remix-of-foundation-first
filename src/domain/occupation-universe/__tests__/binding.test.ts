import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { bindCareerPackOccupation } from "../binding";
import { normaliseOccupationText } from "../normalise";
import { resolveOccupationIntent } from "../search";

describe("Career Pack occupation binding", () => {
  it("binds all four Increment 11 architecture-test Career Packs by key", () => {
    const bound = ARCHITECTURE_TEST_PACKS.map((pack) => {
      const outcome = bindCareerPackOccupation(ARCHITECTURE_TEST_OCCUPATIONS, pack.occupation);
      if (!outcome.ok) throw new Error(`${pack.occupation.occupationKey}: ${outcome.code}`);
      return outcome.occupation.occupationKey;
    });
    expect(bound).toEqual([
      "registered_nurse",
      "electrician",
      "solicitor_england_wales",
      "photographer",
    ]);
  });

  it("succeeds on an exact id plus key match", () => {
    const target = ARCHITECTURE_TEST_OCCUPATIONS[0];
    if (!target) throw new Error("expected architecture-test occupations");
    const outcome = bindCareerPackOccupation(ARCHITECTURE_TEST_OCCUPATIONS, {
      occupationKey: target.occupationKey,
      occupationId: target.occupationId,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    expect(outcome.occupation.occupationId).toBe(target.occupationId);
  });

  it("fails closed on a mismatched id and key", () => {
    const [first, second] = ARCHITECTURE_TEST_OCCUPATIONS;
    if (!first || !second) throw new Error("expected two occupations");
    const outcome = bindCareerPackOccupation(ARCHITECTURE_TEST_OCCUPATIONS, {
      occupationKey: second.occupationKey,
      occupationId: first.occupationId,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe("identity_mismatch");
  });

  it("fails closed on an unknown id", () => {
    const outcome = bindCareerPackOccupation(ARCHITECTURE_TEST_OCCUPATIONS, {
      occupationKey: "registered_nurse",
      occupationId: "ffffffff-0000-4000-8000-00000000ffff",
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe("unknown_occupation_id");
  });

  it("fails closed on an unknown key", () => {
    const outcome = bindCareerPackOccupation(ARCHITECTURE_TEST_OCCUPATIONS, {
      occupationKey: "not_an_occupation",
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.code).toBe("unknown_occupation_key");
  });

  it("never uses aliases, normalisation or fuzzy matching", () => {
    for (const key of ["Registered Nurse", "registered nurse", "nurse", "RN", "registerd_nurse"]) {
      const outcome = bindCareerPackOccupation(ARCHITECTURE_TEST_OCCUPATIONS, {
        occupationKey: key,
      });
      expect(outcome.ok, key).toBe(false);
    }
  });

  it("does not mutate Career Pack content", () => {
    const pack = ARCHITECTURE_TEST_PACKS[0];
    if (!pack) throw new Error("expected a pack");
    const before = JSON.stringify(pack.occupation);
    bindCareerPackOccupation(ARCHITECTURE_TEST_OCCUPATIONS, pack.occupation);
    expect(JSON.stringify(pack.occupation)).toBe(before);
  });
});

describe("architecture-test occupation content", () => {
  it("is a deeply frozen, deterministic four-record set", () => {
    expect(ARCHITECTURE_TEST_OCCUPATIONS).toHaveLength(4);
    expect(Object.isFrozen(ARCHITECTURE_TEST_OCCUPATIONS)).toBe(true);
    for (const occupation of ARCHITECTURE_TEST_OCCUPATIONS) {
      expect(Object.isFrozen(occupation)).toBe(true);
      expect(Object.isFrozen(occupation.specialisms)).toBe(true);
    }
  });

  it("carries safe canonical titles that resolve exactly", () => {
    const expected: readonly (readonly [string, string])[] = [
      ["Registered Nurse", "registered_nurse"],
      ["Electrician", "electrician"],
      ["Solicitor of England and Wales", "solicitor_england_wales"],
      ["Photographer", "photographer"],
    ];
    for (const [title, key] of expected) {
      const found = ARCHITECTURE_TEST_OCCUPATIONS.find((entry) => entry.canonicalTitle === title);
      expect(found?.occupationKey, title).toBe(key);
    }
  });
});

describe("architecture-test occupation search safety", () => {
  /**
   * Reconciliation regression: broad single-word titles were removed from the
   * real four-record set. A bare `Nurse` spans registered, veterinary, dental
   * and nursery-related occupations, and a bare `Solicitor` is jurisdictionally
   * ambiguous across England & Wales, Scotland and Northern Ireland. Neither may
   * silently bind here merely because only four records exist today.
   */
  it("does not silently resolve bare Nurse or bare Solicitor", () => {
    for (const query of ["Nurse", "nurse", "  NURSE ", "Solicitor", "solicitor", " Solicitor "]) {
      const result = resolveOccupationIntent(ARCHITECTURE_TEST_OCCUPATIONS, query);
      expect(result.outcome, query).toBe("unmatched");
    }
  });

  it("authors no broad single-word alias in the real content", () => {
    for (const occupation of ARCHITECTURE_TEST_OCCUPATIONS) {
      const nonCanonical = [
        ...occupation.aliases,
        ...occupation.colloquialTitles,
        ...occupation.emergingTitles,
        ...occupation.specialisms,
      ];
      for (const term of nonCanonical) {
        expect(["nurse", "solicitor"], term).not.toContain(normaliseOccupationText(term));
      }
    }
    const photographer = ARCHITECTURE_TEST_OCCUPATIONS.find(
      (entry) => entry.occupationKey === "photographer",
    );
    expect(photographer?.emergingTitles).toEqual([]);
  });

  it("keeps exact canonical titles resolving after term removal", () => {
    const expected: readonly (readonly [string, string])[] = [
      ["Registered Nurse", "registered_nurse"],
      ["Electrician", "electrician"],
      ["Solicitor of England and Wales", "solicitor_england_wales"],
      ["Photographer", "photographer"],
    ];
    for (const [title, key] of expected) {
      const result = resolveOccupationIntent(ARCHITECTURE_TEST_OCCUPATIONS, title);
      expect(result.outcome, title).toBe("resolved");
      if (result.outcome !== "resolved") throw new Error("unreachable");
      expect(result.occupationKey).toBe(key);
      expect(result.termCategory).toBe("canonical_title");
      expect(result.matchMode).toBe("exact");
    }
  });

  it("keeps defensible explicit terms working", () => {
    const cases: readonly (readonly [string, string])[] = [
      ["RN", "registered_nurse"],
      ["Mental Health Nurse", "registered_nurse"],
      ["Sparky", "electrician"],
      ["Wedding Photographer", "photographer"],
    ];
    for (const [query, key] of cases) {
      const result = resolveOccupationIntent(ARCHITECTURE_TEST_OCCUPATIONS, query);
      expect(result.outcome, query).toBe("resolved");
      if (result.outcome !== "resolved") throw new Error("unreachable");
      expect(result.occupationKey).toBe(key);
    }
  });
});
