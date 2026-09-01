import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Stages D1+D2+D3+D4+D5+D6 package boundary enforcement (current package).
 *
 * The package is a declarative readiness contract. It must contain no statement
 * execution, no relational client, no spatial computation, no network or
 * geocoding, no generative model use, no Decision Engine or Career Pack change
 * and no durable participant location vocabulary.
 */

const PACKAGE_DIR = join(process.cwd(), "src/domain/local-reality-persistence");

/** The manifest may carry this declarative qualified type string verbatim. */
const ALLOWED_DECLARATIVE_TYPE_STRING = "extensions.geography(Point,4326)";

/**
 * The Stage D5 evidence record may cite the inspected migration directory as
 * declarative string data. It is a path citation, never a client or execution.
 */
const ALLOWED_MIGRATION_PATH_PREFIX = "supabase/migrations/";

/**
 * The Stage D6 authoring record may cite the authored (not applied) migration
 * directory as declarative string data. It is a path citation, never a client
 * or execution, and the file is not applied by this package.
 */
const ALLOWED_AUTHORED_MIGRATION_PATH_PREFIX = "supabase/authored-migrations/";

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
      if (full.includes("__tests__")) continue;
      entries.push({
        file: full.slice(PACKAGE_DIR.length + 1),
        text: stripComments(readFileSync(full, "utf8"))
          .split(ALLOWED_DECLARATIVE_TYPE_STRING)
          .join("<allowed-declarative-type>")
          .split(ALLOWED_AUTHORED_MIGRATION_PATH_PREFIX)
          .join("<allowed-authored-migration-path>")
          .split(ALLOWED_MIGRATION_PATH_PREFIX)
          .join("<allowed-migration-path>"),
      });
    }
  };
  walk(PACKAGE_DIR);
  return entries;
}

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  [
    "executable statements / DDL",
    /\b(create\s+table|alter\s+table|create\s+index|insert\s+into|update\s+set|delete\s+from|select\s+.*\s+from|create\s+policy|grant\s+)/i,
  ],
  ["relational or hosted client", /supabase|createClient|postgres|\bpg\b|knex|drizzle|prisma/i],
  ["statement execution", /\brun_sql\b|executeSql|\.query\s*\(|rpc\s*\(/i],
  // Bans auth/RLS IMPLEMENTATION only. The declarative contract may name the
  // exact final access-control identifiers (`service_role`, `authenticated`,
  // `anon`, RLS) as data; executing or configuring them here is forbidden.
  [
    "auth / RLS implementation",
    /auth\.uid|getSession|requireSupabaseAuth|SUPABASE_SERVICE_ROLE|enable\s+row\s+level\s+security|create\s+policy|using\s*\(\s*auth|\bto\s+(authenticated|anon|service_role)\b/i,
  ],

  ["network or geocoding", /\bfetch\s*\(|XMLHttpRequest|axios|geocod|postcodes\.io|nominatim/i],
  [
    "spatial computation",
    /haversine|\bST_[A-Za-z]|distanceBetween|computeDistance|Math\.(sin|cos|atan2|sqrt)/i,
  ],
  [
    "participant raw location persistence",
    /rawPostcode|postcode_normalised|postcodeNormalised|latitude|longitude|\blat\b|\blng\b/i,
  ],
  ["generative engine", /openai|anthropic|gemini|\bprompt\b|\bLLM\b/i],
  [
    "Decision Engine or judgement vocabulary",
    /decision-engine|safeEvaluateRealityCheck|realistic_now|realistic_with_conditions|more_information_needed|not_realistic_yet/i,
  ],
  ["Career Pack mutation", /career-packs\/|CAREER_PACK_SCHEMA_VERSION/],
  ["UI framework", /\breact\b|useState|useEffect|@\/components|@tanstack/i],
  ["ambient clock / env", /Date\.now|new\s+Date\s*\(|process\.env|import\.meta\.env/i],
  [
    "later increment scope",
    /compareRoutes|chooseRoute|dashboard|labourDemand|aggregateIntelligence/i,
  ],
];

describe("Stages D1+D2+D3+D4+D5+D6 persistence contract boundary", () => {
  const files = sourceFiles();

  it("contains implementation files", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`contains no ${label}`, () => {
      const offenders = files.filter((entry) => pattern.test(entry.text)).map((e) => e.file);
      expect(offenders).toEqual([]);
    });
  }

  it("imports only the closed Stage A vocabulary and nothing external", () => {
    const specifiers = new Set<string>();
    for (const entry of files) {
      for (const match of entry.text.matchAll(/from\s+"([^"]+)"/g)) specifiers.add(match[1]!);
    }
    const external = [...specifiers].filter((specifier) => !specifier.startsWith("."));
    expect(external).toEqual([]);
    expect([...specifiers].some((s) => s.includes("local-reality/codes"))).toBe(true);
  });

  it("permits the declarative qualified spatial type string only as data", () => {
    const manifest = readFileSync(join(PACKAGE_DIR, "manifest.ts"), "utf8");
    expect(manifest).toContain(ALLOWED_DECLARATIVE_TYPE_STRING);
    // Declarative string only: no import of, or call into, any spatial library.
    expect(manifest).not.toMatch(/import[^;]*geo|\bST_/i);
  });

  it("never reports the projection as ready from static contract data", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/migrationReady:\s*true/);
  });
});
