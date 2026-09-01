import { z } from "zod";

import {
  evidenceReferenceSchema,
  realityCheckJudgementSchema,
  requirementSeveritySchema,
  requirementStateSchema,
  semanticVersionSchema,
  stableKeySchema,
  uuidSchema,
} from "../contracts";
import { routeArchetypeCompositionSchema } from "../archetypes";
import {
  questionAnswerValueSchema,
  questionConsequenceCodeSchema,
  questionModuleDefinitionSchema,
  questionRefSchema,
} from "../questions";
import { packRuleSchema } from "./condition";
import { CAREER_PACK_SCHEMA_VERSION } from "./version";

/**
 * Canonical Career Pack document schema.
 *
 * DATA plus validated declarative rules. Not the Decision Engine, not the
 * publication system, not the evidence registry, not UI. Every schema is
 * `.strict()` so undeclared fields cannot silently enter canonical truth.
 *
 * There is deliberately NO author-supplied `contentHash`, publication state,
 * author/reviewer/approver identity, participant-facing copy, numeric weight or
 * score anywhere in this document.
 */

/* -------------------------------------------------------------------------- */
/* Occupation reference                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Opaque occupation reference. The occupation universe, titles, aliases, fuzzy
 * matching, SOC mapping, salary and demand belong to Increment 12+.
 */
export const careerPackOccupationRefSchema = z
  .object({
    occupationKey: stableKeySchema,
    occupationId: uuidSchema.nullable().optional(),
  })
  .strict();
export type CareerPackOccupationRef = z.infer<typeof careerPackOccupationRefSchema>;

/* -------------------------------------------------------------------------- */
/* Evidence catalogue (references only — no registry)                         */
/* -------------------------------------------------------------------------- */

export const careerPackEvidenceEntrySchema = z
  .object({
    evidenceKey: stableKeySchema,
    reference: evidenceReferenceSchema,
  })
  .strict();
export type CareerPackEvidenceEntry = z.infer<typeof careerPackEvidenceEntrySchema>;

/* -------------------------------------------------------------------------- */
/* Requirements                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Approved requirement purposes. Eligibility and practical fit remain separate
 * concepts; a requirement may govern one or both.
 */
export const CAREER_PACK_REQUIREMENT_PURPOSES = Object.freeze([
  "eligibility",
  "practical_fit",
] as const);
export type CareerPackRequirementPurpose = (typeof CAREER_PACK_REQUIREMENT_PURPOSES)[number];

const requirementPurposesSchema = z
  .array(z.enum(CAREER_PACK_REQUIREMENT_PURPOSES))
  .min(1, "a requirement must declare at least one purpose")
  .refine((purposes) => new Set(purposes).size === purposes.length, "purposes must be unique");

/**
 * Structural requirement definition. It deliberately carries NO `state`:
 * met/unmet/unknown/verification_required/not_applicable is an assessment RESULT
 * produced later by the shared Decision Engine.
 */
export const careerPackRequirementDefinitionSchema = z
  .object({
    requirementKey: stableKeySchema,
    requirementId: uuidSchema.nullable().optional(),
    severity: requirementSeveritySchema,
    purposes: requirementPurposesSchema,
    evidenceKeys: z.array(stableKeySchema).default([]),
  })
  .strict();
export type CareerPackRequirementDefinition = z.infer<typeof careerPackRequirementDefinitionSchema>;

/** Declarative requirement assessment rule DATA. Never executed here. */
export const careerPackRequirementRuleSchema = z
  .object({
    ruleKey: stableKeySchema,
    requirementKey: stableKeySchema,
    when: packRuleSchema,
    /**
     * Target requirement state. `unknown` is permitted because it is a real
     * protected structural state. Rule application/precedence/defaults are
     * Increment 9 and are NOT decided here.
     */
    state: requirementStateSchema,
  })
  .strict();
export type CareerPackRequirementRule = z.infer<typeof careerPackRequirementRuleSchema>;

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

export const careerPackRouteDefinitionSchema = z
  .object({
    routeKey: stableKeySchema,
    routeId: uuidSchema.nullable().optional(),
    /**
     * Optional. Absence is better than forcing a wrong archetype (Increment 3
     * rule). Consumes the exact current composition contract.
     */
    archetypeComposition: routeArchetypeCompositionSchema.optional(),
    eligibilityRequirementKeys: z.array(stableKeySchema).default([]),
    practicalFitRequirementKeys: z.array(stableKeySchema).default([]),
    availabilityRuleKeys: z.array(stableKeySchema).default([]),
    localRequirementKeys: z.array(stableKeySchema).default([]),
  })
  .strict();
export type CareerPackRouteDefinition = z.infer<typeof careerPackRouteDefinitionSchema>;

/**
 * Narrow declarative route-availability rule. No scores, no ranking effect, no
 * provider/vacancy logic. Absence of a local vacancy is never route
 * impossibility.
 */
export const careerPackRouteAvailabilityRuleSchema = z
  .object({
    ruleKey: stableKeySchema,
    routeKey: stableKeySchema,
    when: packRuleSchema,
    available: z.boolean(),
  })
  .strict();
export type CareerPackRouteAvailabilityRule = z.infer<typeof careerPackRouteAvailabilityRuleSchema>;

/* -------------------------------------------------------------------------- */
/* Barriers                                                                   */
/* -------------------------------------------------------------------------- */

/** No barrier severity/priority vocabulary: Increment 2 did not approve one. */
export const careerPackBarrierDefinitionSchema = z
  .object({
    barrierKey: stableKeySchema,
    blocking: z.boolean(),
    relatedRequirementKeys: z.array(stableKeySchema).default([]),
    relatedRouteKeys: z.array(stableKeySchema).default([]),
    evidenceKeys: z.array(stableKeySchema).default([]),
  })
  .strict();
export type CareerPackBarrierDefinition = z.infer<typeof careerPackBarrierDefinitionSchema>;

export const careerPackBarrierRuleSchema = z
  .object({
    ruleKey: stableKeySchema,
    barrierKey: stableKeySchema,
    when: packRuleSchema,
  })
  .strict();
export type CareerPackBarrierRule = z.infer<typeof careerPackBarrierRuleSchema>;

/* -------------------------------------------------------------------------- */
/* Unresolved checks                                                          */
/* -------------------------------------------------------------------------- */

export const careerPackUnresolvedCheckDefinitionSchema = z
  .object({
    checkKey: stableKeySchema,
    relatedRequirementKeys: z.array(stableKeySchema).default([]),
    relatedRouteKeys: z.array(stableKeySchema).default([]),
    /** Internal explanation key only. Never participant-facing copy. */
    explanationKey: stableKeySchema.nullable().optional(),
  })
  .strict();
export type CareerPackUnresolvedCheckDefinition = z.infer<
  typeof careerPackUnresolvedCheckDefinitionSchema
>;

export const careerPackUnresolvedCheckRuleSchema = z
  .object({
    ruleKey: stableKeySchema,
    checkKey: stableKeySchema,
    when: packRuleSchema,
  })
  .strict();
export type CareerPackUnresolvedCheckRule = z.infer<typeof careerPackUnresolvedCheckRuleSchema>;

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

export const careerPackActionDefinitionSchema = z
  .object({
    actionKey: stableKeySchema,
    relatedRouteKeys: z.array(stableKeySchema).default([]),
    relatedRequirementKeys: z.array(stableKeySchema).default([]),
    relatedBarrierKeys: z.array(stableKeySchema).default([]),
    relatedUnresolvedCheckKeys: z.array(stableKeySchema).default([]),
    evidenceKeys: z.array(stableKeySchema).default([]),
  })
  .strict();
export type CareerPackActionDefinition = z.infer<typeof careerPackActionDefinitionSchema>;

export const careerPackActionRuleSchema = z
  .object({
    ruleKey: stableKeySchema,
    actionKey: stableKeySchema,
    when: packRuleSchema,
  })
  .strict();
export type CareerPackActionRule = z.infer<typeof careerPackActionRuleSchema>;

/* -------------------------------------------------------------------------- */
/* Ranking configuration — ordered factors, no weights/scores                 */
/* -------------------------------------------------------------------------- */

export const careerPackRankingFactorSchema = z
  .object({
    factorKey: stableKeySchema,
    preferWhen: packRuleSchema,
    /** Optional route scoping. */
    routeKeys: z.array(stableKeySchema).default([]),
  })
  .strict();
export type CareerPackRankingFactor = z.infer<typeof careerPackRankingFactorSchema>;

/**
 * Deterministic, inspectable ranking configuration. The ORDER of `factors` is
 * the authored canonical data. There are no weights, scores, directions,
 * arithmetic or tie-break policy fields; ranking execution is Increment 9.
 */
export const careerPackRankingConfigSchema = z
  .object({
    rankingConfigKey: stableKeySchema,
    factors: z
      .array(careerPackRankingFactorSchema)
      .min(1, "a ranking configuration must declare at least one factor")
      .refine(
        (factors) => new Set(factors.map((f) => f.factorKey)).size === factors.length,
        "factor keys must be unique within a ranking configuration",
      ),
  })
  .strict();
export type CareerPackRankingConfig = z.infer<typeof careerPackRankingConfigSchema>;

/* -------------------------------------------------------------------------- */
/* Local requirement declarations (references only)                           */
/* -------------------------------------------------------------------------- */

/**
 * Declares that later evaluation requires a local input. NO postcode parsing,
 * PostGIS, distances, radii, providers, vacancies, demand models or local
 * snapshots: Increment 17 owns those. Missing local data is never a negative
 * fact.
 */
export const careerPackLocalRequirementSchema = z
  .object({
    localRequirementKey: stableKeySchema,
    /** Opaque local fact key. No geographic implementation semantics here. */
    localFactKey: stableKeySchema,
    relatedRouteKeys: z.array(stableKeySchema).default([]),
    purposes: z
      .array(questionConsequenceCodeSchema)
      .min(1, "a local requirement must declare at least one consequential purpose")
      .refine((codes) => new Set(codes).size === codes.length, "purposes must be unique"),
    /** Surface this check when the local fact is unavailable/unverified. */
    unresolvedCheckKey: stableKeySchema.nullable().optional(),
  })
  .strict();
export type CareerPackLocalRequirement = z.infer<typeof careerPackLocalRequirementSchema>;

/* -------------------------------------------------------------------------- */
/* Review / confidence metadata boundary                                      */
/* -------------------------------------------------------------------------- */

/**
 * NARROW structural boundary only.
 *
 * Intentionally deferred to Increment 6: the governed meaning/vocabularies of
 * these keys, author != reviewer != approver identities, review dates,
 * draft/reviewed/approved/published lifecycle, publish timestamps, withdrawal
 * state, content hashing and the publication gate.
 */
export const careerPackReviewMetadataSchema = z
  .object({
    reviewKey: stableKeySchema.optional(),
    confidenceKey: stableKeySchema.optional(),
  })
  .strict();
export type CareerPackReviewMetadata = z.infer<typeof careerPackReviewMetadataSchema>;

/* -------------------------------------------------------------------------- */
/* Scenarios — immutable definitions, never runs                              */
/* -------------------------------------------------------------------------- */

export const CAREER_PACK_SCENARIO_ASSERTION_KINDS = Object.freeze([
  "judgement_is",
  "requirement_state_is",
  "route_eligibility_is",
  "route_practical_fit_is",
  "barrier_present",
  "unresolved_check_present",
  "action_present",
] as const);
export type CareerPackScenarioAssertionKind = (typeof CAREER_PACK_SCENARIO_ASSERTION_KINDS)[number];

/** Tri-state: `null` means unknown, never "false". */
const triStateSchema = z.union([z.boolean(), z.null()]);

export const careerPackScenarioAssertionSchema = z.union([
  z.object({ kind: z.literal("judgement_is"), judgement: realityCheckJudgementSchema }).strict(),
  z
    .object({
      kind: z.literal("requirement_state_is"),
      requirementKey: stableKeySchema,
      state: requirementStateSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("route_eligibility_is"),
      routeKey: stableKeySchema,
      eligibility: triStateSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("route_practical_fit_is"),
      routeKey: stableKeySchema,
      practicalFit: triStateSchema,
    })
    .strict(),
  z.object({ kind: z.literal("barrier_present"), barrierKey: stableKeySchema }).strict(),
  z.object({ kind: z.literal("unresolved_check_present"), checkKey: stableKeySchema }).strict(),
  z.object({ kind: z.literal("action_present"), actionKey: stableKeySchema }).strict(),
]);
export type CareerPackScenarioAssertion = z.infer<typeof careerPackScenarioAssertionSchema>;

export const careerPackScenarioFixtureSchema = z
  .object({
    question: questionRefSchema,
    value: questionAnswerValueSchema,
  })
  .strict();
export type CareerPackScenarioFixture = z.infer<typeof careerPackScenarioFixtureSchema>;

/**
 * Immutable scenario DEFINITION. There is no execution, no run record, no
 * engine version, no scenario hash and no publication pass/fail state here;
 * those mechanics are Increment 6/9.
 */
export const careerPackScenarioSchema = z
  .object({
    scenarioKey: stableKeySchema,
    answers: z
      .array(careerPackScenarioFixtureSchema)
      .min(1, "a scenario must declare at least one confirmed answer fixture"),
    expect: z
      .array(careerPackScenarioAssertionSchema)
      .min(1, "a scenario must declare at least one expected assertion"),
  })
  .strict();
export type CareerPackScenario = z.infer<typeof careerPackScenarioSchema>;

/* -------------------------------------------------------------------------- */
/* Canonical pack document                                                    */
/* -------------------------------------------------------------------------- */

export const careerPackSchema = z
  .object({
    schemaVersion: z.literal(CAREER_PACK_SCHEMA_VERSION),
    careerPackId: uuidSchema,
    /** Content version of THIS pack. Separate from `schemaVersion`. */
    version: semanticVersionSchema,
    occupation: careerPackOccupationRefSchema,
    questionModules: z
      .array(questionModuleDefinitionSchema)
      .min(1, "a pack must embed at least one question module definition"),
    routes: z
      .array(careerPackRouteDefinitionSchema)
      .min(1, "a pack must declare at least one route"),
    requirements: z.array(careerPackRequirementDefinitionSchema).default([]),
    requirementRules: z.array(careerPackRequirementRuleSchema).default([]),
    routeAvailabilityRules: z.array(careerPackRouteAvailabilityRuleSchema).default([]),
    barriers: z.array(careerPackBarrierDefinitionSchema).default([]),
    barrierRules: z.array(careerPackBarrierRuleSchema).default([]),
    unresolvedChecks: z.array(careerPackUnresolvedCheckDefinitionSchema).default([]),
    unresolvedCheckRules: z.array(careerPackUnresolvedCheckRuleSchema).default([]),
    actions: z.array(careerPackActionDefinitionSchema).default([]),
    actionRules: z.array(careerPackActionRuleSchema).default([]),
    evidence: z.array(careerPackEvidenceEntrySchema).default([]),
    rankingConfigs: z.array(careerPackRankingConfigSchema).default([]),
    localRequirements: z.array(careerPackLocalRequirementSchema).default([]),
    review: careerPackReviewMetadataSchema.default({}),
    scenarios: z.array(careerPackScenarioSchema).default([]),
  })
  .strict();
export type CareerPack = z.infer<typeof careerPackSchema>;
