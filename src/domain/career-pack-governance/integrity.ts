import { safeParseCanonicalCareerPack, type CareerPack } from "../career-packs";

import type { GovernanceIssue } from "./codes";
import { hashCanonicalCareerPack } from "./hash";
import type { CareerPackGovernanceRecord } from "./schema";

/**
 * Shared, pure, NON-CIRCULAR semantic integrity checks for a governance record.
 *
 * This module deliberately knows nothing about lifecycle transitions, the
 * publication gate or projection, so both the gate and external record
 * validation can consume it without circular evaluator logic.
 *
 * It performs no I/O of any kind.
 */

export interface GovernanceRecordIntegrity {
  readonly issues: readonly GovernanceIssue[];
  /** The canonically parsed pack, present only when the pack is canonical. */
  readonly canonicalPack: CareerPack | null;
}

function instant(value: string): number {
  return Date.parse(value);
}

/**
 * Validate that the embedded document is a REAL canonical Career Pack
 * (Increment 5 whole-document boundary) and that `contentHash` is the exact
 * hash of that canonical pack.
 */
export function collectCanonicalPackIssues(
  pack: unknown,
  contentHash: string,
): GovernanceRecordIntegrity {
  const canonical = safeParseCanonicalCareerPack(pack);
  if (!canonical.ok) {
    return {
      canonicalPack: null,
      issues: canonical.issues.map((issue) => ({
        code: "schema_invalid" as const,
        message: `embedded document is not a valid canonical Career Pack: ${issue.message}`,
        ...(issue.at ? { at: issue.at } : {}),
      })),
    };
  }
  if (hashCanonicalCareerPack(canonical.pack) !== contentHash) {
    return {
      canonicalPack: canonical.pack,
      issues: [
        {
          code: "content_hash_mismatch",
          message: "canonical pack content does not recompute to the recorded contentHash",
        },
      ],
    };
  }
  return { canonicalPack: canonical.pack, issues: [] };
}

/**
 * Actor separation (`author != reviewer != approver`, including `admin`) and
 * monotonic stage timestamps for whatever stages the record actually carries.
 *
 * Publisher separation is deliberately NOT enforced: the publisher may equal
 * the approver, and the withdrawal actor need not be separated.
 */
export function collectActorAndTimelineIssues(
  record: CareerPackGovernanceRecord,
): readonly GovernanceIssue[] {
  const issues: GovernanceIssue[] = [];

  const author = record.author;
  const reviewer = "review" in record ? record.review.reviewer : null;
  const approver = "approval" in record ? record.approval.approver : null;
  const publisher = "publication" in record ? record.publication.publisher : null;
  const withdrawer = "withdrawal" in record ? record.withdrawal.withdrawnBy : null;

  if (reviewer && reviewer.internalUserId === author.internalUserId) {
    issues.push({ code: "actor_separation_violation", message: "reviewer equals author" });
  }
  if (approver && approver.internalUserId === author.internalUserId) {
    issues.push({ code: "actor_separation_violation", message: "approver equals author" });
  }
  if (approver && reviewer && approver.internalUserId === reviewer.internalUserId) {
    issues.push({ code: "actor_separation_violation", message: "approver equals reviewer" });
  }

  const ordered: readonly (readonly [string, string])[] = [
    ["authoredAt", author.at] as const,
    ...(reviewer ? [["reviewedAt", reviewer.at] as const] : []),
    ...(approver ? [["approvedAt", approver.at] as const] : []),
    ...(publisher ? [["publishedAt", publisher.at] as const] : []),
    ...(withdrawer ? [["withdrawnAt", withdrawer.at] as const] : []),
  ];
  for (let index = 1; index < ordered.length; index += 1) {
    const [label, later] = ordered[index]!;
    const [, earlier] = ordered[index - 1]!;
    if (instant(later) < instant(earlier)) {
      issues.push({
        code: "timestamp_reversal",
        message: `${label} is earlier than the preceding stage timestamp`,
      });
    }
  }
  return issues;
}

/**
 * Combined canonical-content and actor/timeline integrity for a record whose
 * envelope has ALREADY been strict-parsed.
 */
export function collectGovernanceRecordIntegrityIssues(
  record: CareerPackGovernanceRecord,
): GovernanceRecordIntegrity {
  const canonical = collectCanonicalPackIssues(record.pack, record.contentHash);
  return {
    canonicalPack: canonical.canonicalPack,
    issues: [...canonical.issues, ...collectActorAndTimelineIssues(record)],
  };
}
