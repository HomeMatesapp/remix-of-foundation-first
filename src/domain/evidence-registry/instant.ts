import { isoTimestampSchema } from "../contracts";

/**
 * Exact instant comparison for the shared `isoTimestampSchema` vocabulary.
 *
 * `isoTimestampSchema` admits 1–9 fractional-second digits plus `Z` or an
 * explicit `±HH:MM` offset. JavaScript `Date` truncates to milliseconds, so
 * `Date.parse` cannot be used for consequential equality or ordering: two
 * instants differing after the third fractional digit would compare equal.
 *
 * This helper converts a validated instant to exact epoch NANOSECONDS using
 * BigInt arithmetic, correctly accounting for the timezone offset. It is pure,
 * reads no ambient time and adds no dependency. It deliberately does NOT
 * introduce a competing public timestamp vocabulary: every input is validated
 * through the shared contract first.
 */

const INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

const NANOS_PER_SECOND = 1_000_000_000n;
const SECONDS_PER_DAY = 86_400n;
const NANOS_PER_MINUTE = 60_000_000_000n;

/**
 * Exact proleptic-Gregorian days since 1970-01-01 (Howard Hinnant's
 * `days_from_civil`), computed in BigInt.
 *
 * This replaces `Date.UTC`, which remaps numeric years 0–99 onto 1900–1999 and
 * would therefore mis-convert the four-digit years `0000`–`0099` that the shared
 * `isoTimestampSchema` admits. The algorithm is purely arithmetic over the
 * 400-year Gregorian cycle (146097 days), so it is exact for every year with no
 * special cases: the `era`/`yoe` decomposition applies the same leap rules to
 * year 0000 as to 2026, and shifting March to the start of the internal year
 * makes the leap day the last day, removing any February branch.
 */
function daysFromCivil(year: bigint, month: bigint, day: bigint): bigint {
  const y = month <= 2n ? year - 1n : year;
  const era = (y >= 0n ? y : y - 399n) / 400n;
  const yearOfEra = y - era * 400n; // 0..399
  const dayOfYear = (153n * (month + (month > 2n ? -3n : 9n)) + 2n) / 5n + day - 1n; // 0..365
  const dayOfEra = yearOfEra * 365n + yearOfEra / 4n - yearOfEra / 100n + dayOfYear; // 0..146096
  return era * 146097n + dayOfEra - 719468n;
}

/**
 * Exact epoch nanoseconds of a validated ISO instant. Negative for pre-epoch
 * instants. PRIVATE implementation detail: only the comparison helpers below are
 * part of the Increment 7 surface.
 */
function epochNanosOfInstant(value: string): bigint {
  const validated = isoTimestampSchema.parse(value);
  const match = INSTANT_PATTERN.exec(validated);
  if (!match) {
    // Unreachable for values accepted by the shared contract; fails closed.
    throw new Error("not an exactly comparable ISO instant");
  }
  const [, year, month, day, hour, minute, second, fraction, zone] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string | undefined,
    string,
  ];

  const days = daysFromCivil(BigInt(year), BigInt(month), BigInt(day));
  const secondsOfDay = BigInt(hour) * 3600n + BigInt(minute) * 60n + BigInt(second);
  const fractionNanos = BigInt((fraction ?? "").padEnd(9, "0") || "0");
  let nanos = (days * SECONDS_PER_DAY + secondsOfDay) * NANOS_PER_SECOND + fractionNanos;

  if (zone !== "Z") {
    const sign = zone.startsWith("-") ? -1n : 1n;
    const offsetHours = BigInt(zone.slice(1, 3));
    const offsetMinutes = BigInt(zone.slice(4, 6));
    // A local time ahead of UTC represents an EARLIER absolute instant.
    nanos -= sign * (offsetHours * 60n + offsetMinutes) * NANOS_PER_MINUTE;
  }
  return nanos;
}

/** -1, 0 or 1 comparing two validated ISO instants exactly. */
export function compareInstants(left: string, right: string): -1 | 0 | 1 {
  const a = epochNanosOfInstant(left);
  const b = epochNanosOfInstant(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Exact instant equality, offset-aware, to nanosecond precision. */
export function instantsEqual(left: string, right: string): boolean {
  return compareInstants(left, right) === 0;
}

/** True when `left` is strictly before `right`. */
export function instantIsBefore(left: string, right: string): boolean {
  return compareInstants(left, right) === -1;
}

/** True when `left` is at or after `right`. */
export function instantIsAtOrAfter(left: string, right: string): boolean {
  return compareInstants(left, right) >= 0;
}
