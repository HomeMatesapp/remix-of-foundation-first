import { parseCanonicalOccupationUniverse } from "../canonical";
import type { OccupationUniverse } from "../schema";

/**
 * TEST-ONLY occupation fixtures.
 *
 * These are hostile architecture fixtures, not content: multiple engineers,
 * consultants, managers, officers and advisers exist deliberately so shared-word
 * collision protection is proven rather than assumed. Every term category is
 * exercised here even where the four real architecture-test records do not
 * naturally use it.
 */

export interface FixtureRecordInput {
  readonly occupationId: string;
  readonly occupationKey: string;
  readonly canonicalTitle: string;
  readonly specialisms: readonly string[];
  readonly aliases: readonly string[];
  readonly abbreviations: readonly string[];
  readonly colloquialTitles: readonly string[];
  readonly emergingTitles: readonly string[];
}

export function record(
  overrides: Partial<FixtureRecordInput> &
    Pick<FixtureRecordInput, "occupationId" | "occupationKey" | "canonicalTitle">,
): FixtureRecordInput {
  return {
    specialisms: [],
    aliases: [],
    abbreviations: [],
    colloquialTitles: [],
    emergingTitles: [],
    ...overrides,
  };
}

const uuid = (n: number): string => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

export const SOFTWARE_ENGINEER = record({
  occupationId: uuid(1),
  occupationKey: "software_engineer",
  canonicalTitle: "Software Engineer",
  aliases: ["Software Developer"],
  abbreviations: ["SWE"],
  colloquialTitles: ["Coder"],
  emergingTitles: ["Platform Engineer"],
  specialisms: ["Backend Software Engineer"],
});

export const CIVIL_ENGINEER = record({
  occupationId: uuid(2),
  occupationKey: "civil_engineer",
  canonicalTitle: "Civil Engineer",
  specialisms: ["Structural Engineer"],
});

export const POLICE_OFFICER = record({
  occupationId: uuid(3),
  occupationKey: "police_officer",
  canonicalTitle: "Police Officer",
  colloquialTitles: ["Copper"],
});

export const PRISON_OFFICER = record({
  occupationId: uuid(4),
  occupationKey: "prison_officer",
  canonicalTitle: "Prison Officer",
});

export const MANAGEMENT_CONSULTANT = record({
  occupationId: uuid(5),
  occupationKey: "management_consultant",
  canonicalTitle: "Management Consultant",
  /* Deliberately shared with the recruitment consultant below. */
  aliases: ["Business Consultant"],
});

export const RECRUITMENT_CONSULTANT = record({
  occupationId: uuid(6),
  occupationKey: "recruitment_consultant",
  canonicalTitle: "Recruitment Consultant",
  aliases: ["Business Consultant"],
});

export const PROJECT_MANAGER = record({
  occupationId: uuid(7),
  occupationKey: "project_manager",
  canonicalTitle: "Project Manager",
  abbreviations: ["PM"],
});

export const RETAIL_MANAGER = record({
  occupationId: uuid(8),
  occupationKey: "retail_manager",
  canonicalTitle: "Retail Manager",
});

export const FINANCIAL_ADVISER = record({
  occupationId: uuid(9),
  occupationKey: "financial_adviser",
  canonicalTitle: "Financial Adviser",
  aliases: ["Financial Advisor"],
});

export const CAREERS_ADVISER = record({
  occupationId: uuid(10),
  occupationKey: "careers_adviser",
  canonicalTitle: "Careers Adviser",
  aliases: ["Careers Advisor"],
});

/** A long unique title used to prove conservative fuzzy tolerance. */
export const VETERINARY_PHYSIOTHERAPIST = record({
  occupationId: uuid(11),
  occupationKey: "veterinary_physiotherapist",
  canonicalTitle: "Veterinary Physiotherapist",
});

export const COLLISION_FIXTURE_INPUT: readonly FixtureRecordInput[] = Object.freeze([
  SOFTWARE_ENGINEER,
  CIVIL_ENGINEER,
  POLICE_OFFICER,
  PRISON_OFFICER,
  MANAGEMENT_CONSULTANT,
  RECRUITMENT_CONSULTANT,
  PROJECT_MANAGER,
  RETAIL_MANAGER,
  FINANCIAL_ADVISER,
  CAREERS_ADVISER,
  VETERINARY_PHYSIOTHERAPIST,
]);

export function collisionUniverse(): OccupationUniverse {
  return parseCanonicalOccupationUniverse(COLLISION_FIXTURE_INPUT.map((entry) => ({ ...entry })));
}

/** Same universe, authored in reverse order, to prove order invariance. */
export function reversedCollisionUniverse(): OccupationUniverse {
  return parseCanonicalOccupationUniverse(
    [...COLLISION_FIXTURE_INPUT].reverse().map((entry) => ({ ...entry })),
  );
}
