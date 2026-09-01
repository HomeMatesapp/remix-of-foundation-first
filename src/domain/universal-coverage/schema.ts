import { z } from "zod";

import { semanticVersionSchema, sha256HashSchema, stableKeySchema, uuidSchema } from "../contracts";
import { OCCUPATION_UNMATCHED_REASONS } from "../occupation-universe";
import {
  COVERAGE_ESCALATION_CODES,
  COVERAGE_SUPPORT_DEPTHS,
  PROVISIONAL_LIMITATION_CODES,
} from "./codes";

/**
 * Strict structural contracts for the coverage layer.
 *
 * Every schema is `.strict()`, so an undeclared field is REJECTED rather than
 * silently carried. This is what structurally prevents a later caller smuggling
 * a fabricated route, condition, source grade or judgement through this layer.
 */

/* -------------------------------------------------------------------------- */
/* Runtime immutability                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Deep runtime freeze, local to this package (no application-wide freeze
 * framework is introduced).
 *
 * `Object.freeze` is SHALLOW, so an already frozen parent may still contain
 * mutable children: the walk must therefore continue through a frozen object
 * rather than returning early. Cycles terminate through a private visited set
 * that no caller can supply or observe.
 */
export function freezeCoverageDocument<T>(value: T): T {
  return freezeDeep(value, new WeakSet<object>());
}

function freezeDeep<T>(value: T, visited: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (visited.has(value)) return value;
  visited.add(value);
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    freezeDeep((value as Record<string, unknown>)[key], visited);
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

/** Canonical occupation identity, projected from the closed Increment 12 layer. */
export const coverageOccupationRefSchema = z
  .object({
    occupationId: uuidSchema,
    occupationKey: stableKeySchema,
    canonicalTitle: z.string().min(1),
  })
  .strict();
export type CoverageOccupationRef = z.infer<typeof coverageOccupationRefSchema>;

/**
 * Reference to the exact Career Pack that backs a full assessment.
 *
 * `contentHash` is always RECOMPUTED from the parsed canonical document; a
 * caller-declared hash is never accepted as truth.
 */
export const coveragePackRefSchema = z
  .object({
    careerPackId: uuidSchema,
    version: semanticVersionSchema,
    contentHash: sha256HashSchema,
  })
  .strict();
export type CoveragePackRef = z.infer<typeof coveragePackRefSchema>;

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/** One canonical occupation with exactly one validated, bound Career Pack. */
export const coverageCatalogueEntrySchema = z
  .object({
    occupation: coverageOccupationRefSchema,
    pack: coveragePackRefSchema,
  })
  .strict();
export type CoverageCatalogueEntry = z.infer<typeof coverageCatalogueEntrySchema>;

/**
 * A validated, deterministically ordered set of supported occupations.
 *
 * This is a pure INPUT to coverage resolution. It is not a registry, not a
 * publication service and carries no lifecycle state.
 */
export type CareerPackCoverageCatalogue = readonly CoverageCatalogueEntry[];

/* -------------------------------------------------------------------------- */
/* Provisional safe assessment plan                                           */
/* -------------------------------------------------------------------------- */

/**
 * The provisional plan exists so a recognised occupation does not dead-end. It
 * is NOT a Career Pack and NOT a Reality Check result.
 *
 * Deliberately ABSENT, and not to be added without owner approval:
 * - any judgement, requirement state, route, route archetype or source grade;
 * - any Career Pack id, version or content hash (there is none to point at);
 * - any authored question list — a provisional plan declares an escalation
 *   requirement, never career-specific questions that could be mistaken for
 *   reviewed Career Pack questions.
 */
export const provisionalAssessmentPlanSchema = z
  .object({
    kind: z.literal("provisional_safe_assessment_plan"),
    occupation: coverageOccupationRefSchema,
    supportDepth: z.literal(COVERAGE_SUPPORT_DEPTHS[1]),
    /** Always false: nothing here is produced by the shared Decision Engine. */
    engineBacked: z.literal(false),
    /** Always false: this layer authors no intake question. */
    declaresIntakeQuestions: z.literal(false),
    /** Structural statements of absence only. */
    limitations: z.array(z.enum(PROVISIONAL_LIMITATION_CODES)).min(1),
    /**
     * Verification that MUST happen before any consequential career-specific
     * certainty is presented to a participant.
     */
    verificationRequiredBeforeCareerSpecificCertainty: z.literal(true),
    requiredEscalations: z.array(z.enum(COVERAGE_ESCALATION_CODES)).min(1),
  })
  .strict();
export type ProvisionalAssessmentPlan = z.infer<typeof provisionalAssessmentPlanSchema>;

/* -------------------------------------------------------------------------- */
/* Capture descriptor                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Unrecognised-intent capture descriptor.
 *
 * Purely descriptive: this layer performs no persistence. `recognisedOccupation`
 * is always false, so nothing downstream may treat captured text as a
 * legitimate occupation.
 */
export const unrecognisedIntentCaptureSchema = z
  .object({
    kind: z.literal("unrecognised_intent_capture"),
    recognisedOccupation: z.literal(false),
    rawQuery: z.string(),
    normalisedQuery: z.string(),
    /** The Increment 12 unmatched reason, passed through verbatim. */
    unmatchedReason: z.enum(OCCUPATION_UNMATCHED_REASONS),
    requiredEscalations: z.array(z.enum(COVERAGE_ESCALATION_CODES)).min(1),
  })
  .strict();
export type UnrecognisedIntentCapture = z.infer<typeof unrecognisedIntentCaptureSchema>;
