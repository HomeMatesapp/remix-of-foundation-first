import { describe, expect, it } from "vitest";

import {
  D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS,
  D4_RESOLVED_FINDING_CODES,
  D4_SPATIAL_INDEX_TABLES,
  LOCAL_REALITY_D4_DECISIONS,
  LOCAL_REALITY_D4_DECISION_DATE,
  NORMALISE_TITLE_OPERATIONS,
  OCCUPATION_STATUS_DEFAULT_MEMBER,
  OCCUPATION_STATUS_MEMBERS,
  PROGRAMME_HAS_SPATIAL_COLUMN,
  getD4Decision,
} from "../d4-decisions";
import { D3_DEFINITION_FINDINGS, D3_DEFINITION_FINDING_CODES } from "../definition-findings";
import {
  D4_CURRENT_CLOSED_TYPE_MEMBERS,
  D4_CURRENT_DEPENDENCY_NODES,
  D4_NODE_STATE_RESOLUTIONS,
  D4_RESOLUTION_MARKER,
  applyD4Reconciliation,
  getD4CurrentNode,
} from "../d4-reconciled-graph";
import { DEPENDENCY_NODES, EXTERNAL_ENTITY_COLUMNS, getDependencyNode } from "../dependency-graph";
import { assessD4SchemaAuthoringReadiness } from "../d4-readiness";
import { assessD3SchemaAuthoringReadiness } from "../d3-readiness";
import { REQUIRED_DEPENDENCY_OBJECTS } from "../codes";

describe("Stage D4 owner decisions", () => {
  it("resolves exactly the three Stage D3 finding codes and no fourth", () => {
    expect([...D4_RESOLVED_FINDING_CODES]).toEqual([...D3_DEFINITION_FINDING_CODES]);
    expect(LOCAL_REALITY_D4_DECISIONS).toHaveLength(3);
    expect(LOCAL_REALITY_D4_DECISIONS.map((d) => d.resolvesFindingCode)).toEqual([
      ...D3_DEFINITION_FINDING_CODES,
    ]);
    expect(LOCAL_REALITY_D4_DECISION_DATE).toBe("2026-08-30");
  });

  it("preserves the historical Stage D3 findings unchanged", () => {
    expect(D3_DEFINITION_FINDINGS).toHaveLength(3);
    expect(D3_DEFINITION_FINDINGS.map((f) => f.code)).toEqual([
      "occupation_status_members_not_frozen",
      "normalise_title_controlled_suffix_list_not_frozen",
      "programme_geog_index_without_column",
    ]);
  });

  it("reports zero current unresolved schema-definition findings", () => {
    expect([...D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS]).toEqual([]);
  });

  it("freezes occupation status members as exactly active|inactive", () => {
    expect([...OCCUPATION_STATUS_MEMBERS]).toEqual(["active", "inactive"]);
    expect(OCCUPATION_STATUS_DEFAULT_MEMBER).toBe("active");
    for (const forbidden of ["retired", "deprecated", "archived", "suspended", "unavailable"]) {
      expect([...OCCUPATION_STATUS_MEMBERS]).not.toContain(forbidden);
    }
    expect([...D4_CURRENT_CLOSED_TYPE_MEMBERS["occupation_status"]!]).toEqual([
      "active",
      "inactive",
    ]);
  });

  it("carries no participant, availability or judgement meaning in occupation status", () => {
    const text = JSON.stringify(LOCAL_REALITY_D4_DECISIONS).toLowerCase();
    expect(text).toContain("catalogue lifecycle only");
    expect(text).toContain("never real-world availability");
  });

  it("freezes exactly four canonical normalisation operations", () => {
    expect([...NORMALISE_TITLE_OPERATIONS]).toEqual([
      "lowercase",
      "remove_punctuation",
      "remove_diacritics",
      "collapse_whitespace",
    ]);
  });

  it("targets the spatial index at provider and opportunity only", () => {
    expect([...D4_SPATIAL_INDEX_TABLES]).toEqual(["provider", "opportunity"]);
    expect([...D4_SPATIAL_INDEX_TABLES]).not.toContain("programme");
    expect(PROGRAMME_HAS_SPATIAL_COLUMN).toBe(false);
  });

  it("keeps programme columns free of any spatial column", () => {
    const programme = EXTERNAL_ENTITY_COLUMNS.filter((c) => c.table === "programme");
    expect(programme.length).toBeGreaterThan(0);
    expect(programme.map((c) => c.column)).not.toContain("geog");
  });

  it("does not invent an import batch referential target", () => {
    const batchColumns = EXTERNAL_ENTITY_COLUMNS.filter((c) => c.column === "import_batch_id");
    expect(batchColumns).toHaveLength(3);
    for (const column of batchColumns) {
      expect(column.fkTarget).toBeNull();
      expect(column.fkTargetUnspecified).toBe(true);
    }
  });

  it("fails closed on an unknown resolved finding code", () => {
    // @ts-expect-error hostile: code outside the closed union
    expect(() => getD4Decision("something_else")).toThrow(/Unknown Stage D4/);
  });
});

describe("Stage D4 reconciled graph", () => {
  it("changes exactly four node states and nothing else", () => {
    expect(D4_NODE_STATE_RESOLUTIONS.map((r) => r.nodeKey).sort()).toEqual([
      "normalise_title",
      "occupation",
      "occupation_status",
      "programme",
    ]);
    for (const node of D4_CURRENT_DEPENDENCY_NODES) {
      const original = getDependencyNode(node.key);
      expect(node.classification).toBe(original.classification);
      expect([...node.dependsOn]).toEqual([...original.dependsOn]);
      const changed = D4_NODE_STATE_RESOLUTIONS.some((r) => r.nodeKey === node.key);
      if (!changed) expect(node.state).toBe(original.state);
    }
  });

  it("makes the four resolved nodes authorable", () => {
    for (const key of ["occupation_status", "normalise_title", "occupation", "programme"]) {
      expect(getD4CurrentNode(key).state).toBe("to_be_authored");
    }
  });

  it("keeps programme dependencies exact and free of spatial support", () => {
    expect([...getD4CurrentNode("programme").dependsOn]).toEqual([
      "source",
      "provider",
      "occupation",
      "route_archetype",
      "citext",
    ]);
    expect([...getD4CurrentNode("programme").dependsOn]).not.toContain("postgis");
  });

  it("keeps the six Stage D2 dependency objects exact", () => {
    expect([...REQUIRED_DEPENDENCY_OBJECTS]).toEqual([
      "source",
      "occupation",
      "route_archetype",
      "provider",
      "programme",
      "opportunity",
    ]);
  });

  it("justifies every state change with accepted resolved finding codes", () => {
    const byKey = Object.fromEntries(D4_NODE_STATE_RESOLUTIONS.map((r) => [r.nodeKey, r]));
    expect([...byKey["occupation_status"]!.becauseResolvedFindingCodes]).toEqual([
      "occupation_status_members_not_frozen",
    ]);
    expect([...byKey["normalise_title"]!.becauseResolvedFindingCodes]).toEqual([
      "normalise_title_controlled_suffix_list_not_frozen",
    ]);
    expect([...byKey["occupation"]!.becauseResolvedFindingCodes]).toEqual([
      "occupation_status_members_not_frozen",
      "normalise_title_controlled_suffix_list_not_frozen",
    ]);
    expect([...byKey["programme"]!.becauseResolvedFindingCodes]).toEqual([
      "programme_geog_index_without_column",
    ]);
    for (const resolution of D4_NODE_STATE_RESOLUTIONS) {
      expect(Object.isFrozen(resolution)).toBe(true);
      expect(Object.isFrozen(resolution.becauseResolvedFindingCodes)).toBe(true);
      expect(resolution.becauseResolvedFindingCodes.length).toBeGreaterThan(0);
      for (const code of resolution.becauseResolvedFindingCodes) {
        expect([...D4_RESOLVED_FINDING_CODES]).toContain(code);
      }
    }
  });

  it("fails closed on unjustified or unaccepted cause codes", () => {
    expect(() =>
      applyD4Reconciliation(DEPENDENCY_NODES, [
        { ...D4_NODE_STATE_RESOLUTIONS[0]!, becauseResolvedFindingCodes: Object.freeze([]) },
      ]),
    ).toThrow(/Unjustified Stage D4/);
    expect(() =>
      applyD4Reconciliation(DEPENDENCY_NODES, [
        {
          ...D4_NODE_STATE_RESOLUTIONS[0]!,
          // @ts-expect-error hostile: cause code outside the accepted D4 set
          becauseResolvedFindingCodes: Object.freeze(["made_up_finding"]),
        },
      ]),
    ).toThrow(/Unresolved Stage D4 cause code/);
  });

  it("never mutates the frozen Stage D3 catalogue and is deeply idempotent", () => {
    const before = JSON.stringify(DEPENDENCY_NODES);
    const once = applyD4Reconciliation();
    const twice = applyD4Reconciliation(once);
    const thrice = applyD4Reconciliation(twice);
    expect(JSON.stringify(DEPENDENCY_NODES)).toEqual(before);
    expect(getDependencyNode("programme").state).toBe("definition_blocked");
    expect(twice).toEqual(once);
    expect(JSON.stringify(twice)).toEqual(JSON.stringify(once));
    expect(JSON.stringify(thrice)).toEqual(JSON.stringify(once));
    for (const node of once) {
      const repeated = twice.find((entry) => entry.key === node.key)!;
      expect(repeated.note).toBe(node.note);
      expect([...repeated.dependsOn]).toEqual([...node.dependsOn]);
      expect(node.note.split(D4_RESOLUTION_MARKER)).toHaveLength(
        node.note.includes(D4_RESOLUTION_MARKER) ? 2 : 1,
      );
    }
    expect(Object.isFrozen(D4_CURRENT_DEPENDENCY_NODES)).toBe(true);
    expect(D4_CURRENT_DEPENDENCY_NODES.every((n) => Object.isFrozen(n))).toBe(true);
  });

  it("fails closed on conflicting existing D4 resolution metadata", () => {
    const tampered = D4_CURRENT_DEPENDENCY_NODES.map((node) =>
      node.key === "programme" ? { ...node, note: `${node.note} and something else` } : node,
    );
    expect(() => applyD4Reconciliation(tampered)).toThrow(/Conflicting Stage D4/);
  });

  it("fails closed on duplicate or unknown resolutions", () => {
    const duplicate = [...D4_NODE_STATE_RESOLUTIONS, D4_NODE_STATE_RESOLUTIONS[0]!];
    expect(() => applyD4Reconciliation(DEPENDENCY_NODES, duplicate)).toThrow(/Duplicate Stage D4/);
    const unknown = [
      {
        ...D4_NODE_STATE_RESOLUTIONS[0]!,
        nodeKey: "shadow_occupation",
      },
    ];
    expect(() => applyD4Reconciliation(DEPENDENCY_NODES, unknown)).toThrow(/Unknown Stage D4/);
    expect(() => getD4CurrentNode("nope")).toThrow(/Unknown current dependency node/);
  });
});

describe("Stage D4 readiness", () => {
  it("defaults to not ready while preflight capabilities are unverified", () => {
    const result = assessD4SchemaAuthoringReadiness();
    expect(result.graph.structurallyValid).toBe(true);
    expect(result.historicalD3FindingCount).toBe(3);
    expect([...result.currentUnresolvedDefinitionFindingCodes]).toEqual([]);
    expect(result.ownerDefinitionReconciliationComplete).toBe(true);
    expect([...result.definitionBlockedNodeKeys]).toEqual([]);
    expect([...result.unverifiedPreflightCapabilities]).toEqual([
      "citext",
      "pg_trgm",
      "immutable_history_enforcement",
    ]);
    expect(result.schemaAuthoringReady).toBe(false);
    expect(result.authorisationNote).toMatch(/separate owner gate/i);
  });

  it("becomes ready only when all three preflight capabilities are verified", () => {
    expect(
      assessD4SchemaAuthoringReadiness({ citextVerified: true, pgTrgmVerified: true })
        .schemaAuthoringReady,
    ).toBe(false);
    const ready = assessD4SchemaAuthoringReadiness({
      citextVerified: true,
      pgTrgmVerified: true,
      immutableHistoryEnforcementVerified: true,
    });
    expect(ready.schemaAuthoringReady).toBe(true);
    expect(ready.authorisationNote).toMatch(/never|separate owner gate/i);
    expect(Object.isFrozen(ready)).toBe(true);
  });

  it("leaves the Stage D3 assessor semantics untouched", () => {
    const d3 = assessD3SchemaAuthoringReadiness({
      citextVerified: true,
      pgTrgmVerified: true,
      immutableHistoryEnforcementVerified: true,
    });
    expect(d3.schemaAuthoringReady).toBe(false);
    expect([...d3.unresolvedDefinitionFindingCodes]).toHaveLength(3);
    expect([...d3.definitionBlockedNodeKeys]).toEqual([
      "normalise_title",
      "occupation",
      "occupation_status",
      "programme",
    ]);
  });
});
