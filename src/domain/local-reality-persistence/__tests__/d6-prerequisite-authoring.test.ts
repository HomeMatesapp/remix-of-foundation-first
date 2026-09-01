import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { D3_PREFLIGHT_CAPABILITY_KEYS } from "../d3-readiness";
import { D3_DEFINITION_FINDINGS } from "../definition-findings";
import {
  D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS,
  NORMALISE_TITLE_OPERATIONS,
} from "../d4-decisions";
import { assessD4SchemaAuthoringReadiness } from "../d4-readiness";
import {
  D5_INSPECTED_MIGRATION_PATHS,
  D5_PREFLIGHT_EVIDENCE,
  assessD5RepositoryPreflights,
} from "../d5-preflight-evidence";
import {
  D6_AUTHORED_MIGRATION_ORDINAL,
  D6_AUTHORED_MIGRATION_PATH,
  D6_AUTHORING_STATUSES,
  D6_NORMALISE_TITLE_OBLIGATION,
  D6_PREREQUISITE_AUTHORING,
  assessD6PrerequisiteAuthoring,
  toD4PreflightCapabilityInputFromD6,
  type D6PrerequisiteAuthoring,
} from "../d6-prerequisite-authoring";

const REPO = process.cwd();
const AUTHORED_DIR = join(REPO, "supabase/authored-migrations");
const APPLIED_DIR = join(REPO, "supabase/migrations");

const migrationSql = readFileSync(join(REPO, D6_AUTHORED_MIGRATION_PATH), "utf8");
const sqlLower = migrationSql.toLowerCase();
/**
 * Executable statements only. The file header documents what is deliberately
 * OUT of scope (postcodes, normalisation, spatial work), so exclusion checks run
 * against the statement text rather than the scope commentary.
 */
const statementsLower = migrationSql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .toLowerCase();

const recordFor = (key: string): D6PrerequisiteAuthoring => {
  const found = D6_PREREQUISITE_AUTHORING.find((entry) => entry.capabilityKey === key);
  if (!found) throw new Error(`missing Stage D6 authoring fixture: ${key}`);
  return found;
};

describe("Stage D6 authored prerequisite migration source", () => {
  it("authors exactly one D6 migration, positioned ninth in repository order", () => {
    const authored = readdirSync(AUTHORED_DIR).filter((f) => f.endsWith(".sql"));
    // Exactly one D6 prerequisite source exists; later stages add their own
    // authored sources alongside it without altering this historical record.
    const d6Authored = authored.filter((file) => file.includes("stage-d6"));
    expect(d6Authored).toHaveLength(1);
    expect(D6_AUTHORED_MIGRATION_PATH.endsWith(d6Authored[0]!)).toBe(true);

    // The eight migrations of the D5 evidence snapshot remain, and the ninth
    // applied migration is this authored D6 source (applied at the owner gate).
    const applied = readdirSync(APPLIED_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(applied).toHaveLength(9);
    expect(D6_AUTHORED_MIGRATION_ORDINAL).toBe(9);

    // The authored file sorts after every previously applied migration.
    const priorApplied = applied.slice(0, 8);
    expect(authored[0]! > priorApplied.at(-1)!).toBe(true);
  });

  it("covers exactly the three required prerequisite keys", () => {
    expect(D6_PREREQUISITE_AUTHORING.map((r) => r.capabilityKey)).toEqual([
      "citext",
      "pg_trgm",
      "immutable_history_enforcement",
    ]);
    expect(D6_PREREQUISITE_AUTHORING.map((r) => r.capabilityKey)).toEqual([
      ...D3_PREFLIGHT_CAPABILITY_KEYS,
    ]);
    expect(D6_AUTHORING_STATUSES).toEqual(["authored_not_applied", "not_authored"]);
  });

  it("checks availability and carries exact blocker wording for both extensions", () => {
    expect(sqlLower).toContain("pg_available_extensions where name = 'citext'");
    expect(sqlLower).toContain("pg_available_extensions where name = 'pg_trgm'");
    expect(migrationSql).toContain("MIGRATION BLOCKER: citext unavailable in target project");
    expect(migrationSql).toContain("MIGRATION BLOCKER: pg_trgm unavailable in target project");
  });

  it("establishes both extensions in the extensions schema and fails closed elsewhere", () => {
    expect(migrationSql).toContain("CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions");
    expect(migrationSql).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions");
    // Two independent unexpected-schema guards, one per extension.
    expect(migrationSql.match(/v_schema <> 'extensions'/g)).toHaveLength(2);
    // No application-role search_path broadening anywhere.
    expect(sqlLower).not.toMatch(/alter\s+role/);
    expect(sqlLower).not.toMatch(/alter\s+database/);
    expect(sqlLower).not.toMatch(/set\s+search_path\s*=\s*[^;\n]*extensions/);
  });

  it("verifies citext through schema-qualified use and never claims accent removal", () => {
    expect(migrationSql).toContain("extensions.citext");
    expect(migrationSql).toContain("::extensions.citext");
    expect(sqlLower).toContain("case-insensitive");
    expect(sqlLower).not.toMatch(/accent-insensitiv(e|ity) (is |)(provided|supported|established)/);
    expect(sqlLower).toContain("no accent-insensitivity claimed");
  });

  it("verifies trigram functionality and index capability concretely", () => {
    expect(migrationSql).toContain("extensions.similarity(");
    expect(migrationSql).toContain("gin_trgm_ops");
    expect(migrationSql).toContain("USING GIN (v extensions.gin_trgm_ops)");
    expect(migrationSql).toContain(
      "MIGRATION BLOCKER: pg_trgm unavailable in target project (trigram index creation verification failed)",
    );
  });

  it("adds a guard that rejects every update and every delete", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.forbid_mutation()");
    expect(migrationSql).toContain("BEFORE UPDATE ON public._d6_immutable_gate");
    expect(migrationSql).toContain("BEFORE DELETE ON public._d6_immutable_gate");
    // No selected-column semantics and no successful mutation return path.
    const body = migrationSql.slice(
      migrationSql.indexOf("CREATE OR REPLACE FUNCTION public.forbid_mutation()"),
      migrationSql.indexOf("$forbid$;"),
    );
    expect(body).toContain("RAISE EXCEPTION");
    expect(body).not.toContain("TG_ARGV");
    expect(body).not.toMatch(/RETURN\s+(NEW|OLD)/);
  });

  it("leaves the pre-existing selected-column helper untouched", () => {
    expect(migrationSql).not.toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_immutable_columns",
    );
    expect(migrationSql).not.toMatch(/DROP\s+FUNCTION[^;]*enforce_immutable_columns/i);
    expect(migrationSql).not.toMatch(/ALTER\s+FUNCTION[^;]*enforce_immutable_columns/i);
    // and the helper's own migration is unchanged: still the only definition.
    const defs = readdirSync(APPLIED_DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(APPLIED_DIR, f), "utf8"))
      .join("\n")
      .match(/CREATE OR REPLACE FUNCTION public\.enforce_immutable_columns/g);
    expect(defs).toHaveLength(1);
  });

  it("self-verifies insert success, mutation rejection and scratch cleanup", () => {
    expect(migrationSql).toContain(
      "INSERT INTO public._d6_immutable_gate (id, v) VALUES (1, 'original')",
    );
    expect(migrationSql).toContain("v_update_rejected := true");
    expect(migrationSql).toContain("v_delete_rejected := true");
    expect(migrationSql).toContain(
      "MIGRATION BLOCKER: immutable history enforcement verification failed",
    );
    expect(migrationSql).toContain("DROP TABLE public._d6_immutable_gate");
    expect(migrationSql).toContain("DROP TABLE _d6_citext_gate");
    expect(migrationSql).toContain("DROP TABLE _d6_trgm_gate");
  });

  it("counts a mutation rejection only when the authored guard proves it", () => {
    // R1: a generic `WHEN others THEN <flag> := true` would false-pass whenever the
    // DML failed for an unrelated reason. The scratch verification must correlate
    // the exact guard SQLSTATE with a guard message naming the scratch table and
    // the specific operation.
    expect(migrationSql).toContain("USING ERRCODE = '0A000'");
    expect(migrationSql).toContain("EXCEPTION WHEN feature_not_supported THEN");
    expect(migrationSql).toContain(
      "GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT",
    );

    for (const [flag, operation] of [
      ["v_update_rejected", "UPDATE"],
      ["v_delete_rejected", "DELETE"],
    ] as const) {
      const guarded = new RegExp(
        String.raw`IF v_state = '0A000'\s*` +
          String.raw`AND v_message LIKE '%_d6_immutable_gate is an immutable historical table%'\s*` +
          String.raw`AND v_message LIKE '%${operation} is not permitted%' THEN\s*` +
          String.raw`${flag} := true;`,
      );
      expect(migrationSql).toMatch(guarded);
      // and an unrelated exception must abort rather than set the flag.
      expect(migrationSql).toContain(
        `MIGRATION BLOCKER: immutable history enforcement verification failed (${operation} rejected by an unrelated error`,
      );
    }

    // no generic catch-all may set either rejection flag
    expect(migrationSql).not.toMatch(
      /EXCEPTION\s+WHEN\s+others\s+THEN\s*\n?\s*v_(update|delete)_rejected\s*:=\s*true/i,
    );
    expect(migrationSql).not.toContain("WHEN others THEN");
  });

  it("authors no Local Reality relational table and no participant location data", () => {
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
      expect(statementsLower).not.toContain(`create table public.${table} `);
      expect(statementsLower).not.toContain(`create table if not exists public.${table}`);
    }
    expect(statementsLower).not.toContain("postcode");
    expect(statementsLower).not.toContain("latitude");
    expect(statementsLower).not.toContain("longitude");
  });

  it("selects no diacritic-removal mechanism and implements no title normalisation", () => {
    expect(statementsLower).not.toContain("unaccent");
    expect(statementsLower).not.toContain("normalise_title");
    expect(statementsLower).not.toContain("normalize_title");
    expect(D6_NORMALISE_TITLE_OBLIGATION.mechanismSelected).toBe(false);
    expect(D6_NORMALISE_TITLE_OBLIGATION.implemented).toBe(false);
    // The accepted operation set itself is unchanged.
    expect(NORMALISE_TITLE_OPERATIONS.length).toBeGreaterThan(0);
  });

  it("touches neither the spatial foundation nor any hosted apply mechanism", () => {
    expect(statementsLower).not.toContain("postgis");
    expect(statementsLower).not.toMatch(/\bst_[a-z]/);
    expect(statementsLower).not.toContain("http");
    expect(statementsLower).not.toContain("geography");
  });
});

describe("Stage D6 authoring manifest", () => {
  it("is deeply frozen and deterministic", () => {
    expect(Object.isFrozen(D6_PREREQUISITE_AUTHORING)).toBe(true);
    for (const record of D6_PREREQUISITE_AUTHORING) {
      expect(Object.isFrozen(record)).toBe(true);
      expect(Object.isFrozen(record.authoredIntent)).toBe(true);
      expect(Object.isFrozen(record.failClosedBehaviour)).toBe(true);
    }
    expect(assessD6PrerequisiteAuthoring()).toEqual(assessD6PrerequisiteAuthoring());
    expect(Object.isFrozen(assessD6PrerequisiteAuthoring())).toBe(true);
  });

  it("records authored-not-applied with no target verification and no authorisation", () => {
    const result = assessD6PrerequisiteAuthoring();
    expect(result.authoredMigrationPaths).toEqual([D6_AUTHORED_MIGRATION_PATH]);
    expect(result.repositoryMigrationAuthored).toBe(true);
    expect(result.targetProjectVerified).toBe(false);
    expect(result.targetVerifiedCapabilityKeys).toEqual([]);
    expect(result.d4SchemaAuthoringReady).toBe(false);
    expect(result.hostedApplyAuthorised).toBe(false);
    expect(result.authoredCapabilityKeys).toEqual([...D3_PREFLIGHT_CAPABILITY_KEYS]);
    for (const record of D6_PREREQUISITE_AUTHORING) {
      expect(record.authoringStatus).toBe("authored_not_applied");
      expect(record.targetProjectVerified).toBe(false);
    }
    expect(result.nextSequence.join(" ")).toMatch(/inspection/i);
    expect(result.nextSequence.join(" ")).toMatch(/owner/i);
  });

  it("fails closed on unknown, duplicate, missing or over-claiming records", () => {
    const citext = recordFor("citext");
    expect(() =>
      assessD6PrerequisiteAuthoring([
        { ...citext, capabilityKey: "geohashing" as never },
        recordFor("pg_trgm"),
        recordFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/unknown Stage D6 capability key/);
    expect(() =>
      assessD6PrerequisiteAuthoring([citext, citext, recordFor("immutable_history_enforcement")]),
    ).toThrow(/duplicate Stage D6 capability key/);
    expect(() => assessD6PrerequisiteAuthoring([citext])).toThrow(
      /missing Stage D6 authoring record/,
    );
    expect(() =>
      assessD6PrerequisiteAuthoring([
        { ...citext, targetProjectVerified: true },
        recordFor("pg_trgm"),
        recordFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/authoring is not verification/);
    expect(() =>
      assessD6PrerequisiteAuthoring([
        { ...citext, authoringStatus: "applied" as never },
        recordFor("pg_trgm"),
        recordFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/unknown Stage D6 authoring status/);
  });

  it("never bridges authoring into Stage D4 readiness", () => {
    const input = toD4PreflightCapabilityInputFromD6();
    expect(input).toEqual({
      citextVerified: false,
      pgTrgmVerified: false,
      immutableHistoryEnforcementVerified: false,
    });
    expect(assessD4SchemaAuthoringReadiness(input).schemaAuthoringReady).toBe(false);
  });

  it("leaves Stage D4 and Stage D5 historical semantics unchanged", () => {
    // D5 remains the frozen eight-migration evidence snapshot at its closure.
    expect(D5_INSPECTED_MIGRATION_PATHS).toHaveLength(8);
    for (const evidence of D5_PREFLIGHT_EVIDENCE) {
      expect(evidence.status).toBe("not_established_in_repository");
      expect(evidence.verified).toBe(false);
    }
    const d5 = assessD5RepositoryPreflights();
    expect(d5.repositoryPreflightComplete).toBe(true);
    expect(d5.prerequisiteAuthoringRequired).toBe(true);
    expect(d5.localSchemaAuthoringReady).toBe(false);
    expect(d5.hostedApplyAuthorised).toBe(false);
    expect(d5.inspectedMigrationPaths).toEqual(D5_INSPECTED_MIGRATION_PATHS);

    // D3 findings history and current D4 findings are untouched.
    expect(D3_DEFINITION_FINDINGS).toHaveLength(3);
    expect(D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS).toHaveLength(0);
  });
});
