/**
 * Increment 17 Stage C — conservative UK full-postcode SHAPE check.
 *
 * This is a formatting courtesy only. It deliberately does NOT claim the
 * postcode exists, does not geocode it, does not infer coordinates, does not
 * determine a local authority, does not calculate distance and consults no
 * postcode dataset of any kind. There is no network call and no lookup.
 *
 * Any normalised value produced here is TRANSIENT: it is handed to the caller
 * for an immediate in-memory hand-off and is never returned as state, never
 * written to any durable surface and never displayed back after hand-off.
 */

/**
 * Conservative full-postcode shape. Outward + inward, with the special
 * `GIR 0AA` case. Partial postcodes (outward or sector only) are deliberately
 * NOT accepted here because Stage C collects a full postcode when — and only
 * when — a bound Career Pack declares a local requirement.
 */
const FULL_POSTCODE_SHAPE = /^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/;

export type PostcodeShapeCheck =
  | { readonly ok: true; readonly transientNormalised: string }
  | { readonly ok: false; readonly message: string };

/** Message shown when the typed value is not yet a full-postcode shape. */
export const POSTCODE_SHAPE_MESSAGE =
  "That does not look like a complete UK postcode yet. Enter it in full, for example the outward part, a space, then the inward part.";

/** Message shown when nothing has been typed at all. */
export const POSTCODE_EMPTY_MESSAGE =
  "Enter your full UK postcode, or choose Skip for now if you would rather not.";

/**
 * Shape-check a typed value WITHOUT mutating or storing it.
 *
 * The typed value the participant sees is untouched: normalisation happens only
 * on the transient copy handed straight to the caller.
 */
export function checkPostcodeShape(typedValue: string): PostcodeShapeCheck {
  const collapsed = typedValue.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return { ok: false, message: POSTCODE_EMPTY_MESSAGE };

  const candidate = collapsed.toUpperCase();
  if (!FULL_POSTCODE_SHAPE.test(candidate)) {
    return { ok: false, message: POSTCODE_SHAPE_MESSAGE };
  }

  /* Single-space canonical spacing on the TRANSIENT copy only. */
  const compact = candidate.replace(/ /g, "");
  const transientNormalised = `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`;
  return { ok: true, transientNormalised };
}
