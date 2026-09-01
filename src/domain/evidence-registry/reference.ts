import { evidenceReferenceSchema, type EvidenceReference } from "../contracts";
import type { EvidenceReferenceIssue } from "./codes";
import { instantsEqual } from "./instant";
import {
  collectRecordRevisions,
  findEvidenceSource,
  resolveCurrentUsableRevision,
  findTerminalRecordRevision,
} from "./lookup";
import {
  formatEvidenceRecordIdentity,
  type EvidenceRecordRevision,
  type EvidenceRegistry,
} from "./schema";

/**
 * Pure reconciliation between an Increment 2 `evidenceReferenceSchema` value and
 * the canonical registry.
 *
 * The shared reference contract is CONSUMED unchanged and never weakened. Any
 * contradiction fails closed: a mismatched grade, classification, version, hash
 * or verification instant is an error, never a silent correction.
 */

export type EvidenceReferenceResolution =
  | { readonly ok: true; readonly revision: EvidenceRecordRevision }
  | { readonly ok: false; readonly issues: readonly EvidenceReferenceIssue[] };

function fail(
  code: EvidenceReferenceIssue["code"],
  message: string,
  at?: string,
): EvidenceReferenceResolution {
  return { ok: false, issues: [at === undefined ? { code, message } : { code, message, at }] };
}

export function resolveEvidenceReference(
  registry: EvidenceRegistry,
  input: unknown,
): EvidenceReferenceResolution {
  const parsed = evidenceReferenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "reference_invalid" as const,
        message: issue.message,
        at: issue.path.join("."),
      })),
    };
  }
  const reference: EvidenceReference = parsed.data;
  const identity = { sourceId: reference.sourceId, sourceRecordKey: reference.sourceRecordKey };
  const at = formatEvidenceRecordIdentity(identity);

  if (!findEvidenceSource(registry, reference.sourceId)) {
    return fail("unknown_source", "sourceId is not declared in the registry", at);
  }
  const revisions = collectRecordRevisions(registry, identity);
  if (revisions.length === 0) {
    return fail("unknown_record", "sourceRecordKey is not declared for this source", at);
  }

  const pinnedVersion = reference.recordVersion ?? null;
  const pinnedHash = reference.recordContentHash ?? null;

  let resolved: EvidenceRecordRevision;
  if (pinnedVersion !== null) {
    const byVersion = revisions.find((revision) => revision.recordVersion === pinnedVersion);
    if (!byVersion) {
      return fail("version_mismatch", "no revision carries the pinned recordVersion", at);
    }
    if (pinnedHash !== null && byVersion.recordContentHash !== pinnedHash) {
      return fail(
        "content_hash_mismatch",
        "pinned recordVersion and recordContentHash identify different revisions",
        at,
      );
    }
    resolved = byVersion;
  } else if (pinnedHash !== null) {
    const byHash = revisions.find((revision) => revision.recordContentHash === pinnedHash);
    if (!byHash) {
      return fail("content_hash_mismatch", "no revision carries the pinned recordContentHash", at);
    }
    resolved = byHash;
  } else {
    // Unpinned current-use reference: exactly one unambiguous non-withdrawn
    // terminal revision, derived from lineage only.
    const current = resolveCurrentUsableRevision(registry, identity);
    if (!current) {
      const terminal = findTerminalRecordRevision(registry, identity);
      if (terminal?.withdrawal) {
        return fail(
          "current_revision_withdrawn",
          "the terminal revision is withdrawn and is not usable current evidence",
          at,
        );
      }
      return fail("unknown_revision", "no unambiguous current revision is determinable", at);
    }
    resolved = current;
  }

  const issues: EvidenceReferenceIssue[] = [];
  if (reference.grade != null && reference.grade !== resolved.grade) {
    issues.push({
      code: "grade_mismatch",
      message: "reference grade contradicts the canonical record grade",
      at,
    });
  }
  if (
    reference.participantClassification != null &&
    reference.participantClassification !== resolved.participantClassification
  ) {
    issues.push({
      code: "participant_classification_mismatch",
      message: "reference classification contradicts the canonical record classification",
      at,
    });
  }
  if (
    reference.retrievedAt != null &&
    !instantsEqual(reference.retrievedAt, resolved.retrievedAt)
  ) {
    issues.push({
      code: "retrieved_at_mismatch",
      message: "reference retrievedAt contradicts the canonical record retrievedAt",
      at,
    });
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, revision: resolved };
}
