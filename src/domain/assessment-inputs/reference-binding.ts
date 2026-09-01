import type { EvidenceReference } from "../contracts";
import { instantsEqual, type EvidenceRecordRevision } from "../evidence-registry";

/**
 * Pure binding check between a Career Pack `EvidenceReference` and the exact
 * immutable revision a SUPPLIED historical Evidence Context Snapshot embeds
 * under the same `evidenceKey`.
 *
 * This deliberately never consults the current Evidence Registry: a historical
 * supplied document is validated against the pinned reference plus its own
 * embedded revision only, so later registry change can never rewrite history.
 * No registry resolution is duplicated and no evidence semantics are invented —
 * the Increment 7 exact-instant comparison is reused for `retrievedAt`.
 */

/** Machine-readable field names that failed the binding check, in fixed order. */
export type EvidenceBindingMismatchField =
  | "sourceId"
  | "sourceRecordKey"
  | "recordVersion"
  | "recordContentHash"
  | "grade"
  | "participantClassification"
  | "retrievedAt";

/**
 * Identity is always required. Optional reference fields are enforced only when
 * the Career Pack declares them (`null`/absent declares nothing and therefore
 * pins nothing — it never becomes a mismatch and never weakens the revision).
 */
export function evidenceBindingMismatches(
  reference: EvidenceReference,
  revision: EvidenceRecordRevision,
): readonly EvidenceBindingMismatchField[] {
  const mismatches: EvidenceBindingMismatchField[] = [];

  if (revision.sourceId !== reference.sourceId) mismatches.push("sourceId");
  if (revision.sourceRecordKey !== reference.sourceRecordKey) mismatches.push("sourceRecordKey");

  if (reference.recordVersion != null && revision.recordVersion !== reference.recordVersion) {
    mismatches.push("recordVersion");
  }
  if (
    reference.recordContentHash != null &&
    revision.recordContentHash !== reference.recordContentHash
  ) {
    mismatches.push("recordContentHash");
  }
  if (reference.grade != null && revision.grade !== reference.grade) {
    mismatches.push("grade");
  }
  if (
    reference.participantClassification != null &&
    revision.participantClassification !== reference.participantClassification
  ) {
    mismatches.push("participantClassification");
  }
  if (
    reference.retrievedAt != null &&
    !instantsEqual(revision.retrievedAt, reference.retrievedAt)
  ) {
    mismatches.push("retrievedAt");
  }

  return mismatches;
}
