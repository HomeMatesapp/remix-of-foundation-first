import { z } from "zod";
import { stableKeySchema, uuidSchema } from "./primitives";
import { realityCheckJudgementSchema } from "./judgement";
import { requirementAssessmentSchema } from "./requirements";
import { deterministicProvenanceSchema } from "./provenance";
import { DOMAIN_CONTRACT_VERSION } from "./version";

/**
 * Minimum cross-cutting structural result envelopes.
 *
 * Deliberate non-decisions in Increment 2:
 * - no eligibility vocabulary and no practical-fit vocabulary are invented;
 *   both are represented as explicitly tri-state (`true | false | null`) where
 *   `null` means unknown, plus opaque structured detail added later
 * - no ranking weights, scores, directions, outcomes or tie-break policy
 * - no barrier severity or barrier priority vocabulary
 * - no participant-facing copy
 * - no decision state
 *
 * Every object boundary below is `.strict()`: undeclared fields fail closed
 * rather than being silently stripped, so scores, decisions, or AI/model
 * metadata cannot enter a deterministic structural result unnoticed.
 */

/** Identity of a route as declared inside a versioned Career Pack. */
export const routeRefSchema = z
  .object({
    routeKey: stableKeySchema,
    routeId: uuidSchema.nullable().optional(),
  })
  .strict();
export type RouteRef = z.infer<typeof routeRefSchema>;

/**
 * Lightweight barrier result item. No barrier severity or priority vocabulary is
 * invented in Increment 2, and requirement severity is deliberately NOT reused.
 */
export const barrierResultItemSchema = z
  .object({
    barrierKey: stableKeySchema,
    /** Null means "not yet determined", never "no barrier". */
    blocking: z.boolean().nullable(),
    relatedRequirementKeys: z.array(stableKeySchema).default([]),
  })
  .strict();
export type BarrierResultItem = z.infer<typeof barrierResultItemSchema>;

/** Lightweight unresolved-check item: something knowable but not yet known. */
export const unresolvedCheckItemSchema = z
  .object({
    checkKey: stableKeySchema,
    relatedRequirementKeys: z.array(stableKeySchema).default([]),
    relatedRouteKeys: z.array(stableKeySchema).default([]),
    /**
     * Internal machine key only — never participant-facing copy. Deliberately a
     * `stableKeySchema` rather than free text.
     */
    explanationKey: stableKeySchema.nullable().optional(),
  })
  .strict();
export type UnresolvedCheckItem = z.infer<typeof unresolvedCheckItemSchema>;

/**
 * Structured, inspectable ranking metadata. No weights, scores or policy are
 * defined in Increment 2; only the container and ordered inspectable factors.
 */
export const rankingMetadataSchema = z
  .object({
    /** Identifier of the ranking configuration used, when one applied. */
    rankingConfigKey: stableKeySchema.nullable().optional(),
    /** Ordered stable identities of the factors considered, in the order applied. */
    factorKeys: z.array(stableKeySchema).default([]),
    /** Position within the candidate list, 1-based, or null when unranked. */
    position: z.number().int().positive().nullable().optional(),
  })
  .strict();
export type RankingMetadata = z.infer<typeof rankingMetadataSchema>;

/** Eligibility sub-envelope: explicit unknown, never collapsed into a negative. */
export const eligibilityOutcomeSchema = z
  .object({
    /** true = eligible, false = not eligible, null = unknown. */
    satisfied: z.boolean().nullable(),
    requirementAssessments: z.array(requirementAssessmentSchema).default([]),
  })
  .strict();
export type EligibilityOutcome = z.infer<typeof eligibilityOutcomeSchema>;

/** Practical-fit sub-envelope: structurally separate from eligibility. */
export const practicalFitOutcomeSchema = z
  .object({
    /** true = practically feasible, false = not, null = unknown. */
    satisfied: z.boolean().nullable(),
    requirementAssessments: z.array(requirementAssessmentSchema).default([]),
  })
  .strict();
export type PracticalFitOutcome = z.infer<typeof practicalFitOutcomeSchema>;

/**
 * Evaluation of one candidate route.
 *
 * `eligibility` and `practicalFit` are structurally separate and each carries an
 * explicit unknown (`null`). Unknown must never collapse into a negative.
 */
export const candidateRouteEvaluationSchema = z
  .object({
    route: routeRefSchema,
    eligibility: eligibilityOutcomeSchema,
    practicalFit: practicalFitOutcomeSchema,
    barriers: z.array(barrierResultItemSchema).default([]),
    unresolvedChecks: z.array(unresolvedCheckItemSchema).default([]),
    ranking: rankingMetadataSchema.nullable().optional(),
  })
  .strict();
export type CandidateRouteEvaluation = z.infer<typeof candidateRouteEvaluationSchema>;

/** Overall Reality Check structural result. */
export const realityCheckResultSchema = z
  .object({
    contractVersion: z.literal(DOMAIN_CONTRACT_VERSION),
    judgement: realityCheckJudgementSchema,
    candidateRoutes: z.array(candidateRouteEvaluationSchema).default([]),
    /** Assessments that are not specific to one candidate route. */
    requirementAssessments: z.array(requirementAssessmentSchema).default([]),
    barriers: z.array(barrierResultItemSchema).default([]),
    unresolvedChecks: z.array(unresolvedCheckItemSchema).default([]),
    provenance: deterministicProvenanceSchema,
  })
  .strict();
export type RealityCheckResult = z.infer<typeof realityCheckResultSchema>;
