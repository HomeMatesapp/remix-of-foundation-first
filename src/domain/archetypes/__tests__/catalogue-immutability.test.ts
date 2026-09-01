import { describe, expect, it } from "vitest";

import { ROUTE_ARCHETYPE_CODES } from "../codes";
import { listCurrentRouteArchetypes } from "../registry";

const EXPECTED_CODES = [
  "regulated_undergraduate",
  "postgraduate_conversion",
  "degree_apprenticeship",
  "apprenticeship",
  "vocational_qualification",
  "licence_certification",
  "portfolio_experience",
  "self_employed",
  "employer_led_training",
  "graduate_scheme",
  "direct_employment",
  "experience_led_progression",
  "bridging",
  "regulator_verification",
];

function mutable(value: readonly unknown[]): unknown[] {
  return value as unknown[];
}

function attempt(action: () => void): void {
  try {
    action();
  } catch {
    // Frozen arrays throw in strict mode; a silent no-op is equally acceptable.
  }
}

describe("ROUTE_ARCHETYPE_CODES is frozen at runtime", () => {
  it("cannot be reordered, extended, truncated or overwritten", () => {
    attempt(() => mutable(ROUTE_ARCHETYPE_CODES).push("injected_archetype"));
    attempt(() => mutable(ROUTE_ARCHETYPE_CODES).reverse());
    attempt(() => mutable(ROUTE_ARCHETYPE_CODES).splice(0, 2));
    attempt(() => {
      mutable(ROUTE_ARCHETYPE_CODES)[0] = "tampered";
    });

    expect(Object.isFrozen(ROUTE_ARCHETYPE_CODES)).toBe(true);
    expect([...ROUTE_ARCHETYPE_CODES]).toEqual(EXPECTED_CODES);
    expect(ROUTE_ARCHETYPE_CODES).toHaveLength(14);
  });

  it("keeps listCurrentRouteArchetypes() order and content stable after mutation attempts", () => {
    attempt(() => mutable(ROUTE_ARCHETYPE_CODES).push("injected_archetype"));
    attempt(() => mutable(ROUTE_ARCHETYPE_CODES).reverse());
    attempt(() => mutable(ROUTE_ARCHETYPE_CODES).pop());

    const listed = listCurrentRouteArchetypes().map((definition) => definition.code);
    expect(listed).toEqual(EXPECTED_CODES);
    expect(listed).toHaveLength(14);
    expect(listed).not.toContain("injected_archetype");
  });
});
