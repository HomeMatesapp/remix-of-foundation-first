import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Package boundary enforcement.
 *
 * Local Reality Stage A is a pure domain package. These tests assert the July
 * hard-stop boundary structurally: no SQL/migrations/hosted DB, no RLS or auth,
 * no network, no filesystem I/O, no UI framework, no AI/model/prompt, no ambient
 * clock, no process env, no geographic computation, no Decision Engine usage and
 * no Compare/Choose/progress/dashboard/aggregate-intelligence concepts.
 */

const PACKAGE_DIR = join(process.cwd(), "src/domain/local-reality");

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
  ["UI framework", /\breact\b|jsx|tsx|useState|useEffect|@\/components|@tanstack/i],
  ["generative engine", /\bAI\b|openai|anthropic|gemini|\bprompt\b|\bmodel\b|LLM/i],
  ["ambient clock / timers", /Date\.now|new\s+Date\s*\(|performance\.now|setTimeout|setInterval/i],
  ["process env", /process\.env|import\.meta\.env/i],
  ["persistence layer", /repository|\bservice\b|\bstore\b|persist|localStorage|sessionStorage/i],
  [
    "geographic computation / PostGIS",
    /haversine|ST_[A-Za-z]|geography\s*\(|geometry\s*\(|latitude|longitude|\blat\b|\blng\b|Math\.(sin|cos|tan|sqrt|atan2)/i,
  ],
  [
    "Decision Engine execution",
    /decision-engine|evaluateRule|evaluatePack|computeJudgement|rankRoutes|safeEvaluateRealityCheck/i,
  ],
  [
    "later increment scope",
    /compareRoutes|chooseRoute|myRoute|progressTracking|dashboard|aggregateIntelligence|labourDemand/i,
  ],
  ["retention period constant", /retention/i],
];

describe("local reality package boundary", () => {
  const files = sourceFiles().filter((entry) => !entry.file.startsWith("__tests__"));

  it("contains implementation files", () => {
    expect(files.length).toBeGreaterThan(3);
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

  it("adds no second hashing algorithm and reuses the existing hashing authority", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/createHash|md5|sha1|sha512|blake/i);
    expect(surface).toMatch(/career-pack-governance\/hash/);
  });

  it("isolates hashing away from the browser-safe barrel", () => {
    const barrel = stripComments(readFileSync(join(PACKAGE_DIR, "index.ts"), "utf8"));
    expect(barrel).not.toMatch(/\.\/hash/);
    const hashImporters = files.filter(
      (entry) => entry.file !== "hash.ts" && /\.\/hash/.test(entry.text),
    );
    expect(hashImporters.map((entry) => entry.file)).toEqual([]);
  });

  it("computes no distance and concludes no local accessibility", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/distanceBetween|computeDistance|travelTime|journeyTime/i);
    expect(surface).not.toMatch(/localAccessib|isAccessible|opportunityStatus/i);
  });

  it("declares no engine, pack schema or judgement vocabulary", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(
      /DECISION_ENGINE_VERSION|CAREER_PACK_SCHEMA_VERSION|realistic_now|realistic_with_conditions|more_information_needed|not_realistic_yet/,
    );
  });

  it("declares no protected judgement, requirement-state or structural entry vocabulary", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/\beligibilit/i);
    expect(surface).not.toMatch(/\b(un)?met\b/i);
    expect(surface).not.toMatch(/routeAvailable|isAvailable|routeUnavailable/i);
  });

  it("introduces no zero-result / searched-and-found-none Stage B state", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/no_current_example_found|zeroResult|searchExecuted/i);
  });

  it("stores no raw postcode value in the snapshot contract", () => {
    const surface = files.map((entry) => entry.text).join("\n");
    expect(surface).not.toMatch(/rawPostcode|postcodeValue|fullPostcodeValue|postcodeSchema/);
  });

  it("performs exact key matching only, with no matcher normalisation in the resolver", () => {
    // Stage B binds `signalKey === localFactKey` by exact equality. Any string
    // transformation in the resolver source would silently widen that binding.
    const resolver = stripComments(readFileSync(join(PACKAGE_DIR, "resolve.ts"), "utf8"));
    expect(resolver).not.toMatch(/\.trim\s*\(/);
    expect(resolver).not.toMatch(/\.toLowerCase\s*\(/);
    expect(resolver).not.toMatch(/\.toUpperCase\s*\(/);
    expect(resolver).not.toMatch(/\.normalize\s*\(/);
    expect(resolver).not.toMatch(/\.replace\s*\(|localeCompare\s*\(|startsWith\s*\(|includes\s*\(/);
  });
});
