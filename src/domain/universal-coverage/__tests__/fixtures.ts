import { parseCanonicalOccupationUniverse } from "../../occupation-universe";
import { ARCHITECTURE_TEST_OCCUPATIONS } from "../../../content/occupations/architecture-tests";

/**
 * Test-only fixtures.
 *
 * Synthetic occupations exist to prove the resolver is DATA-DRIVEN. They are not
 * content, not a catalogue and are never exported from the package barrel.
 */

/** A recognised, legitimate occupation deliberately WITHOUT a Career Pack. */
export const SYNTHETIC_UNSUPPORTED_OCCUPATION = {
  occupationId: "5f6a7b8c-9d0e-4f10-8a2b-3c4d5e6f7001",
  occupationKey: "synthetic_supported_none_a",
  canonicalTitle: "Marine Pilot",
  specialisms: [],
  aliases: [],
  abbreviations: [],
  colloquialTitles: [],
  emergingTitles: [],
} as const;

/** A second synthetic occupation, long enough to be fuzzy-eligible. */
export const SYNTHETIC_FUZZY_OCCUPATION = {
  occupationId: "6a7b8c9d-0e1f-4021-9b3c-4d5e6f708002",
  occupationKey: "synthetic_supported_none_b",
  canonicalTitle: "Quantity Surveyor",
  specialisms: [],
  aliases: [],
  abbreviations: [],
  colloquialTitles: [],
  emergingTitles: [],
} as const;

/** Scale fixture: many occupations, none of them special-cased anywhere. */
export function syntheticOccupationInputs(count: number): readonly Record<string, unknown>[] {
  return Array.from({ length: count }, (_unused, index) => {
    const suffix = String(index).padStart(4, "0");
    return {
      occupationId: `7b8c9d0e-1f20-4132-8c4d-5e6f7080${suffix}`,
      occupationKey: `synthetic_scale_${suffix}`,
      canonicalTitle: `Synthetic Scale Occupation ${suffix}`,
      specialisms: [],
      aliases: [],
      abbreviations: [],
      colloquialTitles: [],
      emergingTitles: [],
    };
  });
}

/** The four real architecture-test occupations plus two synthetic ones. */
export const MIXED_UNIVERSE = parseCanonicalOccupationUniverse([
  ...ARCHITECTURE_TEST_OCCUPATIONS,
  SYNTHETIC_UNSUPPORTED_OCCUPATION,
  SYNTHETIC_FUZZY_OCCUPATION,
]);
