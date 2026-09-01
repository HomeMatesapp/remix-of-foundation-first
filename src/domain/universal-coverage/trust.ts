import { z } from "zod";

import {
  OCCUPATION_CLARIFICATION_REASONS,
  OCCUPATION_MATCH_MODES,
  OCCUPATION_TERM_CATEGORIES,
  OCCUPATION_UNMATCHED_REASONS,
  occupationRefOf,
  type OccupationClarificationReason,
  type OccupationRef,
  type OccupationUnmatchedReason,
  type OccupationUniverse,
} from "../occupation-universe";
import type { CoverageTrustIssue } from "./codes";
import { freezeCoverageDocument, type CoverageOccupationRef } from "./schema";

/**
 * Runtime trust boundary for occupation intent supplied to this layer.
 *
 * This increment deliberately does NOT rerun occupation string search: a caller
 * may supply an existing Increment 12 `OccupationResolution`. But a TypeScript
 * type is not a runtime guarantee, so at the public boundary that resolution is
 * treated as untrusted input and reconciled against the canonical universe.
 *
 * Only the existing Increment 12 vocabulary is reused; no new clarification or
 * unmatched reason semantic is created here.
 */

const canonicalRefShape = z
  .object({
    occupationId: z.string(),
    occupationKey: z.string(),
    canonicalTitle: z.string(),
  })
  .strict();

const suppliedResolutionSchema = z.discriminatedUnion("outcome", [
  z
    .object({
      outcome: z.literal("resolved"),
      occupationId: z.string(),
      occupationKey: z.string(),
      canonicalTitle: z.string(),
      matchedTerm: z.string(),
      termCategory: z.enum(OCCUPATION_TERM_CATEGORIES),
      matchMode: z.enum(OCCUPATION_MATCH_MODES),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("clarification_required"),
      reason: z.enum(OCCUPATION_CLARIFICATION_REASONS),
      candidates: z.array(canonicalRefShape).min(1),
    })
    .strict(),
  z
    .object({
      outcome: z.literal("unmatched"),
      reason: z.enum(OCCUPATION_UNMATCHED_REASONS),
      rawQuery: z.string(),
      normalisedQuery: z.string(),
    })
    .strict(),
]);

/**
 * Occupation intent that has been reconciled against canonical truth.
 *
 * Identity carried here is always canonical-universe truth, never a caller
 * field, so a spoofed title or key can never reach coverage output.
 */
export type VerifiedOccupationIntent =
  | { readonly kind: "resolved"; readonly occupation: CoverageOccupationRef }
  | {
      readonly kind: "clarification_required";
      readonly reason: OccupationClarificationReason;
      readonly candidates: readonly OccupationRef[];
    }
  | {
      readonly kind: "unmatched";
      readonly reason: OccupationUnmatchedReason;
      readonly rawQuery: string;
      readonly normalisedQuery: string;
    };

export type VerifiedOccupationIntentResult =
  | { readonly ok: true; readonly intent: VerifiedOccupationIntent }
  | { readonly ok: false; readonly issues: readonly CoverageTrustIssue[] };

/**
 * Reconcile one supplied identity triple against the canonical universe.
 *
 * Exact id AND exact key must identify the SAME canonical record, and the
 * supplied canonical title must match that record exactly.
 */
function reconcileRef(
  universe: OccupationUniverse,
  supplied: z.infer<typeof canonicalRefShape>,
  at: string,
):
  | { readonly ok: true; readonly ref: OccupationRef }
  | { readonly ok: false; readonly issue: CoverageTrustIssue } {
  const byId = universe.find((record) => record.occupationId === supplied.occupationId);
  if (!byId) {
    return {
      ok: false,
      issue: {
        code: "occupation_resolution_mismatch",
        message: "no canonical occupation carries the supplied occupation id",
        at,
      },
    };
  }
  if (byId.occupationKey !== supplied.occupationKey) {
    return {
      ok: false,
      issue: {
        code: "occupation_resolution_mismatch",
        message: "occupation id and occupation key identify different canonical occupations",
        at,
      },
    };
  }
  if (byId.canonicalTitle !== supplied.canonicalTitle) {
    return {
      ok: false,
      issue: {
        code: "occupation_resolution_mismatch",
        message: "supplied canonical title contradicts canonical occupation truth",
        at,
      },
    };
  }
  return { ok: true, ref: occupationRefOf(byId) };
}

export function verifyOccupationIntent(
  universe: OccupationUniverse,
  suppliedResolution: unknown,
): VerifiedOccupationIntentResult {
  const parsed = suppliedResolutionSchema.safeParse(suppliedResolution);
  if (!parsed.success) {
    return {
      ok: false,
      issues: freezeCoverageDocument(
        parsed.error.issues.map((issue) => ({
          code: "occupation_resolution_invalid" as const,
          message: issue.message,
          at: issue.path.join("."),
        })),
      ),
    };
  }

  const supplied = parsed.data;

  if (supplied.outcome === "unmatched") {
    /* Unrecognised intent asserts no legitimacy, so there is nothing to
       reconcile beyond the existing Increment 12 reason vocabulary. */
    return {
      ok: true,
      intent: freezeCoverageDocument({
        kind: "unmatched" as const,
        reason: supplied.reason,
        rawQuery: supplied.rawQuery,
        normalisedQuery: supplied.normalisedQuery,
      }),
    };
  }

  if (supplied.outcome === "clarification_required") {
    const issues: CoverageTrustIssue[] = [];
    const refs: OccupationRef[] = [];
    supplied.candidates.forEach((candidate, index) => {
      const reconciled = reconcileRef(universe, candidate, `candidates[${index}]`);
      if (!reconciled.ok) {
        issues.push(reconciled.issue);
        return;
      }
      refs.push(reconciled.ref);
    });
    if (issues.length > 0) return { ok: false, issues: freezeCoverageDocument(issues) };

    const distinct = new Set(refs.map((ref) => ref.occupationKey));
    if (distinct.size < 2) {
      return {
        ok: false,
        issues: freezeCoverageDocument([
          {
            code: "occupation_resolution_invalid" as const,
            message: "clarification requires two or more distinct canonical candidates",
          },
        ]),
      };
    }

    /* Deterministic, authored-order invariant, and never narrowed to one. */
    const candidates = [...refs].sort((left, right) =>
      left.occupationKey < right.occupationKey
        ? -1
        : left.occupationKey > right.occupationKey
          ? 1
          : 0,
    );
    return {
      ok: true,
      intent: freezeCoverageDocument({
        kind: "clarification_required" as const,
        reason: supplied.reason,
        candidates,
      }),
    };
  }

  const reconciled = reconcileRef(
    universe,
    {
      occupationId: supplied.occupationId,
      occupationKey: supplied.occupationKey,
      canonicalTitle: supplied.canonicalTitle,
    },
    "occupationResolution",
  );
  if (!reconciled.ok) return { ok: false, issues: freezeCoverageDocument([reconciled.issue]) };

  return {
    ok: true,
    intent: freezeCoverageDocument({
      kind: "resolved" as const,
      occupation: {
        occupationId: reconciled.ref.occupationId,
        occupationKey: reconciled.ref.occupationKey,
        canonicalTitle: reconciled.ref.canonicalTitle,
      },
    }),
  };
}
