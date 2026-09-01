import type { OccupationUnmatchedReason } from "../occupation-universe";
import {
  freezeCoverageDocument,
  unrecognisedIntentCaptureSchema,
  type UnrecognisedIntentCapture,
} from "./schema";

/**
 * Unrecognised-intent capture descriptor construction.
 *
 * Pure description of what a later adapter MAY persist. Nothing here writes,
 * queues or records anything, and `recognisedOccupation` is pinned false so no
 * downstream layer can treat unrecognised text as a legitimate occupation.
 */
export function buildUnrecognisedIntentCapture(input: {
  readonly rawQuery: string;
  readonly normalisedQuery: string;
  readonly unmatchedReason: OccupationUnmatchedReason;
}): UnrecognisedIntentCapture {
  const capture = unrecognisedIntentCaptureSchema.parse({
    kind: "unrecognised_intent_capture",
    recognisedOccupation: false,
    rawQuery: input.rawQuery,
    normalisedQuery: input.normalisedQuery,
    unmatchedReason: input.unmatchedReason,
    requiredEscalations: ["unrecognised_intent_capture_needed", "content_review_needed"],
  });
  return freezeCoverageDocument(capture);
}
