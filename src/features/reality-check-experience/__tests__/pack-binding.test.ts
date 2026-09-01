import { describe, expect, it } from "vitest";

import { ARCHITECTURE_TEST_PACKS } from "../../../content/career-packs/architecture-tests";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";
import type { CareerPack } from "../../../domain/career-packs";
import { hashCanonicalCareerPack } from "../../../domain/career-pack-governance";
import { resolveRealityCheckPackBinding } from "../../career-discovery/coverage.server";

/**
 * EXACT Career Pack hash binding.
 *
 * The Reality Check experience may only start from a pack document whose
 * RECOMPUTED content hash equals the Increment 13 coverage ref. Same id, same
 * version, same occupation and different bytes MUST fail closed.
 */

const ELECTRICIAN = ARCHITECTURE_TEST_PACKS.find(
  (pack) => pack.occupation.occupationKey === "electrician",
);
if (!ELECTRICIAN) throw new Error("electrician architecture-test pack missing");

function bind(packs: readonly CareerPack[], occupationKey = "electrician") {
  return resolveRealityCheckPackBinding({
    occupationKey,
    universe: ARCHITECTURE_TEST_OCCUPATIONS,
    packs,
  });
}

describe("exact reality check pack binding", () => {
  it("returns the exact document paired with its recomputed coverage ref", () => {
    const binding = bind(ARCHITECTURE_TEST_PACKS);
    expect(binding.state).toBe("assessment_available");
    if (binding.state !== "assessment_available") return;
    expect(binding.document.careerPackId).toBe(ELECTRICIAN.careerPackId);
    expect(binding.pack.contentHash).toBe(hashCanonicalCareerPack(binding.document));
    expect(binding.pack.contentHash).toBe(hashCanonicalCareerPack(ELECTRICIAN));
  });

  it("binds every architecture-test career to its own exact document", () => {
    for (const pack of ARCHITECTURE_TEST_PACKS) {
      const binding = bind(ARCHITECTURE_TEST_PACKS, pack.occupation.occupationKey);
      expect(binding.state, pack.occupation.occupationKey).toBe("assessment_available");
      if (binding.state !== "assessment_available") continue;
      expect(binding.document.careerPackId).toBe(pack.careerPackId);
      expect(binding.pack.contentHash).toBe(hashCanonicalCareerPack(pack));
    }
  });

  it("fails closed for a tampered pack with the same id, version and occupation", () => {
    /* Same identity, DIFFERENT bytes: no exact hash can be established. */
    const tampered = ARCHITECTURE_TEST_PACKS.map((pack) =>
      pack.occupation.occupationKey === "electrician"
        ? ({ ...pack, questionModules: pack.questionModules.slice(0, 1) } as CareerPack)
        : pack,
    );
    expect(hashCanonicalCareerPack(tampered[0] as CareerPack)).not.toBe("");
    const binding = bind(tampered);
    expect(binding).toEqual({ state: "assessment_not_available_yet" });
  });

  it("cannot be satisfied by a forged coverage hash", () => {
    /* No caller-supplied hash exists in this boundary: truth is recomputed. */
    const binding = bind(ARCHITECTURE_TEST_PACKS);
    if (binding.state !== "assessment_available") throw new Error("expected availability");
    expect(binding.pack.contentHash).not.toBe("a".repeat(64));
    expect(binding.pack.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails closed for an unknown occupation", () => {
    expect(bind(ARCHITECTURE_TEST_PACKS, "not_a_real_occupation")).toEqual({
      state: "assessment_not_available_yet",
    });
  });

  it("fails closed when no pack is supplied", () => {
    expect(bind([])).toEqual({ state: "assessment_not_available_yet" });
  });
});
