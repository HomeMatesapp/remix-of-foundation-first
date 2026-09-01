import type { CareerPackOccupationRef } from "../career-packs";
import type { OccupationBindingIssueCode } from "./codes";
import type { OccupationRecord, OccupationUniverse } from "./schema";

/**
 * Career Pack → canonical occupation binding.
 *
 * Binding is IDENTITY resolution, not search. It never consults aliases,
 * specialisms, abbreviations, colloquial or emerging titles, and never applies
 * normalisation or fuzzy matching: a Career Pack must point at exactly one
 * canonical occupation or fail closed.
 *
 * `careerPackOccupationRefSchema.occupationId` stays optional — that closed
 * schema is not changed by this increment — so this helper prefers the exact
 * `occupationId` when present and otherwise resolves the exact `occupationKey`.
 * No Career Pack is mutated.
 */

export interface OccupationBindingFailure {
  readonly ok: false;
  readonly code: OccupationBindingIssueCode;
  readonly message: string;
}

export type OccupationBindingOutcome =
  { readonly ok: true; readonly occupation: OccupationRecord } | OccupationBindingFailure;

export function bindCareerPackOccupation(
  universe: OccupationUniverse,
  ref: CareerPackOccupationRef,
): OccupationBindingOutcome {
  const byKey = universe.find((record) => record.occupationKey === ref.occupationKey);

  if (ref.occupationId != null) {
    const byId = universe.find((record) => record.occupationId === ref.occupationId);
    if (!byId) {
      return {
        ok: false,
        code: "unknown_occupation_id",
        message: "no canonical occupation carries the referenced occupation id",
      };
    }
    if (byId.occupationKey !== ref.occupationKey) {
      return {
        ok: false,
        code: "identity_mismatch",
        message: "occupation id and occupation key identify different canonical occupations",
      };
    }
    return { ok: true, occupation: byId };
  }

  if (!byKey) {
    return {
      ok: false,
      code: "unknown_occupation_key",
      message: "no canonical occupation carries the referenced occupation key",
    };
  }
  return { ok: true, occupation: byKey };
}
