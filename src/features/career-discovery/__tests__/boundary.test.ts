import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Increment 14 scope guard.
 *
 * The participant discovery/overview layer must remain presentation-only: no
 * Decision Engine execution, no participant answers, no local reality, no AI,
 * no network, no database and no occupation-specific search branching.
 */

const ROOTS = [
  join(import.meta.dirname, ".."),
  join(import.meta.dirname, "..", "..", "..", "content", "career-overviews"),
  join(import.meta.dirname, "..", "..", "..", "routes"),
];

const ROUTE_FILES = new Set(["index.tsx", "careers.$occupationKey.tsx"]);

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, files: { file: string; text: string }[]): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__") continue;
      collect(path, files);
      continue;
    }
    if (!/\.tsx?$/.test(name)) continue;
    if (dir.endsWith("routes") && !ROUTE_FILES.has(name)) continue;
    files.push({ file: path, text: stripComments(readFileSync(path, "utf8")) });
  }
}

function runtimeSources(): readonly { readonly file: string; readonly text: string }[] {
  const files: { file: string; text: string }[] = [];
  for (const root of ROOTS) collect(root, files);
  return files;
}

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ["Decision Engine execution", /evaluateRealityCheck|safeEvaluateRealityCheck|decision-engine/],
  [
    "protected judgement values",
    /realistic_now|realistic_with_conditions|not_realistic_yet|more_information_needed/,
  ],
  [
    "participant answer / questionnaire state",
    /answerSnapshot|answer_snapshot|questionnaire|\bquestionKey\b|assessment-inputs/i,
  ],
  [
    "requirement / barrier / eligibility derivation",
    /requirementState|\beligibility\b|\bbarrier\b|unresolvedCheck/i,
  ],
  [
    "postcode / PostGIS / provider / vacancy / local reality",
    /postcode|postgis|latitude|longitude|\bvacanc|localReality|local_reality|providerDirectory/i,
  ],
  [
    "compare / decision progress / dashboard / reporting",
    /compareRoutes|decisionProgress|\bdashboard\b|\breporting\b|\bcohort\b/i,
  ],
  ["AI / model / prompt / embedding", /\bprompt\b|openai|anthropic|gemini|\bllm\b|\bembedding\b/i],
  /* Authored evidence URLs are required content, so only runtime callers are banned. */
  ["external network / runtime fetch", /\bfetch\(|XMLHttpRequest|\baxios\b|WebSocket|\.get\(/],
  [
    "database / auth / RLS",
    /\bsupabase\b|createClient|row level security|auth\.uid|service_role|\bRLS\b/i,
  ],
  ["invented scoring", /demandScore|demandRating|suitabilityScore|routeScore|confidenceScore/i],
];

describe("increment 14 participant discovery boundary", () => {
  const files = runtimeSources();

  it("scans the new feature, content and route sources", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it("declares exactly one app-internal server boundary, for Increment 13 coverage only", () => {
    const withServerFn = files
      .filter((entry) => /createServerFn/.test(entry.text))
      .map((entry) => entry.file);
    expect(withServerFn.map((file) => file.replace(/^.*\/src\//, "src/"))).toEqual([
      "src/features/career-discovery/coverage.functions.ts",
    ]);
  });

  for (const [label, pattern] of FORBIDDEN) {
    it(`contains no ${label}`, () => {
      expect(files.filter((entry) => pattern.test(entry.text)).map((entry) => entry.file)).toEqual(
        [],
      );
    });
  }

  it("contains no occupation-specific branching in search or view-model logic", () => {
    const logic = files.filter(
      (entry) => entry.file.includes("view-model") || entry.file.includes("components"),
    );
    expect(logic.length).toBeGreaterThan(0);
    for (const entry of logic) {
      expect(/\bnurse\b|\belectrician\b|\bsolicitor\b|\bphotographer\b/i.test(entry.text)).toBe(
        false,
      );
    }
  });

  it("does not implement a second matching algorithm", () => {
    const feature = files.filter((entry) => entry.file.includes("career-discovery"));
    for (const entry of feature) {
      expect(/levenshtein|editDistance|fuzzy|\.score\b/i.test(entry.text)).toBe(false);
    }
  });

  it("links the call to action to the Increment 15 Reality Check route", () => {
    const routes = readdirSync(join(import.meta.dirname, "..", "..", "..", "routes"));
    expect(routes.filter((name) => /reality/i.test(name))).toEqual([
      "careers.$occupationKey_.reality-check.tsx",
    ]);
  });

  it("offers the Reality Check only when injected coverage says it is available", () => {
    const overview = files.find((entry) => entry.file.endsWith("role-overview.tsx"));
    expect(overview?.text).toContain("Start Reality Check");
    /* Availability is the injected Increment 13 outcome, never re-derived here. */
    expect(overview?.text).toMatch(/const assessmentSupported = model\.assessment\.state ===/);
    expect(overview?.text).toMatch(/assessmentSupported \? \(/);
    expect(overview?.text).toMatch(/to="\/careers\/\$occupationKey\/reality-check"/);
  });

  it("keeps a real disabled control with no handler for unsupported careers", () => {
    const overview = files.find((entry) => entry.file.endsWith("role-overview.tsx"));
    expect(overview?.text).toMatch(/\n\s+disabled\n/);
    expect(overview?.text).not.toMatch(/disabled=\{/);
    expect(overview?.text).toMatch(/aria-disabled="true"/);
    expect(overview?.text).not.toMatch(/onClick|useNavigate|navigate\(/);
  });

  it("keeps the disabled call to action visually primary", () => {
    const overview = files.find((entry) => entry.file.endsWith("role-overview.tsx"));
    expect(overview?.text).toMatch(/bg-primary/);
    expect(overview?.text).toMatch(/text-primary-foreground/);
  });

  it("states the four-career scope of this build near the search", () => {
    const search = files.find((entry) => entry.file.endsWith("discovery-search.tsx"));
    expect(search?.text).toMatch(/four careers/);
  });

  it("claims no broad UK career catalogue in Increment 14 metadata or copy", () => {
    for (const entry of files) {
      expect(entry.text).not.toMatch(/Search a UK career/i);
      expect(entry.text).not.toMatch(/every UK career|all UK careers|thousands of careers/i);
    }
  });

  it("renders visible per-route source citations on the role page", () => {
    const overview = files.find((entry) => entry.file.endsWith("role-overview.tsx"));
    expect(overview?.text).toContain("RouteCitations");
    expect(overview?.text).toMatch(/checked \{/);
    expect(overview?.text).toMatch(/source\.url/);
  });
});
