/**
 * Increment 17, Stage D3 — unresolved SCHEMA-DEFINITION findings.
 *
 * These are statements about relational definitions that the authoritative
 * inspected design chain does not freeze. They are NOT permission to guess a
 * definition, NOT participant-facing, and say nothing about participant routes,
 * availability, eligibility or judgement. Each one fails closed: while it stands,
 * Stage D3 schema-authoring readiness is false.
 *
 * Pure data. Nothing here reads, writes, computes, executes or authorises.
 */

/** Version of the Stage D3 definition-findings document itself. */
export const LOCAL_REALITY_D3_FINDINGS_VERSION = "1.0.0" as const;

/** Stable finding codes, in a fixed order for deterministic reporting. */
export const D3_DEFINITION_FINDING_CODES = Object.freeze([
  "occupation_status_members_not_frozen",
  "normalise_title_controlled_suffix_list_not_frozen",
  "programme_geog_index_without_column",
] as const);
export type D3DefinitionFindingCode = (typeof D3_DEFINITION_FINDING_CODES)[number];

export interface D3DefinitionFinding {
  readonly code: D3DefinitionFindingCode;
  /** Node key the finding attaches to. */
  readonly nodeKey: string;
  /** Internal reviewer-facing explanation only. */
  readonly reason: string;
  /** What must NOT be done while the finding stands. */
  readonly prohibition: string;
}

export const D3_DEFINITION_FINDINGS: readonly D3DefinitionFinding[] = Object.freeze([
  Object.freeze({
    code: "occupation_status_members_not_frozen",
    nodeKey: "occupation_status",
    reason:
      "The `occupation_status` type and its default member `active` are frozen, but the complete member vocabulary is not stated anywhere in the authoritative design chain inspected.",
    prohibition:
      "No additional member may be invented, guessed or implied. Only `active` is known, and the type may not be authored until the owner freezes the full member list.",
  }),
  Object.freeze({
    code: "normalise_title_controlled_suffix_list_not_frozen",
    nodeKey: "normalise_title",
    reason:
      "The deterministic title-normalisation contract is specified only as lower-casing, stripping punctuation and diacritics, collapsing whitespace, and singularising a CONTROLLED SUFFIX LIST. That suffix list is not frozen in the inspected authority.",
    prohibition:
      "The suffix list may not be invented and the normalisation routine may not be implemented at this stage, in this package or anywhere else.",
  }),
  Object.freeze({
    code: "programme_geog_index_without_column",
    nodeKey: "programme",
    reason:
      "The final design states a spatial GIST index requirement for provider, programme and opportunity, yet the final `programme` definition declares no `geog` column at all. The two statements contradict each other.",
    prohibition:
      "A `programme.geog` column may not be synthesised to satisfy the index sentence, and the stated index requirement may not be silently dropped. The owner must reconcile the contradiction.",
  }),
] as const);

export function getD3DefinitionFinding(code: D3DefinitionFindingCode): D3DefinitionFinding {
  const finding = D3_DEFINITION_FINDINGS.find((entry) => entry.code === code);
  if (!finding) throw new Error(`Unknown Stage D3 definition finding code: ${code}`);
  return finding;
}

/** Findings attached to a given node key, in canonical finding order. */
export function findingsForNode(nodeKey: string): readonly D3DefinitionFinding[] {
  return Object.freeze(D3_DEFINITION_FINDINGS.filter((finding) => finding.nodeKey === nodeKey));
}
