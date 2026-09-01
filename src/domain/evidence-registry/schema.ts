import { z } from "zod";

import {
  internalEvidenceGradeSchema,
  isoTimestampSchema,
  participantEvidenceClassificationSchema,
  sha256HashSchema,
  sourceRecordKeySchema,
  stableKeySchema,
  uuidSchema,
} from "../contracts";
import { governanceSemanticVersionSchema } from "../career-pack-governance/semver";
import { EVIDENCE_REGISTRY_SCHEMA_VERSION } from "./codes";
import { instantIsBefore } from "./instant";

/**
 * Strict evidence-registry schemas.
 *
 * Every object is `.strict()`: undeclared keys (generated claim text,
 * participant copy, scores, engine internals, credentials, raw retrieved
 * document bodies) are REJECTED rather than silently stripped.
 */

/* -------------------------------------------------------------------------- */
/* Source identity                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Deliberately minimal. No category, tier, provider, URL, participant copy,
 * commercial metadata, ingestion credential or operational field is invented
 * in this increment.
 */
export const evidenceSourceDefinitionSchema = z
  .object({
    sourceId: uuidSchema,
    /** Clear Routes-owned stable internal key. */
    sourceKey: stableKeySchema,
  })
  .strict();
export type EvidenceSourceDefinition = z.infer<typeof evidenceSourceDefinitionSchema>;

/* -------------------------------------------------------------------------- */
/* Stable source-record identity                                              */
/* -------------------------------------------------------------------------- */

/**
 * Canonical record identity is EXACTLY `sourceId + sourceRecordKey`.
 *
 * `sourceRecordKey` is never normalised, trimmed-and-stored, rewritten or
 * hash-replaced: the external key is preserved byte for byte. Only blank keys
 * are rejected, exactly as the shared primitive already specifies.
 */
export const evidenceRecordIdentitySchema = z
  .object({
    sourceId: uuidSchema,
    sourceRecordKey: sourceRecordKeySchema,
  })
  .strict();
export type EvidenceRecordIdentity = z.infer<typeof evidenceRecordIdentitySchema>;

/** Fully pinned reference to one exact immutable record revision. */
export const evidenceRecordRevisionRefSchema = z
  .object({
    sourceId: uuidSchema,
    sourceRecordKey: sourceRecordKeySchema,
    recordVersion: governanceSemanticVersionSchema,
    recordContentHash: sha256HashSchema,
  })
  .strict();
export type EvidenceRecordRevisionRef = z.infer<typeof evidenceRecordRevisionRefSchema>;

/* -------------------------------------------------------------------------- */
/* Withdrawal                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Withdrawal metadata is a timestamp plus a stable machine reason key ONLY.
 * No participant-facing prose, no free text, no actor narrative.
 */
export const evidenceWithdrawalSchema = z
  .object({
    withdrawnAt: isoTimestampSchema,
    reasonKey: stableKeySchema,
  })
  .strict();
export type EvidenceWithdrawal = z.infer<typeof evidenceWithdrawalSchema>;

/* -------------------------------------------------------------------------- */
/* Immutable evidence record revision                                         */
/* -------------------------------------------------------------------------- */

/**
 * Grade and participant classification are REQUIRED on canonical registry
 * records: an evidence record can never exist in the registry without explicit
 * declared strength. Nothing here may promote a weaker grade to a stronger one.
 */
export const evidenceRecordRevisionSchema = z
  .object({
    sourceId: uuidSchema,
    sourceRecordKey: sourceRecordKeySchema,
    recordVersion: governanceSemanticVersionSchema,
    recordContentHash: sha256HashSchema,
    grade: internalEvidenceGradeSchema,
    participantClassification: participantEvidenceClassificationSchema,
    /** Retrieval / verification instant of this exact revision. */
    retrievedAt: isoTimestampSchema,
    /** Optional review / freshness deadline. Absent means no scheduled review. */
    reviewDueAt: isoTimestampSchema.nullable().optional(),
    /** Optional pinned prior revision of the SAME source-record identity. */
    supersedes: evidenceRecordRevisionRefSchema.nullable().optional(),
    withdrawal: evidenceWithdrawalSchema.nullable().optional(),
  })
  .strict()
  .superRefine((revision, ctx) => {
    if (revision.reviewDueAt) {
      // A review deadline earlier than the retrieval instant is temporally
      // impossible and fails closed at schema level. Comparison is exact to
      // nanosecond precision, never millisecond-truncated.
      if (instantIsBefore(revision.reviewDueAt, revision.retrievedAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewDueAt"],
          message: "reviewDueAt must not be earlier than retrievedAt",
        });
      }
    }
    if (revision.withdrawal) {
      if (instantIsBefore(revision.withdrawal.withdrawnAt, revision.retrievedAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["withdrawal", "withdrawnAt"],
          message: "withdrawnAt must not be earlier than retrievedAt",
        });
      }
    }

    const prior = revision.supersedes;
    if (prior) {
      if (
        prior.sourceId === revision.sourceId &&
        prior.sourceRecordKey === revision.sourceRecordKey &&
        prior.recordVersion === revision.recordVersion &&
        prior.recordContentHash === revision.recordContentHash
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["supersedes"],
          message: "a revision must not supersede itself",
        });
      }
    }
  });
export type EvidenceRecordRevision = z.infer<typeof evidenceRecordRevisionSchema>;

/* -------------------------------------------------------------------------- */
/* Canonical registry document                                                */
/* -------------------------------------------------------------------------- */

export const evidenceRegistrySchema = z
  .object({
    registryVersion: z.literal(EVIDENCE_REGISTRY_SCHEMA_VERSION),
    sources: z.array(evidenceSourceDefinitionSchema),
    records: z.array(evidenceRecordRevisionSchema),
  })
  .strict();
export type EvidenceRegistry = z.infer<typeof evidenceRegistrySchema>;

/* -------------------------------------------------------------------------- */
/* Deterministic addressing                                                   */
/* -------------------------------------------------------------------------- */

/** Stable internal address of a source-record identity, for issue reporting. */
export function formatEvidenceRecordIdentity(identity: EvidenceRecordIdentity): string {
  return `${identity.sourceId}#${identity.sourceRecordKey}`;
}

/** Stable internal address of one exact revision, for issue reporting. */
export function formatEvidenceRevisionAddress(revision: EvidenceRecordRevisionRef): string {
  return `${formatEvidenceRecordIdentity(revision)}@${revision.recordVersion}+${revision.recordContentHash}`;
}

/**
 * Exact collision-free revision key.
 *
 * `sourceRecordKey` is an arbitrary external string: the shared contract only
 * rejects blank-equivalent values, so ANY character — including control
 * characters, `#`, `@`, `+`, tabs or `\u0000` — may legitimately occur and must
 * be preserved verbatim. Internal map/set keys therefore use deterministic JSON
 * tuple encoding so that internal identity relies on no separator-character
 * assumption and stays unambiguous for arbitrary external keys, rather than on
 * an argument about which delimiter is safe today.
 */
export function evidenceRevisionKey(revision: EvidenceRecordRevisionRef): string {
  return JSON.stringify([
    revision.sourceId,
    revision.sourceRecordKey,
    revision.recordVersion,
    revision.recordContentHash,
  ]);
}

/** Exact collision-free source-record identity key (JSON tuple encoding). */
export function evidenceIdentityKey(identity: EvidenceRecordIdentity): string {
  return JSON.stringify([identity.sourceId, identity.sourceRecordKey]);
}

/**
 * Collision-safe slot key for an identity plus one additional discriminator
 * (record version or content hash). Built from a full tuple, never by appending
 * to an already-encoded identity string.
 */
export function evidenceIdentitySlotKey(
  identity: EvidenceRecordIdentity,
  discriminator: string,
): string {
  return JSON.stringify([identity.sourceId, identity.sourceRecordKey, discriminator]);
}
