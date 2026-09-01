import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Architectural scope guard for Increment 12.
 *
 * The occupation universe layer must stay a pure, deterministic UK-first
 * resolution layer: no SQL, database, RLS, auth, UI, routing, network,
 * filesystem, environment, ambient clock, AI/model/prompt, geography, provider,
 * vacancy, Decision Engine evaluation or Reality Check judgement logic, and no
 * participant-facing copy.
 */

const PACKAGE_DIR = join(import.meta.dirname, "..");

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
  ["react / UI", /\breact\b|className=/i],
  ["AI authority", /\bprompt\b|\bmodel\b|\bopenai\b|\bgemini\b|\bllm\b|\bembedding\b/i],
  ["geography", /postcode|postgis|latitude|longitude|\bradius\b/i],
  ["provider / vacancy", /\bvacanc|\bprovider\b/i],
  ["randomness", /Math\.random|crypto\.randomUUID/],
  [
    "Reality Check judgement",
    /realistic_now|realistic_with_conditions|not_realistic_yet|more_information_needed/,
  ],
  ["Decision Engine evaluation", /evaluateRealityCheck|DECISION_ENGINE_VERSION/],
];

describe("occupation universe scope", () => {
  it("contains no out-of-scope runtime dependency or side effect", () => {
    for (const { file, text } of sourceFiles()) {
      for (const [label, pattern] of FORBIDDEN) {
        expect(pattern.test(text), `${file} must not contain ${label}`).toBe(false);
      }
    }
  });

  it("imports only local modules and zod", () => {
    for (const { file, text } of sourceFiles()) {
      const imports = [...text.matchAll(/from "([^"]+)"/g)].map((match) => match[1] ?? "");
      for (const specifier of imports) {
        const allowed =
          specifier === "zod" || specifier.startsWith("./") || specifier.startsWith("../");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });

  it("hard-codes no occupation content in the domain layer", () => {
    for (const { file, text } of sourceFiles()) {
      expect(text, file).not.toMatch(/\bnurse\b|\belectrician\b|\bsolicitor\b|\bphotographer\b/i);
    }
  });

  it("exposes no confidence score, weight or ranking vocabulary in its public surface", () => {
    const index = stripComments(readFileSync(join(PACKAGE_DIR, "index.ts"), "utf8"));
    expect(index).not.toMatch(/\bscore\b|\bweight\b|\bconfidence\b|\brank\b/i);
  });
});
