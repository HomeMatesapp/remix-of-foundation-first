import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  D8_ARTIFACT_KIND,
  D8_AUTHORED_MIGRATION_ORDINAL,
  D8_AUTHORED_MIGRATION_PATH,
  D8_DICTIONARY_IDENTITY_PROPERTY,
  D8_FINAL_BLOCKER,
  D8_NORMALISE_TITLE_STATUS,
  D8_OWNER_MECHANISM_APPROVAL,
  D8_R1_RECONCILIATION,
  D8_STILL_UNAUTHORISED_ENTITIES,
  D8_SUPERSEDED_WRAPPER_DESIGN,
  D8_UPSTREAM_VOLATILITY_EXPECTATION,
  D8_WRAPPER_CONTRACT,
  assessD8UnaccentWrapperProof,
} from "../d8-unaccent-wrapper-proof";
import { D7_BLOCKED_CHAIN } from "../d7-relational-authoring";

const REPO = process.cwd();
const AUTHORED_DIR = join(REPO, "supabase/authored-migrations");
const SUPERSEDED_DIR = join(AUTHORED_DIR, "superseded");
const APPLIED_DIR = join(REPO, "supabase/migrations");

const sql = readFileSync(join(REPO, D8_AUTHORED_MIGRATION_PATH), "utf8");
/** Executable statement text only: the header documents the blocker in prose. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const statementsLower = statements.toLowerCase();

describe("Stage D8 R1 reconciliation record", () => {
  it("identifies the false upstream-volatility claim and the circular proof", () => {
    expect(D8_R1_RECONCILIATION.severity).toBe("critical");
    expect(D8_R1_RECONCILIATION.inspectedCommit).toBe("349378b14ae7df1202f89d8e7bdf655ca8399d26");
    const codes = D8_R1_RECONCILIATION.findings.map((f) => f.code);
    expect(codes).toEqual([
      "D8_R1_FALSE_UPSTREAM_VOLATILITY",
      "D8_R1_CIRCULAR_GENERATED_COLUMN_PROOF",
      "D8_R1_DICTIONARY_CONTENT_STILL_MUTABLE",
    ]);
    expect(codes).toHaveLength(new Set(codes).size);
    for (const finding of D8_R1_RECONCILIATION.findings) {
      expect(finding.defect.length).toBeGreaterThan(40);
      expect(finding.correction.length).toBeGreaterThan(40);
    }
  });

  it("records STABLE as the exact official upstream expectation for both overloads", () => {
    expect(D8_UPSTREAM_VOLATILITY_EXPECTATION.source).toBe("contrib/unaccent/unaccent--1.1.sql");
    expect(D8_UPSTREAM_VOLATILITY_EXPECTATION.overloads).toEqual({
      "unaccent(regdictionary, text)": "STABLE",
      "unaccent(text)": "STABLE",
    });
    expect(Object.values(D8_UPSTREAM_VOLATILITY_EXPECTATION.overloads)).not.toContain("IMMUTABLE");
  });

  it("keeps dictionary identity as a useful property only, never as proof", () => {
    expect(D8_DICTIONARY_IDENTITY_PROPERTY.sufficientForImmutability).toBe(false);
    expect(D8_DICTIONARY_IDENTITY_PROPERTY.whyInsufficient).toMatch(/content|rules/i);
  });
});

describe("Stage D8 is BLOCKED and not proven", () => {
  it("reports an unproven, unauthored, unapplied wrapper", () => {
    const assessment = assessD8UnaccentWrapperProof();
    expect(assessment.wrapperDesignProven).toBe(false);
    expect(assessment.wrapperAuthored).toBe(false);
    expect(assessment.ownerConditionSatisfied).toBe(false);
    expect(assessment.hostedApplyAuthorised).toBe(false);
    expect(assessment.targetProjectVerified).toBe(false);
    expect(assessment.blockers.length).toBeGreaterThan(3);
    expect(assessment.blockers[0]).toBe(D8_FINAL_BLOCKER);
  });

  it("records the owner approval as conditional with the condition unmet", () => {
    expect(D8_OWNER_MECHANISM_APPROVAL.conditional).toBe(true);
    expect(D8_OWNER_MECHANISM_APPROVAL.conditionSatisfied).toBe(false);
    expect(D8_OWNER_MECHANISM_APPROVAL.hostedInstallAuthorised).toBe(false);
    expect(D8_OWNER_MECHANISM_APPROVAL.hostedApplyAuthorised).toBe(false);
  });

  it("marks the earlier wrapper design superseded and unaccepted", () => {
    expect(D8_SUPERSEDED_WRAPPER_DESIGN.status).toBe("superseded");
    expect(D8_SUPERSEDED_WRAPPER_DESIGN.accepted).toBe(false);
    expect(D8_SUPERSEDED_WRAPPER_DESIGN.declaredVolatilityJustified).toBe(false);
    expect(D8_SUPERSEDED_WRAPPER_DESIGN.rejectionReason).toMatch(/STABLE|circular/i);
  });

  it("selects no replacement accent-removal mechanism", () => {
    expect(D8_OWNER_MECHANISM_APPROVAL.rejectedAlternatives.length).toBeGreaterThan(0);
    for (const term of ["translate(", "to_ascii", "convert_to", "iconv"]) {
      expect(statementsLower).not.toContain(term);
    }
    expect(statementsLower).not.toMatch(/create\s+extension/);
  });
});

describe("Stage D8 artifact is a fail-closed blocker, not executable proof DDL", () => {
  it("is authored outside managed migrations and is not applied", () => {
    expect(D8_ARTIFACT_KIND).toBe("blocker");
    expect(D8_AUTHORED_MIGRATION_PATH.startsWith("supabase/authored-migrations/")).toBe(true);
    const fileName = D8_AUTHORED_MIGRATION_PATH.split("/").pop()!;
    expect(readdirSync(AUTHORED_DIR)).toContain(fileName);
    expect(readdirSync(APPLIED_DIR)).not.toContain(fileName);
    expect(sql).toContain("NOT APPLIED");
    expect(D8_AUTHORED_MIGRATION_ORDINAL).toBe(11);
  });

  it("raises unconditionally and creates nothing at all", () => {
    expect(statements).toContain("RAISE EXCEPTION 'MIGRATION BLOCKER");
    expect(statementsLower).not.toMatch(/create\s+(function|table|extension|policy|role|index)/);
    expect(statementsLower).not.toMatch(/alter\s+(table|role|database|system|text\s+search)/);
    expect(statementsLower).not.toMatch(/\bgrant\b|\brevoke\b|\binsert\b|\bupdate\b|\bdelete\b/);
    // the wrapper name appears only inside the refusal message, never as DDL
    expect(statementsLower).not.toMatch(/create\s+function/);
    expect(statementsLower).not.toContain("generated always as");
    expect(statementsLower).not.toContain("_d8_wrapper_scratch");
    // No IF NOT EXISTS / OR REPLACE adoption path anywhere.
    expect(statementsLower).not.toContain("if not exists");
    expect(statementsLower).not.toContain("or replace");
  });

  it("never claims the two-argument form is immutable upstream", () => {
    // the only mention of an upstream immutability claim is its refutation
    expect([...sql.matchAll(/IMMUTABLE upstream/g)]).toHaveLength(1);
    expect(sql).toMatch(/IMMUTABLE upstream\. It is not\./);
    expect(sql).toContain("STABLE STRICT PARALLEL SAFE");
    expect(sql).toMatch(/NOT PROVEN/);
    expect(sql).toMatch(/CIRCULAR PROOF LOGIC/);
  });

  it("never claims a generated-column scratch table proves semantic immutability", () => {
    expect([...sql.matchAll(/server-enforced evidence of immutability/g)]).toHaveLength(1);
    expect(sql).toMatch(/It is not\. The generated/);
  });

  it("preserves the original source as non-promotable historical evidence", () => {
    const historyName = D8_R1_RECONCILIATION.supersededSourcePath.split("/").pop()!;
    expect(historyName.endsWith(".sql.txt")).toBe(true);
    expect(readdirSync(SUPERSEDED_DIR)).toContain(historyName);
    const history = readFileSync(join(REPO, D8_R1_RECONCILIATION.supersededSourcePath), "utf8");
    expect(history).toContain("SUPERSEDED / HISTORICAL EVIDENCE ONLY");
    // history keeps the original DDL, which is exactly why it must not be .sql
    expect(history).toContain("CREATE FUNCTION public.clear_routes_unaccent(");
    expect(readdirSync(AUTHORED_DIR).filter((f) => f.endsWith(".sql"))).toHaveLength(3);
  });

  it("keeps managed migrations at exactly nine files with no accent extension", () => {
    const applied = readdirSync(APPLIED_DIR).filter((f) => f.endsWith(".sql"));
    expect(applied).toHaveLength(9);
    for (const file of applied) {
      expect(readFileSync(join(APPLIED_DIR, file), "utf8").toLowerCase()).not.toContain("unaccent");
    }
  });

  it("leaves the Stage D6 and D7 authored sources untouched as history", () => {
    expect(
      readFileSync(
        join(AUTHORED_DIR, "20260830220000_stage-d6-prerequisite-capabilities.sql"),
        "utf8",
      ),
    ).toContain("STAGE D6");
    expect(
      readFileSync(
        join(AUTHORED_DIR, "20260831210000_stage-d7-local-reality-relational-foundation.sql"),
        "utf8",
      ),
    ).toContain("STAGE D7");
  });

  it("carries no participant, postcode, location or unrelated scope", () => {
    const lower = sql.toLowerCase();
    for (const term of [
      "postcode",
      "participant location",
      "latitude",
      "longitude",
      "local_snapshot_item",
      "reality_check",
      "career_pack",
    ]) {
      expect(statementsLower).not.toContain(term);
      if (
        term !== "local_snapshot_item" &&
        term !== "postcode" &&
        term !== "participant location"
      ) {
        expect(lower).not.toContain(term);
      }
    }
  });
});

describe("Stage D8 leaves normalise_title and downstream schema unauthored", () => {
  it("does not implement normalise_title and holds no approved mechanism for it", () => {
    expect(D8_NORMALISE_TITLE_STATUS.implemented).toBe(false);
    expect(D8_NORMALISE_TITLE_STATUS.mechanismApproved).toBe(false);
    expect(D8_NORMALISE_TITLE_STATUS.wrapperProvenByAuthoredSource).toBe(false);
    expect(assessD8UnaccentWrapperProof().normaliseTitleImplemented).toBe(false);
    expect(statementsLower).not.toContain("create function public.normalise_title");
  });

  it("preserves the accepted operation order with no morphology", () => {
    expect(D8_NORMALISE_TITLE_STATUS.acceptedOperationOrder).toEqual([
      "lowercase",
      "remove punctuation",
      "remove diacritics",
      "collapse whitespace",
    ]);
    expect(D8_NORMALISE_TITLE_STATUS.morphologyPermitted).toBe(false);
    expect(D8_WRAPPER_CONTRACT.authored).toBe(false);
    expect(D8_WRAPPER_CONTRACT.performs).toHaveLength(1);
    expect(D8_WRAPPER_CONTRACT.mustNotPerform).toContain("case folding");
  });

  it("authors no occupation or downstream entity", () => {
    for (const entity of ["occupation", "programme", "opportunity", "local_snapshot_item"]) {
      expect(statementsLower).not.toContain(`create table public.${entity}`);
    }
    expect(D8_STILL_UNAUTHORISED_ENTITIES).toEqual([...D7_BLOCKED_CHAIN]);
    expect(assessD8UnaccentWrapperProof().downstreamAuthored).toBe(false);
  });
});
