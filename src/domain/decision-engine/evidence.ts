import type { EvidenceContextSnapshot } from "../assessment-inputs";
import type { CareerPackRequirementDefinition } from "../career-packs";
import {
  evidenceReferenceSchema,
  INTERNAL_EVIDENCE_GRADES,
  type EvidenceReference,
  type InternalEvidenceGrade,
  type RequirementState,
} from "../contracts";
import type { EvidenceRecordRevision } from "../evidence-registry";
import { engineIssue, type DecisionEngineIssue } from "./codes";

/**
 * Evidence attachment and the frozen evidence-strength ceiling.
 *
 * Judgement strength must never exceed evidence strength. Weak, unverified,
 * provider-dependent or withdrawn evidence can never drive a consequential
 * certainty, and missing evidence can never become certainty.
 *
 * Embedded historical revisions are read only: nothing here mutates them, and a
 * withdrawn revision stays reconstructable and attachable — it simply cannot
 * strengthen a state.
 */

/** Existing A > B > C > D authority ordering. A is strongest. */
export const EVIDENCE_GRADE_STRENGTH_ORDER: readonly InternalEvidenceGrade[] =
  INTERNAL_EVIDENCE_GRADES;

/** Negative when `left` is the STRONGER grade. */
export function compareEvidenceGradeStrength(
  left: InternalEvidenceGrade,
  right: InternalEvidenceGrade,
): number {
  return EVIDENCE_GRADE_STRENGTH_ORDER.indexOf(left) - EVIDENCE_GRADE_STRENGTH_ORDER.indexOf(right);
}

export type EvidenceIndex = ReadonlyMap<string, EvidenceRecordRevision>;

export function buildEvidenceIndex(snapshot: EvidenceContextSnapshot): EvidenceIndex {
  const index = new Map<string, EvidenceRecordRevision>();
  for (const entry of snapshot.entries) index.set(entry.evidenceKey, entry.revision);
  return index;
}

export interface RequirementEvidenceAttachment {
  /** Canonical references, ordered by the pack's evidence key ordering. */
  readonly references: readonly EvidenceReference[];
  /** Strongest attached grade, or null when the requirement attaches none. */
  readonly grade: InternalEvidenceGrade | null;
  /** True when the requirement declares at least one evidence key. */
  readonly declaresEvidence: boolean;
  /**
   * True when at least one attached embedded revision is a confirmed
   * requirement, graded A/B/C and not withdrawn in that embedded revision.
   */
  readonly supportsConsequentialCertainty: boolean;
}

/**
 * Build the `EvidenceReference` shape from an embedded revision using ONLY the
 * fields the existing `evidenceReferenceSchema` accepts. Nothing else may ride
 * along as provenance.
 */
export function evidenceReferenceOfRevision(revision: EvidenceRecordRevision): EvidenceReference {
  return evidenceReferenceSchema.parse({
    sourceId: revision.sourceId,
    sourceRecordKey: revision.sourceRecordKey,
    grade: revision.grade,
    participantClassification: revision.participantClassification,
    recordVersion: revision.recordVersion,
    recordContentHash: revision.recordContentHash,
    retrievedAt: revision.retrievedAt,
  });
}

export function attachRequirementEvidence(
  requirement: CareerPackRequirementDefinition,
  index: EvidenceIndex,
):
  | { readonly ok: true; readonly attachment: RequirementEvidenceAttachment }
  | { readonly ok: false; readonly issues: readonly DecisionEngineIssue[] } {
  const issues: DecisionEngineIssue[] = [];
  const references: EvidenceReference[] = [];
  let strongest: InternalEvidenceGrade | null = null;
  let supports = false;

  /* Evidence keys are canonically ordered so authored order cannot leak out. */
  const evidenceKeys = [...requirement.evidenceKeys].sort();

  for (const evidenceKey of evidenceKeys) {
    const revision = index.get(evidenceKey);
    if (!revision) {
      issues.push(
        engineIssue(
          "missing_pack_definition",
          "requirement evidence key has no entry in the exact Evidence Context Snapshot",
          `requirement:${requirement.requirementKey}/evidence:${evidenceKey}`,
        ),
      );
      continue;
    }
    references.push(evidenceReferenceOfRevision(revision));
    if (strongest === null || compareEvidenceGradeStrength(revision.grade, strongest) < 0) {
      strongest = revision.grade;
    }
    if (
      revision.participantClassification === "confirmed_requirement" &&
      revision.grade !== "D" &&
      !revision.withdrawal
    ) {
      supports = true;
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    attachment: {
      references,
      grade: strongest,
      declaresEvidence: requirement.evidenceKeys.length > 0,
      supportsConsequentialCertainty: supports,
    },
  };
}

/**
 * Evidence-strength ceiling.
 *
 * A requirement that declares evidence may only hold a consequential `met` or
 * `unmet` when at least one attached embedded revision confirms a requirement at
 * grade A/B/C and is not withdrawn. Otherwise the state is capped at
 * `verification_required`. `unknown`, `verification_required` and
 * `not_applicable` are never changed, and no cap applies when a requirement
 * declares no evidence at all.
 */
export function applyEvidenceStateCeiling(
  state: RequirementState,
  attachment: RequirementEvidenceAttachment,
): RequirementState {
  if (!attachment.declaresEvidence) return state;
  if (state !== "met" && state !== "unmet") return state;
  return attachment.supportsConsequentialCertainty ? state : "verification_required";
}
