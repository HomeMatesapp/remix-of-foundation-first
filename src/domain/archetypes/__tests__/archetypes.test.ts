import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ROUTE_ARCHETYPE_CODES,
  ROUTE_ARCHETYPE_FRAMEWORK_VERSION,
  isKnownRouteArchetypeRef,
  listCurrentRouteArchetypes,
  resolveRouteArchetype,
  resolveRouteArchetypeComposition,
  routeArchetypeCompositionSchema,
  routeArchetypeDefinitionSchema,
  type RouteArchetypeComposition,
  type RouteArchetypeRef,
} from "../index";

const PACKAGE_DIR = join(process.cwd(), "src/domain/archetypes");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

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

describe("A. governed catalogue", () => {
  it("contains exactly the 14 approved codes in stable order", () => {
    expect([...ROUTE_ARCHETYPE_CODES]).toEqual(EXPECTED_CODES);
    expect(ROUTE_ARCHETYPE_CODES).toHaveLength(14);
  });

  it("registry has exactly one definition per code, no extras or aliases", () => {
    const definitions = listCurrentRouteArchetypes();
    expect(definitions).toHaveLength(14);
    expect(definitions.map((d) => d.code)).toEqual(EXPECTED_CODES);
    expect(new Set(definitions.map((d) => d.code)).size).toBe(14);
  });
});

describe("B. definition validity and versioning", () => {
  it("every definition validates and uses framework version 1.0.0", () => {
    expect(ROUTE_ARCHETYPE_FRAMEWORK_VERSION).toBe("1.0.0");
    for (const definition of listCurrentRouteArchetypes()) {
      expect(routeArchetypeDefinitionSchema.parse(definition)).toEqual(definition);
      expect(definition.version).toBe("1.0.0");
    }
  });
});

describe("C. stage skeletons", () => {
  it("every definition has ordered, non-empty, unique stage keys", () => {
    for (const definition of listCurrentRouteArchetypes()) {
      expect(definition.stageKeys.length).toBeGreaterThan(0);
      expect(new Set(definition.stageKeys).size).toBe(definition.stageKeys.length);
      for (const key of definition.stageKeys) {
        expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("rejects empty and duplicate stage keys", () => {
    expect(
      routeArchetypeDefinitionSchema.safeParse({
        code: "bridging",
        version: "1.0.0",
        stageKeys: [],
      }).success,
    ).toBe(false);
    expect(
      routeArchetypeDefinitionSchema.safeParse({
        code: "bridging",
        version: "1.0.0",
        stageKeys: ["bridge_step", "bridge_step"],
      }).success,
    ).toBe(false);
  });
});

describe("D/E. exact resolution fails closed", () => {
  it("resolves an exact code + version", () => {
    const definition = resolveRouteArchetype("apprenticeship", "1.0.0");
    expect(definition?.code).toBe("apprenticeship");
  });

  it("rejects unknown codes and near-miss aliases", () => {
    for (const code of [
      "unknown_archetype",
      "Apprenticeship",
      "apprenticeships",
      "degree apprenticeship",
      "",
    ]) {
      expect(resolveRouteArchetype(code, "1.0.0")).toBeUndefined();
    }
  });

  it("rejects a wrong version", () => {
    expect(resolveRouteArchetype("apprenticeship", "1.0.1")).toBeUndefined();
    expect(resolveRouteArchetype("apprenticeship", "2.0.0")).toBeUndefined();
    expect(
      isKnownRouteArchetypeRef({
        code: "apprenticeship",
        version: "1.1.0",
      } as unknown as RouteArchetypeRef),
    ).toBe(false);
  });
});

describe("F/G/H/I. composition", () => {
  const ref = (code: string) => ({ code, version: "1.0.0" });

  it("parses a single-archetype composition", () => {
    const parsed = routeArchetypeCompositionSchema.parse({
      frameworkVersion: "1.0.0",
      archetypes: [ref("regulated_undergraduate")],
    });
    expect(parsed.archetypes).toHaveLength(1);
  });

  it("parses a multi-archetype composition and preserves order", () => {
    const parsed = routeArchetypeCompositionSchema.parse({
      frameworkVersion: "1.0.0",
      archetypes: [ref("bridging"), ref("vocational_qualification")],
    });
    expect(parsed.archetypes.map((r) => r.code)).toEqual(["bridging", "vocational_qualification"]);
    expect(resolveRouteArchetypeComposition(parsed)?.map((d) => d.code)).toEqual([
      "bridging",
      "vocational_qualification",
    ]);
  });

  it("rejects an empty chain", () => {
    expect(
      routeArchetypeCompositionSchema.safeParse({
        frameworkVersion: "1.0.0",
        archetypes: [],
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate identical refs in a chain", () => {
    expect(
      routeArchetypeCompositionSchema.safeParse({
        frameworkVersion: "1.0.0",
        archetypes: [ref("bridging"), ref("bridging")],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown code or wrong version in a chain", () => {
    expect(
      routeArchetypeCompositionSchema.safeParse({
        frameworkVersion: "1.0.0",
        archetypes: [ref("not_an_archetype")],
      }).success,
    ).toBe(false);

    const wrongVersion = {
      frameworkVersion: "1.0.0" as const,
      archetypes: [{ code: "bridging" as const, version: "9.9.9" }],
    } as unknown as RouteArchetypeComposition;
    expect(resolveRouteArchetypeComposition(wrongVersion)).toBeUndefined();
  });

  it("rejects a wrong framework version on the composition", () => {
    expect(
      routeArchetypeCompositionSchema.safeParse({
        frameworkVersion: "2.0.0",
        archetypes: [ref("bridging")],
      }).success,
    ).toBe(false);
  });
});

describe("J. no policy or participant-facing vocabulary", () => {
  const FORBIDDEN = [
    "required",
    "optional",
    "blocking",
    "severity",
    "weight",
    "score",
    "condition",
    "rule",
    "question",
    "evidence",
    "grade",
    "ranking",
    "cost",
    "duration",
    "salary",
    "label",
    "title",
    "description",
    "displayName",
    "action",
    "occupation",
  ];

  it("definitions expose only structural fields", () => {
    for (const definition of listCurrentRouteArchetypes()) {
      expect(Object.keys(definition).sort()).toEqual(["code", "stageKeys", "version"]);
    }
  });

  it("definition schema rejects smuggled policy fields", () => {
    for (const field of FORBIDDEN) {
      const result = routeArchetypeDefinitionSchema.safeParse({
        code: "bridging",
        version: "1.0.0",
        stageKeys: ["bridge_step"],
        [field]: "x",
      });
      expect(result.success, `field ${field} must be rejected`).toBe(false);
    }
  });

  it("composition schema rejects smuggled policy fields", () => {
    for (const field of FORBIDDEN) {
      const result = routeArchetypeCompositionSchema.safeParse({
        frameworkVersion: "1.0.0",
        archetypes: [{ code: "bridging", version: "1.0.0" }],
        [field]: "x",
      });
      expect(result.success, `field ${field} must be rejected`).toBe(false);
    }
    expect(
      routeArchetypeCompositionSchema.safeParse({
        frameworkVersion: "1.0.0",
        archetypes: [{ code: "bridging", version: "1.0.0", weight: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe("K/L. package boundary", () => {
  const files = sourceFiles(PACKAGE_DIR).filter((f) => !f.includes("__tests__"));

  it("has source files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("imports nothing from React, Supabase, UI, routes or the database", () => {
    const forbiddenImports =
      /from\s+["'](react|react-dom|@tanstack\/[^"']+|@supabase\/[^"']+|@\/integrations\/[^"']+|@\/components\/[^"']+|@\/routes\/[^"']+|\.\.\/\.\.\/integrations\/[^"']+)["']/;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(forbiddenImports.test(source), `${file} has a forbidden import`).toBe(false);
      expect(/\b(window|document|localStorage|fetch\()/.test(source)).toBe(false);
    }
  });

  it("only imports zod and the shared contracts layer", () => {
    const allowed = new Set(["zod", "../contracts", "./codes", "./schema", "./registry"]);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        expect(allowed.has(match[1]!), `${file} imports ${match[1]}`).toBe(true);
      }
    }
  });

  it("contains no career-specific implementation", () => {
    const careerTerms = /\b(registered nurse|nursing|nurse|electrician|solicitor|photographer)\b/i;
    for (const file of files) {
      expect(
        careerTerms.test(readFileSync(file, "utf8")),
        `${file} contains career-specific logic`,
      ).toBe(false);
    }
  });
});
