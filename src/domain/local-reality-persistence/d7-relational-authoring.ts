/**
 * Increment 17, Stage D7 — RELATIONAL SCHEMA AUTHORING record.
 *
 * Pure declarative record of which frozen relational objects have been AUTHORED
 * as repository source, and which remain unauthored because their dependency
 * chain is blocked. Authoring is not application: nothing here claims that any
 * target project holds any of these objects, and nothing here authorises
 * application to any hosted database.
 *
 * Stage D1–D6 records are untouched and remain frozen history.
 */

import { D4_CURRENT_DEPENDENCY_NODES } from "./d4-reconciled-graph";

/** Version of the Stage D7 authoring record document itself. */
export const LOCAL_REALITY_D7_AUTHORING_VERSION = "1.2.0" as const;

/** Date the authoring record below was written (ISO calendar date). */
export const LOCAL_REALITY_D7_AUTHORING_DATE = "2026-08-31" as const;

/**
 * Stage D7 R1 reconciliation record. External inspection of the initial D7
 * authoring commit found confirmed drift from the frozen column authority
 * (`EXTERNAL_ENTITY_COLUMNS` in `dependency-graph.ts`) and from the inherited
 * v1.0 source read/index semantics. The corrections below were applied to the
 * authored source ONLY — no hosted database was contacted and nothing was
 * applied.
 *
 * PRESERVED HISTORY: this record states what R1 actually did, including its
 * one over-correction (removal of the provider id primary-key default), which
 * R2 later reconciled. It is deliberately not rewritten.
 */
export const D7_R1_RECONCILIATION = Object.freeze({
  reconciliationCode: "d7_r1_provider_source_failclosed" as const,
  inspectedCommit: "1d9a1ea8cd7dd37e0ea1e31b2fc7f21a02cf5242" as const,
  /** The provider column contract is read from this frozen authority, never re-stated. */
  columnAuthority: "EXTERNAL_ENTITY_COLUMNS" as const,
  corrections: Object.freeze([
    "provider now carries EXACTLY the frozen external-entity columns in contract order: invented created_at/updated_at columns and the provider touch trigger were removed.",
    "provider defaults were removed entirely (id, first_seen_at, status and timestamp defaults): the frozen contract states no provider defaults, so none are authored.",
    "provider nullability/type drift corrected: last_seen_at is NOT NULL, provider_type is NOT NULL, postcode_sector is extensions.citext, status is plain text NOT NULL with no invented vocabulary.",
    "source authenticated read policy no longer USING (true): inherited v1.0 semantics exclude withdrawn sources from authenticated reads while internal governance retains access via the existing helper.",
    "source carries the inherited state and authority_level indexes (canonical_url uniqueness already provides its unique index).",
    "fail-closed authoring: IF NOT EXISTS adoption of pre-existing D7 objects was replaced by an absence gate before any DDL plus direct CREATE, and self-verification now checks the exact provider frozen shape (columns, no defaults, no trigger).",
  ] as const),
  /** Authored source proves nothing about a target; application stays gated. */
  hostedApplyAuthorised: false as const,
});

/**
 * Stage D7 R2 reconciliation record. External inspection of the R1 state found
 * two remaining contract issues, corrected here without erasing the R1 record:
 * R1 is preserved verbatim above and this record explains the
 * global-vs-table-specific distinction it missed.
 */
export const D7_R2_RECONCILIATION = Object.freeze({
  reconciliationCode: "d7_r2_uuid_pk_default_and_local_snapshot" as const,
  inspectedCommit: "f3e55574cb7aacd7e15b4a969de4b819940087fd" as const,
  /** The authorities the R2 corrections are derived from, never re-stated. */
  columnAuthorities: Object.freeze([
    "EXTERNAL_ENTITY_COLUMNS",
    "PROPOSED_COLUMNS",
    "SNAPSHOT_FIELD_PROJECTIONS",
  ] as const),
  corrections: Object.freeze([
    "provider.id restored to the frozen GLOBAL relational convention default gen_random_uuid(): R1 correctly removed the invented table-specific business/lifecycle defaults but over-corrected the uuid primary key, whose default is a GLOBAL convention rather than a table-specific invention. Every other provider column still carries NO default.",
    "local_snapshot was wrongly deferred and is now authored: its frozen dependency chain is ONLY participant_profile + postgis + immutable_history_enforcement — all established/target-verified — so the already-authorised rule 'author every independent frozen object whose complete dependency chain is valid' requires it. It is authored to the exact frozen D1/D2 shape (PROPOSED_COLUMNS/SNAPSHOT_FIELD_PROJECTIONS, no extras), immutable via separate public.forbid_mutation() BEFORE UPDATE and BEFORE DELETE triggers that also protect against service_role mutation, with authenticated SELECT-only access under the established participant access pattern and inserts confined to the service-role/server boundary.",
    "local_snapshot_item remains deferred for its OWN reason: its typed references need the unauthored programme/opportunity/occupation chain. The blocked chain no longer contains local_snapshot and no longer implies a single shared blocker.",
  ] as const),
  /** Authored source proves nothing about a target; application stays gated. */
  hostedApplyAuthorised: false as const,
});

/**
 * Stage D7 R2.1 reconciliation record. External inspection of the R2 state
 * found one functional migration-time defect and one stale present-tense
 * comment. R1 and R2 remain intact above; this record is additive.
 */
export const D7_R2_1_RECONCILIATION = Object.freeze({
  reconciliationCode: "d7_r2_1_foundation_signature_and_stale_comment" as const,
  inspectedCommit: "36ac3b3bdd5163b2b3169afeaad5ddbbacebbf51" as const,
  /** The exact catalogue lookup the D7 precondition must use. */
  isInternalPrerequisiteLookup: "public.is_internal(public.internal_role)" as const,
  /** The frozen foundation declaration the lookup is derived from. */
  foundationDeclarationFragment: "_role public.internal_role DEFAULT NULL" as const,
  corrections: Object.freeze([
    "foundation-signature precondition fixed: the D7 prerequisite lookup checked to_regprocedure('public.is_internal()'), which never matches the foundation function's catalogue identity public.is_internal(public.internal_role) merely because its argument carries a default. That could have falsely blocked a future D7 apply. The lookup and its blocker text now use the exact declared signature; the intentional zero-argument CALLS public.is_internal() are valid via the default argument and are unchanged.",
    "stale present-tense programme comment removed: the D7_BLOCKED_CHAIN commentary claimed programme was also blocked by its own definition contradiction. Closed D4 resolved that (programme has no geog/PostGIS dependency), so programme is deferred solely because it references the unauthored occupation catalogue. Historical D3/D4 findings and the R1/R2 records are unchanged.",
  ] as const),
  /** Authored source proves nothing about a target; application stays gated. */
  hostedApplyAuthorised: false as const,
});

/**
 * The single authored relational-foundation source, held outside the applied
 * migration directory pending external inspection and a separate owner
 * hosted-apply gate. It is the intended TENTH migration in repository order.
 */
export const D7_AUTHORED_MIGRATION_PATH =
  "supabase/authored-migrations/20260831210000_stage-d7-local-reality-relational-foundation.sql" as const;

/** Intended ordinal position of the authored source in repository order. */
export const D7_AUTHORED_MIGRATION_ORDINAL = 10 as const;

/**
 * Closed Stage D7 authoring-status vocabulary. There is deliberately no
 * "applied" or "verified" member: this stage can only record that source exists.
 */
export const D7_AUTHORING_STATUSES = Object.freeze([
  "authored_not_applied",
  "not_authored_dependency_blocked",
] as const);
export type D7AuthoringStatus = (typeof D7_AUTHORING_STATUSES)[number];

export interface D7AuthoredObject {
  /** Dependency-graph node key, unchanged from the accepted architecture. */
  readonly nodeKey: string;
  readonly authoringStatus: D7AuthoringStatus;
  /** Path of the authored source covering the object, when authored. */
  readonly authoredIn: typeof D7_AUTHORED_MIGRATION_PATH | null;
  /** Why the object is unauthored. Null when it is authored. */
  readonly blockedReason: string | null;
  /**
   * MUST be false for every Stage D7 record: authoring proves nothing about
   * any target project, and no D7 object has been applied or verified there.
   */
  readonly targetProjectVerified: boolean;
}

const AUTHORED = (nodeKey: string): D7AuthoredObject =>
  Object.freeze({
    nodeKey,
    authoringStatus: "authored_not_applied" as D7AuthoringStatus,
    authoredIn: D7_AUTHORED_MIGRATION_PATH,
    blockedReason: null,
    targetProjectVerified: false,
  });

const BLOCKED = (nodeKey: string, blockedReason: string): D7AuthoredObject =>
  Object.freeze({
    nodeKey,
    authoringStatus: "not_authored_dependency_blocked" as D7AuthoringStatus,
    authoredIn: null,
    blockedReason,
    targetProjectVerified: false,
  });

/**
 * The MECHANISM blocker. The normalisation SEMANTICS are already accepted and
 * unchanged: lowercase, remove punctuation, remove diacritics, collapse
 * whitespace, with no morphological guessing of any kind. What is missing is an
 * owner-approved diacritic-removal MECHANISM. No extension is selected and no
 * character mapping is invented, so no immutable normalisation helper — and
 * therefore no generated canonical-title column — is authored.
 */
export const D7_NORMALISE_TITLE_MECHANISM_BLOCKER = Object.freeze({
  blockerCode: "normalise_title_diacritic_mechanism_not_approved" as const,
  nodeKey: "normalise_title" as const,
  requiresOwnerDecision: true,
  note: "The accepted operations are exactly lowercase, punctuation removal, diacritic removal and whitespace collapsing. A deterministic immutable implementation needs a diacritic-removal mechanism that has not been approved; none is selected, added or invented at this stage.",
});

/**
 * The exact chain that cannot be authored yet. Each node carries its OWN
 * accurate blocker, not one shared reason: normalise_title waits on the
 * mechanism owner decision; occupation waits on normalise_title; programme and
 * opportunity wait on the unauthored occupation catalogue they reference;
 * local_snapshot_item waits on the programme/opportunity/occupation chain for
 * its typed references. local_snapshot is NOT in this chain: R2 established
 * that its frozen dependencies (participant_profile, postgis,
 * immutable_history_enforcement) are all present, so it is authored.
 */

export const D7_BLOCKED_CHAIN: readonly string[] = Object.freeze([
  "normalise_title",
  "occupation",
  "programme",
  "opportunity",
  "local_snapshot_item",
]);

export const D7_AUTHORED_OBJECTS: readonly D7AuthoredObject[] = Object.freeze([
  AUTHORED("occupation_status"),
  AUTHORED("source_state"),
  AUTHORED("source_authority"),
  AUTHORED("evidence_scope"),
  AUTHORED("availability_confidence"),
  AUTHORED("source_type"),
  AUTHORED("opportunity_type"),
  AUTHORED("route_archetype"),
  AUTHORED("source"),
  AUTHORED("taxonomy_import_batch"),
  AUTHORED("provider"),
  AUTHORED("local_snapshot"),
  BLOCKED(
    "normalise_title",
    "No owner-approved diacritic-removal mechanism, so no deterministic immutable implementation can be authored.",
  ),
  BLOCKED(
    "occupation",
    "Its generated canonical-title columns depend on the unauthored normalisation helper.",
  ),
  BLOCKED("programme", "References the unauthored occupation catalogue."),
  BLOCKED("opportunity", "References the unauthored occupation catalogue."),
  BLOCKED(
    "local_snapshot_item",
    "Requires typed references to the unauthored programme and opportunity entities (themselves blocked on the occupation chain). Its parent local_snapshot is authored; this item table has its own distinct blocker.",
  ),
]);

export interface D7AuthoringAssessment {
  readonly allNodesAccountedFor: boolean;
  readonly authoredNodeKeys: readonly string[];
  readonly blockedNodeKeys: readonly string[];
  /** Always false at Stage D7: authored source proves nothing about a target. */
  readonly hostedApplyAuthorised: false;
}

/**
 * Deterministic fail-closed assessment. Every node of the accepted dependency
 * graph that this stage could author must appear in the record exactly once, and
 * no record may name a node outside the accepted graph.
 */
export function assessD7RelationalAuthoring(
  records: readonly D7AuthoredObject[] = D7_AUTHORED_OBJECTS,
): D7AuthoringAssessment {
  const graphKeys = new Set(D4_CURRENT_DEPENDENCY_NODES.map((entry) => entry.key));
  const seen = new Set<string>();
  for (const record of records) {
    if (!graphKeys.has(record.nodeKey)) {
      throw new Error(`Unknown Stage D7 node: ${record.nodeKey}`);
    }
    if (seen.has(record.nodeKey)) {
      throw new Error(`Duplicate Stage D7 node record: ${record.nodeKey}`);
    }
    seen.add(record.nodeKey);
    if (record.targetProjectVerified) {
      throw new Error(
        `Stage D7 record claims target verification, which authoring cannot prove: ${record.nodeKey}`,
      );
    }
    if (record.authoringStatus === "authored_not_applied") {
      if (record.authoredIn !== D7_AUTHORED_MIGRATION_PATH || record.blockedReason !== null) {
        throw new Error(`Malformed Stage D7 authored record: ${record.nodeKey}`);
      }
    } else if (record.authoredIn !== null || !record.blockedReason) {
      throw new Error(`Malformed Stage D7 blocked record: ${record.nodeKey}`);
    }
  }

  const authoredNodeKeys = Object.freeze(
    records.filter((r) => r.authoringStatus === "authored_not_applied").map((r) => r.nodeKey),
  );
  const blockedNodeKeys = Object.freeze(
    records
      .filter((r) => r.authoringStatus === "not_authored_dependency_blocked")
      .map((r) => r.nodeKey),
  );

  /**
   * Foundation anchors and preflight capabilities are established elsewhere and
   * are deliberately outside this authoring stage.
   */
  const outOfScope = new Set(
    D4_CURRENT_DEPENDENCY_NODES.filter(
      (entry) =>
        entry.classification === "foundation_anchor" ||
        entry.classification === "extension_or_capability" ||
        (entry.classification === "function_contract" && entry.key !== "normalise_title"),
    ).map((entry) => entry.key),
  );
  const allNodesAccountedFor = [...graphKeys].every((key) => outOfScope.has(key) || seen.has(key));

  return Object.freeze({
    allNodesAccountedFor,
    authoredNodeKeys,
    blockedNodeKeys,
    hostedApplyAuthorised: false as const,
  });
}
