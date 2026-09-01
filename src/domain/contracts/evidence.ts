import { z } from "zod";
import {
  isoTimestampSchema,
  semanticVersionSchema,
  sha256HashSchema,
  sourceRecordKeySchema,
  uuidSchema,
} from "./primitives";

/**
 * Evidence-strength vocabularies and the minimal source provenance reference.
 *
 * BINDING RULE (documented here, enforced by the Decision Engine in a later
 * increment): judgement strength must never exceed evidence strength. A weakly
 * evidenced statement can never be presented as a confirmed requirement, and
 * missing evidence can never become certainty.
 *
 * No evidence or source database tables are created in Increment 2.
 */

/** Internal authority grade of a source. A is strongest, D is weakest. */
export const INTERNAL_EVIDENCE_GRADES = ["A", "B", "C", "D"] as const;
export const internalEvidenceGradeSchema = z.enum(INTERNAL_EVIDENCE_GRADES);
export type InternalEvidenceGrade = z.infer<typeof internalEvidenceGradeSchema>;

/** Participant-facing classification of what a statement actually is. */
export const PARTICIPANT_EVIDENCE_CLASSIFICATIONS = [
  "confirmed_requirement",
  "provider_dependent",
  "general_guidance",
  "needs_verification",
] as const;
export const participantEvidenceClassificationSchema = z.enum(PARTICIPANT_EVIDENCE_CLASSIFICATIONS);
export type ParticipantEvidenceClassification = z.infer<
  typeof participantEvidenceClassificationSchema
>;

/**
 * Stable source identity: the approved `source_id` + `source_record_key` pair.
 * Optional fields pin the exact retrieved state where that is available.
 */
export const evidenceReferenceSchema = z
  .object({
    sourceId: uuidSchema,
    sourceRecordKey: sourceRecordKeySchema,
    grade: internalEvidenceGradeSchema.nullable().optional(),
    participantClassification: participantEvidenceClassificationSchema.nullable().optional(),
    recordVersion: semanticVersionSchema.nullable().optional(),
    recordContentHash: sha256HashSchema.nullable().optional(),
    retrievedAt: isoTimestampSchema.nullable().optional(),
  })
  /**
   * Strict: undeclared keys (AI model, generated claim text, prompts) are
   * REJECTED so unevidenced content cannot ride along as provenance.
   */
  .strict();
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
