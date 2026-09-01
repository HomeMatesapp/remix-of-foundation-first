import { PROVISIONAL_LIMITATION_CODES } from "./codes";
import {
  freezeCoverageDocument,
  provisionalAssessmentPlanSchema,
  type CoverageOccupationRef,
  type ProvisionalAssessmentPlan,
} from "./schema";

/**
 * Provisional safe assessment plan construction.
 *
 * The plan is entirely determined by canonical occupation IDENTITY. It contains
 * no career-specific inference of any kind, and it declares no authored
 * question: the safest architecture at this depth is an explicit escalation
 * requirement, not a generic questionnaire that could later be mistaken for
 * reviewed Career Pack content.
 *
 * Identical occupation identity always produces an identical, deeply frozen
 * plan.
 */
export function buildProvisionalAssessmentPlan(
  occupation: CoverageOccupationRef,
): ProvisionalAssessmentPlan {
  const plan = provisionalAssessmentPlanSchema.parse({
    kind: "provisional_safe_assessment_plan",
    occupation,
    supportDepth: "not_yet_supported",
    engineBacked: false,
    declaresIntakeQuestions: false,
    limitations: [...PROVISIONAL_LIMITATION_CODES],
    verificationRequiredBeforeCareerSpecificCertainty: true,
    requiredEscalations: [
      "content_review_needed",
      "adviser_escalation_needed",
      "participant_interest_capture_needed",
    ],
  });
  return freezeCoverageDocument(plan);
}
