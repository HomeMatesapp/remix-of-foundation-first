import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import { hashCanonicalCareerPack } from "../../career-pack-governance";
import { parseCanonicalOccupationUniverse } from "../../occupation-universe";
import { buildCareerPackCoverageCatalogue, catalogueEntryForOccupationId } from "../catalogue";
import { MIXED_UNIVERSE } from "./fixtures";

describe("coverage catalogue", () => {
  it("binds all four architecture-test packs with recomputed content hashes", () => {
    const built = buildCareerPackCoverageCatalogue(
      ARCHITECTURE_TEST_OCCUPATIONS,
      ARCHITECTURE_TEST_PACKS,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.catalogue).toHaveLength(4);

    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const entry = built.catalogue.find(
        (candidate) => candidate.occupation.occupationKey === pack.occupation.occupationKey,
      );
      expect(entry).toBeDefined();
      expect(entry?.pack.careerPackId).toBe(pack.careerPackId);
      expect(entry?.pack.version).toBe(pack.version);
      expect(entry?.pack.contentHash).toBe(hashCanonicalCareerPack(pack));
    }
  });

  it("is independent of pack input order and universe order", () => {
    const forward = buildCareerPackCoverageCatalogue(
      ARCHITECTURE_TEST_OCCUPATIONS,
      ARCHITECTURE_TEST_PACKS,
    );
    const reversed = buildCareerPackCoverageCatalogue(
      parseCanonicalOccupationUniverse([...ARCHITECTURE_TEST_OCCUPATIONS].reverse()),
      [...ARCHITECTURE_TEST_PACKS].reverse(),
    );
    expect(forward.ok && reversed.ok).toBe(true);
    if (!forward.ok || !reversed.ok) return;
    expect(JSON.stringify(reversed.catalogue)).toBe(JSON.stringify(forward.catalogue));
  });

  it("collapses byte-identical duplicate pack submissions", () => {
    const first = ARCHITECTURE_TEST_PACKS[0];
    const built = buildCareerPackCoverageCatalogue(ARCHITECTURE_TEST_OCCUPATIONS, [first, first]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.catalogue).toHaveLength(1);
  });

  it("fails closed when two different versions compete for one occupation", () => {
    const first = ARCHITECTURE_TEST_PACKS[0]!;
    const competing = { ...structuredClone(first), version: "1.1.0" };
    const built = buildCareerPackCoverageCatalogue(ARCHITECTURE_TEST_OCCUPATIONS, [
      first,
      competing,
    ]);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.code)).toContain("competing_pack_support");
  });

  it("fails closed when two distinct pack ids claim one occupation", () => {
    const first = ARCHITECTURE_TEST_PACKS[0]!;
    const other = {
      ...structuredClone(first),
      careerPackId: "11111111-2222-4333-8444-555555555555",
    };
    const built = buildCareerPackCoverageCatalogue(ARCHITECTURE_TEST_OCCUPATIONS, [first, other]);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.code)).toContain("competing_pack_support");
  });

  it("fails closed when the same pack identity is supplied with different content", () => {
    const first = ARCHITECTURE_TEST_PACKS[0]!;
    const tampered = structuredClone(first) as Record<string, unknown>;
    tampered["review"] = { reviewKey: "tampered_review_key" };
    const built = buildCareerPackCoverageCatalogue(ARCHITECTURE_TEST_OCCUPATIONS, [
      first,
      tampered,
    ]);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.code)).toContain("conflicting_pack_content");
  });

  it("rejects an invalid pack rather than creating support", () => {
    const broken = structuredClone(ARCHITECTURE_TEST_PACKS[0]!) as Record<string, unknown>;
    broken["routes"] = [];
    const built = buildCareerPackCoverageCatalogue(ARCHITECTURE_TEST_OCCUPATIONS, [broken]);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.code)).toContain("pack_invalid");
  });

  it("rejects a pack whose occupation identity conflicts with the canonical universe", () => {
    const mismatched = structuredClone(ARCHITECTURE_TEST_PACKS[0]!) as Record<string, unknown>;
    mismatched["occupation"] = {
      occupationKey: ARCHITECTURE_TEST_OCCUPATIONS[0]!.occupationKey,
      occupationId: ARCHITECTURE_TEST_OCCUPATIONS[1]!.occupationId,
    };
    const built = buildCareerPackCoverageCatalogue(ARCHITECTURE_TEST_OCCUPATIONS, [mismatched]);
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.code)).toContain("pack_occupation_unbound");
  });

  it("rejects a pack for an occupation absent from the universe", () => {
    const built = buildCareerPackCoverageCatalogue(
      parseCanonicalOccupationUniverse([ARCHITECTURE_TEST_OCCUPATIONS[1]!]),
      [ARCHITECTURE_TEST_PACKS[0]!],
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues.map((issue) => issue.code)).toContain("pack_occupation_unbound");
  });

  it("returns a deeply frozen catalogue", () => {
    const built = buildCareerPackCoverageCatalogue(
      ARCHITECTURE_TEST_OCCUPATIONS,
      ARCHITECTURE_TEST_PACKS,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.isFrozen(built.catalogue)).toBe(true);
    expect(Object.isFrozen(built.catalogue[0]!.pack)).toBe(true);
    expect(() => {
      (built.catalogue as unknown as Record<string, unknown>[])[0] = {};
    }).toThrow();
  });

  it("looks up support by exact occupation id only", () => {
    const built = buildCareerPackCoverageCatalogue(MIXED_UNIVERSE, ARCHITECTURE_TEST_PACKS);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(
      catalogueEntryForOccupationId(
        built.catalogue,
        ARCHITECTURE_TEST_OCCUPATIONS[0]!.occupationId,
      ),
    ).toBeDefined();
    expect(
      catalogueEntryForOccupationId(built.catalogue, "00000000-0000-4000-8000-000000000000"),
    ).toBeUndefined();
  });
});
