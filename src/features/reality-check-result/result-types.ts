import type { RealityCheckEvaluation } from "../../domain/decision-engine";
import type { QuestionRef } from "../../domain/questions";
import type { CoveragePackRef } from "../../domain/universal-coverage";

/**
 * Increment 16 — shared, browser-safe types for the evaluation boundary.
 *
 * These describe the SHAPE returned by the server boundary so presentation code
 * can be typed without importing a server-only module. They carry no behaviour,
 * no content and no authority.
 */

/** Participant-facing attribution for one evidence record used in a result. */
export interface ResultEvidenceItem {
  readonly evidenceKey: string;
  readonly label: string;
  readonly url: string;
  readonly checkedOn: string;
  readonly participantClassification: string;
  readonly limitation?: string;
}

/**
 * Canonical relationships the exact bound Career Pack already declares for one
 * TRIGGERED action. This is a projection of pack data, never a new judgement,
 * priority or trigger: the engine alone decides which actions are triggered.
 */
export interface ResultActionRelation {
  readonly actionKey: string;
  readonly relatedRouteKeys: readonly string[];
  readonly relatedRequirementKeys: readonly string[];
  readonly relatedUnresolvedCheckKeys: readonly string[];
  readonly relatedBarrierKeys: readonly string[];
}

export type RealityCheckEvaluationOutcome =
  | {
      readonly state: "evaluated";
      readonly occupationKey: string;
      readonly pack: CoveragePackRef;
      readonly evaluatedAt: string;
      readonly evaluation: RealityCheckEvaluation;
      /** Reviewed sources relevant to the elements this result actually surfaces. */
      readonly evidence: readonly ResultEvidenceItem[];
      readonly actionRelations: readonly ResultActionRelation[];
    }
  /** The submitted answers are not a complete, currently asked, valid set. */
  | { readonly state: "answers_incomplete"; readonly missing: readonly QuestionRef[] }
  /** The submitted payload does not describe this questionnaire at all. */
  | { readonly state: "answers_rejected" }
  /** No exact full-coverage Career Pack binding, or the client ref disagrees. */
  | { readonly state: "assessment_not_available_yet" }
  /**
   * Any fail-closed defect in reviewed content or engine execution, INCLUDING
   * reviewed result copy that no longer binds exactly to the bound pack.
   */
  | { readonly state: "evaluation_unavailable" };
