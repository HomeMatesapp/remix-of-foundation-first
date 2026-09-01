import { describe, expect, it } from "vitest";

import { ROUTE_ARCHETYPE_CODES, ROUTE_ARCHETYPE_FRAMEWORK_VERSION } from "../codes";
import {
  listCurrentRouteArchetypes,
  resolveRouteArchetype,
  resolveRouteArchetypeComposition,
} from "../registry";
import {
  routeArchetypeCompositionSchema,
  routeArchetypeRefSchema,
  type RouteArchetypeComposition,
} from "../schema";

/** Approved ordered stage skeletons — regression lock. Do not edit casually. */
const EXPECTED_STAGE_KEYS: Record<string, readonly string[]> = {
  regulated_undergraduate: [
    "entry_requirements",
    "approved_undergraduate_study",
    "professional_registration",
    "role_entry",
  ],
  postgraduate_conversion: [
    "prior_higher_education",
    "conversion_study",
    "professional_or_role_entry",
  ],
  degree_apprenticeship: [
    "employer_entry",
    "degree_apprenticeship_training",
    "completion",
    "role_entry",
  ],
  apprenticeship: ["employer_entry", "apprenticeship_training", "completion", "role_entry"],
  vocational_qualification: [
    "entry_requirements",
    "vocational_training",
    "qualification_or_competence",
    "role_entry",
  ],
  licence_certification: [
    "prerequisites",
    "training_or_assessment",
    "licence_or_certification",
    "practice_entry",
  ],
  portfolio_experience: [
    "foundation_skills",
    "portfolio_building",
    "experience_building",
    "role_entry",
  ],
  self_employed: [
    "skill_readiness",
    "business_setup",
    "client_or_market_entry",
    "ongoing_operation",
  ],
  employer_led_training: [
    "employer_entry",
    "workplace_training",
    "competence_confirmation",
    "progression",
  ],
  graduate_scheme: [
    "graduate_entry_requirements",
    "recruitment_process",
    "structured_scheme",
    "progression",
  ],
  direct_employment: ["baseline_requirements", "recruitment", "employment", "progression"],
  experience_led_progression: [
    "entry_or_adjacent_role",
    "experience_building",
    "responsibility_progression",
    "target_role",
  ],
  bridging: ["gap_identification", "bridge_step", "requirement_recheck", "target_route_handoff"],
  regulator_verification: [
    "evidence_preparation",
    "regulator_submission",
    "verification",
    "next_step",
  ],
};

describe("route archetype ref version pinning", () => {
  it("accepts the current framework version", () => {
    expect(
      routeArchetypeRefSchema.parse({
        code: "bridging",
        version: ROUTE_ARCHETYPE_FRAMEWORK_VERSION,
      }),
    ).toEqual({ code: "bridging", version: "1.0.0" });
  });

  it.each(["1.0.1", "2.0.0", "0.9.9", "9.9.9", "1.0", "v1.0.0", "", "latest"])(
    "rejects version %s",
    (version) => {
      expect(routeArchetypeRefSchema.safeParse({ code: "bridging", version }).success).toBe(false);
    },
  );

  it("composition schema itself rejects a current code at version 9.9.9", () => {
    const result = routeArchetypeCompositionSchema.safeParse({
      frameworkVersion: ROUTE_ARCHETYPE_FRAMEWORK_VERSION,
      archetypes: [{ code: "bridging", version: "9.9.9" }],
    });
    expect(result.success).toBe(false);
  });

  it("resolver still fails closed for raw unvalidated wrong-version input", () => {
    const raw = {
      frameworkVersion: ROUTE_ARCHETYPE_FRAMEWORK_VERSION,
      archetypes: [{ code: "bridging", version: "9.9.9" }],
    } as unknown as RouteArchetypeComposition;
    expect(resolveRouteArchetypeComposition(raw)).toBeUndefined();
    expect(resolveRouteArchetype("bridging", "9.9.9")).toBeUndefined();
    expect(resolveRouteArchetype("not_a_code", ROUTE_ARCHETYPE_FRAMEWORK_VERSION)).toBeUndefined();
  });
});

describe("exact stage skeleton regression lock", () => {
  it("locks all 14 governed skeletons in exact order", () => {
    expect(Object.keys(EXPECTED_STAGE_KEYS)).toHaveLength(14);
    for (const code of ROUTE_ARCHETYPE_CODES) {
      const definition = resolveRouteArchetype(code, ROUTE_ARCHETYPE_FRAMEWORK_VERSION);
      expect(definition, code).toBeDefined();
      expect([...definition!.stageKeys], code).toEqual([...EXPECTED_STAGE_KEYS[code]!]);
    }
  });
});

describe("canonical registry immutability", () => {
  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* frozen objects throw in strict mode; either outcome is acceptable */
    }
  };

  it("definitions cannot be mutated in a way that changes later reads", () => {
    const first = resolveRouteArchetype("bridging", ROUTE_ARCHETYPE_FRAMEWORK_VERSION)!;
    attempt(() => {
      (first as unknown as { code: string }).code = "apprenticeship";
    });
    attempt(() => {
      (first as unknown as { version: string }).version = "9.9.9";
    });
    const again = resolveRouteArchetype("bridging", ROUTE_ARCHETYPE_FRAMEWORK_VERSION)!;
    expect(again.code).toBe("bridging");
    expect(again.version).toBe(ROUTE_ARCHETYPE_FRAMEWORK_VERSION);
  });

  it("stage-key arrays cannot be mutated in a way that changes later reads", () => {
    const definition = resolveRouteArchetype("apprenticeship", ROUTE_ARCHETYPE_FRAMEWORK_VERSION)!;
    attempt(() => {
      (definition.stageKeys as string[]).push("injected_stage");
    });
    attempt(() => {
      (definition.stageKeys as string[])[0] = "tampered";
    });
    const again = resolveRouteArchetype("apprenticeship", ROUTE_ARCHETYPE_FRAMEWORK_VERSION)!;
    expect([...again.stageKeys]).toEqual([...EXPECTED_STAGE_KEYS["apprenticeship"]!]);
  });

  it("catalogue order remains unchanged after mutation attempts", () => {
    const list = listCurrentRouteArchetypes();
    attempt(() => {
      (list as unknown as unknown[]).reverse();
    });
    attempt(() => {
      (list as unknown as unknown[]).push({ code: "bridging" });
    });
    expect(listCurrentRouteArchetypes().map((d) => d.code)).toEqual([...ROUTE_ARCHETYPE_CODES]);
  });
});
