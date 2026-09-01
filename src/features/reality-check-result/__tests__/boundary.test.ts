import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Increment 16 scope guard.
 *
 * The result experience REPORTS the closed Decision Engine's output. It must
 * contain no second decision authority, no persistence, no participant
 * identity, no postcode or local-reality work, no Compare Routes, no saved
 * progress and no AI. Engine execution is permitted in exactly one place: the
 * server-only evaluation boundary.
 */

const FEATURE_DIR = join(import.meta.dirname, "..");
const COPY_DIR = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "reality-check-result-copy",
);

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
    files.push({ file: full, text: stripComments(readFileSync(full, "utf8")) });
  }
}

const files: { file: string; text: string }[] = [];
collect(FEATURE_DIR, files);
collect(COPY_DIR, files);

const FORBIDDEN: readonly (readonly [string, RegExp])[] = [
  ["durable persistence", /localStorage|sessionStorage|indexedDB|document\.cookie/],
  ["database or auth access", /supabase|createClient|auth\.|user_id|requireSupabaseAuth/i],
  ["participant identity", /\bparticipantId\b|\bappUserId\b|\bemail\b/],
  ["AI or model inference", /openai|anthropic|gemini|LOVABLE_API_KEY|prompt\s*:/i],
  ["postcode or local reality", /postcode|latitude|longitude|postgis|travelTime|localReality/i],
  ["Compare Routes or saved progress", /compareRoutes|myRoute|savedProgress|decisionState/i],
  ["scores, percentages or probability", /probability|percentChance|matchScore|confidenceScore/i],
  ["independent judgement derivation", /deriveJudgement|computeJudgement|chooseJudgement/],
];

describe("Increment 16 — scope boundary", () => {
  it("finds source to inspect", () => {
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

  it("executes the Decision Engine only inside the server-only boundary", () => {
    const offenders = files
      .filter((entry) => /safeEvaluateRealityCheck/.test(entry.text))
      .map((entry) => entry.file)
      .filter((file) => !file.endsWith("evaluation.server.ts"));
    expect(offenders).toEqual([]);
  });

  it("reads reviewed evidence content only through the server-only module", () => {
    const offenders = files
      .filter((entry) => /architecture-tests\.server/.test(entry.text))
      .map((entry) => entry.file)
      .filter((file) => !file.endsWith("evaluation.server.ts"));
    expect(offenders).toEqual([]);
  });
});
