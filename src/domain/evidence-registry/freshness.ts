import { isoTimestampSchema } from "../contracts";
import { instantIsAtOrAfter } from "./instant";
import type { EvidenceRecordRevision } from "./schema";

/**
 * Deterministic freshness evaluation.
 *
 * `asOf` is ALWAYS supplied by the caller. Canonical evaluation never reads
 * ambient current time, never uses timers and is therefore reproducible for any
 * historical instant.
 */

export interface EvidenceFreshness {
  /** Explicit deadline as stored, or `null` when none is declared. */
  readonly reviewDueAt: string | null;
  /** True only when a deadline exists and `asOf` is at or after it. */
  readonly reviewDue: boolean;
}

export function evaluateEvidenceFreshness(
  revision: EvidenceRecordRevision,
  asOf: string,
): EvidenceFreshness {
  const instant = isoTimestampSchema.parse(asOf);
  const deadline = revision.reviewDueAt ?? null;
  // No deadline means NOT automatically stale or due. Absence of a review
  // schedule is never converted into a conclusion.
  if (deadline === null) return { reviewDueAt: null, reviewDue: false };
  return { reviewDueAt: deadline, reviewDue: instantIsAtOrAfter(instant, deadline) };
}

/** Convenience boolean form of {@link evaluateEvidenceFreshness}. */
export function isEvidenceReviewDue(revision: EvidenceRecordRevision, asOf: string): boolean {
  return evaluateEvidenceFreshness(revision, asOf).reviewDue;
}
