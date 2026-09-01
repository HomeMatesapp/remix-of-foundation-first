/**
 * Increment 17, Stage D10 — `occupation.title_word_count` GENERATED EXPRESSION,
 * and the occupation authoring decision that depends on it.
 *
 * Pure data and pure derivation. Nothing here reads, writes, executes or
 * authorises anything. Recording a decision or authoring SQL source is NOT
 * authority to apply any hosted relational change.
 *
 * HISTORY IS PRESERVED ADDITIVELY. Stage D1–D9 records are untouched:
 *   * D4 still records the original database generated-normalisation mechanism;
 *   * D7 still records occupation as unauthored and blocked;
 *   * D8 still records the `unaccent` wrapper as BLOCKED / NOT PROVEN;
 *   * D9/D9 R1 still record application-computed `title_normalised` and the
 *     narrow `title_word_count` blocker.
 * This stage states only what is CURRENT.
 */

import { normaliseCanonicalTitle } from "./d9-canonical-title";
import {
  D9_R1_OCCUPATION_AUTHORING_BLOCKER,
  D9_R1_OCCUPATION_FROZEN_BY_ERD,
} from "./d9-application-normalisation";

/** Version of the Stage D10 decision/authoring record document itself. */
export const LOCAL_REALITY_D10_RECORD_VERSION = "1.0.0" as const;

/** Date the product owner accepted the decision below (ISO calendar date). */
export const LOCAL_REALITY_D10_DECISION_DATE = "2026-09-01" as const;

/**
 * The owner-approved narrow technical decision. It resolves EXACTLY the D9 R1
 * blocker and nothing else. It is not a product decision, not a search or
 * ranking rule, and it grants no hosted authority.
 */
export const D10_OWNER_TITLE_WORD_COUNT_DECISION = Object.freeze({
  decisionCode: "d10_title_word_count_canonical_space_split" as const,
  approved: true as const,
  scope: "narrow_technical_only" as const,
  resolvesBlocker: D9_R1_OCCUPATION_AUTHORING_BLOCKER.blockerCode,
  semantics:
    "title_word_count is the number of canonical words in the already-canonical stored title_normalised, obtained by splitting on the single ASCII space that D9 guarantees is the only inter-word separator." as const,
  /** Unchanged by this stage: the column stays database-generated. */
  remainsDatabaseGenerated: true as const,
  storageType: "smallint NOT NULL GENERATED ALWAYS AS (...) STORED" as const,
  hostedApplyAuthorised: false as const,
  hostedSchemaApplicationAuthorised: false as const,
});

/**
 * The EXACT frozen generated expression, stated once. The authored SQL must
 * contain this string verbatim; no other derivation exists.
 *
 * Only built-in, immutable PostgreSQL primitives are used:
 *   * `string_to_array(text, text)` — IMMUTABLE
 *   * `array_length(anyarray, int)` — IMMUTABLE
 *   * a plain CASE expression and a plain cast
 * There is no regular expression, no `unaccent`, no custom function, no
 * re-normalisation and no duplication of the D9 canonical normaliser in SQL.
 */
export const D10_TITLE_WORD_COUNT_EXPRESSION =
  "(CASE WHEN title_normalised = '' THEN 0 ELSE array_length(string_to_array(title_normalised, ' '), 1) END)::smallint" as const;

/** Everything the expression is permitted to depend on. Exactly one column. */
export const D10_TITLE_WORD_COUNT_DEPENDENCIES: readonly string[] = Object.freeze([
  "title_normalised",
]);

/** Built-in primitives actually used, recorded exactly. */
export const D10_TITLE_WORD_COUNT_PRIMITIVES: readonly string[] = Object.freeze([
  "string_to_array",
  "array_length",
  "CASE",
  "::smallint",
]);

/** Explicit prohibitions on the generated expression. */
export const D10_TITLE_WORD_COUNT_PROHIBITIONS = Object.freeze([
  "No regular expression of any kind (no regexp_matches, regexp_split_to_array, regexp_replace).",
  "No unaccent, clear_routes_unaccent or any diacritic mechanism.",
  "No normalise_title or any other custom database function.",
  "No re-normalisation: the stored canonical title_normalised is trusted as canonical.",
  "No duplication of the D9 canonical normaliser in SQL.",
  "No morphology, singularisation, stemming or lemmatisation.",
  "No dependency on any column other than title_normalised.",
  "No new CHECK constraint on title_normalised: the application persistence boundary rejects blank and non-normalisable canonical titles.",
] as const);

/**
 * Defensive empty-string behaviour, decided explicitly rather than left to
 * produce a nonsensical value. `string_to_array('', ' ')` yields `{""}` in
 * PostgreSQL, whose length is 1 — which would wrongly report one word for an
 * empty title. The CASE arm therefore returns 0 for the empty string.
 *
 * This is defence in depth only: the D9 persistence boundary already rejects a
 * canonical title that normalises to an empty identity, so the arm is expected
 * to be unreachable in practice.
 */
export const D10_EMPTY_STRING_BEHAVIOUR = Object.freeze({
  input: "" as const,
  wordCount: 0 as const,
  rationale:
    "string_to_array('', ' ') returns a one-element array containing the empty string, so an unguarded array_length would report 1 word for a title with no words. The explicit CASE arm returns 0 instead." as const,
  guardedInSql: true as const,
  reachableInPractice: false as const,
  newCheckConstraintAdded: false as const,
});

/**
 * The frozen semantic examples, including the owner's required examples. These
 * are proved both by the pure application mirror below and by string equality
 * against the authored SQL expression.
 */
export const D10_TITLE_WORD_COUNT_EXAMPLES = Object.freeze([
  Object.freeze({ titleNormalised: "registered nurse", wordCount: 2 }),
  Object.freeze({ titleNormalised: "software engineer", wordCount: 2 }),
  Object.freeze({ titleNormalised: "health and safety officer", wordCount: 4 }),
  Object.freeze({ titleNormalised: "electrician", wordCount: 1 }),
  Object.freeze({ titleNormalised: "", wordCount: 0 }),
] as const);

/**
 * Pure application mirror of the frozen SQL expression, provided so the
 * semantics can be proved deterministically in tests without a database. It is
 * NOT a second source of truth: the database column remains generated, and this
 * function is never used to supply a persisted value.
 *
 * It deliberately assumes canonical input, exactly like the SQL expression.
 */
export function countCanonicalTitleWords(titleNormalised: string): number {
  if (titleNormalised === "") return 0;
  return titleNormalised.split(" ").length;
}

/** True when `title` is canonical and its mirrored word count matches `expected`. */
export function isCanonicalWordCount(title: string, expected: number): boolean {
  return (
    normaliseCanonicalTitle(title) === title && countCanonicalTitleWords(title) === expected
  );
}

/** `title_normalised` remains an ordinary application-supplied stored column. */
export const D10_TITLE_NORMALISED_STORAGE = Object.freeze({
  column: "title_normalised" as const,
  sqlType: "text" as const,
  notNull: true as const,
  generated: false as const,
  suppliedBy: "application persistence boundary (D9 buildOccupationTitleWriteValues)" as const,
});

/** Where the authored Stage D10 SQL source lives. NOT a managed migration. */
export const D10_AUTHORED_MIGRATION_PATH =
  "supabase/authored-migrations/20260901103000_stage-d10-occupation.sql" as const;

/** Occupation SQL IS authored at Stage D10, as repository source only. */
export const D10_OCCUPATION_SQL_AUTHORED = true as const;

/**
 * Why authoring is now safe: the last blocker is cleared and every other part
 * of the occupation contract was already frozen (recorded at D9 R1) and is
 * satisfied by objects already authored at D7 or established by the foundation.
 */
export const D10_OCCUPATION_AUTHORING_JUSTIFICATION = Object.freeze({
  clearedBlocker: D9_R1_OCCUPATION_AUTHORING_BLOCKER.blockerCode,
  frozenByErd: D9_R1_OCCUPATION_FROZEN_BY_ERD.sourceRecord,
  prerequisitesSatisfied: Object.freeze([
    "public.occupation_status — authored at Stage D7.",
    "public.source — authored at Stage D7.",
    "public.taxonomy_import_batch — authored at Stage D7.",
    "public.internal_user — identity foundation.",
    "extensions.citext — hosted prerequisite established at Stage D6.",
    "extensions.pg_trgm with extensions.gin_trgm_ops — hosted prerequisite established at Stage D6.",
    "public.set_updated_at() — foundation helper, reused unchanged.",
    "public.is_internal(public.internal_role) — foundation helper, reused unchanged.",
  ] as const),
  conventionsMatched: Object.freeze([
    "id uuid PRIMARY KEY DEFAULT gen_random_uuid() — the established global PK convention (source, taxonomy_import_batch, provider, local_snapshot).",
    "created_at/updated_at timestamptz NOT NULL DEFAULT now() with the existing public.set_updated_at() touch trigger — the established convention for mutable governed tables (source, source_type, opportunity_type, route_archetype).",
    "extensions-qualified trigram operator class extensions.gin_trgm_ops, exactly as verified by the Stage D6 prerequisite gate.",
    "row level security enabled; service_role full table privilege; authenticated explicit least privilege; anon nothing.",
    "deletes are never granted and never cascade.",
  ] as const),
  failClosed: Object.freeze([
    "No IF NOT EXISTS, no CREATE OR REPLACE, no DROP: a pre-existing occupation table, index or policy fails the migration closed before any DDL.",
    "Foundation prerequisites are verified by exact catalogue signature before any DDL.",
    "Self-verification re-checks the exact column set, the generated expression, RLS, indexes and policies after the DDL.",
  ] as const),
});

/** Access authority, exactly as frozen. No institution write access anywhere. */
export const D10_OCCUPATION_ACCESS = Object.freeze({
  anon: "no privilege and no policy" as const,
  authenticatedRead: "SELECT on all rows (catalogue is readable by signed-in users)" as const,
  writeAuthority: "public.is_internal('approver'::public.internal_role) only" as const,
  authenticatedPrivileges: Object.freeze(["SELECT", "INSERT", "UPDATE"] as const),
  deleteGranted: false as const,
  institutionWriteAccess: false as const,
  serviceRole: "ALL" as const,
});

/** Entities that deliberately remain unauthored after Stage D10. */
export const D10_STILL_UNAUTHORED: readonly string[] = Object.freeze([
  "occupation_alias",
  "programme",
  "opportunity",
  "local_snapshot_item",
]);

/** Database objects that must NOT exist under the current decisions. */
export const D10_FORBIDDEN_DATABASE_OBJECTS: readonly string[] = Object.freeze([
  "normalise_title",
  "unaccent",
  "clear_routes_unaccent",
]);

/** Repository migration facts this stage must not change. */
export const D10_MIGRATION_FACTS = Object.freeze({
  managedMigrationCount: 9 as const,
  authoredOutsideManagedMigrations: D10_AUTHORED_MIGRATION_PATH,
  hostedApplyAuthorised: false as const,
  targetProjectVerified: false as const,
  seedsAuthored: false as const,
});

export interface D10Assessment {
  readonly titleWordCountExpressionFrozen: boolean;
  readonly semanticsProven: boolean;
  readonly emptyStringGuarded: boolean;
  readonly occupationSqlAuthored: true;
  readonly titleNormalisedGenerated: false;
  readonly hostedApplyAuthorised: false;
  readonly targetProjectVerified: false;
  readonly remainingBlockers: readonly string[];
}

/** Deterministic fail-closed assessment of Stage D10. */
export function assessD10TitleWordCount(): D10Assessment {
  const remaining: string[] = [];

  const semanticsProven = D10_TITLE_WORD_COUNT_EXAMPLES.every(
    (example) => countCanonicalTitleWords(example.titleNormalised) === example.wordCount,
  );
  if (!semanticsProven) {
    remaining.push("The frozen title_word_count semantics do not hold for every frozen example.");
  }

  const expressionFrozen =
    D10_TITLE_WORD_COUNT_EXPRESSION.includes("string_to_array(title_normalised, ' ')") &&
    D10_TITLE_WORD_COUNT_EXPRESSION.includes("::smallint") &&
    !/regexp|unaccent|normalise_title/i.test(D10_TITLE_WORD_COUNT_EXPRESSION);
  if (!expressionFrozen) {
    remaining.push("The frozen generated expression is not exactly the approved D10 expression.");
  }

  return Object.freeze({
    titleWordCountExpressionFrozen: expressionFrozen,
    semanticsProven,
    emptyStringGuarded: D10_EMPTY_STRING_BEHAVIOUR.guardedInSql,
    occupationSqlAuthored: true as const,
    titleNormalisedGenerated: false as const,
    hostedApplyAuthorised: false as const,
    targetProjectVerified: false as const,
    remainingBlockers: Object.freeze(remaining),
  });
}
