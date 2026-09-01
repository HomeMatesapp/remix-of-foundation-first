/**
 * Increment 17, Stage D3 — RELATIONAL DEPENDENCY FOUNDATION contract.
 *
 * Encodes the exact transitive dependency graph that must exist before the
 * Stage D2-approved Local Reality tables could be authored.
 *
 * This is NOT a statement generator, NOT a migration, NOT live inspection of any
 * hosted foundation, and NOT authority to apply anything. Every capability claim
 * is either a documented static foundation fact or an externally supplied input.
 * Nothing here is created, substituted or shadowed: absent objects stay absent.
 */

import { QUALIFIED_POINT_TYPE_EXPECTATION } from "./manifest";

/** Version of the Stage D3 dependency-graph document itself. */
export const LOCAL_REALITY_D3_GRAPH_VERSION = "1.0.0" as const;

/** Node classifications. Governed vocabularies are TABLES, never enum types. */
export const DEPENDENCY_NODE_CLASSES = Object.freeze([
  "foundation_anchor",
  "extension_or_capability",
  "closed_type",
  "governed_vocabulary",
  "table",
  "function_contract",
] as const);
export type DependencyNodeClass = (typeof DEPENDENCY_NODE_CLASSES)[number];

/**
 * Node states.
 *
 * - `already_established_by_foundation`: documented static fact from the closed
 *   Increment 1 foundation and the existing explicit prerequisite migration.
 * - `requires_preflight`: must be verified or provided before authoring; never
 *   silently assumed present.
 * - `to_be_authored`: absent, and a later separately approved change would
 *   author it. Absence is never worked around.
 * - `definition_blocked`: cannot be authored at all until an owner freezes a
 *   definition recorded in `./definition-findings`.
 */
export const DEPENDENCY_NODE_STATES = Object.freeze([
  "already_established_by_foundation",
  "requires_preflight",
  "to_be_authored",
  "definition_blocked",
] as const);
export type DependencyNodeState = (typeof DEPENDENCY_NODE_STATES)[number];

export interface DependencyNode {
  readonly key: string;
  readonly classification: DependencyNodeClass;
  readonly state: DependencyNodeState;
  /** Direct dependencies by node key. Order is authored and stable. */
  readonly dependsOn: readonly string[];
  readonly note: string;
}

function node(entry: DependencyNode): DependencyNode {
  return Object.freeze({ ...entry, dependsOn: Object.freeze([...entry.dependsOn]) });
}

/**
 * Closed member vocabularies safe to record. `null` means the complete member
 * vocabulary is NOT frozen in the inspected authority and must not be guessed.
 */
export const CLOSED_TYPE_MEMBERS: Readonly<Record<string, readonly string[] | null>> =
  Object.freeze({
    availability_confidence: Object.freeze([
      "known_available",
      "uncertain",
      "known_scarce",
      "unknown",
    ] as const),
    evidence_scope: Object.freeze([
      "national",
      "regional",
      "provider_specific",
      "employer_specific",
    ] as const),
    source_state: Object.freeze([
      "healthy",
      "redirected",
      "suspect",
      "broken",
      "withdrawn",
      "under_review",
    ] as const),
    source_authority: Object.freeze([
      "primary_authoritative",
      "official_provider_employer",
      "strong_secondary",
      "exploratory",
    ] as const),
    occupation_status: null,
  });

/** Members whose declaration order carries no product meaning whatsoever. */
export const NON_ORDINAL_CLOSED_TYPES = Object.freeze(["availability_confidence"] as const);

/**
 * Column contract for the three external local entities, recorded exactly as the
 * final design states it. `fkTarget: null` with `fkTargetUnspecified: true` means
 * the design names no target and none may be invented.
 */
export interface ExternalEntityColumn {
  readonly table: "provider" | "programme" | "opportunity";
  readonly column: string;
  readonly typeExpectation: string;
  readonly nullable: boolean;
  readonly fkTarget: string | null;
  readonly fkTargetUnspecified?: true;
  readonly note?: string;
}

const SHARED_EXTERNAL_COLUMNS = (
  table: ExternalEntityColumn["table"],
): readonly ExternalEntityColumn[] => [
  { table, column: "id", typeExpectation: "uuid", nullable: false, fkTarget: null },
  { table, column: "source_id", typeExpectation: "uuid", nullable: false, fkTarget: "source" },
  { table, column: "source_record_key", typeExpectation: "text", nullable: false, fkTarget: null },
  {
    table,
    column: "first_seen_at",
    typeExpectation: "timestamptz",
    nullable: false,
    fkTarget: null,
  },
  {
    table,
    column: "last_seen_at",
    typeExpectation: "timestamptz",
    nullable: false,
    fkTarget: null,
  },
  {
    table,
    column: "last_verified_at",
    typeExpectation: "timestamptz",
    nullable: true,
    fkTarget: null,
  },
  {
    table,
    column: "import_batch_id",
    typeExpectation: "uuid",
    nullable: true,
    fkTarget: null,
    fkTargetUnspecified: true,
    note: "The final design declares no referential target for this field on this table. None may be invented, including `taxonomy_import_batch`.",
  },
];

export const EXTERNAL_ENTITY_COLUMNS: readonly ExternalEntityColumn[] = Object.freeze(
  [
    ...SHARED_EXTERNAL_COLUMNS("provider"),
    { table: "provider", column: "name", typeExpectation: "text", nullable: false, fkTarget: null },
    {
      table: "provider",
      column: "provider_type",
      typeExpectation: "text",
      nullable: false,
      fkTarget: null,
    },
    {
      table: "provider",
      column: "postcode_sector",
      typeExpectation: "citext",
      nullable: true,
      fkTarget: null,
      note: "Governed area-level value only; never a participant-supplied full location value.",
    },
    {
      table: "provider",
      column: "geog",
      typeExpectation: QUALIFIED_POINT_TYPE_EXPECTATION,
      nullable: true,
      fkTarget: null,
      note: "Established fact only; spatial GIST index expected.",
    },
    {
      table: "provider",
      column: "licence_reference",
      typeExpectation: "text",
      nullable: true,
      fkTarget: null,
    },
    {
      table: "provider",
      column: "status",
      typeExpectation: "text",
      nullable: false,
      fkTarget: null,
    },

    ...SHARED_EXTERNAL_COLUMNS("programme"),
    {
      table: "programme",
      column: "provider_id",
      typeExpectation: "uuid",
      nullable: false,
      fkTarget: "provider",
    },
    {
      table: "programme",
      column: "occupation_id",
      typeExpectation: "uuid",
      nullable: true,
      fkTarget: "occupation",
    },
    {
      table: "programme",
      column: "archetype_code",
      typeExpectation: "citext",
      nullable: true,
      fkTarget: "route_archetype",
    },
    {
      table: "programme",
      column: "title",
      typeExpectation: "text",
      nullable: false,
      fkTarget: null,
    },
    { table: "programme", column: "mode", typeExpectation: "text", nullable: true, fkTarget: null },
    {
      table: "programme",
      column: "duration_months",
      typeExpectation: "smallint",
      nullable: true,
      fkTarget: null,
    },
    {
      table: "programme",
      column: "status",
      typeExpectation: "text",
      nullable: false,
      fkTarget: null,
      note: "The final `programme` definition declares NO spatial column; see finding `programme_geog_index_without_column`.",
    },

    ...SHARED_EXTERNAL_COLUMNS("opportunity"),
    {
      table: "opportunity",
      column: "opportunity_type_code",
      typeExpectation: "citext",
      nullable: false,
      fkTarget: "opportunity_type",
    },
    {
      table: "opportunity",
      column: "occupation_id",
      typeExpectation: "uuid",
      nullable: true,
      fkTarget: "occupation",
    },
    {
      table: "opportunity",
      column: "archetype_code",
      typeExpectation: "citext",
      nullable: true,
      fkTarget: "route_archetype",
    },
    {
      table: "opportunity",
      column: "provider_id",
      typeExpectation: "uuid",
      nullable: true,
      fkTarget: "provider",
    },
    {
      table: "opportunity",
      column: "employer_name",
      typeExpectation: "text",
      nullable: true,
      fkTarget: null,
    },
    {
      table: "opportunity",
      column: "postcode_sector",
      typeExpectation: "citext",
      nullable: true,
      fkTarget: null,
    },
    {
      table: "opportunity",
      column: "geog",
      typeExpectation: QUALIFIED_POINT_TYPE_EXPECTATION,
      nullable: true,
      fkTarget: null,
      note: "Established fact only; spatial GIST index expected.",
    },
    {
      table: "opportunity",
      column: "title",
      typeExpectation: "text",
      nullable: false,
      fkTarget: null,
    },
    {
      table: "opportunity",
      column: "posted_on",
      typeExpectation: "date",
      nullable: true,
      fkTarget: null,
    },
    {
      table: "opportunity",
      column: "closes_on",
      typeExpectation: "date",
      nullable: true,
      fkTarget: null,
    },
    {
      table: "opportunity",
      column: "status",
      typeExpectation: "text",
      nullable: false,
      fkTarget: null,
      note: "Constrained to exactly active|expired|withdrawn. Absence of an opportunity never narrows a participant route.",
    },
  ].map((column) => Object.freeze(column)) as readonly ExternalEntityColumn[],
);

/**
 * Global relational rules every authored object must honour. Declarative only.
 */
export const D3_GLOBAL_RULES = Object.freeze([
  "Every public table is RLS-enabled.",
  "`service_role` receives full table privilege; `authenticated` receives explicit least-privilege grants plus policies; `anon` receives nothing anywhere.",
  "Referential actions default to restricting deletes; governed records are withdrawn, never deleted.",
  "Immutable historical tables are enforced by a foundation immutability helper, not by application code.",
  "Governed vocabularies are tables keyed by a stable code, never enum types.",
  "Every spatial type, function and operator is reached through the qualified `extensions` schema.",
] as const);

export const DEPENDENCY_NODES: readonly DependencyNode[] = Object.freeze([
  node({
    key: "internal_user",
    classification: "foundation_anchor",
    state: "already_established_by_foundation",
    dependsOn: [],
    note: "Established by the closed identity/tenancy foundation; governance identity for every governed table.",
  }),
  node({
    key: "participant_profile",
    classification: "foundation_anchor",
    state: "already_established_by_foundation",
    dependsOn: [],
    note: "Established by the closed identity foundation; parent of the participant Local Reality envelope.",
  }),
  node({
    key: "is_internal",
    classification: "function_contract",
    state: "already_established_by_foundation",
    dependsOn: ["internal_user"],
    note: "Established internal-access predicate supporting exactly the reconciled active internal roles viewer|editor|reviewer|approver|admin.",
  }),
  node({
    key: "postgis",
    classification: "extension_or_capability",
    state: "already_established_by_foundation",
    dependsOn: [],
    note: "The existing explicit prerequisite migration installs and verifies spatial support in the `extensions` schema. All spatial expectations stay extensions-qualified; no coordinate-maths fallback of any kind is permitted.",
  }),
  node({
    key: "citext",
    classification: "extension_or_capability",
    state: "requires_preflight",
    dependsOn: [],
    note: "Required by the governed code tables and canonical codes. NOT claimed present: capability must be supplied and verified externally.",
  }),
  node({
    key: "pg_trgm",
    classification: "extension_or_capability",
    state: "requires_preflight",
    dependsOn: [],
    note: "Required by the occupation title index design. NOT claimed present: capability must be supplied and verified externally.",
  }),
  node({
    key: "immutable_history_enforcement",
    classification: "function_contract",
    state: "requires_preflight",
    dependsOn: [],
    note: "Capability requirement only: the foundation must provide a mutation-forbidding helper for immutable historical tables. No executable implementation is authored or invented here.",
  }),
  node({
    key: "normalise_title",
    classification: "function_contract",
    state: "definition_blocked",
    dependsOn: [],
    note: "Deterministic immutable title-normalisation contract required by the generated occupation columns. Its controlled suffix list is not frozen, so it is neither implemented nor invented here.",
  }),
  node({
    key: "availability_confidence",
    classification: "closed_type",
    state: "to_be_authored",
    dependsOn: [],
    note: "Frozen named relational type with exactly the four Stage D2-approved non-ordinal members. Declaration order carries no product meaning.",
  }),
  node({
    key: "evidence_scope",
    classification: "closed_type",
    state: "to_be_authored",
    dependsOn: [],
    note: "Closed vocabulary: national|regional|provider_specific|employer_specific.",
  }),
  node({
    key: "source_state",
    classification: "closed_type",
    state: "to_be_authored",
    dependsOn: [],
    note: "Closed vocabulary retained unchanged by the amended design.",
  }),
  node({
    key: "source_authority",
    classification: "closed_type",
    state: "to_be_authored",
    dependsOn: [],
    note: "Closed vocabulary retained unchanged by the amended design and used by its requirement rules.",
  }),
  node({
    key: "occupation_status",
    classification: "closed_type",
    state: "definition_blocked",
    dependsOn: [],
    note: "The type and its default member `active` are frozen; the complete member vocabulary is not stated in the inspected authority and must not be invented.",
  }),
  node({
    key: "source_type",
    classification: "governed_vocabulary",
    state: "to_be_authored",
    dependsOn: ["internal_user", "citext"],
    note: "Governed text-code table, not an enum. No code values are seeded or invented at this stage.",
  }),
  node({
    key: "opportunity_type",
    classification: "governed_vocabulary",
    state: "to_be_authored",
    dependsOn: ["internal_user", "citext"],
    note: "Governed text-code table, not an enum. No code values are seeded or invented at this stage.",
  }),
  node({
    key: "route_archetype",
    classification: "governed_vocabulary",
    state: "to_be_authored",
    dependsOn: ["internal_user", "citext"],
    note: "Governed table keyed by a case-insensitive code, not an enum. No rows are seeded or invented at this stage.",
  }),
  node({
    key: "source",
    classification: "table",
    state: "to_be_authored",
    dependsOn: [
      "source_type",
      "evidence_scope",
      "source_state",
      "source_authority",
      "internal_user",
      "citext",
    ],
    note: "Final shape retains canonical url uniqueness, organisation, authority level, nullable licence reference, state defaulting to healthy, nullable last review timestamp and timestamps, with case-insensitive source type code and evidence scope. Sources are withdrawn, never deleted.",
  }),
  node({
    key: "taxonomy_import_batch",
    classification: "table",
    state: "to_be_authored",
    dependsOn: ["source", "internal_user"],
    note: "Adapter key, nullable source reference, nullable licence reference, record count defaulting to zero, importing internal user, nullable notes and a creation timestamp. Prerequisite of occupation because occupation references it.",
  }),
  node({
    key: "occupation",
    classification: "table",
    state: "definition_blocked",
    dependsOn: [
      "source",
      "taxonomy_import_batch",
      "internal_user",
      "occupation_status",
      "normalise_title",
      "citext",
      "pg_trgm",
    ],
    note: "Blocked while both the status member vocabulary and the normalisation suffix list remain unfrozen. Generated normalised-title and word-count columns depend on the deterministic normalisation contract; trigram index and active-title uniqueness are required.",
  }),
  node({
    key: "provider",
    classification: "table",
    state: "to_be_authored",
    dependsOn: ["source", "postgis", "citext"],
    note: "Externally sourced entity with composite source identity uniqueness and nullable established spatial point. Its import batch field has no stated referential target and none is invented.",
  }),
  node({
    key: "programme",
    classification: "table",
    state: "definition_blocked",
    dependsOn: ["source", "provider", "occupation", "route_archetype", "citext"],
    note: "Definition-blocked while finding `programme_geog_index_without_column` stands: the final definition declares NO spatial column, yet a spatial index is stated for it. No spatial column or dependency is synthesised and the stated index requirement is not silently dropped; the owner must reconcile the contradiction first.",
  }),
  node({
    key: "opportunity",
    classification: "table",
    state: "to_be_authored",
    dependsOn: [
      "source",
      "opportunity_type",
      "occupation",
      "route_archetype",
      "provider",
      "postgis",
      "citext",
    ],
    note: "Externally sourced entity with nullable established spatial point and a constrained lifecycle status. Absence of an opportunity never narrows a participant route.",
  }),
  node({
    key: "local_snapshot",
    classification: "table",
    state: "to_be_authored",
    dependsOn: ["participant_profile", "postgis", "immutable_history_enforcement"],
    note: "Stage D2-approved participant Local Reality envelope with nullable established centre point. Immutable history; no raw or normalised participant location value is ever stored.",
  }),
  node({
    key: "local_snapshot_item",
    classification: "table",
    state: "to_be_authored",
    dependsOn: [
      "local_snapshot",
      "source",
      "occupation",
      "route_archetype",
      "provider",
      "programme",
      "opportunity",
      "availability_confidence",
      "postgis",
      "immutable_history_enforcement",
    ],
    note: "Stage D2-approved item table. Every typed reference is a real constraint with restricting delete behaviour; there is no polymorphic identifier and no weakened constraint.",
  }),
]);

export const DEPENDENCY_NODE_KEYS: readonly string[] = Object.freeze(
  DEPENDENCY_NODES.map((entry) => entry.key),
);

function indexNodes(nodes: readonly DependencyNode[]): ReadonlyMap<string, DependencyNode> {
  const map = new Map<string, DependencyNode>();
  for (const entry of nodes) {
    if (map.has(entry.key)) throw new Error(`Duplicate dependency node: ${entry.key}`);
    map.set(entry.key, entry);
  }
  for (const entry of nodes) {
    for (const dependency of entry.dependsOn) {
      if (!map.has(dependency)) {
        throw new Error(`Unknown dependency \`${dependency}\` declared by node \`${entry.key}\``);
      }
      if (dependency === entry.key) {
        throw new Error(`Self dependency on node \`${entry.key}\``);
      }
    }
  }
  return map;
}

export function getDependencyNode(key: string): DependencyNode {
  const found = DEPENDENCY_NODES.find((entry) => entry.key === key);
  if (!found) throw new Error(`Unknown dependency node: ${key}`);
  return found;
}

/**
 * Deterministic topological order. Ready nodes are always taken in lexicographic
 * key order, so the result is independent of input array order. Fails closed on
 * duplicate nodes, unknown dependencies and cycles.
 */
export function topologicalOrder(
  nodes: readonly DependencyNode[] = DEPENDENCY_NODES,
): readonly string[] {
  const index = indexNodes(nodes);
  const remaining = new Map<string, Set<string>>();
  for (const entry of index.values()) remaining.set(entry.key, new Set(entry.dependsOn));

  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, deps]) => deps.size === 0)
      .map(([key]) => key)
      .sort();
    if (ready.length === 0) {
      throw new Error(
        `Dependency cycle detected among: ${[...remaining.keys()].sort().join(", ")}`,
      );
    }
    for (const key of ready) {
      ordered.push(key);
      remaining.delete(key);
    }
    for (const deps of remaining.values()) for (const key of ready) deps.delete(key);
  }
  return Object.freeze(ordered);
}

/**
 * Full transitive dependency closure of a node, in deterministic topological
 * order. Excludes the node itself.
 */
export function transitiveDependencies(
  key: string,
  nodes: readonly DependencyNode[] = DEPENDENCY_NODES,
): readonly string[] {
  const index = indexNodes(nodes);
  const start = index.get(key);
  if (!start) throw new Error(`Unknown dependency node: ${key}`);

  const collected = new Set<string>();
  const visit = (current: DependencyNode) => {
    for (const dependency of current.dependsOn) {
      if (collected.has(dependency)) continue;
      collected.add(dependency);
      visit(index.get(dependency)!);
    }
  };
  visit(start);
  const order = topologicalOrder(nodes);
  return Object.freeze(order.filter((entry) => collected.has(entry)));
}

export interface GraphIntegrityResult {
  readonly structurallyValid: boolean;
  readonly issues: readonly string[];
  readonly orderedNodeKeys: readonly string[];
}

/** Pure structural validation. Never throws for the canonical catalogue. */
export function validateDependencyGraph(
  nodes: readonly DependencyNode[] = DEPENDENCY_NODES,
): GraphIntegrityResult {
  try {
    const orderedNodeKeys = topologicalOrder(nodes);
    return Object.freeze({
      structurallyValid: true,
      issues: Object.freeze([] as readonly string[]),
      orderedNodeKeys,
    });
  } catch (error) {
    return Object.freeze({
      structurallyValid: false,
      issues: Object.freeze([error instanceof Error ? error.message : String(error)]),
      orderedNodeKeys: Object.freeze([] as readonly string[]),
    });
  }
}
