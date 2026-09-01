import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { D3_PREFLIGHT_CAPABILITY_KEYS } from "../d3-readiness";
import { assessD4SchemaAuthoringReadiness } from "../d4-readiness";
import { D5_INSPECTED_MIGRATION_PATHS, D5_PREFLIGHT_EVIDENCE } from "../d5-preflight-evidence";
import {
  D6_AUTHORED_MIGRATION_PATH,
  assessD6PrerequisiteAuthoring,
  toD4PreflightCapabilityInputFromD6,
} from "../d6-prerequisite-authoring";
import {
  D6_APPLIED_MIGRATION_COUNT,
  D6_APPLIED_MIGRATION_PATH,
  D6_HOSTED_MIGRATION_VERSION,
  D6_PRIOR_APPLIED_MIGRATION_COUNT,
  D6_TARGET_VERIFICATION,
  D6_TARGET_VERIFICATION_STATUSES,
  assessD6TargetVerification,
  toD4PreflightCapabilityInputFromD6Verification,
  type D6TargetVerification,
} from "../d6-target-verification";

const REPO = process.cwd();
const APPLIED_DIR = join(REPO, "supabase/migrations");

const recordFor = (key: string): D6TargetVerification => {
  const found = D6_TARGET_VERIFICATION.find((entry) => entry.capabilityKey === key);
  if (!found) throw new Error(`missing Stage D6 verification fixture: ${key}`);
  return found;
};

describe("Stage D6 hosted apply inventory", () => {
  it("adds exactly one managed migration and keeps the eight prior ones intact", () => {
    const applied = readdirSync(APPLIED_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(applied).toHaveLength(D6_APPLIED_MIGRATION_COUNT);
    expect(D6_APPLIED_MIGRATION_COUNT).toBe(D6_PRIOR_APPLIED_MIGRATION_COUNT + 1);

    // the eight Stage D5 evidence migrations are still present, byte for byte
    expect(D5_INSPECTED_MIGRATION_PATHS).toHaveLength(D6_PRIOR_APPLIED_MIGRATION_COUNT);
    for (const path of D5_INSPECTED_MIGRATION_PATHS) {
      expect(applied).toContain(path.split("/").at(-1));
      expect(readFileSync(join(REPO, path), "utf8").length).toBeGreaterThan(0);
    }

    // the ninth applied migration is the D6 prerequisite migration
    expect(applied.at(-1)).toBe(D6_APPLIED_MIGRATION_PATH.split("/").at(-1));
    expect(D6_APPLIED_MIGRATION_PATH).toContain(D6_HOSTED_MIGRATION_VERSION);
  });

  it("applied exactly the authored D6 source, unmodified", () => {
    const authored = readFileSync(join(REPO, D6_AUTHORED_MIGRATION_PATH), "utf8").trimEnd();
    const applied = readFileSync(join(REPO, D6_APPLIED_MIGRATION_PATH), "utf8").trimEnd();
    expect(applied).toBe(authored);
  });

  it("created no Local Reality relational table and no postcode storage", () => {
    const applied = readFileSync(join(REPO, D6_APPLIED_MIGRATION_PATH), "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .toLowerCase();
    for (const table of [
      "source",
      "occupation",
      "provider",
      "programme",
      "opportunity",
      "local_snapshot",
      "local_snapshot_item",
      "import_batch",
    ]) {
      expect(applied).not.toContain(`create table public.${table} `);
      expect(applied).not.toContain(`create table if not exists public.${table}`);
    }
    expect(applied).not.toContain("postcode");
    expect(applied).not.toContain("unaccent");
    expect(applied).not.toContain("normalise_title");
  });
});

describe("Stage D6 target-verification record", () => {
  it("is deeply frozen and deterministic", () => {
    expect(Object.isFrozen(D6_TARGET_VERIFICATION)).toBe(true);
    for (const record of D6_TARGET_VERIFICATION) {
      expect(Object.isFrozen(record)).toBe(true);
      expect(Object.isFrozen(record.observedEvidence)).toBe(true);
    }
    expect(assessD6TargetVerification()).toEqual(assessD6TargetVerification());
    expect(Object.isFrozen(assessD6TargetVerification())).toBe(true);
  });

  it("covers exactly the three prerequisite keys, each target verified with evidence", () => {
    expect(D6_TARGET_VERIFICATION.map((r) => r.capabilityKey)).toEqual([
      ...D3_PREFLIGHT_CAPABILITY_KEYS,
    ]);
    expect(D6_TARGET_VERIFICATION_STATUSES).toEqual(["target_verified", "not_target_verified"]);
    for (const record of D6_TARGET_VERIFICATION) {
      expect(record.status).toBe("target_verified");
      expect(record.observedEvidence.length).toBeGreaterThan(0);
    }
    const result = assessD6TargetVerification();
    expect(result.hostedApplySucceeded).toBe(true);
    expect(result.targetProjectVerified).toBe(true);
    expect(result.targetVerifiedCapabilityKeys).toEqual([...D3_PREFLIGHT_CAPABILITY_KEYS]);
    expect(result.d4PreflightSatisfied).toBe(true);
  });

  it("authorises no relational schema work", () => {
    const result = assessD6TargetVerification();
    expect(result.relationalSchemaAuthorised).toBe(false);
    expect(result.noRelationalSchemaNote).toMatch(/no source, occupation, provider/);
    expect(result.nextSequence.join(" ")).toMatch(/inspection/i);
    expect(result.authorisationNote).toMatch(/neither authored nor applied/);
  });

  it("fails closed on unknown, duplicate, missing or unevidenced records", () => {
    const citext = recordFor("citext");
    expect(() =>
      assessD6TargetVerification([
        { ...citext, capabilityKey: "geohashing" as never },
        recordFor("pg_trgm"),
        recordFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/unknown Stage D6 capability key/);
    expect(() =>
      assessD6TargetVerification([citext, citext, recordFor("immutable_history_enforcement")]),
    ).toThrow(/duplicate Stage D6 capability key/);
    expect(() => assessD6TargetVerification([citext])).toThrow(
      /missing Stage D6 verification record/,
    );
    expect(() =>
      assessD6TargetVerification([
        { ...citext, status: "applied" as never },
        recordFor("pg_trgm"),
        recordFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/unknown Stage D6 verification status/);
    expect(() =>
      assessD6TargetVerification([
        { ...citext, observedEvidence: Object.freeze([]) },
        recordFor("pg_trgm"),
        recordFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/requires observed evidence/);
  });

  it("bridges only target verification into Stage D4 readiness", () => {
    // authoring alone still contributes nothing
    expect(toD4PreflightCapabilityInputFromD6()).toEqual({
      citextVerified: false,
      pgTrgmVerified: false,
      immutableHistoryEnforcementVerified: false,
    });
    expect(assessD6PrerequisiteAuthoring().targetProjectVerified).toBe(false);

    const input = toD4PreflightCapabilityInputFromD6Verification();
    expect(input).toEqual({
      citextVerified: true,
      pgTrgmVerified: true,
      immutableHistoryEnforcementVerified: true,
    });
    const d4 = assessD4SchemaAuthoringReadiness(input);
    expect(d4.unverifiedPreflightCapabilities).toEqual([]);
    expect(d4.schemaAuthoringReady).toBe(true);

    // a single unverified capability collapses readiness again
    const partial = toD4PreflightCapabilityInputFromD6Verification([
      { ...recordFor("citext"), status: "not_target_verified" },
      recordFor("pg_trgm"),
      recordFor("immutable_history_enforcement"),
    ]);
    expect(assessD4SchemaAuthoringReadiness(partial).schemaAuthoringReady).toBe(false);
  });

  it("does not rewrite Stage D5 historical repository evidence", () => {
    expect(D5_INSPECTED_MIGRATION_PATHS).toHaveLength(8);
    for (const evidence of D5_PREFLIGHT_EVIDENCE) {
      expect(evidence.status).toBe("not_established_in_repository");
      expect(evidence.verified).toBe(false);
    }
  });
});
