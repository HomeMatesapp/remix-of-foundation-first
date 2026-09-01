import { describe, expect, it } from "vitest";

import { REQUIRED_DEPENDENCY_OBJECTS } from "../codes";
import {
  CLOSED_TYPE_MEMBERS,
  D3_GLOBAL_RULES,
  DEPENDENCY_NODES,
  DEPENDENCY_NODE_KEYS,
  EXTERNAL_ENTITY_COLUMNS,
  NON_ORDINAL_CLOSED_TYPES,
  getDependencyNode,
  topologicalOrder,
  transitiveDependencies,
  validateDependencyGraph,
  type DependencyNode,
} from "../dependency-graph";

import { D3_DEFINITION_FINDING_CODES, D3_DEFINITION_FINDINGS } from "../definition-findings";
import { assessD3SchemaAuthoringReadiness } from "../d3-readiness";

describe("Stage D3 dependency graph", () => {
  it("keeps the six Stage D2 direct dependency objects exact and unchanged", () => {
    expect([...REQUIRED_DEPENDENCY_OBJECTS]).toEqual([
      "source",
      "occupation",
      "route_archetype",
      "provider",
      "programme",
      "opportunity",
    ]);
  });

  it("creates no shadow, minimal or temporary substitute nodes", () => {
    for (const key of DEPENDENCY_NODE_KEYS) {
      expect(key).not.toMatch(/shadow|minimal|temp|stub|placeholder|lite|fake/i);
    }
    const serialised = JSON.stringify(DEPENDENCY_NODES);
    expect(serialised).not.toMatch(/relax|nullableFk|withoutFk|deferConstraint|softReference/i);
  });

  it("classifies the governed code tables as tables, not types, with no invented members", () => {
    for (const key of ["source_type", "opportunity_type", "route_archetype"]) {
      const entry = getDependencyNode(key);
      expect(entry.classification).toBe("governed_vocabulary");
      expect(Object.keys(CLOSED_TYPE_MEMBERS)).not.toContain(key);
      expect(entry.dependsOn).toContain("internal_user");
      expect(entry.dependsOn).toContain("citext");
    }
  });

  it("records exactly the known closed vocabularies and no guessed occupation status members", () => {
    expect([...(CLOSED_TYPE_MEMBERS["availability_confidence"] ?? [])]).toEqual([
      "known_available",
      "uncertain",
      "known_scarce",
      "unknown",
    ]);
    expect([...(CLOSED_TYPE_MEMBERS["evidence_scope"] ?? [])]).toEqual([
      "national",
      "regional",
      "provider_specific",
      "employer_specific",
    ]);
    expect([...(CLOSED_TYPE_MEMBERS["source_state"] ?? [])]).toEqual([
      "healthy",
      "redirected",
      "suspect",
      "broken",
      "withdrawn",
      "under_review",
    ]);
    expect([...(CLOSED_TYPE_MEMBERS["source_authority"] ?? [])]).toEqual([
      "primary_authoritative",
      "official_provider_employer",
      "strong_secondary",
      "exploratory",
    ]);
    expect(CLOSED_TYPE_MEMBERS["occupation_status"]).toBeNull();
    expect(NON_ORDINAL_CLOSED_TYPES).toContain("availability_confidence");
    expect(getDependencyNode("occupation_status").state).toBe("definition_blocked");
  });

  it("orders nodes deterministically with every dependency before its dependent", () => {
    const order = topologicalOrder();
    const reversedInput = topologicalOrder([...DEPENDENCY_NODES].reverse());
    const shuffled = topologicalOrder(
      [...DEPENDENCY_NODES].sort((a, b) => (a.key < b.key ? 1 : -1)),
    );
    expect(reversedInput).toEqual(order);
    expect(shuffled).toEqual(order);
    for (const entry of DEPENDENCY_NODES) {
      for (const dependency of entry.dependsOn) {
        expect(order.indexOf(dependency)).toBeLessThan(order.indexOf(entry.key));
      }
    }
  });

  it("fails closed on cycles, duplicates and unknown dependencies", () => {
    const base = (key: string, dependsOn: readonly string[]): DependencyNode => ({
      key,
      classification: "table",
      state: "to_be_authored",
      dependsOn,
      note: "hostile fixture",
    });
    expect(() => topologicalOrder([base("a", ["b"]), base("b", ["a"])])).toThrow(/cycle/i);
    expect(() => topologicalOrder([base("a", []), base("a", [])])).toThrow(/duplicate/i);
    expect(() => topologicalOrder([base("a", ["missing"])])).toThrow(/unknown dependency/i);
    expect(validateDependencyGraph([base("a", ["b"]), base("b", ["a"])]).structurallyValid).toBe(
      false,
    );
    expect(validateDependencyGraph().structurallyValid).toBe(true);
  });

  it("closes local_snapshot_item over all six direct dependencies and prerequisites", () => {
    const closure = transitiveDependencies("local_snapshot_item");
    for (const key of REQUIRED_DEPENDENCY_OBJECTS) expect(closure).toContain(key);
    for (const key of [
      "local_snapshot",
      "participant_profile",
      "internal_user",
      "source_type",
      "taxonomy_import_batch",
      "availability_confidence",
      "occupation_status",
      "normalise_title",
      "citext",
      "pg_trgm",
      "postgis",
      "immutable_history_enforcement",
    ]) {
      expect(closure).toContain(key);
    }
    expect(closure).not.toContain("local_snapshot_item");
  });

  it("records the programme spatial-index contradiction without synthesising a column", () => {
    expect(D3_DEFINITION_FINDING_CODES).toContain("programme_geog_index_without_column");
    const programmeColumns = EXTERNAL_ENTITY_COLUMNS.filter((c) => c.table === "programme");
    expect(programmeColumns.some((c) => c.column === "geog")).toBe(false);
    expect(getDependencyNode("programme").dependsOn).not.toContain("postgis");
    expect(getDependencyNode("provider").dependsOn).toContain("postgis");
    expect(getDependencyNode("opportunity").dependsOn).toContain("postgis");
  });

  it("fails closed on programme: it is definition_blocked while its finding stands", () => {
    const finding = D3_DEFINITION_FINDINGS.find(
      (entry) => entry.code === "programme_geog_index_without_column",
    );
    expect(finding?.nodeKey).toBe("programme");
    expect(getDependencyNode("programme").state).toBe("definition_blocked");
    expect(getDependencyNode("programme").dependsOn).toEqual([
      "source",
      "provider",
      "occupation",
      "route_archetype",
      "citext",
    ]);
    expect(assessD3SchemaAuthoringReadiness().definitionBlockedNodeKeys).toContain("programme");
  });

  it("preserves the exact final access-control identifiers as declarative data", () => {
    const rules = D3_GLOBAL_RULES.join("\n");
    expect(rules).toMatch(/\bRLS\b/);
    expect(rules).toContain("service_role");
    expect(rules).toContain("authenticated");
    expect(rules).toContain("anon");
    // Declarative only: no executable policy/grant statement or client.
    expect(rules).not.toMatch(/create\s+policy|alter\s+table|grant\s+(all|select)|auth\.uid/i);
  });

  it("records the normalisation finding and invents no suffix list", () => {
    expect(D3_DEFINITION_FINDING_CODES).toContain(
      "normalise_title_controlled_suffix_list_not_frozen",
    );
    const serialised = JSON.stringify([...D3_DEFINITION_FINDINGS, ...DEPENDENCY_NODES]);
    expect(serialised).not.toMatch(/suffixList|SUFFIXES|"ers"|"ians"|"ists"|"s"\]/);
    expect(getDependencyNode("normalise_title").state).toBe("definition_blocked");
  });

  it("leaves the external import batch reference target unspecified", () => {
    const importBatchColumns = EXTERNAL_ENTITY_COLUMNS.filter(
      (c) => c.column === "import_batch_id",
    );
    expect(importBatchColumns).toHaveLength(3);
    for (const column of importBatchColumns) {
      expect(column.fkTarget).toBeNull();
      expect(column.fkTargetUnspecified).toBe(true);
    }
    expect(getDependencyNode("provider").dependsOn).not.toContain("taxonomy_import_batch");
    expect(getDependencyNode("occupation").dependsOn).toContain("taxonomy_import_batch");
  });

  it("treats spatial support as a qualified foundation fact and capabilities as unverified", () => {
    expect(getDependencyNode("postgis").state).toBe("already_established_by_foundation");
    for (const column of EXTERNAL_ENTITY_COLUMNS.filter((c) => c.column === "geog")) {
      expect(column.typeExpectation).toBe("extensions.geography(Point,4326)");
      expect(column.nullable).toBe(true);
    }
    expect(getDependencyNode("citext").state).toBe("requires_preflight");
    expect(getDependencyNode("pg_trgm").state).toBe("requires_preflight");
    const readiness = assessD3SchemaAuthoringReadiness();
    expect([...readiness.unverifiedPreflightCapabilities]).toEqual([
      "citext",
      "pg_trgm",
      "immutable_history_enforcement",
    ]);
  });

  it("reports graph integrity separately and never reports schema-authoring readiness", () => {
    const readiness = assessD3SchemaAuthoringReadiness({
      citextVerified: true,
      pgTrgmVerified: true,
      immutableHistoryEnforcementVerified: true,
    });
    expect(readiness.graph.structurallyValid).toBe(true);
    expect(readiness.schemaAuthoringReady).toBe(false);
    expect([...readiness.unresolvedDefinitionFindingCodes]).toEqual([
      ...D3_DEFINITION_FINDING_CODES,
    ]);
    expect([...readiness.definitionBlockedNodeKeys]).toEqual([
      "normalise_title",
      "occupation",
      "occupation_status",
      "programme",
    ]);

    expect(readiness.authorisationNote).toMatch(/separate owner gate/i);
  });

  it("returns frozen, deterministic, non-mutating outputs", () => {
    expect(Object.isFrozen(DEPENDENCY_NODES)).toBe(true);
    for (const entry of DEPENDENCY_NODES) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.dependsOn)).toBe(true);
    }
    for (const finding of D3_DEFINITION_FINDINGS) expect(Object.isFrozen(finding)).toBe(true);
    const first = assessD3SchemaAuthoringReadiness();
    const second = assessD3SchemaAuthoringReadiness();
    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
    expect(Object.isFrozen(first)).toBe(true);
    expect(topologicalOrder()).toEqual(topologicalOrder());
    expect(Object.isFrozen(topologicalOrder())).toBe(true);
  });

  it("introduces no durable participant location vocabulary and no inference", () => {
    const serialised = JSON.stringify([...DEPENDENCY_NODES, ...EXTERNAL_ENTITY_COLUMNS]);
    expect(serialised).not.toMatch(/rawPostcode|postcode_normalised|full_postcode/i);
    expect(serialised).not.toMatch(/infer|derive_availability|eligib|judgement|no_result/i);
  });
});
