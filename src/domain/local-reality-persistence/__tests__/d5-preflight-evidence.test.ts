import { describe, expect, it } from "vitest";

import { D3_PREFLIGHT_CAPABILITY_KEYS, assessD3SchemaAuthoringReadiness } from "../d3-readiness";
import { D3_DEFINITION_FINDINGS } from "../definition-findings";
import {
  D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS,
  NORMALISE_TITLE_OPERATIONS,
  OCCUPATION_STATUS_DEFAULT_MEMBER,
  OCCUPATION_STATUS_MEMBERS,
} from "../d4-decisions";
import { assessD4SchemaAuthoringReadiness } from "../d4-readiness";
import {
  D5_ESTABLISHED_FOUNDATION_EVIDENCE,
  D5_EVIDENCE_STATUSES,
  D5_EVIDENCE_STRENGTHS,
  D5_INSPECTED_MIGRATION_PATHS,
  D5_NEXT_SEQUENCE,
  D5_PREFLIGHT_EVIDENCE,
  LOCAL_REALITY_D5_EVIDENCE_DATE,
  LOCAL_REALITY_D5_EVIDENCE_SOURCE_SCOPE,
  assessD5RepositoryPreflights,
  toD4PreflightCapabilityInput,
  type D5PreflightEvidence,
} from "../d5-preflight-evidence";

const evidenceFor = (key: string): D5PreflightEvidence => {
  const found = D5_PREFLIGHT_EVIDENCE.find((entry) => entry.capabilityKey === key);
  if (!found) throw new Error(`missing evidence fixture: ${key}`);
  return found;
};

describe("Stage D5 preflight capability evidence", () => {
  it("records exactly the three required capability keys and no fourth", () => {
    expect(D5_PREFLIGHT_EVIDENCE.map((e) => e.capabilityKey)).toEqual([
      "citext",
      "pg_trgm",
      "immutable_history_enforcement",
    ]);
    expect(D5_PREFLIGHT_EVIDENCE.map((e) => e.capabilityKey)).toEqual([
      ...D3_PREFLIGHT_CAPABILITY_KEYS,
    ]);
  });

  it("reports every capability unverified under current repository evidence", () => {
    for (const entry of D5_PREFLIGHT_EVIDENCE) expect(entry.verified).toBe(false);
    const result = assessD5RepositoryPreflights();
    expect(result.verifiedCapabilityKeys).toEqual([]);
    expect(result.unverifiedCapabilityKeys).toEqual([...D3_PREFLIGHT_CAPABILITY_KEYS]);
  });

  it("scopes citext and pg_trgm to repository history and never claims installation", () => {
    for (const key of ["citext", "pg_trgm"]) {
      const entry = evidenceFor(key);
      expect(entry.status).toBe("not_established_in_repository");
      const text = JSON.stringify(entry).toLowerCase();
      expect(text).not.toMatch(/installed|\blive\b|available|present in the database/);
      expect(entry.scopeNote).toContain("Not established by current repository migration history");
      expect(entry.scopeNote).toContain("later target-project verification");
      expect(entry.observations.join(" ")).toContain("eight committed migration files");
    }
  });

  it("uses a closed capability-status vocabulary with no live, installed or partial member", () => {
    expect([...D5_EVIDENCE_STATUSES]).toEqual([
      "verified_by_repository",
      "not_established_in_repository",
    ]);
    expect([...D5_EVIDENCE_STRENGTHS]).toEqual(["none", "partial_insufficient"]);
  });

  it("classifies all three overall capability statuses as not established in repository", () => {
    expect(D5_PREFLIGHT_EVIDENCE.map((e) => e.status)).toEqual([
      "not_established_in_repository",
      "not_established_in_repository",
      "not_established_in_repository",
    ]);
    for (const entry of D5_PREFLIGHT_EVIDENCE) expect(entry.verified).toBe(false);
  });

  it("records no partial helper evidence for citext or pg_trgm", () => {
    for (const key of ["citext", "pg_trgm"]) {
      const entry = evidenceFor(key);
      expect(entry.evidenceStrength).toBe("none");
      expect(JSON.stringify(entry)).not.toContain("enforce_immutable_columns");
    }
  });

  it("never lets partial evidence produce verification or a true D4 capability input", () => {
    const promoted = [
      evidenceFor("citext"),
      evidenceFor("pg_trgm"),
      {
        ...evidenceFor("immutable_history_enforcement"),
        evidenceStrength: "partial_insufficient" as const,
      },
    ];
    const result = assessD5RepositoryPreflights(promoted);
    expect(result.verifiedCapabilityKeys).toEqual([]);
    expect(toD4PreflightCapabilityInput(promoted)).toEqual({
      citextVerified: false,
      pgTrgmVerified: false,
      immutableHistoryEnforcementVerified: false,
    });
    expect(() =>
      assessD5RepositoryPreflights([
        { ...evidenceFor("citext"), evidenceStrength: "strong" as never },
        evidenceFor("pg_trgm"),
        evidenceFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/Unknown Stage D5 evidence strength/);
  });

  it("freezes the exact inspected migration inventory of eight files", () => {
    expect(D5_INSPECTED_MIGRATION_PATHS).toHaveLength(8);
    expect(Object.isFrozen(D5_INSPECTED_MIGRATION_PATHS)).toBe(true);
    expect(D5_INSPECTED_MIGRATION_PATHS[0]).toContain(
      "20260824234007_4b897f34-6a28-4311-b2ce-e30374969b29.sql",
    );
    expect(D5_INSPECTED_MIGRATION_PATHS[7]).toContain(
      "20260825175811_5ece808c-abfe-4434-8f57-e183af642eab.sql",
    );
    expect(new Set(D5_INSPECTED_MIGRATION_PATHS).size).toBe(8);
  });

  it("fails closed on unknown, duplicate, missing or over-claiming evidence", () => {
    const base = [...D5_PREFLIGHT_EVIDENCE];
    expect(() =>
      assessD5RepositoryPreflights([
        ...base,
        { ...evidenceFor("citext"), capabilityKey: "unaccent" as never },
      ]),
    ).toThrow(/Unknown Stage D5 preflight capability key/);
    expect(() => assessD5RepositoryPreflights([...base, evidenceFor("citext")])).toThrow(
      /Duplicate Stage D5 preflight evidence/,
    );
    expect(() => assessD5RepositoryPreflights(base.slice(1))).toThrow(
      /Missing Stage D5 preflight evidence/,
    );
    expect(() =>
      assessD5RepositoryPreflights([
        { ...evidenceFor("citext"), verified: true },
        evidenceFor("pg_trgm"),
        evidenceFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/claims verification without repository proof/);
    expect(() =>
      assessD5RepositoryPreflights([
        { ...evidenceFor("citext"), status: "installed" as never },
        evidenceFor("pg_trgm"),
        evidenceFor("immutable_history_enforcement"),
      ]),
    ).toThrow(/Unknown Stage D5 evidence status/);
  });

  it("names the existing helper but proves it insufficient for immutable history", () => {
    const entry = evidenceFor("immutable_history_enforcement");
    expect(entry.status).toBe("not_established_in_repository");
    expect(entry.evidenceStrength).toBe("partial_insufficient");
    expect(entry.verified).toBe(false);
    const observed = entry.observations.join(" ");
    expect(observed).toContain("public.enforce_immutable_columns");
    expect(observed).toContain("TG_ARGV");
    const reasons = entry.insufficiencyReasons.join(" ");
    expect(reasons).toContain("selected-column UPDATE guard only");
    expect(reasons).toContain("no whole-row UPDATE ban");
    expect(reasons).toContain("no DELETE rejection path");
    expect(reasons).toContain("never reclassified as full enforcement");
  });

  it("records the spatial foundation separately from the unresolved three", () => {
    expect(D5_ESTABLISHED_FOUNDATION_EVIDENCE).toHaveLength(1);
    const spatial = D5_ESTABLISHED_FOUNDATION_EVIDENCE[0]!;
    expect(spatial.factKey).toBe("spatial_foundation");
    expect(spatial.status).toBe("verified_by_repository");
    expect(spatial.sourceMigrationPath).toBe(D5_INSPECTED_MIGRATION_PATHS[0]);
    expect(D5_PREFLIGHT_EVIDENCE.map((e) => e.capabilityKey as string)).not.toContain(
      "spatial_foundation",
    );
    expect(D3_PREFLIGHT_CAPABILITY_KEYS as readonly string[]).not.toContain("spatial_foundation");
  });

  it("states repository inspection completeness without implying a capability pass", () => {
    const result = assessD5RepositoryPreflights();
    expect(result.repositoryPreflightComplete).toBe(true);
    expect(result.prerequisiteAuthoringRequired).toBe(true);
    expect(result.localSchemaAuthoringReady).toBe(false);
    expect(result.hostedApplyAuthorised).toBe(false);
    expect(result.sourceScope).toBe(LOCAL_REALITY_D5_EVIDENCE_SOURCE_SCOPE);
    expect(result.evidenceDate).toBe("2026-08-30");
    expect(LOCAL_REALITY_D5_EVIDENCE_DATE).toBe("2026-08-30");
  });

  it("sequences prerequisite authoring next and selects no diacritic mechanism", () => {
    expect(D5_NEXT_SEQUENCE).toHaveLength(4);
    const text = D5_NEXT_SEQUENCE.join(" ");
    expect(text).toContain("citext and pg_trgm");
    expect(text).toContain("rejects every UPDATE and every DELETE");
    expect(text).toContain("separate hosted owner gate");
    const source = JSON.stringify([D5_NEXT_SEQUENCE, D5_PREFLIGHT_EVIDENCE]).toLowerCase();
    expect(source).not.toContain("unaccent");
  });

  it("is deterministic and deeply frozen", () => {
    const a = assessD5RepositoryPreflights();
    const b = assessD5RepositoryPreflights();
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
    expect(Object.isFrozen(a)).toBe(true);
    for (const entry of D5_PREFLIGHT_EVIDENCE) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.observations)).toBe(true);
      expect(Object.isFrozen(entry.insufficiencyReasons)).toBe(true);
    }
    expect(Object.isFrozen(D5_PREFLIGHT_EVIDENCE)).toBe(true);
    expect(Object.isFrozen(D5_NEXT_SEQUENCE)).toBe(true);
  });

  it("bridges current evidence into Stage D4 without making it ready", () => {
    const input = toD4PreflightCapabilityInput();
    expect(input).toEqual({
      citextVerified: false,
      pgTrgmVerified: false,
      immutableHistoryEnforcementVerified: false,
    });
    const d4 = assessD4SchemaAuthoringReadiness(input);
    expect(d4.schemaAuthoringReady).toBe(false);
    expect(d4.unverifiedPreflightCapabilities).toEqual([...D3_PREFLIGHT_CAPABILITY_KEYS]);
    const d3 = assessD3SchemaAuthoringReadiness(input);
    expect(d3.schemaAuthoringReady).toBe(false);
  });

  it("leaves Stage D3 history and Stage D4 owner decisions unchanged", () => {
    expect(D3_DEFINITION_FINDINGS).toHaveLength(3);
    expect(D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS).toHaveLength(0);
    expect([...OCCUPATION_STATUS_MEMBERS]).toEqual(["active", "inactive"]);
    expect(OCCUPATION_STATUS_DEFAULT_MEMBER).toBe("active");
    expect([...NORMALISE_TITLE_OPERATIONS]).toEqual([
      "lowercase",
      "remove_punctuation",
      "remove_diacritics",
      "collapse_whitespace",
    ]);
  });

  it("carries no participant location or judgement vocabulary", () => {
    const text = JSON.stringify([
      D5_PREFLIGHT_EVIDENCE,
      D5_ESTABLISHED_FOUNDATION_EVIDENCE,
      D5_NEXT_SEQUENCE,
      assessD5RepositoryPreflights(),
    ]).toLowerCase();
    for (const banned of [
      "postcode",
      "latitude",
      "longitude",
      "eligib",
      "realistic",
      "availability_confidence",
    ]) {
      expect(text).not.toContain(banned);
    }
  });
});
