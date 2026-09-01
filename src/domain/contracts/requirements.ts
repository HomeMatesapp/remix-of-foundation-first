import { z } from "zod";
import { stableKeySchema, uuidSchema } from "./primitives";
import { evidenceReferenceSchema, internalEvidenceGradeSchema } from "./evidence";

/**
 * Requirement vocabularies and the reusable structural assessment shape.
 *
 * `unknown` is structurally distinct from `unmet` and must never be treated as
 * a negative outcome by any consumer.
 */

export const REQUIREMENT_STATES = [
  "met",
  "unmet",
  "unknown",
  "verification_required",
  "not_applicable",
] as const;

export const requirementStateSchema = z.enum(REQUIREMENT_STATES);
export type RequirementState = z.infer<typeof requirementStateSchema>;

export const REQUIREMENT_SEVERITIES = ["mandatory", "preferred", "contextual"] as const;

export const requirementSeveritySchema = z.enum(REQUIREMENT_SEVERITIES);
export type RequirementSeverity = z.infer<typeof requirementSeveritySchema>;

/** Identity of a requirement as declared inside a versioned Career Pack. */
export const requirementRefSchema = z
  .object({
    requirementKey: stableKeySchema,
    requirementId: uuidSchema.nullable().optional(),
  })
  /** Strict: undeclared keys are REJECTED, never silently stripped. */
  .strict();
export type RequirementRef = z.infer<typeof requirementRefSchema>;

/**
 * Structural result for a single requirement. Carries no career-specific
 * decision logic — only identity, state, severity and cross-cutting provenance.
 */
export const requirementAssessmentSchema = z
  .object({
    requirement: requirementRefSchema,
    state: requirementStateSchema,
    severity: requirementSeveritySchema,
    /** Highest internal evidence grade backing this state, when known. */
    evidenceGrade: internalEvidenceGradeSchema.nullable().optional(),
    /** Evidence/source references supporting this state. */
    evidence: z.array(evidenceReferenceSchema).default([]),
    /**
     * Machine-readable keys of the unresolved checks that keep this requirement
     * in `unknown` or `verification_required`. Never participant-facing copy.
     */
    unresolvedCheckKeys: z.array(stableKeySchema).default([]),
    /**
     * Internal machine key only. Deliberately a `stableKeySchema` and NOT free
     * text, so participant-facing prose can never be smuggled into a
     * deterministic structural result.
     */
    explanationKey: stableKeySchema.nullable().optional(),
  })
  /** Strict: undeclared keys (e.g. `decision`) are REJECTED, never stripped. */
  .strict();
export type RequirementAssessment = z.infer<typeof requirementAssessmentSchema>;
