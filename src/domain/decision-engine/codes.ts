/**
 * Frozen catalogues for the shared deterministic Decision Engine.
 *
 * This package CONSUMES the already-approved primitive, question, Career Pack,
 * Evidence Registry and assessment-input vocabularies. It invents no judgement,
 * requirement, evidence-strength or ranking vocabulary of its own, and it holds
 * no career-specific, occupation-specific, AI, model, prompt, geographic,
 * provider or vacancy concept.
 */

/**
 * Version of the shared Decision Engine ITSELF.
 *
 * Not a Career Pack schema/content version, not a domain-contract version, not a
 * snapshot document version and not an Evidence Registry version.
 */
export const DECISION_ENGINE_VERSION = "1.0.0" as const;

/** Machine-only issue codes. Never participant-facing copy. */
export const DECISION_ENGINE_ISSUE_CODES = Object.freeze([
  /* Input boundary. */
  "invalid_career_pack",
  "invalid_answer_snapshot",
  "invalid_evidence_context",
  "invalid_evaluated_at",
  "invalid_local_snapshot",
  "provenance_invalid",
  /* Rule execution. */
  "operator_input_incompatible",
  "conflicting_requirement_rules",
  "conflicting_route_availability_rules",
  "ambiguous_ranking_configuration",
  /* Structural integrity. */
  "missing_pack_definition",
  "invalid_evidence_reference",
  "invalid_evaluation_envelope",
  /* Scenario execution. */
  "unknown_scenario",
  "invalid_scenario_answers",
] as const);
export type DecisionEngineIssueCode = (typeof DECISION_ENGINE_ISSUE_CODES)[number];

export interface DecisionEngineIssue {
  readonly code: DecisionEngineIssueCode;
  /** Internal diagnostic text only. Never participant-facing copy. */
  readonly message: string;
  /** Stable internal address of the entity the issue concerns. */
  readonly at?: string;
}

export class DecisionEngineError extends Error {
  readonly issues: readonly DecisionEngineIssue[];

  constructor(issues: readonly DecisionEngineIssue[]) {
    super(
      `decision engine evaluation failed closed: ${issues
        .map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "DecisionEngineError";
    this.issues = issues;
  }
}

/** Build one machine-only issue, omitting `at` when there is no address. */
export function engineIssue(
  code: DecisionEngineIssueCode,
  message: string,
  at?: string,
): DecisionEngineIssue {
  return at === undefined ? { code, message } : { code, message, at };
}
