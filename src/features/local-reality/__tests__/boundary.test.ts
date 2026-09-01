import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Increment 17 Stage C scope guard.
 *
 * The Local Reality feature COLLECTS a transient postcode and PRESENTS closed
 * Stage A facts through the closed Stage B resolver. It must contain no
 * database, migration, SQL, RLS or auth path, no PostGIS, coordinates or
 * geographic maths, no network call, no geocoding or provider integration, no
 * AI/model/prompt path, no persistence of any kind, no Compare/Choose/MyRoute/
 * progress/dashboard concept, no new protected judgement or requirement
 * vocabulary, and no durable raw-postcode field.
 */

const FEATURE_DIR = join(process.cwd(), "src/features/local-reality");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function collect(dir: string, files: { file: string; text: string }[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collect(full, files);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    files.push({
      file: full.slice(FEATURE_DIR.length + 1),
      text: stripComments(readFileSync(full, "utf8")),
    });
  }
}

const FILES: readonly { readonly file: string; readonly text: string }[] = (() => {
  const files: { file: string; text: string }[] = [];
  collect(FEATURE_DIR, files);
  return files;
})();

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  [
    "SQL / DDL",
    /\b(create\s+table|alter\s+table|insert\s+into|drop\s+table|select\s+\*\s+from)\b/i,
  ],
  ["migrations", /\bmigration(s)?\b/i],
  ["row level security", /row\s+level\s+security|\bRLS\b|create\s+policy/i],
  ["hosted database / auth", /@supabase|supabase|postgres|pg_|auth\.uid|getSession|service_role/i],
  ["server boundary", /createServerFn|createFileRoute|useServerFn/i],
  ["network I/O", /\bfetch\s*\(|XMLHttpRequest|axios|WebSocket|https?:\/\//i],
  [
    "geographic maths / coordinates",
    /postgis|haversine|latitude|longitude|\blat\b|\blng\b|geocod|st_distance|travelTime/i,
  ],
  ["AI / generative", /\bopenai\b|anthropic|gemini|\bprompt\b|\bLLM\b|lovable-ai/i],
  ["persistence", /localStorage|sessionStorage|indexedDB|document\.cookie|writeFileSync|node:fs/i],
  [
    "compare / choose / progress / dashboard",
    /compareRoutes|chooseRoute|myRoute|savedProgress|dashboard/i,
  ],
  ["retention policy claim", /retention/i],
  ["decision engine execution", /evaluateRealityCheck|DECISION_ENGINE_VERSION/],
];

describe("Stage C boundary", () => {
  it("collects source files to scan", () => {
    expect(FILES.length).toBeGreaterThan(3);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`contains no ${label}`, () => {
      const offenders = FILES.filter((entry) => pattern.test(entry.text)).map(
        (entry) => entry.file,
      );
      expect(offenders).toEqual([]);
    });
  }

  it("declares no durable raw-postcode field name", () => {
    const offenders = FILES.filter((entry) =>
      /(postcode\s*:\s*string\s*;\s*\/\*\s*persist)|savedPostcode|storedPostcode|postcodeHistory|persistedPostcode/i.test(
        entry.text,
      ),
    ).map((entry) => entry.file);
    expect(offenders).toEqual([]);
  });

  it("introduces no protected judgement or requirement vocabulary", () => {
    const forbidden = [
      "realistic_now",
      "realistic_with_conditions",
      "more_information_needed",
      "not_realistic_yet",
      "no_current_example_found",
    ];
    for (const entry of FILES) {
      for (const token of forbidden) {
        expect(entry.text, `${entry.file} must not contain ${token}`).not.toContain(token);
      }
    }
  });

  it("resolves local state only through the closed Stage B resolver", () => {
    const viewModel = FILES.find((entry) => entry.file === "view-model.ts");
    expect(viewModel?.text).toContain("resolveLocalRequirements");
    /* Only three local states may be named anywhere in the feature. */
    for (const entry of FILES) {
      const states =
        entry.text.match(
          /matching_local_evidence_present|local_evidence_insufficient|location_not_supplied/g,
        ) ?? [];
      const distinct = new Set(states);
      expect(distinct.size).toBeLessThanOrEqual(3);
    }
  });
});

describe("Increment 17 Stage C public barrel boundary", () => {
  const BARREL = readFileSync(join(FEATURE_DIR, "index.ts"), "utf8");

  it("does not re-export raw postcode collection or controller modules", () => {
    const stripped = stripComments(BARREL);
    expect(stripped).not.toMatch(/from\s+"\.\/postcode"/);
    expect(stripped).not.toMatch(/from\s+"\.\/collection"/);
  });

  it("exposes no raw-postcode normalisation, controller or hand-off API publicly", async () => {
    const publicApi = await import("../index");
    /* Participant-safe copy constants may mention the field; APIs may not. */
    const forbidden =
      /handOff|normalisePostcode|normalizePostcode|validatePostcode|postcodeShape|collectionReducer|CollectionState|collectionState/i;
    const offenders = Object.keys(publicApi).filter((name) => forbidden.test(name));
    expect(offenders).toEqual([]);
  });
});
