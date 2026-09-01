import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Increment 15 scope guard.
 *
 * The participant Reality Check experience owns ANSWER COLLECTION AND
 * CONFIRMATION only. This test proves the runtime source contains no Decision
 * Engine execution, no protected judgement value, no Evidence Context creation,
 * no Increment 16 result surface, no database/auth/network/AI access, no
 * durable persistence and no participant identity.
 *
 * `sessionStorage` is explicitly allowed.
 */

const FEATURE_DIR = join(import.meta.dirname, "..");
const CONTENT_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "reality-check-question-copy",
);
const ROUTES_DIR = join(import.meta.dirname, "..", "..", "..", "routes");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

const files: { file: string; text: string }[] = [];
collect(FEATURE_DIR, files);
collect(CONTENT_DIR, files);
for (const name of readdirSync(ROUTES_DIR)) {
  if (!/reality/i.test(name)) continue;
  files.push({
    file: name,
    text: stripComments(readFileSync(join(ROUTES_DIR, name), "utf8")),
  });
}

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ["Decision Engine execution", /safeEvaluateRealityCheck|evaluateRealityCheck|decision-engine/],
  [
    "protected judgement value",
    /realistic_now|realistic_with_conditions|not_realistic_yet|more_information_needed/,
  ],
  ["Evidence Context creation", /evidenceContext|EvidenceContext|createEvidence/i],
  ["route outcome authority", /routeOutcome|routeAvailab|recommendedRoute|rankedRoute/i],
  /*
   * R2.1: the canonical question-module code `postcode_geography` may be named
   * in the exhaustive start-screen mapping, because naming a governed module
   * code is not collecting a postcode. Actual postcode collection and
   * geographic coordinates remain forbidden everywhere in this scan.
   *
   * Increment 17 Stage C integration: the SHARED career route may compose the
   * separately owned Local Reality section by component name only, after the
   * closed Increment 16 result. The Increment 15 questionnaire feature itself
   * still may not contain any Local Reality implementation (see
   * FEATURE_ONLY_FORBIDDEN below).
   */
  ["local reality / geography", /postcode(?!_geography\b)|postgis|latitude|longitude/i],

  ["provider / vacancy data", /\bvacanc|providerAcceptance|providerLookup/i],
  ["compare routes / decision / progress", /compareRoutes|decisionState|progressReport|dashboard/i],
  ["database / persistence", /supabase|createClient|\bSELECT \b|INSERT INTO|row level security/i],
  ["auth / identity", /auth\.uid|requireSupabaseAuth|appUserId|institutionId|participantId/],
  ["network", /\bfetch\(|XMLHttpRequest|axios|createServerFn/],
  ["AI interpretation", /\bprompt(?!s?\b)|openai|gemini|\bllm\b|embedding|\bmodel\b/i],
  ["durable client persistence", /localStorage|indexedDB|document\.cookie/],
  ["invented scoring", /\bscore\b|\bweight\b|\bconfidence\b|\bthreshold\b/i],
  ["Increment 16 result surface", /resultRoute|RealityCheckResult|verdict/i],
];

/**
 * Forbidden in the Increment 15 questionnaire feature and its content, but NOT
 * in the shared career route, which legitimately composes the separately owned
 * Increment 17 Stage C Local Reality section after the closed result.
 */
const FEATURE_ONLY_FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ["Local Reality implementation", /localReality|local-reality/i],
];

const SHARED_ROUTE = /reality-check\.tsx$/;

describe("increment 15 scope", () => {
  it("scans the whole feature, its content and its route", () => {
    expect(files.length).toBeGreaterThan(8);
    expect(files.some((entry) => SHARED_ROUTE.test(entry.file))).toBe(true);
  });

  it("contains no out-of-scope concept", () => {
    for (const { file, text } of files) {
      for (const [label, pattern] of FORBIDDEN) {
        expect(pattern.test(text), `${file} must not contain ${label}`).toBe(false);
      }
      if (SHARED_ROUTE.test(file)) continue;
      for (const [label, pattern] of FEATURE_ONLY_FORBIDDEN) {
        expect(pattern.test(text), `${file} must not contain ${label}`).toBe(false);
      }
    }
  });

  it("uses sessionStorage only for draft persistence", () => {
    const draft = files.find((entry) => entry.file === "draft.ts");
    expect(draft?.text).toContain("sessionStorage");
    for (const { file, text } of files) {
      expect(text, file).not.toContain("localStorage");
    }
  });

  it("reuses the single existing coverage server boundary", () => {
    const route = files.find((entry) => /reality-check\.tsx$/.test(entry.file));
    expect(route?.text).toContain("getRealityCheckPackBinding");
    /* No second hashing, search or decision authority is created here. */
    for (const { file, text } of files) {
      expect(text, file).not.toMatch(/createHash|node:crypto|sha256/i);
    }
  });

  it("keys the flow on exact occupation plus pack content hash", () => {
    /*
     * State isolation: a change of exact questionnaire identity must mount a
     * FRESH controller, so no answer, stage or confirmation can cross packs.
     */
    const route = files.find((entry) => /reality-check\.tsx$/.test(entry.file));
    expect(route?.text).toMatch(
      /key=\{`\$\{bound\.occupationKey\}:\$\{bound\.pack\.contentHash\}`\}/,
    );
    /* The pack document is server-established, never reselected client-side. */
    expect(route?.text).toContain("pack={bound.document}");
    expect(route?.text).not.toContain("ARCHITECTURE_TEST_PACKS");
    for (const { file, text } of files) {
      expect(text, file).not.toMatch(/bindQuestionnairePack/);
    }
  });

  it("does not create an Increment 16 result route", () => {
    const routes = readdirSync(ROUTES_DIR);
    expect(routes.filter((name) => /result|verdict|judgement/i.test(name))).toEqual([]);
  });

  it("reuses the closed Increment 4 dependency evaluator", () => {
    const flow = files.find((entry) => entry.file === "flow.ts");
    expect(flow?.text).toContain("isQuestionAsked");
    /* No second dependency evaluator: no local operator switch over rules. */
    for (const { file, text } of files) {
      expect(text, file).not.toMatch(/evaluateDependencyRule|case "greater_than"/);
    }
  });
});
