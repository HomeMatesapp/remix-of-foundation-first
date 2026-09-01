import type { CareerPack, CareerPackRequirementDefinition } from "../career-packs";
import {
  type RequirementAssessment,
  type RequirementRef,
  type RequirementSeverity,
  type RequirementState,
} from "../contracts";
import { canonicalKeyList, requirementRefOf } from "./canonical";
import { engineIssue, type DecisionEngineIssue } from "./codes";
import {
  applyEvidenceStateCeiling,
  attachRequirementEvidence,
  type EvidenceIndex,
  type RequirementEvidenceAttachment,
} from "./evidence";
import { evaluatePackRule, type AnswerIndex } from "./truth";

/**
 * Requirement state resolution.
 *
 * NO precedence ladder is invented. Only a determinately TRUE rule asserts its
 * declared state; a FALSE rule asserts nothing; an UNKNOWN rule is a possible but
 * unresolved assertion. Two determinately-true rules asserting different states
 * are an authored contradiction and fail CLOSED.
 *
 * Consequence of this model: missing or unanswered data can never independently
 * create `unmet`. A concrete `unmet` requires at least one determinately-true
 * unmet rule with no unresolved competing state.
 */

export interface RequirementResolution {
  readonly requirementKey: string;
  readonly requirement: RequirementRef;
  readonly severity: RequirementSeverity;
  readonly state: RequirementState;
  /** State before the evidence-strength ceiling was applied. Diagnostic only. */
  readonly ruleState: RequirementState;
  readonly attachment: RequirementEvidenceAttachment;
}

export type RequirementResolutionIndex = ReadonlyMap<string, RequirementResolution>;

function resolveState(
  requirement: CareerPackRequirementDefinition,
  pack: CareerPack,
  answers: AnswerIndex,
):
  | { readonly ok: true; readonly state: RequirementState }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const issues: DecisionEngineIssue[] = [];
  const assertedStates = new Set<RequirementState>();
  const possibleStates = new Set<RequirementState>();

  /* Array order is irrelevant: every targeting rule is evaluated. */
  for (const rule of pack.requirementRules) {
    if (rule.requirementKey !== requirement.requirementKey) continue;
    const truth = evaluatePackRule(rule.when, answers);
    if (!truth.ok) {
      issues.push(...truth.issues);
      continue;
    }
    if (truth.value === true) assertedStates.add(rule.state);
    else if (truth.value === null) possibleStates.add(rule.state);
  }

  if (issues.length > 0) return { ok: false, issues };

  if (assertedStates.size > 1) {
    return {
      ok: false,
      issues: [
        engineIssue(
          "conflicting_requirement_rules",
          `determinately-true requirement rules assert different states (${canonicalKeyList([...assertedStates]).join(", ")}); no precedence is invented`,
          `requirement:${requirement.requirementKey}`,
        ),
      ],
    };
  }

  if (assertedStates.size === 0) {
    /* No concrete assertion: unknown, whether or not unresolved rules exist. */
    return { ok: true, state: "unknown" };
  }

  const asserted = [...assertedStates][0] as RequirementState;
  for (const possible of possibleStates) {
    /* An unresolved rule that could assert a DIFFERENT state means missing data
     * may still change the outcome, so the concrete state is not safe to keep. */
    if (possible !== asserted) return { ok: true, state: "unknown" };
  }
  return { ok: true, state: asserted };
}

export function resolveRequirements(
  pack: CareerPack,
  answers: AnswerIndex,
  evidence: EvidenceIndex,
):
  | { readonly ok: true; readonly resolutions: RequirementResolutionIndex }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const issues: DecisionEngineIssue[] = [];
  const resolutions = new Map<string, RequirementResolution>();

  for (const requirement of pack.requirements) {
    const attached = attachRequirementEvidence(requirement, evidence);
    if (!attached.ok) {
      issues.push(...attached.issues);
      continue;
    }
    const state = resolveState(requirement, pack, answers);
    if (!state.ok) {
      issues.push(...state.issues);
      continue;
    }
    resolutions.set(requirement.requirementKey, {
      requirementKey: requirement.requirementKey,
      requirement: requirementRefOf(requirement),
      severity: requirement.severity,
      ruleState: state.state,
      state: applyEvidenceStateCeiling(state.state, attached.attachment),
      attachment: attached.attachment,
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, resolutions };
}

/**
 * Build the frozen `RequirementAssessment` shape. `unresolvedCheckKeys` are the
 * canonical keys of SURFACED checks related to this requirement; `explanationKey`
 * is only ever taken from a declared unresolved check — never invented.
 */
export function buildRequirementAssessment(
  resolution: RequirementResolution,
  unresolvedCheckKeys: readonly string[],
  explanationKey: string | null,
): RequirementAssessment {
  return {
    requirement: resolution.requirement,
    state: resolution.state,
    severity: resolution.severity,
    evidenceGrade: resolution.attachment.grade,
    evidence: [...resolution.attachment.references],
    unresolvedCheckKeys: [...canonicalKeyList(unresolvedCheckKeys)],
    explanationKey,
  };
}
