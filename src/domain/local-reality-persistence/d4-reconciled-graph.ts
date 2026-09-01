/**
 * Increment 17, Stage D4 — CURRENT reconciled dependency view.
 *
 * Derived deterministically from the frozen Stage D3 catalogue. The D3 catalogue
 * is never mutated: it remains the historical record of what was known when D3
 * closed. This module produces a new frozen node list in which exactly the nodes
 * blocked by the three now-resolved findings become authorable.
 *
 * Pure data and pure derivation. No statement is emitted, no hosted state is
 * read or changed, and nothing is authorised.
 */

import {
  CLOSED_TYPE_MEMBERS,
  DEPENDENCY_NODES,
  type DependencyNode,
  type DependencyNodeState,
} from "./dependency-graph";
import { type D3DefinitionFindingCode } from "./definition-findings";
import { D4_RESOLVED_FINDING_CODES, OCCUPATION_STATUS_MEMBERS } from "./d4-decisions";

/** Version of the Stage D4 reconciled-view document itself. */
export const LOCAL_REALITY_D4_GRAPH_VERSION = "1.0.0" as const;

/** Exact marker that makes a Stage D4 resolution note recognisable and idempotent. */
export const D4_RESOLUTION_MARKER = " RESOLVED AT STAGE D4: " as const;

export interface D4NodeStateResolution {
  readonly nodeKey: string;
  readonly state: DependencyNodeState;
  /**
   * Every resolved D3 finding that unblocks this node. A node blocked by two
   * findings records both, in canonical D3 finding order. Nothing is invented:
   * each code must already be present in `D4_RESOLVED_FINDING_CODES`.
   */
  readonly becauseResolvedFindingCodes: readonly D3DefinitionFindingCode[];
  readonly note: string;
}

/**
 * The only node-state changes D4 makes. Classifications and dependency lists are
 * never altered here, so no dependency can be added or relaxed by reconciliation.
 */
export const D4_NODE_STATE_RESOLUTIONS: readonly D4NodeStateResolution[] = Object.freeze([
  Object.freeze({
    nodeKey: "occupation_status",
    state: "to_be_authored" as DependencyNodeState,
    becauseResolvedFindingCodes: Object.freeze([
      "occupation_status_members_not_frozen",
    ] as const) as readonly D3DefinitionFindingCode[],
    note: "Complete member vocabulary is now exactly `active | inactive`, default `active`, catalogue lifecycle only and never a participant or career statement.",
  }),
  Object.freeze({
    nodeKey: "normalise_title",
    state: "to_be_authored" as DependencyNodeState,
    becauseResolvedFindingCodes: Object.freeze([
      "normalise_title_controlled_suffix_list_not_frozen",
    ] as const) as readonly D3DefinitionFindingCode[],
    note: "Definition-ready: exactly lowercase, remove punctuation, remove diacritics, collapse whitespace. No morphological guessing of any kind belongs in canonical identity.",
  }),
  Object.freeze({
    nodeKey: "occupation",
    state: "to_be_authored" as DependencyNodeState,
    becauseResolvedFindingCodes: Object.freeze([
      "occupation_status_members_not_frozen",
      "normalise_title_controlled_suffix_list_not_frozen",
    ] as const) as readonly D3DefinitionFindingCode[],
    note: "Both definition blockers on this table are resolved. Its dependency list is unchanged.",
  }),
  Object.freeze({
    nodeKey: "programme",
    state: "to_be_authored" as DependencyNodeState,
    becauseResolvedFindingCodes: Object.freeze([
      "programme_geog_index_without_column",
    ] as const) as readonly D3DefinitionFindingCode[],
    note: "Resolved in favour of the table definition: no spatial column and no spatial dependency; the spatial index requirement covers provider and opportunity only.",
  }),
] as const);

/**
 * Current closed-type member vocabularies. Identical to the D3 record except
 * that `occupation_status` is now frozen by owner decision.
 */
export const D4_CURRENT_CLOSED_TYPE_MEMBERS: Readonly<Record<string, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(CLOSED_TYPE_MEMBERS).map(([key, members]) => [
        key,
        key === "occupation_status" ? OCCUPATION_STATUS_MEMBERS : Object.freeze([...members!]),
      ]),
    ),
  );

/**
 * Deterministic, non-mutating, FULLY IDEMPOTENT reconciliation. Applying it to an
 * already-reconciled catalogue deep-equals a single application: an already
 * resolved node is returned unchanged rather than accumulating another marker.
 *
 * Fails closed on an unknown node key, a duplicate resolution mapping, a
 * resolution justified by no code or by a code outside the accepted D4 set, and
 * on conflicting or malformed existing D4 resolution metadata.
 */
export function applyD4Reconciliation(
  nodes: readonly DependencyNode[] = DEPENDENCY_NODES,
  resolutions: readonly D4NodeStateResolution[] = D4_NODE_STATE_RESOLUTIONS,
): readonly DependencyNode[] {
  const byKey = new Map<string, D4NodeStateResolution>();
  for (const resolution of resolutions) {
    if (byKey.has(resolution.nodeKey)) {
      throw new Error(`Duplicate Stage D4 node resolution: ${resolution.nodeKey}`);
    }
    if (!nodes.some((entry) => entry.key === resolution.nodeKey)) {
      throw new Error(`Unknown Stage D4 resolution node: ${resolution.nodeKey}`);
    }
    if (resolution.becauseResolvedFindingCodes.length === 0) {
      throw new Error(`Unjustified Stage D4 node resolution: ${resolution.nodeKey}`);
    }
    for (const code of resolution.becauseResolvedFindingCodes) {
      if (!D4_RESOLVED_FINDING_CODES.includes(code)) {
        throw new Error(`Unresolved Stage D4 cause code: ${code}`);
      }
    }
    byKey.set(resolution.nodeKey, resolution);
  }

  return Object.freeze(
    nodes.map((entry) => {
      const resolution = byKey.get(entry.key);
      if (!resolution) return entry;
      const suffix = `${D4_RESOLUTION_MARKER}${resolution.note}`;
      if (entry.note.includes(D4_RESOLUTION_MARKER)) {
        if (entry.state === resolution.state && entry.note.endsWith(suffix)) return entry;
        throw new Error(`Conflicting Stage D4 resolution metadata on node: ${entry.key}`);
      }
      return Object.freeze({
        ...entry,
        state: resolution.state,
        dependsOn: Object.freeze([...entry.dependsOn]),
        note: `${entry.note}${suffix}`,
      });
    }),
  );
}

/** The current reconciled node catalogue. */
export const D4_CURRENT_DEPENDENCY_NODES: readonly DependencyNode[] = applyD4Reconciliation();

export function getD4CurrentNode(key: string): DependencyNode {
  const found = D4_CURRENT_DEPENDENCY_NODES.find((entry) => entry.key === key);
  if (!found) throw new Error(`Unknown current dependency node: ${key}`);
  return found;
}
