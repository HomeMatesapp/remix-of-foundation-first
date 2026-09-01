/**
 * Increment 17, Stage D4 — owner SCHEMA-DEFINITION RECONCILIATION record.
 *
 * Stage D3 correctly discovered three unresolved schema-definition findings and
 * closed while they were unresolved. That history is accurate and is NOT
 * rewritten: `D3_DEFINITION_FINDINGS` keeps exactly those three findings. Stage
 * D4 records the product owner's explicit resolution of all three, so the
 * CURRENT definition authority in this package changes accordingly.
 *
 * Pure data only. Nothing here reads, writes, computes, executes or authorises.
 * Recording a decision is NOT authority to apply a hosted relational change.
 */

import { D3_DEFINITION_FINDING_CODES, type D3DefinitionFindingCode } from "./definition-findings";

/** Version of the Stage D4 decision record document itself. */
export const LOCAL_REALITY_D4_DECISION_VERSION = "1.0.0" as const;

/** Date the product owner accepted the decisions below (ISO calendar date). */
export const LOCAL_REALITY_D4_DECISION_DATE = "2026-08-30" as const;

/**
 * Complete relational member vocabulary of `occupation_status`, exactly two.
 *
 * Semantics are repository/catalogue lifecycle ONLY: `active` means Clear Routes
 * currently uses and offers that occupation record; `inactive` means the record
 * is retained for history or reference but is not actively offered. Neither
 * member says anything about whether a real-world occupation is available,
 * possible, accessible or open to a participant, and neither may be used in any
 * career judgement. There is no rank or order-of-goodness between them.
 */
export const OCCUPATION_STATUS_MEMBERS = Object.freeze(["active", "inactive"] as const);
export type OccupationStatusMember = (typeof OCCUPATION_STATUS_MEMBERS)[number];

/** Frozen relational default member of `occupation_status`. */
export const OCCUPATION_STATUS_DEFAULT_MEMBER = "active" as const;

/**
 * The complete authoritative deterministic canonical title-normalisation
 * contract: exactly these four operations, in this order, and nothing else.
 */
export const NORMALISE_TITLE_OPERATIONS = Object.freeze([
  "lowercase",
  "remove_punctuation",
  "remove_diacritics",
  "collapse_whitespace",
] as const);
export type NormaliseTitleOperation = (typeof NORMALISE_TITLE_OPERATIONS)[number];

/**
 * Explicit prohibitions on the canonical normalisation contract. Canonical
 * relational identity must never alter word morphology, so the controlled
 * suffix list is WITHDRAWN rather than frozen. Flexible search or alias
 * handling is a separate later concern and is out of scope for this stage.
 */
export const NORMALISE_TITLE_PROHIBITIONS = Object.freeze([
  "No singularisation and no controlled suffix list: canonical identity must not change singular/plural morphology.",
  "No stemming, lemmatisation, suffix stripping or any other morphological guessing.",
  "No synonym expansion, translation or generative rewriting of an authored title.",
] as const);

/** Tables the relational spatial index requirement applies to, exactly two. */
export const D4_SPATIAL_INDEX_TABLES = Object.freeze(["provider", "opportunity"] as const);
export type D4SpatialIndexTable = (typeof D4_SPATIAL_INDEX_TABLES)[number];

/** `programme` carries no spatial column and no spatial dependency. */
export const PROGRAMME_HAS_SPATIAL_COLUMN = false as const;

export interface OwnerSchemaDecisionRecord {
  /** Stable Stage D3 finding code this decision resolves. */
  readonly resolvesFindingCode: D3DefinitionFindingCode;
  readonly decision: string;
}

/** Exactly the THREE owner decisions resolving the three D3 findings. */
export const LOCAL_REALITY_D4_DECISIONS: readonly OwnerSchemaDecisionRecord[] = Object.freeze([
  Object.freeze({
    resolvesFindingCode: "occupation_status_members_not_frozen",
    decision:
      "The complete `occupation_status` member vocabulary is exactly `active | inactive`, with `active` remaining the relational default. The members describe catalogue lifecycle only — whether Clear Routes currently offers the occupation record — and never real-world availability, possibility or participant outcome. No further member may be added.",
  }),
  Object.freeze({
    resolvesFindingCode: "normalise_title_controlled_suffix_list_not_frozen",
    decision:
      "The canonical normalisation contract is exactly lowercase, remove punctuation, remove diacritics, collapse whitespace. The controlled suffix list is WITHDRAWN from canonical relational normalisation, so no morphological guessing of any kind belongs in canonical identity. Flexible search and alias behaviour is outside this stage.",
  }),
  Object.freeze({
    resolvesFindingCode: "programme_geog_index_without_column",
    decision:
      "Resolved in favour of the table definition: `programme` has NO spatial column and NO spatial dependency, and the relational spatial index requirement applies to `provider` and `opportunity` only. Provider coordinates are not duplicated onto programme, no programme-location table is introduced at this stage, and programme locality is represented through its governed provider.",
  }),
] as const);

/** Finding codes resolved by owner decision at Stage D4, in D3 order. */
export const D4_RESOLVED_FINDING_CODES: readonly D3DefinitionFindingCode[] = Object.freeze(
  D3_DEFINITION_FINDING_CODES.map((code) => code),
);

/**
 * Current unresolved schema-definition findings: deliberately EMPTY. The three
 * D3 findings remain as historical discovery, all now resolved.
 */
export const D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS: readonly D3DefinitionFindingCode[] =
  Object.freeze([]);

export function getD4Decision(code: D3DefinitionFindingCode): OwnerSchemaDecisionRecord {
  const found = LOCAL_REALITY_D4_DECISIONS.find((entry) => entry.resolvesFindingCode === code);
  if (!found) throw new Error(`Unknown Stage D4 resolved finding code: ${code}`);
  return found;
}
