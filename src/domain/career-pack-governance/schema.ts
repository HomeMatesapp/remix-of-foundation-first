import { z } from "zod";

import {
  isoTimestampSchema,
  pinnedVersionedRefSchema,
  sha256HashSchema,
  stableKeySchema,
  uuidSchema,
} from "../contracts";
import { governanceSemanticVersionSchema } from "./semver";
import { careerPackSchema } from "../career-packs";
import {
  governanceAuthorityRoleSchema,
  internalGovernanceRoleSchema,
  GOVERNANCE_CAPABILITY_ROLES,
  type GovernanceCapability,
  type InternalGovernanceRole,
} from "./codes";

/**
 * Strict governance envelope schemas.
 *
 * The governance envelope is EXTERNAL to the canonical Career Pack content that
 * is hashed. No governance identity, date or lifecycle state is ever written
 * into the canonical pack document.
 */

/* -------------------------------------------------------------------------- */
/* Actor context and stamps                                                   */
/* -------------------------------------------------------------------------- */

export const governanceActorContextSchema = z
  .object({
    internalUserId: uuidSchema,
    roles: z
      .array(internalGovernanceRoleSchema)
      .min(1, "an actor context must declare at least one internal role")
      .refine((roles) => new Set(roles).size === roles.length, "roles must be unique"),
  })
  .strict();
export type GovernanceActorContext = z.infer<typeof governanceActorContextSchema>;

export const governanceActorStampSchema = z
  .object({
    internalUserId: uuidSchema,
    authorityRole: governanceAuthorityRoleSchema,
    at: isoTimestampSchema,
  })
  .strict();
export type GovernanceActorStamp = z.infer<typeof governanceActorStampSchema>;

function stampWithRole(allowed: readonly InternalGovernanceRole[]) {
  return governanceActorStampSchema.refine(
    (stamp) => (allowed as readonly string[]).includes(stamp.authorityRole),
    `authorityRole must be one of ${allowed.join(", ")}`,
  );
}

const authorStampSchema = stampWithRole(GOVERNANCE_CAPABILITY_ROLES.create_draft);
const reviewerStampSchema = stampWithRole(GOVERNANCE_CAPABILITY_ROLES.review);
const approverStampSchema = stampWithRole(GOVERNANCE_CAPABILITY_ROLES.approve);
const publisherStampSchema = stampWithRole(GOVERNANCE_CAPABILITY_ROLES.publish);
const withdrawerStampSchema = stampWithRole(GOVERNANCE_CAPABILITY_ROLES.withdraw);

/**
 * Pure authority check. The caller supplies already-authenticated internal
 * identity and roles; this package never authenticates or queries roles.
 */
export function actorHasCapability(
  actor: GovernanceActorContext,
  capability: GovernanceCapability,
): boolean {
  const allowed = GOVERNANCE_CAPABILITY_ROLES[capability];
  return actor.roles.some((role) => allowed.includes(role));
}

/** The specific authority role recorded for a stage, or `null` when unauthorised. */
export function resolveAuthorityRole(
  actor: GovernanceActorContext,
  capability: GovernanceCapability,
): (typeof GOVERNANCE_CAPABILITY_ROLES)[GovernanceCapability][number] | null {
  const allowed = GOVERNANCE_CAPABILITY_ROLES[capability];
  // Prefer the specific role over `admin` so the stamp records the narrowest
  // authority actually held.
  const specific = allowed.find((role) => role !== "admin" && actor.roles.includes(role));
  if (specific) return specific;
  return actor.roles.includes("admin") ? "admin" : null;
}

/* -------------------------------------------------------------------------- */
/* Scenario-run attestation (definitions only — no engine execution)          */
/* -------------------------------------------------------------------------- */

/**
 * Evidence that some future shared Decision Engine runner evaluated the exact
 * scenario definition against the exact pack content. Increment 6 does NOT
 * execute scenarios and stores no result payload, model or prompt field.
 */
/**
 * Pinned historical publication reference: exact `id`, `version` and
 * `contentHash`. The shared Increment 2 pinned-ref primitive is CONSUMED and
 * strengthened with the strict governance SemVer contract.
 */
export const governancePinnedVersionedRefSchema = pinnedVersionedRefSchema
  .extend({ version: governanceSemanticVersionSchema })
  .strict();
export type GovernancePinnedVersionedRef = z.infer<typeof governancePinnedVersionedRefSchema>;

export const careerPackScenarioRunAttestationSchema = z
  .object({
    scenarioKey: stableKeySchema,
    scenarioDefinitionHash: sha256HashSchema,
    careerPackContentHash: sha256HashSchema,
    decisionEngineVersion: governanceSemanticVersionSchema,
    passed: z.boolean(),
    runAt: isoTimestampSchema,
  })
  .strict();
export type CareerPackScenarioRunAttestation = z.infer<
  typeof careerPackScenarioRunAttestationSchema
>;

/* -------------------------------------------------------------------------- */
/* Stage envelopes                                                            */
/* -------------------------------------------------------------------------- */

export const governanceReviewStageSchema = z.object({ reviewer: reviewerStampSchema }).strict();
export const governanceApprovalStageSchema = z.object({ approver: approverStampSchema }).strict();

export const governancePublicationStageSchema = z
  .object({
    publisher: publisherStampSchema,
    decisionEngineVersion: governanceSemanticVersionSchema,
    attestations: z
      .array(careerPackScenarioRunAttestationSchema)
      .min(1, "publication requires at least one scenario-run attestation"),
    previousPublishedRef: governancePinnedVersionedRefSchema.nullable(),
  })
  .strict();

export const governanceWithdrawalStageSchema = z
  .object({
    withdrawnBy: withdrawerStampSchema,
    reasonKey: stableKeySchema,
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* Governance record — discriminated by lifecycle state                       */
/* -------------------------------------------------------------------------- */

const recordBase = {
  governanceRecordId: uuidSchema,
  pack: careerPackSchema,
  contentHash: sha256HashSchema,
  author: authorStampSchema,
};

export const careerPackDraftRecordSchema = z
  .object({ ...recordBase, state: z.literal("draft") })
  .strict();

export const careerPackReviewedRecordSchema = z
  .object({
    ...recordBase,
    state: z.literal("reviewed"),
    review: governanceReviewStageSchema,
  })
  .strict();

export const careerPackApprovedRecordSchema = z
  .object({
    ...recordBase,
    state: z.literal("approved"),
    review: governanceReviewStageSchema,
    approval: governanceApprovalStageSchema,
  })
  .strict();

export const careerPackPublishedRecordSchema = z
  .object({
    ...recordBase,
    state: z.literal("published"),
    review: governanceReviewStageSchema,
    approval: governanceApprovalStageSchema,
    publication: governancePublicationStageSchema,
  })
  .strict();

export const careerPackWithdrawnRecordSchema = z
  .object({
    ...recordBase,
    state: z.literal("withdrawn"),
    review: governanceReviewStageSchema,
    approval: governanceApprovalStageSchema,
    publication: governancePublicationStageSchema,
    withdrawal: governanceWithdrawalStageSchema,
  })
  .strict();

export const careerPackGovernanceRecordSchema = z.discriminatedUnion("state", [
  careerPackDraftRecordSchema,
  careerPackReviewedRecordSchema,
  careerPackApprovedRecordSchema,
  careerPackPublishedRecordSchema,
  careerPackWithdrawnRecordSchema,
]);

export type CareerPackDraftRecord = z.infer<typeof careerPackDraftRecordSchema>;
export type CareerPackReviewedRecord = z.infer<typeof careerPackReviewedRecordSchema>;
export type CareerPackApprovedRecord = z.infer<typeof careerPackApprovedRecordSchema>;
export type CareerPackPublishedRecord = z.infer<typeof careerPackPublishedRecordSchema>;
export type CareerPackWithdrawnRecord = z.infer<typeof careerPackWithdrawnRecordSchema>;
export type CareerPackGovernanceRecord = z.infer<typeof careerPackGovernanceRecordSchema>;
