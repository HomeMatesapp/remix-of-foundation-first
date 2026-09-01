import { z } from "zod";
import {
  isoTimestampSchema,
  semanticVersionSchema,
  sha256HashSchema,
  snapshotRefSchema,
  uuidSchema,
} from "./primitives";

/**
 * Immutable deterministic evaluation provenance.
 *
 * This envelope must be sufficient to reconstruct a historical structural
 * result exactly. It is deliberately free of AI model, prompt or generation
 * fields: AI is never eligibility authority and never part of the deterministic
 * reconstruction inputs.
 */
export const deterministicProvenanceSchema = z
  .object({
    careerPackId: uuidSchema,
    careerPackVersion: semanticVersionSchema,
    careerPackContentHash: sha256HashSchema,
    decisionEngineVersion: semanticVersionSchema,
    answerSnapshot: snapshotRefSchema,
    evidenceContext: snapshotRefSchema,
    /** Present only when the evaluation used Local Reality inputs. */
    localSnapshot: snapshotRefSchema.nullable().optional(),
    evaluatedAt: isoTimestampSchema,
  })
  /**
   * Strict: undeclared top-level keys are REJECTED, not silently stripped, so AI
   * model/prompt metadata cannot be smuggled into the deterministic core.
   */
  .strict();
export type DeterministicProvenance = z.infer<typeof deterministicProvenanceSchema>;
