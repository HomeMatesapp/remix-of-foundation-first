import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EXTERNAL_ENTITY_COLUMNS } from "../dependency-graph";
import { PROPOSED_COLUMNS, QUALIFIED_POINT_TYPE_EXPECTATION } from "../manifest";
import { PROJECTED_PRECISION_LEVELS } from "../projection";
import {
  D7_AUTHORED_MIGRATION_ORDINAL,
  D7_AUTHORED_MIGRATION_PATH,
  D7_AUTHORED_OBJECTS,
  D7_BLOCKED_CHAIN,
  D7_NORMALISE_TITLE_MECHANISM_BLOCKER,
  D7_R1_RECONCILIATION,
  D7_R2_1_RECONCILIATION,
  D7_R2_RECONCILIATION,
  assessD7RelationalAuthoring,
} from "../d7-relational-authoring";

const REPO = process.cwd();
const AUTHORED_DIR = join(REPO, "supabase/authored-migrations");
const APPLIED_DIR = join(REPO, "supabase/migrations");

const sql = readFileSync(join(REPO, D7_AUTHORED_MIGRATION_PATH), "utf8");
/** Executable statement text only: header commentary documents exclusions. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");
const statementsLower = statements.toLowerCase();
/**
 * Executable DDL with documentation COMMENT ON statements removed. Those carry
 * scope-limiting prose (for example "never a participant location"), so
 * exclusion checks run against the structural DDL rather than the prose.
 */
const ddlOnly = statements.replace(/COMMENT ON[\s\S]*?;/g, " ");
const ddlOnlyLower = ddlOnly.toLowerCase();

/** Shared column-line parser for exact-shape table assertions. */
function parseColumns(tableBody: string): readonly { name: string; definition: string }[] {
  return tableBody
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.length > 0 && !line.startsWith("CONSTRAINT"))
    .map((line) => {
      const name = line.split(/\s+/)[0]!;
      return { name, definition: line.slice(name.length).trim() };
    });
}

describe("Stage D7 authored source placement", () => {
  it("is authored, not applied, and positioned tenth in repository order", () => {
    const authored = readdirSync(AUTHORED_DIR).filter((f) => f.endsWith(".sql"));
    expect(authored).toContain(D7_AUTHORED_MIGRATION_PATH.split("/").pop());

    const applied = readdirSync(APPLIED_DIR).filter((f) => f.endsWith(".sql"));
    // Nine applied migrations stand; this authored source is the intended tenth.
    expect(applied).toHaveLength(9);
    expect(D7_AUTHORED_MIGRATION_ORDINAL).toBe(applied.length + 1);
    expect(applied).not.toContain(D7_AUTHORED_MIGRATION_PATH.split("/").pop());
  });

  it("leaves the Stage D6 authored source untouched as history", () => {
    const d6 = join(AUTHORED_DIR, "20260830220000_stage-d6-prerequisite-capabilities.sql");
    expect(readFileSync(d6, "utf8")).toContain("STAGE D6");
  });
});

describe("Stage D7 fail-closed authoring", () => {
  it("authors direct CREATE only: never adopts a pre-existing object", () => {
    // No IF NOT EXISTS adoption in DDL...
    expect(statementsLower).not.toMatch(
      /create\s+(table|index|type|trigger|policy|extension|schema|function)\s+if\s+not\s+exists/,
    );
    // ...and no conditional-create adoption inside procedural blocks. The
    // legitimate procedural form is IF NOT EXISTS (...) THEN RAISE, never
    // IF NOT EXISTS (...) THEN CREATE.
    expect(statementsLower).not.toMatch(/if\s+not\s+exists[\s\S]{0,300}?then\s+create/);
    expect(statementsLower).not.toContain("or replace");
    expect(statementsLower).not.toContain("drop policy");
    expect(statementsLower).not.toContain("drop trigger");
    expect(statementsLower).not.toContain("drop table");
  });

  it("gates every Stage D7 object name for absence before any DDL", () => {
    const firstDdlAt = statements.indexOf("CREATE TYPE public.occupation_status");
    expect(firstDdlAt).toBeGreaterThan(0);
    const gate = statements.slice(0, firstDdlAt);
    expect(gate).toMatch(/pre-existing Stage D7 object/);
    for (const objectName of [
      "occupation_status",
      "source_state",
      "source_authority",
      "evidence_scope",
      "availability_confidence",
      "public.source_type",
      "public.opportunity_type",
      "public.route_archetype",
      "public.source",
      "public.taxonomy_import_batch",
      "public.provider",
      "public.local_snapshot",
      "public.provider_geog_gist",
      "public.local_snapshot_centre_geog_gist",
      "public.source_state_idx",
      "public.source_authority_level_idx",
      "local_snapshot_forbid_update_trg",
      "local_snapshot_forbid_delete_trg",
    ]) {
      expect(gate).toContain(`'${objectName}'`);
    }
  });

  it("preserves the foundation dependency preconditions without broadening them", () => {
    expect(statements).toMatch(/citext is not established in the extensions schema/);
    expect(statements).toMatch(/PostGIS is not established in the extensions schema/);
    expect(statements).toMatch(/to_regclass\('public\.internal_user'\)/);
    expect(statements).toMatch(/to_regprocedure\('public\.set_updated_at\(\)'\)/);
    expect(statements).toMatch(/to_regprocedure\('public\.is_internal\(public\.internal_role\)'\)/);
    expect(statements).toMatch(/to_regtype\('public\.relationship_status'\)/);
    expect(statementsLower).not.toContain("search_path");
  });

  it("proves the local_snapshot dependency chain before authoring it", () => {
    const firstDdlAt = statements.indexOf("CREATE TYPE public.occupation_status");
    const gate = statements.slice(0, firstDdlAt);
    expect(gate).toMatch(/to_regclass\('public\.participant_profile'\)/);
    expect(gate).toMatch(/to_regprocedure\('public\.forbid_mutation\(\)'\)/);
    expect(gate).toMatch(/to_regprocedure\('public\.current_participant_id\(\)'\)/);
    expect(gate).toMatch(/to_regprocedure\('public\.can_access_participant\(uuid\)'\)/);
  });

  it("self-verifies the provider and local_snapshot frozen shapes fail-closed", () => {
    expect(statements).toMatch(/provider columns drifted from the frozen contract/);
    expect(statements).toMatch(/provider\.id must carry the global uuid primary-key default/);
    expect(statements).toMatch(/provider carries a non-id column default/);
    expect(statements).toMatch(/provider carries a trigger/);
    expect(statements).toMatch(/local_snapshot columns drifted from the frozen contract/);
    expect(statements).toMatch(/local_snapshot\.id must carry the global uuid primary-key default/);
    expect(statements).toMatch(/local_snapshot carries a non-id column default/);
    expect(statements).toMatch(/must carry both immutable-history triggers/);
    expect(statements).toMatch(/local_snapshot carries an unexpected trigger/);
  });
});

describe("Stage D7 closed named relational types", () => {
  const expected: readonly (readonly [string, readonly string[]])[] = [
    ["occupation_status", ["active", "inactive"]],
    ["source_state", ["healthy", "redirected", "suspect", "broken", "withdrawn", "under_review"]],
    [
      "source_authority",
      ["primary_authoritative", "official_provider_employer", "strong_secondary", "exploratory"],
    ],
    ["evidence_scope", ["national", "regional", "provider_specific", "employer_specific"]],
    ["availability_confidence", ["known_available", "uncertain", "known_scarce", "unknown"]],
  ];

  for (const [typeName, members] of expected) {
    it(`authors public.${typeName} with exactly its frozen members`, () => {
      const declaration = new RegExp(
        `create type public\\.${typeName} as enum\\s*\\(([^)]*)\\)`,
        "i",
      ).exec(statements);
      expect(declaration).not.toBeNull();
      const authoredMembers = [...declaration![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
      expect(authoredMembers).toEqual([...members]);
    });
  }

  it("records availability_confidence as explicitly non-ordinal", () => {
    expect(sql).toMatch(/NON-ORDINAL/);
  });
});

describe("Stage D7 governed vocabulary tables", () => {
  const vocabularies = ["source_type", "opportunity_type", "route_archetype"] as const;

  for (const table of vocabularies) {
    it(`authors public.${table} as an extensible code table, not an enum`, () => {
      const body = new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`, "i").exec(
        statements,
      );
      expect(body).not.toBeNull();
      const columns = body![1]!;
      expect(columns).toMatch(/code extensions\.citext PRIMARY KEY/);
      expect(columns).toMatch(/name text NOT NULL/);
      expect(columns).toMatch(/description text/);
      expect(columns).toMatch(/status public\.relationship_status NOT NULL/);
      expect(columns).toMatch(
        /created_by uuid NOT NULL REFERENCES public\.internal_user \(id\) ON DELETE RESTRICT/,
      );
      expect(columns).toMatch(
        /approved_by uuid REFERENCES public\.internal_user \(id\) ON DELETE RESTRICT/,
      );
      expect(columns).toMatch(/created_at timestamptz NOT NULL/);
      expect(columns).toMatch(/updated_at timestamptz NOT NULL/);
      expect(new RegExp(`create type public\\.${table}`, "i").test(statements)).toBe(false);
    });
  }

  it("seeds no governed vocabulary row of any kind", () => {
    expect(statementsLower).not.toMatch(/insert\s+into/);
    expect(statementsLower).not.toMatch(/\bvalues\s*\(/);
    expect(statementsLower).not.toMatch(/\bcopy\b/);
  });
});

describe("Stage D7 source and taxonomy_import_batch", () => {
  it("authors source with its frozen columns and no delete cascade", () => {
    const body = /create table public\.source \(([\s\S]*?)\n\);/i.exec(statements);
    expect(body).not.toBeNull();
    const columns = body![1]!;
    expect(columns).toMatch(/canonical_url text NOT NULL UNIQUE/);
    expect(columns).toMatch(/organisation text NOT NULL/);
    expect(columns).toMatch(
      /source_type_code extensions\.citext NOT NULL REFERENCES public\.source_type \(code\) ON DELETE RESTRICT/,
    );
    expect(columns).toMatch(/authority_level public\.source_authority NOT NULL/);
    expect(columns).toMatch(/scope public\.evidence_scope NOT NULL/);
    expect(columns).toMatch(/licence_reference text/);
    expect(columns).toMatch(/state public\.source_state NOT NULL DEFAULT 'healthy'/);
    expect(columns).toMatch(/last_reviewed_at timestamptz/);
    expect(columns).toMatch(/maintained_by uuid REFERENCES public\.internal_user \(id\)/);
  });

  it("carries the inherited v1.0 state and authority indexes", () => {
    expect(statements).toMatch(/CREATE INDEX source_state_idx ON public\.source \(state\)/);
    expect(statements).toMatch(
      /CREATE INDEX source_authority_level_idx ON public\.source \(authority_level\)/,
    );
  });

  it("excludes withdrawn sources from authenticated reads while internal governance retains access", () => {
    const policy =
      /create policy source_select on public\.source\s+for select to authenticated\s+using \(([\s\S]*?)\);/i.exec(
        statements,
      );
    expect(policy).not.toBeNull();
    const predicate = policy![1]!.trim();
    expect(predicate).toBe("state <> 'withdrawn' OR public.is_internal()");
    expect(predicate).not.toBe("true");
  });

  it("authors taxonomy_import_batch with a non-negative record count", () => {
    const body = /create table public\.taxonomy_import_batch \(([\s\S]*?)\n\);/i.exec(statements);
    expect(body).not.toBeNull();
    const columns = body![1]!;
    expect(columns).toMatch(/adapter_key text NOT NULL/);
    expect(columns).toMatch(/source_id uuid REFERENCES public\.source \(id\) ON DELETE RESTRICT/);
    expect(columns).toMatch(/record_count integer NOT NULL DEFAULT 0/);
    expect(columns).toMatch(/CHECK \(record_count >= 0\)/);
    expect(columns).toMatch(
      /imported_by uuid NOT NULL REFERENCES public\.internal_user \(id\) ON DELETE RESTRICT/,
    );
    expect(columns).toMatch(/notes text/);
    expect(columns).toMatch(/created_at timestamptz NOT NULL/);
  });

  it("never hard-deletes or cascades governed records", () => {
    expect(statementsLower).not.toMatch(/on delete cascade/);
    expect(statementsLower).not.toMatch(/drop table/);
    const restrictCount = (statementsLower.match(/on delete restrict/g) ?? []).length;
    const references = (statementsLower.match(/references public\./g) ?? []).length;
    expect(restrictCount).toBe(references);
  });
});

describe("Stage D7 provider entity (derived from the frozen column authority)", () => {
  /** The frozen provider column contract. Never re-stated: read from the authority. */
  const frozen = EXTERNAL_ENTITY_COLUMNS.filter((c) => c.table === "provider");

  /** Frozen type vocabulary -> exact authored SQL type text. */
  const SQL_TYPES: Readonly<Record<string, string>> = {
    uuid: "uuid",
    text: "text",
    timestamptz: "timestamptz",
    citext: "extensions.citext",
    [QUALIFIED_POINT_TYPE_EXPECTATION]: QUALIFIED_POINT_TYPE_EXPECTATION,
  };

  const body = /create table public\.provider \(([\s\S]*?)\n\);/i.exec(statements);
  const providerBody = body?.[1] ?? "";
  const parsedColumns = parseColumns(providerBody);

  it("authors exactly the frozen provider columns in contract order — no extras", () => {
    expect(parsedColumns.map((c) => c.name)).toEqual(frozen.map((c) => c.column));
  });

  it("authors the exact frozen type and nullability for every provider column", () => {
    for (const contract of frozen) {
      const authored = parsedColumns.find((c) => c.name === contract.column);
      expect(authored, contract.column).toBeDefined();
      const sqlType = SQL_TYPES[contract.typeExpectation];
      expect(sqlType, `unmapped frozen type for ${contract.column}`).toBeDefined();
      const escaped = sqlType!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(authored!.definition, contract.column).toMatch(
        new RegExp(`^${escaped}\\b|^${escaped}$`),
      );
      if (contract.column === "id") {
        // PRIMARY KEY carries the frozen NOT NULL.
        expect(contract.nullable).toBe(false);
        expect(authored!.definition).toMatch(/PRIMARY KEY/);
      } else {
        expect(/\bNOT NULL\b/.test(authored!.definition), contract.column).toBe(!contract.nullable);
      }
    }
  });

  it("has no provider created_at/updated_at and no provider touch trigger", () => {
    const names = parsedColumns.map((c) => c.name);
    expect(names).not.toContain("created_at");
    expect(names).not.toContain("updated_at");
    expect(statementsLower).not.toMatch(/create trigger[^;]*on public\.provider/);
  });

  it("requires the global uuid primary-key default on id and forbids every other provider default", () => {
    const id = parsedColumns.find((c) => c.name === "id");
    expect(id).toBeDefined();
    // R2: the uuid primary-key default is the frozen GLOBAL relational
    // convention, not a table-specific invention; R1 over-removed it.
    expect(id!.definition).toBe("uuid PRIMARY KEY DEFAULT gen_random_uuid()");
    for (const column of parsedColumns.filter((c) => c.name !== "id")) {
      expect(column.definition, column.name).not.toMatch(/default/i);
    }
  });

  it("authors exactly one provider foreign key: source, delete-restricted", () => {
    expect(providerBody).toMatch(
      /source_id uuid NOT NULL REFERENCES public\.source \(id\) ON DELETE RESTRICT/,
    );
    expect((providerBody.match(/REFERENCES/g) ?? []).length).toBe(1);
  });

  it("authors composite source identity uniqueness", () => {
    expect(providerBody).toMatch(/UNIQUE \(source_id, source_record_key\)/);
  });

  it("keeps status plain text with no invented vocabulary", () => {
    expect(providerBody).toMatch(/status text NOT NULL/);
    expect(providerBody).not.toMatch(/status public\.relationship_status/);
  });

  it("leaves import_batch_id unreferenced: no target is invented", () => {
    const importBatch = parsedColumns.find((c) => c.name === "import_batch_id");
    expect(importBatch).toBeDefined();
    // Bare frozen type only: no FK, no default, no invented target.
    expect(importBatch!.definition).toBe("uuid");
    expect(providerBody).not.toMatch(/import_batch_id uuid[^,\n]*REFERENCES/);
  });

  it("authors a nullable established spatial point through the extensions schema", () => {
    const geog = parsedColumns.find((c) => c.name === "geog");
    expect(geog).toBeDefined();
    expect(geog!.definition).toBe(QUALIFIED_POINT_TYPE_EXPECTATION);
    expect(statements).toMatch(
      /CREATE INDEX provider_geog_gist ON public\.provider USING GIST \(geog\)/,
    );
  });
});

describe("Stage D7 local_snapshot (derived from the frozen D1/D2 column authority)", () => {
  /** The frozen envelope column contract. Never re-stated: read from the authority. */
  const frozen = PROPOSED_COLUMNS.filter((c) => c.table === "local_snapshot");

  /** Frozen type vocabulary -> exact authored SQL type text. */
  const SQL_TYPES: Readonly<Record<string, string>> = {
    uuid: "uuid",
    text: "text",
    smallint: "smallint",
    timestamptz: "timestamptz",
    [QUALIFIED_POINT_TYPE_EXPECTATION]: QUALIFIED_POINT_TYPE_EXPECTATION,
  };

  const body = /create table public\.local_snapshot \(([\s\S]*?)\n\);/i.exec(statements);
  const snapshotBody = body?.[1] ?? "";
  const parsedColumns = parseColumns(snapshotBody);

  it("authors exactly the frozen local_snapshot columns in contract order — no extras", () => {
    expect(frozen.length).toBeGreaterThan(0);
    expect(parsedColumns.map((c) => c.name)).toEqual(frozen.map((c) => c.column));
  });

  it("authors the exact frozen type and nullability for every local_snapshot column", () => {
    for (const contract of frozen) {
      const authored = parsedColumns.find((c) => c.name === contract.column);
      expect(authored, contract.column).toBeDefined();
      const sqlType = SQL_TYPES[contract.typeExpectation];
      expect(sqlType, `unmapped frozen type for ${contract.column}`).toBeDefined();
      const escaped = sqlType!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(authored!.definition, contract.column).toMatch(
        new RegExp(`^${escaped}\\b|^${escaped}$`),
      );
      if (contract.column === "id") {
        // PRIMARY KEY carries the frozen NOT NULL.
        expect(contract.nullable).toBe(false);
        expect(authored!.definition).toMatch(/PRIMARY KEY/);
      } else {
        expect(/\bNOT NULL\b/.test(authored!.definition), contract.column).toBe(!contract.nullable);
      }
    }
  });

  it("requires the global uuid primary-key default on id and forbids every other default", () => {
    const id = parsedColumns.find((c) => c.name === "id");
    expect(id).toBeDefined();
    expect(id!.definition).toBe("uuid PRIMARY KEY DEFAULT gen_random_uuid()");
    // schema_version and captured_at in particular: the canonical values are
    // supplied verbatim, so NO default may exist on any non-id column.
    for (const column of parsedColumns.filter((c) => c.name !== "id")) {
      expect(column.definition, column.name).not.toMatch(/default/i);
    }
  });

  it("constrains resolution_level to exactly the closed precision vocabulary including coarse and none", () => {
    const check =
      /CONSTRAINT local_snapshot_resolution_level_check CHECK \(resolution_level IN \(([^)]*)\)\)/.exec(
        statements,
      );
    expect(check).not.toBeNull();
    const members = [...check![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
    expect(members).toEqual([...PROJECTED_PRECISION_LEVELS]);
    expect(members).toContain("coarse");
    expect(members).toContain("none");
  });

  it("constrains radius_miles to whole miles 1-100 or null", () => {
    expect(statements).toMatch(
      /CONSTRAINT local_snapshot_radius_miles_check CHECK \(radius_miles IS NULL OR radius_miles BETWEEN 1 AND 100\)/,
    );
  });

  it("authors exactly one delete-restricted participant FK", () => {
    expect(snapshotBody).toMatch(
      /participant_id uuid NOT NULL REFERENCES public\.participant_profile \(id\) ON DELETE RESTRICT/,
    );
    expect((snapshotBody.match(/REFERENCES/g) ?? []).length).toBe(1);
  });

  it("authors the GIST index on the nullable established centre point", () => {
    const centre = parsedColumns.find((c) => c.name === "centre_geog");
    expect(centre).toBeDefined();
    expect(centre!.definition).toBe(QUALIFIED_POINT_TYPE_EXPECTATION);
    expect(statements).toMatch(
      /CREATE INDEX local_snapshot_centre_geog_gist ON public\.local_snapshot USING GIST \(centre_geog\)/,
    );
  });

  it("stores no raw postcode, lat/lng, retention or location-derivation field", () => {
    for (const name of parsedColumns.map((c) => c.name)) {
      expect(name).not.toMatch(/postcode|latitude|longitude|\blat\b|\blng\b|retention/);
    }
  });

  it("wires separate forbid_mutation UPDATE and DELETE triggers and no touch trigger", () => {
    expect(statements).toMatch(
      /CREATE TRIGGER local_snapshot_forbid_update_trg BEFORE UPDATE ON public\.local_snapshot\s+FOR EACH ROW EXECUTE FUNCTION public\.forbid_mutation\(\)/,
    );
    expect(statements).toMatch(
      /CREATE TRIGGER local_snapshot_forbid_delete_trg BEFORE DELETE ON public\.local_snapshot\s+FOR EACH ROW EXECUTE FUNCTION public\.forbid_mutation\(\)/,
    );
    const snapshotTriggers = [
      ...statementsLower.matchAll(/create trigger[^;]*on public\.local_snapshot\b[^;]*;/g),
    ];
    expect(snapshotTriggers).toHaveLength(2);
    for (const trigger of snapshotTriggers) {
      expect(trigger[0]).toContain("forbid_mutation");
    }
    // The established immutable-history helper is wired, never redefined, and
    // it raises for every caller including service_role.
    expect([...statements.matchAll(/EXECUTE FUNCTION public\.forbid_mutation\(\)/g)]).toHaveLength(
      2,
    );
    expect(statementsLower).not.toMatch(/on public\.local_snapshot[^;]*set_updated_at/);
  });

  it("authors the exact established participant read policy and nothing broader", () => {
    const policy =
      /create policy local_snapshot_select on public\.local_snapshot\s+for select to authenticated\s+using \(([\s\S]*?)\);/i.exec(
        statements,
      );
    expect(policy).not.toBeNull();
    const predicate = policy![1]!.replace(/\s+/g, " ").trim();
    expect(predicate).toBe(
      "participant_id = public.current_participant_id() OR public.can_access_participant(participant_id) OR public.is_internal('admin'::public.internal_role)",
    );
    // Exactly one policy exists on local_snapshot: read-only, no write path.
    const policies = [
      ...statementsLower.matchAll(/create policy \w+ on public\.local_snapshot\b/g),
    ];
    expect(policies).toHaveLength(1);
  });
});

describe("Stage D7 access control conventions", () => {
  const tables = [
    "source_type",
    "opportunity_type",
    "route_archetype",
    "source",
    "taxonomy_import_batch",
    "provider",
    "local_snapshot",
  ] as const;

  for (const table of tables) {
    it(`enables row level security and least privilege on public.${table}`, () => {
      expect(statements).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(statements).toContain(`GRANT ALL ON public.${table} TO service_role`);
      expect(statements).toContain(`GRANT SELECT ON public.${table} TO authenticated`);
      expect(statements).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(statements).not.toContain(`ON public.${table} TO anon`);
    });
  }

  it("authors no write policy and no anon privilege at all", () => {
    expect(statementsLower).not.toMatch(/for (insert|update|delete)/);
    expect(statementsLower).not.toMatch(/grant[^;]*\banon\b/);
    expect(statementsLower).not.toMatch(/to public\b/);
  });
});

describe("Stage D7 excluded scope", () => {
  it("authors none of the dependency-blocked objects", () => {
    for (const nodeKey of ["occupation", "programme", "opportunity"]) {
      expect(new RegExp(`create table[^;]*public\\.${nodeKey}\\b`, "i").test(statements)).toBe(
        false,
      );
    }
    expect(statementsLower).not.toContain("local_snapshot_item");
    expect(statementsLower).not.toContain("normalise_title");
    expect(statementsLower).not.toContain("generated always as");
    // The immutable-history helper is an established foundation object: it is
    // wired to local_snapshot but never defined, redefined or replaced here.
    expect(statementsLower).not.toMatch(/create\s+(or\s+replace\s+)?function/);
  });

  it("selects no diacritic mechanism, transliteration or morphology", () => {
    expect(statementsLower).not.toContain("unaccent");
    expect(statementsLower).not.toContain("transliterat");
    expect(statementsLower).not.toMatch(/singularis|stemming|lemmatis|plural/);
    expect(statementsLower).not.toMatch(/translate\s*\(/);
  });

  it("persists no participant location and no raw postcode", () => {
    // The ONLY participant tokens permitted in DDL are the snapshot ownership
    // column, its FK target and the two established access helpers; no
    // participant location value of any kind is stored.
    const nonOwnership = ddlOnlyLower.replace(
      /current_participant_id|can_access_participant|participant_profile|participant_id/g,
      "",
    );
    expect(nonOwnership).not.toContain("participant");
    expect(ddlOnlyLower).not.toMatch(/\bpostcode\b/);
    expect(ddlOnlyLower).not.toMatch(/latitude|longitude|retention/);
    // Only the coarse organisation area COLUMN exists, declared once, on
    // provider, as the frozen case-insensitive type.
    const sectorDeclarations = ddlOnly
      .split("\n")
      .filter((line) => /^\s*postcode_sector\s/.test(line));
    expect(sectorDeclarations).toHaveLength(1);
    expect(sectorDeclarations[0]).toMatch(/postcode_sector extensions\.citext/);
  });

  it("changes no spatial installation and stays extensions-qualified", () => {
    expect(statementsLower).not.toMatch(/create extension|drop extension/);
    const spatialUses = [...statements.matchAll(/geography\(/g)].length;
    const qualified = [...statements.matchAll(/extensions\.geography\(/g)].length;
    expect(qualified).toBe(spatialUses);
  });

  it("touches no closed increment semantics", () => {
    expect(statementsLower).not.toMatch(
      /career_pack|decision_engine|reality_check|auth\.|storage\./,
    );
  });
});

describe("Stage D7 authoring record", () => {
  it("accounts for every in-scope dependency node exactly once", () => {
    const assessment = assessD7RelationalAuthoring();
    expect(assessment.allNodesAccountedFor).toBe(true);
    expect(assessment.hostedApplyAuthorised).toBe(false);
    expect(assessment.authoredNodeKeys).toEqual([
      "occupation_status",
      "source_state",
      "source_authority",
      "evidence_scope",
      "availability_confidence",
      "source_type",
      "opportunity_type",
      "route_archetype",
      "source",
      "taxonomy_import_batch",
      "provider",
      "local_snapshot",
    ]);
    expect(assessment.blockedNodeKeys).toEqual([...D7_BLOCKED_CHAIN]);
  });

  it("records local_snapshot as authored-not-applied and outside the blocked chain", () => {
    const record = D7_AUTHORED_OBJECTS.find((r) => r.nodeKey === "local_snapshot");
    expect(record).toBeDefined();
    expect(record!.authoringStatus).toBe("authored_not_applied");
    expect(record!.authoredIn).toBe(D7_AUTHORED_MIGRATION_PATH);
    expect(record!.targetProjectVerified).toBe(false);
    expect(D7_BLOCKED_CHAIN).not.toContain("local_snapshot");
    expect(D7_BLOCKED_CHAIN).toEqual([
      "normalise_title",
      "occupation",
      "programme",
      "opportunity",
      "local_snapshot_item",
    ]);
  });

  it("keeps local_snapshot_item deferred on its own accurate chain, not a shared blocker", () => {
    const record = D7_AUTHORED_OBJECTS.find((r) => r.nodeKey === "local_snapshot_item");
    expect(record).toBeDefined();
    expect(record!.authoringStatus).toBe("not_authored_dependency_blocked");
    expect(record!.blockedReason).toMatch(/programme and opportunity/);
    expect(record!.blockedReason).toMatch(/parent local_snapshot is authored/);
  });

  it("never claims target verification for any Stage D7 record", () => {
    for (const record of D7_AUTHORED_OBJECTS) {
      expect(record.targetProjectVerified, record.nodeKey).toBe(false);
    }
  });

  it("records the normalise_title mechanism gate as an owner decision", () => {
    expect(D7_NORMALISE_TITLE_MECHANISM_BLOCKER.requiresOwnerDecision).toBe(true);
    expect(D7_NORMALISE_TITLE_MECHANISM_BLOCKER.blockerCode).toBe(
      "normalise_title_diacritic_mechanism_not_approved",
    );
  });

  it("records the R1 reconciliation against the frozen column authority", () => {
    expect(D7_R1_RECONCILIATION.columnAuthority).toBe("EXTERNAL_ENTITY_COLUMNS");
    expect(D7_R1_RECONCILIATION.hostedApplyAuthorised).toBe(false);
    const corrected = D7_R1_RECONCILIATION.corrections.join(" ");
    expect(corrected).toMatch(/provider/);
    expect(corrected).toMatch(/withdrawn/);
    expect(corrected).toMatch(/fail.closed|absence gate/i);
  });

  it("records the R2 reconciliation without erasing the R1 history", () => {
    expect(D7_R2_RECONCILIATION.inspectedCommit).toBe("f3e55574cb7aacd7e15b4a969de4b819940087fd");
    expect(D7_R2_RECONCILIATION.hostedApplyAuthorised).toBe(false);
    expect(D7_R2_RECONCILIATION.columnAuthorities).toEqual([
      "EXTERNAL_ENTITY_COLUMNS",
      "PROPOSED_COLUMNS",
      "SNAPSHOT_FIELD_PROJECTIONS",
    ]);
    const corrected = D7_R2_RECONCILIATION.corrections.join(" ");
    expect(corrected).toMatch(/gen_random_uuid/);
    expect(corrected).toMatch(/GLOBAL/);
    expect(corrected).toMatch(/local_snapshot was wrongly deferred/);
    // R1 stays as preserved history, not rewritten.
    expect(D7_R1_RECONCILIATION.inspectedCommit).toBe("1d9a1ea8cd7dd37e0ea1e31b2fc7f21a02cf5242");
  });

  it("fails closed on an unknown or duplicated node record", () => {
    expect(() =>
      assessD7RelationalAuthoring([
        {
          nodeKey: "not_a_node",
          authoringStatus: "authored_not_applied",
          authoredIn: D7_AUTHORED_MIGRATION_PATH,
          blockedReason: null,
          targetProjectVerified: false,
        },
      ]),
    ).toThrow(/Unknown Stage D7 node/);

    expect(() =>
      assessD7RelationalAuthoring([D7_AUTHORED_OBJECTS[0]!, D7_AUTHORED_OBJECTS[0]!]),
    ).toThrow(/Duplicate Stage D7 node record/);
  });

  it("fails closed on a record claiming target verification", () => {
    expect(() =>
      assessD7RelationalAuthoring([
        {
          nodeKey: "local_snapshot",
          authoringStatus: "authored_not_applied",
          authoredIn: D7_AUTHORED_MIGRATION_PATH,
          blockedReason: null,
          targetProjectVerified: true,
        },
      ]),
    ).toThrow(/claims target verification/);
  });

  it("fails closed on a malformed authored or blocked record", () => {
    expect(() =>
      assessD7RelationalAuthoring([
        {
          nodeKey: "source",
          authoringStatus: "authored_not_applied",
          authoredIn: null,
          blockedReason: null,
          targetProjectVerified: false,
        },
      ]),
    ).toThrow(/Malformed Stage D7 authored record/);

    expect(() =>
      assessD7RelationalAuthoring([
        {
          nodeKey: "occupation",
          authoringStatus: "not_authored_dependency_blocked",
          authoredIn: D7_AUTHORED_MIGRATION_PATH,
          blockedReason: "x",
          targetProjectVerified: false,
        },
      ]),
    ).toThrow(/Malformed Stage D7 blocked record/);
  });
});

describe("Stage D7 R2.1 reconciliation", () => {
  const FOUNDATION_SQL = readFileSync(
    join(APPLIED_DIR, "20260824234158_937e2390-91b1-4b09-85cf-8f8d4072bed4.sql"),
    "utf8",
  );

  it("checks the exact foundation catalogue signature of is_internal", () => {
    // A default argument does not change the function's catalogue identity.
    expect(FOUNDATION_SQL).toContain("public.is_internal(_role public.internal_role DEFAULT NULL)");
    expect(D7_R2_1_RECONCILIATION.foundationDeclarationFragment).toBe(
      "_role public.internal_role DEFAULT NULL",
    );
    expect(FOUNDATION_SQL).toContain(D7_R2_1_RECONCILIATION.foundationDeclarationFragment);

    expect(statements).toContain("to_regprocedure('public.is_internal(public.internal_role)')");
    expect(statements).not.toContain("to_regprocedure('public.is_internal()')");
    expect(D7_R2_1_RECONCILIATION.isInternalPrerequisiteLookup).toBe(
      "public.is_internal(public.internal_role)",
    );
  });

  it("keeps the intentional zero-argument is_internal() policy calls", () => {
    expect(statements).toContain("public.is_internal()");
    expect(statements).toContain("public.is_internal('admin'::public.internal_role)");
  });

  it("drops the stale present-tense programme definition-contradiction claim", () => {
    const source = readFileSync(
      join(REPO, "src/domain/local-reality-persistence/d7-relational-authoring.ts"),
      "utf8",
    );
    const blockedChainComment = source.slice(0, source.indexOf("export const D7_BLOCKED_CHAIN"));
    expect(blockedChainComment).not.toContain("definition\n * contradiction");
    expect(blockedChainComment).toContain("the unauthored occupation catalogue they reference");
    expect(D7_BLOCKED_CHAIN).toContain("programme");
  });

  it("records R2.1 additively and keeps the apply gate closed", () => {
    expect(D7_R2_1_RECONCILIATION.reconciliationCode).toBe(
      "d7_r2_1_foundation_signature_and_stale_comment",
    );
    expect(D7_R2_1_RECONCILIATION.inspectedCommit).toBe("36ac3b3bdd5163b2b3169afeaad5ddbbacebbf51");
    expect(D7_R2_1_RECONCILIATION.corrections).toHaveLength(2);
    expect(D7_R2_1_RECONCILIATION.hostedApplyAuthorised).toBe(false);
    // R1 and R2 records survive untouched.
    expect(D7_R1_RECONCILIATION.hostedApplyAuthorised).toBe(false);
    expect(D7_R2_RECONCILIATION.reconciliationCode).toBe(
      "d7_r2_uuid_pk_default_and_local_snapshot",
    );
  });
});
