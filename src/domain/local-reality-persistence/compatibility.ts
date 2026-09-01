/**
 * Increment 17, Stage D2 — relational-binding compatibility check.
 *
 * Stage A remains an IMMUTABLE fact contract: its `availabilityConfidenceKey`
 * stays an opaque stable key and is NOT retroactively narrowed to the four
 * approved relational members. Stage D2 is the relational binding gate, so a
 * canonical snapshot carrying a key outside the approved relational vocabulary
 * is still perfectly valid Stage A input and simply fails to BIND here.
 *
 * Pure and total: no client, no input/output, no network, no environment.
 */

import { deepFreezeDocument } from "../local-reality/canonical";
import type { LocalRealitySnapshot } from "../local-reality/schema";
import { APPROVED_AVAILABILITY_CONFIDENCE_VALUES } from "./decisions";

export const RELATIONAL_BINDING_ISSUE_CODES = Object.freeze([
  "availability_confidence_key_outside_approved_vocabulary",
] as const);
export type RelationalBindingIssueCode = (typeof RELATIONAL_BINDING_ISSUE_CODES)[number];

export interface RelationalBindingIssue {
  readonly code: RelationalBindingIssueCode;
  /** Stable internal address of the canonical field concerned. */
  readonly at: string;
  /** Internal reviewer-facing reason. Never participant-facing copy. */
  readonly reason: string;
}

export interface RelationalBindingCompatibility {
  readonly bindable: boolean;
  readonly issues: readonly RelationalBindingIssue[];
}

function isApprovedAvailabilityConfidenceValue(value: string): boolean {
  return (APPROVED_AVAILABILITY_CONFIDENCE_VALUES as readonly string[]).includes(value);
}

/**
 * Reports whether every item of a canonical Stage A snapshot could bind to the
 * approved relational availability vocabulary. Exact match only: no trimming,
 * case folding, aliasing or nearest-member widening of any kind.
 */
export function checkRelationalBindingCompatibility(
  snapshot: LocalRealitySnapshot,
): RelationalBindingCompatibility {
  const issues: RelationalBindingIssue[] = [];

  snapshot.items.forEach((item, index) => {
    if (!isApprovedAvailabilityConfidenceValue(item.availabilityConfidenceKey)) {
      issues.push({
        code: "availability_confidence_key_outside_approved_vocabulary",
        at: `items.${index}.availabilityConfidenceKey`,
        reason:
          "the canonical opaque key is not exactly one of the approved relational members, so it must not be bound, coerced or normalised into the relational column",
      });
    }
  });

  return deepFreezeDocument({ bindable: issues.length === 0, issues });
}
