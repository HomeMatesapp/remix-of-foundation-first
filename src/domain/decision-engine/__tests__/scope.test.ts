import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architectural scope guard for Increment 9.
 *
 * The shared Decision Engine must stay pure and career-agnostic: one evaluator
 * for every occupation, with no SQL, database, RLS, auth, UI, routing, network,
 * filesystem, environment, ambient clock, AI/model/prompt, geographic, provider,
 * vacancy or local-fact logic anywhere inside the package.
 */

const PACKAGE_DIR = join(import.meta.dirname, "..");

/** Comments are documentation, not behaviour: only executable code is scanned. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceFiles(): readonly { readonly file: string; readonly text: string }[] {
  return readdirSync(PACKAGE_DIR)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => ({
      file: name,
      text: stripComments(readFileSync(join(PACKAGE_DIR, name), "utf8")),
    }));
}

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ["ambient clock", /\bDate\.now\b|\bnew Date\(/],
  ["environment access", /process\.env|import\.meta\.env/],
  ["filesystem", /node:fs|require\(["']fs["']\)/],
  ["network", /\bfetch\(|XMLHttpRequest|axios/],
  [
    "database / SQL",
    /\bsupabase\b|\bcreateClient\b|\bSELECT \b|\bINSERT INTO\b|row level security/i,
  ],
  ["server / routing", /createServerFn|createFileRoute|@tanstack\//],
  ["react / UI", /\breact\b|tsx?["']\s*$|className=/i],
  ["AI authority", /\bprompt\b|\bmodel\b|\bopenai\b|\bgemini\b|\bllm\b/i],
  ["geography", /postcode|postgis|latitude|longitude|\bradius\b/i],
  ["provider / vacancy", /\bvacanc|\bprovider(?!_dependent|Dependent)/i],
  ["scores and weights", /\bscore\b|\bweight\b|\bpoints\b/i],
  ["randomness", /Math\.random|crypto\.randomUUID/],
];

describe("decision engine scope", () => {
  it("contains no career-specific, occupation-specific or slug-specific identifiers", () => {
    for (const { file, text } of sourceFiles()) {
      expect(text, file).not.toMatch(/\bslug\b/i);
      /* Only opaque keys ever appear; no named occupation or route vocabulary. */
      expect(text, file).not.toMatch(/\bnurse|electrician|plumber|teacher|apprenticeship\b/i);
    }
  });

  it("contains no out-of-scope runtime dependency or side effect", () => {
    for (const { file, text } of sourceFiles()) {
      for (const [label, pattern] of FORBIDDEN) {
        expect(pattern.test(text), `${file} must not contain ${label}`).toBe(false);
      }
    }
  });

  it("declares exactly one shared engine version", () => {
    const codes = readFileSync(join(PACKAGE_DIR, "codes.ts"), "utf8");
    expect(codes).toContain('DECISION_ENGINE_VERSION = "1.0.0"');
  });

  it("imports only frozen domain packages and zod", () => {
    for (const { file, text } of sourceFiles()) {
      const imports = [...text.matchAll(/from "([^"]+)"/g)].map((match) => match[1] ?? "");
      for (const specifier of imports) {
        const allowed =
          specifier === "zod" || specifier.startsWith("./") || specifier.startsWith("../");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });
});
