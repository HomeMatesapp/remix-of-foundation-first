/**
 * Increment 17, Stage D3 — schema-authoring readiness assessor.
 *
 * Layered BESIDE the Stage D2 assessor, which keeps its own semantics unchanged.
 * D3 is stricter: it reports graph integrity separately from schema-authoring
 * readiness, and schema-authoring readiness fails closed while any unresolved
 * definition finding stands or any preflight capability is unverified.
 *
 * Readiness here is a CONTRACT statement about whether a definition could be
 * authored. It is never authorisation to apply a hosted relational change.
 */

import {
  DEPENDENCY_NODES,
  type DependencyNode,
  type GraphIntegrityResult,
  validateDependencyGraph,
} from "./dependency-graph";
import { D3_DEFINITION_FINDINGS, type D3DefinitionFindingCode } from "./definition-findings";

/**
 * Externally supplied capability verification. Every field defaults to
 * unverified; nothing here ever silently defaults to present.
 *
 * Spatial support is deliberately absent from this input: it is a documented
 * static foundation fact established by the existing prerequisite migration.
 */
export type D3PreflightCapabilityInput = {
  readonly citextVerified?: boolean;
  readonly pgTrgmVerified?: boolean;
  readonly immutableHistoryEnforcementVerified?: boolean;
};

/** Node keys requiring external capability verification before authoring. */
export const D3_PREFLIGHT_CAPABILITY_KEYS = Object.freeze([
  "citext",
  "pg_trgm",
  "immutable_history_enforcement",
] as const);
export type D3PreflightCapabilityKey = (typeof D3_PREFLIGHT_CAPABILITY_KEYS)[number];

export interface D3ReadinessResult {
  /** Structural integrity of the dependency graph, independent of readiness. */
  readonly graph: GraphIntegrityResult;
  /** True only when no finding stands AND every preflight capability is verified. */
  readonly schemaAuthoringReady: boolean;
  readonly unresolvedDefinitionFindingCodes: readonly D3DefinitionFindingCode[];
  readonly unverifiedPreflightCapabilities: readonly D3PreflightCapabilityKey[];
  readonly definitionBlockedNodeKeys: readonly string[];
  /**
   * Explicit reminder carried in the result so no caller can read readiness as
   * permission to change a hosted foundation.
   */
  readonly authorisationNote: string;
}

const AUTHORISATION_NOTE =
  "Contract-level statement only. Authoring or applying any relational change remains a separate owner gate; no such change has been authored or applied.";

export function assessD3SchemaAuthoringReadiness(
  capabilities: D3PreflightCapabilityInput = {},
  nodes: readonly DependencyNode[] = DEPENDENCY_NODES,
): D3ReadinessResult {
  const graph = validateDependencyGraph(nodes);

  const unresolvedDefinitionFindingCodes = Object.freeze(
    D3_DEFINITION_FINDINGS.map((finding) => finding.code),
  );

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

  return Object.freeze({
    graph,
    schemaAuthoringReady:
      graph.structurallyValid &&
      unresolvedDefinitionFindingCodes.length === 0 &&
      unverifiedPreflightCapabilities.length === 0 &&
      definitionBlockedNodeKeys.length === 0,
    unresolvedDefinitionFindingCodes,
    unverifiedPreflightCapabilities,
    definitionBlockedNodeKeys,
    authorisationNote: AUTHORISATION_NOTE,
  });
}
