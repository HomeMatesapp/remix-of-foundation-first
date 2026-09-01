import { describe, expect, it } from "vitest";

import {
  OccupationUniverseValidationError,
  parseCanonicalOccupationUniverse,
  safeParseCanonicalOccupationUniverse,
  validateOccupationUniverse,
} from "../canonical";
import { normaliseOccupationText } from "../normalise";
import { occupationTerms } from "../schema";
import { collisionUniverse, record, COLLISION_FIXTURE_INPUT } from "./fixtures";

const base = record({
  occupationId: "aaaaaaaa-0000-4000-8000-000000000001",
  occupationKey: "base_occupation",
  canonicalTitle: "Base Occupation",
});

function issueCodes(input: unknown): readonly string[] {
  const result = validateOccupationUniverse(input);
  return result.issues.map((issue) => issue.code);
}

describe("canonical occupation universe", () => {
  it("accepts a valid universe and freezes it deeply", () => {
    const universe = collisionUniverse();
    expect(universe).toHaveLength(COLLISION_FIXTURE_INPUT.length);
    expect(Object.isFrozen(universe)).toBe(true);
    const first = universe[0];
    if (!first) throw new Error("expected a record");
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.aliases)).toBe(true);
    expect(() => {
      (first.aliases as string[]).push("Injected Alias");
    }).toThrow();
    expect(() => {
      (first as { canonicalTitle: string }).canonicalTitle = "Rewritten";
    }).toThrow();
  });

  it("rejects unknown fields strictly", () => {
    expect(issueCodes([{ ...base, socCode: "2136" }])).toContain("schema_invalid");
  });

  it("rejects blank and overlong titles and terms", () => {
    expect(issueCodes([{ ...base, canonicalTitle: "   " }])).toContain("schema_invalid");
    expect(issueCodes([{ ...base, canonicalTitle: "ab" }])).toContain("schema_invalid");
    expect(issueCodes([{ ...base, canonicalTitle: "x".repeat(161) }])).toContain("schema_invalid");
    expect(issueCodes([{ ...base, aliases: [" "] }])).toContain("schema_invalid");
    expect(issueCodes([{ ...base, aliases: ["y".repeat(161)] }])).toContain("schema_invalid");
  });

  it("rejects an invalid occupation id or key", () => {
    expect(issueCodes([{ ...base, occupationId: "not-a-uuid" }])).toContain("schema_invalid");
    expect(issueCodes([{ ...base, occupationKey: "bad key!" }])).toContain("schema_invalid");
  });

  it("rejects duplicate occupation ids", () => {
    expect(
      issueCodes([base, { ...base, occupationKey: "other_key", canonicalTitle: "Other Title" }]),
    ).toContain("duplicate_occupation_id");
  });

  it("rejects duplicate occupation keys", () => {
    expect(
      issueCodes([
        base,
        {
          ...base,
          occupationId: "aaaaaaaa-0000-4000-8000-000000000002",
          canonicalTitle: "Other Title",
        },
      ]),
    ).toContain("duplicate_occupation_key");
  });

  it("rejects duplicate canonical titles under normalisation", () => {
    expect(
      issueCodes([
        base,
        {
          ...base,
          occupationId: "aaaaaaaa-0000-4000-8000-000000000002",
          occupationKey: "other_key",
          canonicalTitle: "  base   OCCUPATION ",
        },
      ]),
    ).toContain("duplicate_canonical_title");
  });

  it("rejects an equivalent term duplicated inside one occupation across categories", () => {
    expect(
      issueCodes([
        { ...base, aliases: ["Nurse Practitioner"], colloquialTitles: ["nurse  practitioner"] },
      ]),
    ).toContain("duplicate_term_within_occupation");
  });

  it("rejects a non-canonical term stealing another occupation's canonical title", () => {
    expect(
      issueCodes([
        base,
        record({
          occupationId: "aaaaaaaa-0000-4000-8000-000000000002",
          occupationKey: "thief",
          canonicalTitle: "Thief Occupation",
          aliases: ["base occupation"],
        }),
      ]),
    ).toContain("canonical_title_conflict");
  });

  it("allows the same non-canonical term to map to several occupations", () => {
    const outcome = safeParseCanonicalOccupationUniverse(
      COLLISION_FIXTURE_INPUT.map((entry) => ({ ...entry })),
    );
    expect(outcome.ok).toBe(true);
  });

  it("throws a validation error carrying issues", () => {
    expect(() => parseCanonicalOccupationUniverse([{ ...base, nope: true }])).toThrow(
      OccupationUniverseValidationError,
    );
    const outcome = safeParseCanonicalOccupationUniverse([{ ...base, nope: true }]);
    expect(outcome.ok).toBe(false);
  });

  it("never rewrites authored title or term bytes", () => {
    const universe = parseCanonicalOccupationUniverse([
      record({
        occupationId: "aaaaaaaa-0000-4000-8000-000000000003",
        occupationKey: "authored_bytes",
        canonicalTitle: "Solicitor of England and Wales",
        aliases: ["Children's Nurse"],
      }),
    ]);
    const only = universe[0];
    if (!only) throw new Error("expected a record");
    expect(only.canonicalTitle).toBe("Solicitor of England and Wales");
    expect(only.aliases[0]).toBe("Children's Nurse");
    expect(normaliseOccupationText(only.canonicalTitle)).toBe("solicitor of england and wales");
  });

  it("enumerates every authored term category deterministically", () => {
    const universe = collisionUniverse();
    const engineer = universe.find((entry) => entry.occupationKey === "software_engineer");
    if (!engineer) throw new Error("expected fixture");
    expect(occupationTerms(engineer).map((term) => term.category)).toEqual([
      "canonical_title",
      "specialism",
      "alias",
      "abbreviation",
      "colloquial",
      "emerging",
    ]);
  });
});
