/**
 * Increment 17, Stage D9 — OWNER ARCHITECTURE RECONCILIATION record:
 * application-computed, database-stored `occupation.title_normalised`.
 *
 * Pure data and pure derivation. Nothing here reads, writes, executes or
 * authorises anything. Recording a decision is NOT authority to apply a hosted
 * relational change.
 *
 * HISTORY IS PRESERVED. Stage D1–D8 records are untouched:
 *   * Stage D4 still records the original generated-column mechanism decision;
 *   * Stage D7 still records `occupation` blocked on `normalise_title`;
 *   * Stage D8 still records the `unaccent` wrapper as BLOCKED / NOT PROVEN.
 * This stage states only what is CURRENT, additively.
 */

import { D4_CURRENT_DEPENDENCY_NODES } from "./d4-reconciled-graph";
import { type DependencyNode } from "./dependency-graph";
import { assessD8UnaccentWrapperProof } from "./d8-unaccent-wrapper-proof";
import { D7_AUTHORED_MIGRATION_PATH } from "./d7-relational-authoring";
import {
  CANONICAL_TITLE_OPERATION_ORDER,
  CANONICAL_TITLE_UNICODE_MECHANISM,
  normaliseCanonicalTitle,
} from "./d9-canonical-title";

/** Version of the Stage D9 decision record document itself. */
export const LOCAL_REALITY_D9_DECISION_VERSION = "1.0.0" as const;

/** Date the product owner accepted the decision below (ISO calendar date). */
export const LOCAL_REALITY_D9_DECISION_DATE = "2026-09-01" as const;

/**
 * The owner-approved superseding architecture decision. It supersedes ONLY the
 * earlier D4/D7 generated-column MECHANISM decision. It does not relax the
 * normalisation behaviour and it authorises no hosted application.
 */
export const D9_OWNER_ARCHITECTURE_DECISION = Object.freeze({
  decisionCode: "d9_application_computed_title_normalised" as const,
  approved: true as const,
  supersedes: Object.freeze([
    "D4: canonical normalisation implemented as a database normalise_title() function.",
    "D7: occupation authoring blocked because its generated canonical-title column depends on that database function.",
  ] as const),
  decision:
    "Clear Routes application/domain code computes the canonical normalised title BEFORE persistence. The database stores that supplied canonical value in an ordinary NOT NULL column and continues to enforce its uniqueness/search/index constraints. No database normalise_title() function is required, authored or permitted." as const,
  /** Behaviour is unchanged: exactly the frozen four operations, in order. */
  normalisationBehaviourChanged: false as const,
  operationOrder: CANONICAL_TITLE_OPERATION_ORDER,
  /** Explicitly still withheld. */
  hostedApplyAuthorised: false as const,
  hostedSchemaApplicationAuthorised: false as const,
});

/**
 * What the decision changes about previously recorded state, stated exactly and
 * additively. Nothing below rewrites a historical record.
 */
export const D9_RECONCILIATION = Object.freeze({
  reconciledAt: LOCAL_REALITY_D9_DECISION_DATE,
  entries: Object.freeze([
    Object.freeze({
      code: "d9_d4_mechanism_superseded" as const,
      preservedHistory:
        "Stage D4 recorded the canonical normalisation contract and, with it, a database normalise_title() implementation as the mechanism. That record stands unchanged as history.",
      current:
        "The four-operation contract remains exactly as D4 froze it. Only the place of computation moved: it is now the pure application/domain normaliser.",
    }),
    Object.freeze({
      code: "d9_normalise_title_no_longer_required" as const,
      preservedHistory:
        "Stage D7 recorded normalise_title as blocked on an unapproved diacritic-removal mechanism, and occupation as blocked on normalise_title.",
      current:
        "The database function normalise_title() is NO LONGER REQUIRED and must not be authored. Occupation is therefore no longer blocked on it.",
    }),
    Object.freeze({
      code: "d9_unaccent_remains_rejected" as const,
      preservedHistory:
        "Stage D8 R1 recorded the unaccent immutable-wrapper design as BLOCKED / NOT PROVEN.",
      current:
        "unaccent remains rejected and blocked for generated-column use. It does not return as a dependency of any node, and no accent extension is added to any migration.",
    }),
  ] as const),
});

/** The database function that must NOT be authored under the current decision. */
export const D9_FORBIDDEN_DATABASE_OBJECTS: readonly string[] = Object.freeze([
  "normalise_title",
  "unaccent",
  "clear_routes_unaccent",
]);

/**
 * Where integrity now lives. Stated exactly, because moving computation must not
 * weaken the database contract.
 */
export const D9_INTEGRITY_MODEL = Object.freeze({
  applicationBoundary: Object.freeze([
    "Exactly one normaliser exists in application code: normaliseCanonicalTitle.",
    "Occupation write paths obtain title_normalised only from buildOccupationTitleWriteValues, which derives it from canonical_title.",
    "A write carrying an externally supplied title_normalised must pass assertOccupationTitleWriteValues, which fails closed on any value that is not exactly the canonical derivation.",
    "A canonical_title that is blank, or that normalises to an empty canonical identity, is rejected before persistence.",
  ] as const),
  databaseAuthoritative: Object.freeze([
    "title_normalised text NOT NULL, stored as an ordinary column (never GENERATED).",
    "canonical_title text NOT NULL, stored exactly as authored.",
    "The frozen uniqueness rule on active title_normalised remains authoritative in the database.",
    "The frozen trigram search indexes remain authoritative in the database.",
  ] as const),
  /**
   * Deliberately NOT done: a database trigger that reimplements normalisation
   * would recreate the dual-source-of-truth problem this decision removes, and
   * is not owner-approved.
   */
  databaseNormalisationTrigger: false as const,
  databaseGeneratedTitleColumn: false as const,
});

/**
 * Current dependency view: `occupation` no longer depends on `normalise_title`.
 * Derived from the D4 current catalogue, which is never mutated. Node states and
 * every other dependency list are left exactly as they were.
 */
export function applyD9DependencyReconciliation(
  nodes: readonly DependencyNode[] = D4_CURRENT_DEPENDENCY_NODES,
): readonly DependencyNode[] {
  return Object.freeze(
    nodes.map((entry) => {
      if (entry.key !== "occupation") return entry;
      const dependsOn = entry.dependsOn.filter((key) => key !== "normalise_title");
      if (dependsOn.length === entry.dependsOn.length) return entry;
      return Object.freeze({ ...entry, dependsOn: Object.freeze(dependsOn) });
    }),
  );
}

/** The current reconciled node catalogue after Stage D9. */
export const D9_CURRENT_DEPENDENCY_NODES: readonly DependencyNode[] =
  applyD9DependencyReconciliation();

export function getD9CurrentNode(key: string): DependencyNode {
  const found = D9_CURRENT_DEPENDENCY_NODES.find((entry) => entry.key === key);
  if (!found) throw new Error(`Unknown current dependency node: ${key}`);
  return found;
}

/**
 * HISTORY — the ORIGINAL Stage D9 occupation blocker, exactly as first recorded.
 *
 * External inspection of the D9 commit found this blocker OVERSTATED: the
 * approved ERD v1.1 record already freezes occupation's complete column list,
 * nullability, FKs, status default, the exact active-title partial-uniqueness
 * predicate, the family/sector indexes, the title_normalised GIN trigram index
 * and the write authority. This record is preserved as history only and is NOT
 * the current blocker. See `D9_R1_OCCUPATION_AUTHORING_BLOCKER` below.
 */
export const D9_OCCUPATION_AUTHORING_BLOCKER_SUPERSEDED_R1 = Object.freeze({
  blockerCode: "occupation_column_contract_not_enumerated" as const,
  nodeKey: "occupation" as const,
  status: "superseded_overstated" as const,
  supersededBy: "occupation_title_word_count_generated_expression_not_frozen" as const,
  note: "HISTORICAL / OVERSTATED. Claimed that occupation's complete frozen column list and exact partial-uniqueness predicate were unenumerated. The approved ERD v1.1 record already freezes both." as const,
});

/**
 * D9 R1 — what the approved ERD v1.1 record (section 2.1, occupation) ALREADY
 * freezes. Recorded so no later stage may again claim these are unspecified.
 * This is a transcription of already-approved authority, not a new decision.
 */
export const D9_R1_OCCUPATION_FROZEN_BY_ERD = Object.freeze({
  sourceRecord: "ERD Specification v1.1 FINAL, section 2.1 (occupation)" as const,
  columns: Object.freeze([
    "id",
    "code citext NOT NULL UNIQUE",
    "canonical_title text NOT NULL",
    "title_normalised text NOT NULL (ordinary stored column under D9; GENERATED mechanism superseded)",
    "title_word_count smallint NOT NULL GENERATED",
    "description text NULL",
    "family text NULL",
    "sector text NULL",
    "regulatory_classification text NULL",
    "status occupation_status NOT NULL DEFAULT 'active'",
    "taxonomy_source_id uuid NULL FK source",
    "taxonomy_external_ref text NULL",
    "import_batch_id uuid NULL FK taxonomy_import_batch",
    "maintained_by uuid NULL FK internal_user",
    "created_at / updated_at timestamps",
  ] as const),
  constraints: Object.freeze([
    "UNIQUE(code)",
    "UNIQUE(title_normalised) WHERE status = 'active'",
  ] as const),
  indexes: Object.freeze([
    "index(family)",
    "index(sector)",
    "GIN trigram index on title_normalised",
  ] as const),
  writeAuthority: "is_internal('approver') only" as const,
  /** Explicitly: these are frozen. No stage may report them as unenumerated. */
  columnListFrozen: true as const,
  activeTitlePartialUniquenessPredicateFrozen: true as const,
});

/**
 * D9 R1 — the EXACT and only remaining occupation-definition gap.
 *
 * The ERD freezes `title_word_count smallint NOT NULL GENERATED` but does not
 * enumerate its generated expression/derivation. The D9 owner approval moved
 * only WHERE `title_normalised` is computed; it did NOT supersede
 * `title_word_count` being a database-generated column. This stage therefore
 * neither invents the expression nor quietly moves it into application code.
 */
export const D9_R1_OCCUPATION_AUTHORING_BLOCKER = Object.freeze({
  blockerCode: "occupation_title_word_count_generated_expression_not_frozen" as const,
  nodeKey: "occupation" as const,
  requiresOwnerDecision: true as const,
  titleWordCountRemainsDatabaseGenerated: true as const,
  note: "The approved ERD freezes title_word_count as smallint NOT NULL GENERATED but does not enumerate its exact generated expression. That expression is not chosen or authored here, and it is not silently converted to an application-computed value. Every other occupation column, nullability, FK, status default, the active-title partial-uniqueness predicate, the family/sector indexes, the title_normalised trigram index and the is_internal('approver') write authority are already frozen by the approved ERD. This is the sole reason occupation SQL remains unauthored." as const,
});

/** Additive R1 reconciliation record for Stage D9. */
export const D9_R1_RECONCILIATION = Object.freeze({
  reconciledAt: "2026-09-01" as const,
  inspectedCommit: "f7a0ac43dbc7c8040ba2df2b1d52ffb2359b32ba" as const,
  finding:
    "The application normalisation implementation is materially sound and is left unchanged. The occupation authoring blocker was overstated." as const,
  corrections: Object.freeze([
    "The overstated blocker occupation_column_contract_not_enumerated is superseded and retained as history only.",
    "The exact narrow blocker is occupation_title_word_count_generated_expression_not_frozen.",
    "All other occupation columns, nullability, FKs, status default, active-title partial uniqueness, family/sector indexes, title_normalised trigram index and write authority are recorded as already frozen by the approved ERD v1.1.",
    "title_word_count remains database-generated; its expression is deliberately not chosen in R1.",
  ] as const),
  normaliserChanged: false as const,
  persistenceGuardsChanged: false as const,
  d8HistoryChanged: false as const,
  occupationSqlAuthored: false as const,
  hostedApplyAuthorised: false as const,
  targetProjectVerified: false as const,
});

/** Occupation SQL was deliberately NOT authored at Stage D9 or its R1. */
export const D9_OCCUPATION_SQL_AUTHORED = false as const;

/** Repository migration facts this stage must not change. */
export const D9_MIGRATION_FACTS = Object.freeze({
  managedMigrationCount: 9 as const,
  authoredOutsideManagedMigrations: D7_AUTHORED_MIGRATION_PATH,
  newAuthoredSourceAdded: false as const,
});

export interface D9Assessment {
  /** True when the application-computed normalisation contract holds exactly. */
  readonly applicationNormalisationProven: boolean;
  readonly occupationBlockedOnNormaliseTitle: boolean;
  readonly occupationBlockedOnUnaccent: boolean;
  readonly databaseNormaliseTitleRequired: false;
  readonly occupationSqlAuthored: false;
  readonly d8RemainsBlocked: boolean;
  readonly hostedApplyAuthorised: false;
  readonly remainingBlockers: readonly string[];
}

/**
 * Deterministic fail-closed assessment of Stage D9. It proves the contract by
 * exercising the pure normaliser against hostile inputs, and reports the
 * remaining (non-normalisation) blockers.
 */
export function assessD9ApplicationNormalisation(): D9Assessment {
  const remaining: string[] = [D9_R1_OCCUPATION_AUTHORING_BLOCKER.note];

  const contractHolds =
    normaliseCanonicalTitle("Nurse—Practitioner") === "nurse practitioner" &&
    normaliseCanonicalTitle("Café Manager") === "cafe manager" &&
    normaliseCanonicalTitle("  Senior   Développeur  ") === "senior developpeur" &&
    normaliseCanonicalTitle("nurses") === "nurses" &&
    CANONICAL_TITLE_UNICODE_MECHANISM.unaccentUsed === false &&
    CANONICAL_TITLE_UNICODE_MECHANISM.transliterationMap === null;

  if (!contractHolds) {
    remaining.push("The application canonical-title contract does not hold exactly.");
  }
  if (D9_INTEGRITY_MODEL.databaseNormalisationTrigger) {
    remaining.push("A database normalisation trigger would recreate a dual source of truth.");
  }

  const occupation = getD9CurrentNode("occupation");
  const d8 = assessD8UnaccentWrapperProof();

  return Object.freeze({
    applicationNormalisationProven: contractHolds,
    occupationBlockedOnNormaliseTitle: occupation.dependsOn.includes("normalise_title"),
    occupationBlockedOnUnaccent: occupation.dependsOn.includes("unaccent"),
    databaseNormaliseTitleRequired: false as const,
    occupationSqlAuthored: false as const,
    d8RemainsBlocked: d8.wrapperDesignProven === false && d8.blockers.length > 0,
    hostedApplyAuthorised: false as const,
    remainingBlockers: Object.freeze(remaining),
  });
}
