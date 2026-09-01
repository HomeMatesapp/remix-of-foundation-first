import { parseCanonicalCareerPack, type CareerPack } from "../career-packs";
import {
  GOVERNANCE_CAPABILITY_ROLES,
  type GovernanceCapability,
  type GovernanceIssue,
  type GovernanceIssueCode,
} from "./codes";
import { hashCanonicalCareerPack } from "./hash";
import { compareSemanticVersionPrecedence, governanceSemanticVersionSchema } from "./semver";
import { collectGovernanceRecordIntegrityIssues } from "./integrity";
import { validateCareerPackPublicationGate } from "./publication-gate";
import {
  careerPackApprovedRecordSchema,
  careerPackDraftRecordSchema,
  careerPackGovernanceRecordSchema,
  careerPackPublishedRecordSchema,
  careerPackReviewedRecordSchema,
  careerPackWithdrawnRecordSchema,
  governanceActorContextSchema,
  governancePinnedVersionedRefSchema,
  resolveAuthorityRole,
  type CareerPackApprovedRecord,
  type CareerPackDraftRecord,
  type CareerPackGovernanceRecord,
  type CareerPackPublishedRecord,
  type CareerPackReviewedRecord,
  type CareerPackScenarioRunAttestation,
  type CareerPackWithdrawnRecord,
  type GovernanceActorContext,
  type GovernancePinnedVersionedRef,
} from "./schema";
import { uuidSchema } from "../contracts";
import type { CareerPackLifecycleState } from "./codes";

/**
 * Pure lifecycle transitions.
 *
 * Every transition:
 * - validates its exact input state strictly,
 * - authorises the actor by internal role,
 * - enforces author != reviewer != approver,
 * - enforces monotonic timestamps,
 * - reverifies the exact canonical content hash,
 * - never mutates caller input, and
 * - returns a NEW deeply runtime-frozen record.
 *
 * NONE of these functions performs database, network, file, deployment or any
 * other I/O. They change an in-memory domain record only.
 */

export class CareerPackGovernanceError extends Error {
  readonly issues: readonly GovernanceIssue[];

  constructor(issues: readonly GovernanceIssue[]) {
    super(
      `Career Pack governance transition rejected: ${issues
        .map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "CareerPackGovernanceError";
    this.issues = issues;
  }
}

function fail(code: GovernanceIssueCode, message: string, at?: string): never {
  throw new CareerPackGovernanceError([at ? { code, message, at } : { code, message }]);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/**
 * Strict-parse the caller-supplied actor context BEFORE any authority decision.
 * A TypeScript type is never the authority boundary: an empty role array, a
 * duplicated role, an unknown role string, a non-UUID identity or an extra
 * field fails closed here.
 */
function authorise(actorInput: unknown, capability: GovernanceCapability) {
  const parsed = governanceActorContextSchema.safeParse(actorInput);
  if (!parsed.success) {
    fail(
      "invalid_actor_context",
      `actor context is not a valid internal governance actor: ${parsed.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }
  const actor = parsed.data;
  const role = resolveAuthorityRole(actor, capability);
  if (!role) {
    fail(
      "unauthorised_role",
      `capability ${capability} requires one of: ${GOVERNANCE_CAPABILITY_ROLES[capability].join(", ")}`,
    );
  }
  return { actor, role };
}

function instant(value: string): number {
  return Date.parse(value);
}

function requireNotBefore(later: string, earlier: string, label: string): void {
  if (instant(later) < instant(earlier)) {
    fail("timestamp_reversal", `${label} must not be earlier than the preceding stage timestamp`);
  }
}

function verifyHash(pack: CareerPack, contentHash: string): void {
  if (hashCanonicalCareerPack(pack) !== contentHash) {
    fail(
      "content_hash_mismatch",
      "canonical pack content does not recompute to the recorded contentHash",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Strict input parsing                                                       */
/* -------------------------------------------------------------------------- */

function parseExact<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: unknown; error?: unknown } },
  input: unknown,
  expected: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    fail("schema_invalid", `input is not a valid ${expected} governance record`);
  }
  return result.data as T;
}

/**
 * A transition may only ever start from a FULLY VALID prior record.
 *
 * Shape validity is not enough: the embedded document must be a real canonical
 * Career Pack, `contentHash` must recompute exactly, actor separation must hold
 * and stage timestamps must be monotonic. For a `published` prior record the
 * publication evidence itself must still be valid. A structurally well-formed
 * but semantically corrupt record is rejected instead of being carried forward.
 */
function requireValidPriorRecord<T>(
  input: unknown,
  expected: CareerPackLifecycleState,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: unknown } },
): T {
  const validated = validateCareerPackGovernanceRecord(input);
  if (!validated.valid) throw new CareerPackGovernanceError(validated.issues);
  if (validated.record.state !== expected) {
    fail(
      "wrong_state",
      `this transition requires a ${expected} record (state: ${validated.record.state})`,
    );
  }
  return parseExact<T>(schema, validated.record, expected);
}

/* -------------------------------------------------------------------------- */
/* 6. Draft creation                                                          */
/* -------------------------------------------------------------------------- */

export interface CreateCareerPackDraftInput {
  readonly candidatePack: unknown;
  readonly governanceRecordId: string;
  readonly author: GovernanceActorContext;
  readonly authoredAt: string;
}

/**
 * Create an immutable draft snapshot. There is deliberately no `updateDraft()`:
 * changed content means a NEW draft snapshot.
 */
export function createCareerPackDraft(input: CreateCareerPackDraftInput): CareerPackDraftRecord {
  const { actor: author, role: authorityRole } = authorise(input.author, "create_draft");
  const pack = parseCanonicalCareerPack(input.candidatePack);
  const contentHash = hashCanonicalCareerPack(pack);

  const record = parseExact<CareerPackDraftRecord>(
    careerPackDraftRecordSchema,
    {
      governanceRecordId: input.governanceRecordId,
      state: "draft",
      pack,
      contentHash,
      author: {
        internalUserId: author.internalUserId,
        authorityRole,
        at: input.authoredAt,
      },
    },
    "draft",
  );
  return deepFreeze(record);
}

/* -------------------------------------------------------------------------- */
/* 7. Review                                                                  */
/* -------------------------------------------------------------------------- */

export interface ReviewCareerPackDraftInput {
  readonly record: unknown;
  readonly reviewer: GovernanceActorContext;
  readonly reviewedAt: string;
}

export function transitionCareerPackToReviewed(
  input: ReviewCareerPackDraftInput,
): CareerPackReviewedRecord {
  const draft = requireValidPriorRecord<CareerPackDraftRecord>(
    input.record,
    "draft",
    careerPackDraftRecordSchema,
  );
  const { actor: reviewer, role: authorityRole } = authorise(input.reviewer, "review");

  if (reviewer.internalUserId === draft.author.internalUserId) {
    fail("actor_separation_violation", "reviewer must differ from author, including for admin");
  }
  requireNotBefore(input.reviewedAt, draft.author.at, "reviewedAt");
  verifyHash(draft.pack, draft.contentHash);

  const record = parseExact<CareerPackReviewedRecord>(
    careerPackReviewedRecordSchema,
    {
      governanceRecordId: draft.governanceRecordId,
      state: "reviewed",
      pack: draft.pack,
      contentHash: draft.contentHash,
      author: draft.author,
      review: {
        reviewer: {
          internalUserId: reviewer.internalUserId,
          authorityRole,
          at: input.reviewedAt,
        },
      },
    },
    "reviewed",
  );
  return deepFreeze(record);
}

/* -------------------------------------------------------------------------- */
/* 8. Approval                                                                */
/* -------------------------------------------------------------------------- */

export interface ApproveCareerPackInput {
  readonly record: unknown;
  readonly approver: GovernanceActorContext;
  readonly approvedAt: string;
}

export function transitionCareerPackToApproved(
  input: ApproveCareerPackInput,
): CareerPackApprovedRecord {
  const reviewed = requireValidPriorRecord<CareerPackReviewedRecord>(
    input.record,
    "reviewed",
    careerPackReviewedRecordSchema,
  );
  const { actor: approver, role: authorityRole } = authorise(input.approver, "approve");

  if (approver.internalUserId === reviewed.author.internalUserId) {
    fail("actor_separation_violation", "approver must differ from author, including for admin");
  }
  if (approver.internalUserId === reviewed.review.reviewer.internalUserId) {
    fail("actor_separation_violation", "approver must differ from reviewer, including for admin");
  }
  requireNotBefore(input.approvedAt, reviewed.review.reviewer.at, "approvedAt");
  verifyHash(reviewed.pack, reviewed.contentHash);

  const record = parseExact<CareerPackApprovedRecord>(
    careerPackApprovedRecordSchema,
    {
      governanceRecordId: reviewed.governanceRecordId,
      state: "approved",
      pack: reviewed.pack,
      contentHash: reviewed.contentHash,
      author: reviewed.author,
      review: reviewed.review,
      approval: {
        approver: {
          internalUserId: approver.internalUserId,
          authorityRole,
          at: input.approvedAt,
        },
      },
    },
    "approved",
  );
  return deepFreeze(record);
}

/* -------------------------------------------------------------------------- */
/* 11. Semantic-version lineage gate                                          */
/* -------------------------------------------------------------------------- */

export interface CareerPackLineageInput {
  /** Untrusted candidate pack identity. */
  readonly careerPackId: unknown;
  /** Untrusted candidate pack version. */
  readonly candidateVersion: unknown;
  /**
   * Untrusted latest HISTORICALLY published reference, or `null` for a first
   * publication. It must be a complete pinned ref: `id`, `version` and
   * `contentHash`. A partial or extra-field ref fails closed.
   */
  readonly previousPublishedRef: unknown;
}

export type CareerPackLineageResult =
  { readonly ok: true } | { readonly ok: false; readonly issues: readonly GovernanceIssue[] };

/**
 * Strictly monotonic SemVer precedence. No bump-category semantics are implied.
 * Withdrawal never permits version reuse: the caller must still supply the
 * latest HISTORICALLY published ref.
 */
export function validateCareerPackVersionLineage(
  input: CareerPackLineageInput,
): CareerPackLineageResult {
  const issues: GovernanceIssue[] = [];

  const careerPackId = uuidSchema.safeParse(input.careerPackId);
  if (!careerPackId.success) {
    issues.push({
      code: "invalid_lineage_ref",
      message: "candidate careerPackId is not a valid identifier",
    });
  }
  const candidateVersion = governanceSemanticVersionSchema.safeParse(input.candidateVersion);
  if (!candidateVersion.success) {
    issues.push({
      code: "version_not_greater",
      message: "candidate version is not a strict SemVer 2.0.0 version",
    });
  }
  if (input.previousPublishedRef === null || input.previousPublishedRef === undefined) {
    // First publication in the lineage: nothing to outrank, but the candidate
    // identity and version must still be well formed.
    return issues.length === 0 ? { ok: true } : { ok: false, issues };
  }
  const parsedPrevious = governancePinnedVersionedRefSchema.safeParse(input.previousPublishedRef);
  if (!parsedPrevious.success) {
    issues.push({
      code: "invalid_lineage_ref",
      message:
        "previousPublishedRef must be a complete pinned reference with id, strict SemVer version and content hash",
    });
    return { ok: false, issues };
  }
  if (issues.length > 0) return { ok: false, issues };
  const previous: GovernancePinnedVersionedRef = parsedPrevious.data;

  if (previous.id !== careerPackId.data) {
    issues.push({
      code: "lineage_pack_mismatch",
      message: "previousPublishedRef.id must equal the candidate pack careerPackId",
    });
    return { ok: false, issues };
  }
  const comparison = compareSemanticVersionPrecedence(candidateVersion.data!, previous.version);
  if (comparison !== 1) {
    issues.push({
      code: "version_not_greater",
      message: `candidate version ${candidateVersion.data} must have strictly greater SemVer precedence than ${previous.version} (build metadata is ignored for precedence)`,
    });
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/* -------------------------------------------------------------------------- */
/* 12. Publication — DOMAIN STATE ONLY, NOT LIVE PUBLISHING                   */
/* -------------------------------------------------------------------------- */

export interface TransitionCareerPackToPublishedInput {
  readonly record: unknown;
  readonly publisher: GovernanceActorContext;
  readonly publishedAt: string;
  /** Untrusted requested Decision Engine version. */
  readonly decisionEngineVersion: unknown;
  /** Untrusted attestation set. */
  readonly attestations: unknown;
  /** Untrusted complete pinned ref to the latest historically published version. */
  readonly previousPublishedRef: unknown;
}

/**
 * Marks the DOMAIN governance record as `published`.
 *
 * This performs ZERO database, network, file, cache, deployment or public
 * exposure I/O. It is NOT a live publishing action and must never be mistaken
 * for one. Live publication remains an owner hard gate.
 */
export function transitionCareerPackToPublished(
  input: TransitionCareerPackToPublishedInput,
): CareerPackPublishedRecord {
  const approved = requireValidPriorRecord<CareerPackApprovedRecord>(
    input.record,
    "approved",
    careerPackApprovedRecordSchema,
  );
  const { actor: publisher, role: authorityRole } = authorise(input.publisher, "publish");

  requireNotBefore(input.publishedAt, approved.approval.approver.at, "publishedAt");
  verifyHash(approved.pack, approved.contentHash);

  const lineage = validateCareerPackVersionLineage({
    careerPackId: approved.pack.careerPackId,
    candidateVersion: approved.pack.version,
    previousPublishedRef: input.previousPublishedRef,
  });
  if (!lineage.ok) throw new CareerPackGovernanceError(lineage.issues);

  const gate = validateCareerPackPublicationGate({
    record: approved,
    decisionEngineVersion: input.decisionEngineVersion,
    attestations: input.attestations,
  });
  if (!gate.ok) throw new CareerPackGovernanceError(gate.issues);

  const record = parseExact<CareerPackPublishedRecord>(
    careerPackPublishedRecordSchema,
    {
      governanceRecordId: approved.governanceRecordId,
      state: "published",
      pack: approved.pack,
      contentHash: approved.contentHash,
      author: approved.author,
      review: approved.review,
      approval: approved.approval,
      publication: {
        publisher: {
          internalUserId: publisher.internalUserId,
          authorityRole,
          at: input.publishedAt,
        },
        decisionEngineVersion: input.decisionEngineVersion,
        attestations: Array.isArray(input.attestations)
          ? input.attestations.map((attestation: CareerPackScenarioRunAttestation) => ({
              ...attestation,
            }))
          : input.attestations,
        previousPublishedRef:
          input.previousPublishedRef === null || input.previousPublishedRef === undefined
            ? null
            : { ...(input.previousPublishedRef as GovernancePinnedVersionedRef) },
      },
    },
    "published",
  );
  return deepFreeze(record);
}

/* -------------------------------------------------------------------------- */
/* 14. Withdrawal                                                             */
/* -------------------------------------------------------------------------- */

export interface WithdrawCareerPackInput {
  readonly record: unknown;
  readonly actor: GovernanceActorContext;
  readonly withdrawnAt: string;
  readonly reasonKey: string;
}

/** Withdrawal is not deletion: all published truth and history is preserved. */
export function transitionCareerPackToWithdrawn(
  input: WithdrawCareerPackInput,
): CareerPackWithdrawnRecord {
  const published = requireValidPriorRecord<CareerPackPublishedRecord>(
    input.record,
    "published",
    careerPackPublishedRecordSchema,
  );
  const { actor: withdrawer, role: authorityRole } = authorise(input.actor, "withdraw");

  requireNotBefore(input.withdrawnAt, published.publication.publisher.at, "withdrawnAt");
  verifyHash(published.pack, published.contentHash);

  const record = parseExact<CareerPackWithdrawnRecord>(
    careerPackWithdrawnRecordSchema,
    {
      governanceRecordId: published.governanceRecordId,
      state: "withdrawn",
      pack: published.pack,
      contentHash: published.contentHash,
      author: published.author,
      review: published.review,
      approval: published.approval,
      publication: published.publication,
      withdrawal: {
        withdrawnBy: {
          internalUserId: withdrawer.internalUserId,
          authorityRole,
          at: input.withdrawnAt,
        },
        reasonKey: input.reasonKey,
      },
    },
    "withdrawn",
  );
  return deepFreeze(record);
}

/* -------------------------------------------------------------------------- */
/* 16. Strict external record validation                                      */
/* -------------------------------------------------------------------------- */

export type GovernanceRecordValidationResult =
  | { readonly valid: true; readonly record: CareerPackGovernanceRecord }
  | { readonly valid: false; readonly issues: readonly GovernanceIssue[] };

/**
 * Fail-closed validation of an externally supplied governance record: strict
 * schema, actor separation, monotonic timestamps, exact content hash and (for
 * published/withdrawn records) a valid attestation set.
 */
export function validateCareerPackGovernanceRecord(
  input: unknown,
): GovernanceRecordValidationResult {
  const parsed = careerPackGovernanceRecordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "schema_invalid" as const,
        message: issue.message,
        at: issue.path.join("."),
      })),
    };
  }
  const record = parsed.data;
  const issues: GovernanceIssue[] = [...collectGovernanceRecordIntegrityIssues(record).issues];

  if ("publication" in record) {
    const approvedView = {
      governanceRecordId: record.governanceRecordId,
      state: "approved" as const,
      pack: record.pack,
      contentHash: record.contentHash,
      author: record.author,
      review: record.review,
      approval: record.approval,
    };
    const gate = validateCareerPackPublicationGate({
      record: approvedView,
      decisionEngineVersion: record.publication.decisionEngineVersion,
      attestations: record.publication.attestations,
    });
    if (!gate.ok) issues.push(...gate.issues);

    const lineage = validateCareerPackVersionLineage({
      careerPackId: record.pack.careerPackId,
      candidateVersion: record.pack.version,
      previousPublishedRef: record.publication.previousPublishedRef,
    });
    if (!lineage.ok) issues.push(...lineage.issues);
  }

  if (issues.length > 0) return { valid: false, issues };
  return { valid: true, record: deepFreeze(record) };
}
