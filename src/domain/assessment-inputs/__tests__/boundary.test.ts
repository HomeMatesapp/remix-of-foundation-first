import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Package boundary enforcement.
 *
 * Immutable Assessment Inputs is a pure domain package. These tests assert the
 * July hard-stop boundary structurally: no SQL, no migrations, no hosted
 * database access, no RLS, no auth, no network, no filesystem I/O, no
 * deployment, no UI framework, no generative engine usage, no ambient clock, no
 * process env dependency and no Increment 9 evaluation logic.
 */

const PACKAGE_DIR = join(process.cwd(), "src/domain/assessment-inputs");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function sourceFiles(): readonly { readonly file: string; readonly text: string }[] {
  const entries: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) continue;
      entries.push({
        file: full.slice(PACKAGE_DIR.length + 1),
        // Comments are stripped so the scan inspects EXECUTABLE code only.
        text: stripComments(readFileSync(full, "utf8")),
      });
    }
  };
  walk(PACKAGE_DIR);
  return entries;
}

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  [
    "SQL / DDL",
    /\b(create\s+table|alter\s+table|insert\s+into|select\s+\*\s+from|drop\s+table)\b/i,
  ],
  ["row level security", /row\s+level\s+security|\bRLS\b|create\s+policy/i],
  ["migrations", /\bmigration(s)?\b/i],
  ["hosted database client", /@supabase|supabase|postgres|pg_/i],
  ["auth", /auth\.uid|getSession|requireSupabaseAuth|service_role/i],
  ["server functions / routes", /createServerFn|createFileRoute|useServerFn/i],
  ["network I/O", /\bfetch\s*\(|XMLHttpRequest|axios|WebSocket/i],
  ["filesystem I/O", /node:fs|writeFileSync|readFileSync/i],
  ["deployment", /\bdeploy(ment)?\b|wrangler|cloudflare/i],
  ["UI framework", /\breact\b|jsx|tsx|useState|useEffect|@\/components/i],
  ["generative engine", /\bAI\b|openai|anthropic|gemini|\bprompt\b|\bmodel\b|LLM/i],
  ["ambient clock / timers", /Date\.now|new\s+Date\s*\(|performance\.now|setTimeout|setInterval/i],
  ["process env", /process\.env|import\.meta\.env/i],
  ["persistence layer", /repository|\bservice\b|\bstore\b|persist|localStorage/i],
  [
    "Increment 9 evaluation",
    /evaluateRule|evaluatePack|computeJudgement|rankRoutes|deriveRequirementState|practicalFitOf/i,
  ],
];

describe("assessment inputs package boundary", () => {
  const files = sourceFiles().filter((entry) => !entry.file.startsWith("__tests__"));

  it("contains implementation files", () => {
    expect(files.length).toBeGreaterThan(4);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`contains no ${label} usage`, () => {
      const offenders = files
        .filter((entry) => pattern.test(entry.text))
        .map((entry) => entry.file);
      expect(offenders).toEqual([]);
    });
  }

  it("imports only pure domain modules and zod", () => {
    const imports = new Set<string>();
    for (const entry of files) {
      for (const match of entry.text.matchAll(/from\s+"([^"]+)"/g)) {
        imports.add(match[1]!);
      }
    }
    const external = [...imports].filter((specifier) => !specifier.startsWith("."));
    expect(external.sort()).toEqual(["zod"]);
  });

  it("adds no second hashing algorithm or dependency", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/createHash|md5|sha1|sha512|blake/i);
    expect(surface).toMatch(/career-pack-governance\/hash/);
  });

  it("exposes no visibility execution, ranking, judgement or submission API", () => {
    const barrel = readFileSync(join(PACKAGE_DIR, "index.ts"), "utf8");
    const surface = files.map((entry) => entry.text).join("\n");
    expect(barrel).not.toMatch(/submit|receipt|evaluate|judgement|ranking|visibility/i);
    expect(surface).not.toMatch(/export\s+(async\s+)?function\s+(submit|evaluate|rank)/i);
  });

  it("defines no Local Reality document vocabulary", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/postcode|postgis|latitude|longitude|vacanc|provider[A-Z]/i);
  });
});
