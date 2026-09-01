/**
 * Increment 17, Stage D4 — CURRENT schema-authoring readiness assessor.
 *
 * Layered BESIDE the Stage D2 and Stage D3 assessors, whose names and semantics
 * are unchanged. D4 reports the reconciled current position: the three Stage D3
 * definition findings are historical discovery, all resolved by owner decision,
 * so no current unresolved definition finding stands.
 *
 * `schemaAuthoringReady` is authority to AUTHOR a definition only, and never
 * authority to APPLY a hosted relational change; that remains a separate owner
 * gate. Preflight capabilities are never silently assumed verified.
 */

import {
  D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS,
  D4_RESOLVED_FINDING_CODES,
} from "./d4-decisions";
import { D4_CURRENT_DEPENDENCY_NODES } from "./d4-reconciled-graph";
import {
  type DependencyNode,
  type GraphIntegrityResult,
  validateDependencyGraph,
} from "./dependency-graph";
import { D3_DEFINITION_FINDINGS, type D3DefinitionFindingCode } from "./definition-findings";
import {
  D3_PREFLIGHT_CAPABILITY_KEYS,
  type D3PreflightCapabilityInput,
  type D3PreflightCapabilityKey,
} from "./d3-readiness";

export interface D4ReadinessResult {
  readonly graph: GraphIntegrityResult;
  /** Count of findings DISCOVERED at Stage D3, preserved as history. */
  readonly historicalD3FindingCount: number;
  readonly resolvedFindingCodes: readonly D3DefinitionFindingCode[];
  /** Current unresolved schema-definition findings: expected empty. */
  readonly currentUnresolvedDefinitionFindingCodes: readonly D3DefinitionFindingCode[];
  readonly ownerDefinitionReconciliationComplete: boolean;
  readonly unverifiedPreflightCapabilities: readonly D3PreflightCapabilityKey[];
  readonly definitionBlockedNodeKeys: readonly string[];
  /** True only with a valid graph, zero current findings and every preflight verified. */
  readonly schemaAuthoringReady: boolean;
  readonly authorisationNote: string;
}

const AUTHORISATION_NOTE =
  "Authoring-readiness statement only. Applying any hosted relational change remains a separate owner gate; no such change has been authored or applied.";

export function assessD4SchemaAuthoringReadiness(
  capabilities: D3PreflightCapabilityInput = {},
  nodes: readonly DependencyNode[] = D4_CURRENT_DEPENDENCY_NODES,
): D4ReadinessResult {
  const graph = validateDependencyGraph(nodes);

  const verified: Readonly<Record<D3PreflightCapabilityKey, boolean>> = {
    citext: capabilities.citextVerified === true,
    pg_trgm: capabilities.pgTrgmVerified === true,
    immutable_history_enforcement: capabilities.immutableHistoryEnforcementVerified === true,
  };
  const unverifiedPreflightCapabilities = Object.freeze(
    D3_PREFLIGHT_CAPABILITY_KEYS.filter((key) => !verified[key]),
  );

  const definitionBlockedNodeKeys = Object.freeze(
    nodes
      .filter((entry) => entry.state === "definition_blocked")
      .map((entry) => entry.key)
      .sort(),
  );

  const currentUnresolvedDefinitionFindingCodes = Object.freeze([
    ...D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS,
  ]);

  return Object.freeze({
    graph,
    historicalD3FindingCount: D3_DEFINITION_FINDINGS.length,
    resolvedFindingCodes: Object.freeze([...D4_RESOLVED_FINDING_CODES]),
    currentUnresolvedDefinitionFindingCodes,
    ownerDefinitionReconciliationComplete:
      currentUnresolvedDefinitionFindingCodes.length === 0 &&
      D4_RESOLVED_FINDING_CODES.length === D3_DEFINITION_FINDINGS.length,
    unverifiedPreflightCapabilities,
    definitionBlockedNodeKeys,
    schemaAuthoringReady:
      graph.structurallyValid &&
      currentUnresolvedDefinitionFindingCodes.length === 0 &&
      definitionBlockedNodeKeys.length === 0 &&
      unverifiedPreflightCapabilities.length === 0,
    authorisationNote: AUTHORISATION_NOTE,
  });
}
