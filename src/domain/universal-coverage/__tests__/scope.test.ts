import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Package boundary guard for Increment 13.
 *
 * The coverage layer must stay a pure, deterministic orchestration layer with no
 * second authority: no engine execution, no Career Pack synthesis, no
 * persistence, no infrastructure and no occupation-specific branching.
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
  ["react / UI", /\breact\b|className=|jsx/i],
  ["server / routing", /createServerFn|createFileRoute|useServerFn|@tanstack\//],
  [
    "database / SQL / RLS / auth",
    /\bsupabase\b|createClient|\bSELECT \b|\bINSERT INTO\b|row level security|auth\.uid|service_role/i,
  ],
  ["network", /\bfetch\(|XMLHttpRequest|axios|WebSocket/],
  ["filesystem", /node:fs|require\(["']fs["']\)/],
  ["environment access", /process\.env|import\.meta\.env/],
  ["ambient clock", /\bDate\.now\b|\bnew Date\(/],
  ["randomness", /Math\.random|randomUUID/],
  ["AI", /\bprompt\b|\bmodel\b|openai|anthropic|gemini|\bllm\b|\bembedding\b/i],
  [
    "geography / provider / vacancy / salary / local reality",
    /postcode|postgis|latitude|longitude|\bradius\b|\bvacanc|\bprovider\b|\bsalary\b|\bemployer\b/i,
  ],
  [
    "Reality Check judgement values",
    /realistic_now|realistic_with_conditions|not_realistic_yet|more_information_needed/,
  ],
  ["requirement states", /requirementState|\brequirement_state\b|\bunmet\b/i],
  ["Decision Engine execution", /evaluateRealityCheck|safeEvaluateRealityCheck|decision-engine/],
  ["route archetype inference", /archetype/i],
  [
    "Career Pack synthesis",
    /synthesiseCareerPack|synthesizeCareerPack|generateCareerPack|placeholderRoute/i,
  ],
  ["persistence writes", /\binsert\b|\bupsert\b|\bpersist\(|\bsave\(|\bwrite\(/i],
  ["occupation-specific branching", /\bnurse\b|\belectrician\b|\bsolicitor\b|\bphotographer\b/i],
];

describe("universal coverage package boundary", () => {
  const files = sourceFiles();

  it("contains implementation files", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`contains no ${label}`, () => {
      const offenders = files
        .filter((entry) => pattern.test(entry.text))
        .map((entry) => entry.file);
      expect(offenders).toEqual([]);
    });
  }

  it("imports only local modules, closed sibling domain packages and zod", () => {
    const allowedPackages = new Set([
      "zod",
      "../contracts",
      "../career-packs",
      "../career-pack-governance",
      "../occupation-universe",
    ]);
    for (const { file, text } of files) {
      for (const match of text.matchAll(/from "([^"]+)"/g)) {
        const specifier = match[1] ?? "";
        const allowed = allowedPackages.has(specifier) || specifier.startsWith("./");
        expect(allowed, `${file} imports ${specifier}`).toBe(true);
      }
    }
  });

  it("exposes no score, confidence, ranking or eligibility vocabulary publicly", () => {
    const index = stripComments(readFileSync(join(PACKAGE_DIR, "index.ts"), "utf8"));
    const surface = files.map((entry) => entry.text).join("\n");
    expect(index).not.toMatch(/score|confidence|rank/i);
    expect(surface).not.toMatch(/\bscore\b|\bweight\b|\bconfidence\b|\beligibility\b/i);
  });
});
