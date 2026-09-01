import { z } from "zod";

import { semanticVersionSchema } from "../contracts";

/**
 * SemVer 2.0.0 — strictly correct validation and precedence.
 *
 * Correctness rules implemented here:
 * - core identifiers `MAJOR.MINOR.PATCH` are numeric with no leading zero
 *   except the single digit `0`
 * - prerelease is dot separated; every identifier is `[0-9A-Za-z-]+` and
 *   non-empty; numeric identifiers must not carry a leading zero
 * - build metadata is dot separated; every identifier is `[0-9A-Za-z-]+` and
 *   non-empty; build metadata is IGNORED for precedence ONLY
 * - numeric identifiers are compared EXACTLY (digit length then lexical), never
 *   via JavaScript `Number`, so arbitrarily large valid identifiers keep their
 *   correct ordering
 */

interface ParsedVersion {
  /** Digit strings, never numbers: no precision loss is possible. */
  readonly core: readonly [string, string, string];
  readonly prerelease: readonly string[];
  readonly build: readonly string[];
}

const NUMERIC_IDENTIFIER = /^(0|[1-9]\d*)$/;
const ALPHANUMERIC_IDENTIFIER = /^[0-9A-Za-z-]+$/;
const ALL_DIGITS = /^\d+$/;

function parseDotSeparatedIdentifiers(raw: string): readonly string[] | null {
  const parts = raw.split(".");
  for (const part of parts) {
    // Empty identifier (e.g. `alpha..1`, trailing dot) is invalid.
    if (part.length === 0) return null;
    if (!ALPHANUMERIC_IDENTIFIER.test(part)) return null;
    // A purely numeric identifier must not carry a leading zero.
    if (ALL_DIGITS.test(part) && !NUMERIC_IDENTIFIER.test(part)) return null;
  }
  return parts;
}

/** Parse a semantic version, or return `null` when it is not strict SemVer 2.0.0. */
export function parseSemanticVersion(value: string): ParsedVersion | null {
  if (typeof value !== "string" || value.length === 0) return null;

  let remainder = value;
  let build: readonly string[] = [];
  const plusIndex = remainder.indexOf("+");
  if (plusIndex !== -1) {
    const parsedBuild = parseDotSeparatedIdentifiers(remainder.slice(plusIndex + 1));
    if (!parsedBuild) return null;
    build = parsedBuild;
    remainder = remainder.slice(0, plusIndex);
  }

  let prerelease: readonly string[] = [];
  const dashIndex = remainder.indexOf("-");
  if (dashIndex !== -1) {
    const parsedPrerelease = parseDotSeparatedIdentifiers(remainder.slice(dashIndex + 1));
    if (!parsedPrerelease) return null;
    prerelease = parsedPrerelease;
    remainder = remainder.slice(0, dashIndex);
  }

  const coreParts = remainder.split(".");
  if (coreParts.length !== 3) return null;
  for (const part of coreParts) {
    if (!NUMERIC_IDENTIFIER.test(part)) return null;
  }

  return {
    core: [coreParts[0]!, coreParts[1]!, coreParts[2]!] as const,
    prerelease,
    build,
  };
}

export function isValidSemanticVersion(value: unknown): boolean {
  return typeof value === "string" && parseSemanticVersion(value) !== null;
}

/**
 * Governance-strengthened semantic-version contract.
 *
 * It CONSUMES the shared Increment 2 primitive (which is deliberately looser)
 * and refines it with the strict Increment 6 validator. Increment 2's shared
 * primitive is intentionally left unchanged.
 */
export const governanceSemanticVersionSchema = semanticVersionSchema.refine(
  (value) => isValidSemanticVersion(value),
  "must be a strict SemVer 2.0.0 version",
);
export type GovernanceSemanticVersion = z.infer<typeof governanceSemanticVersionSchema>;

/** Exact comparison of two numeric identifiers given as digit strings. */
function compareNumericIdentifier(a: string, b: string): -1 | 0 | 1 {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function comparePrerelease(a: readonly string[], b: readonly string[]): -1 | 0 | 1 {
  if (a.length === 0 && b.length === 0) return 0;
  // A version WITHOUT prerelease has higher precedence than one with it.
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    const leftNumeric = ALL_DIGITS.test(left);
    const rightNumeric = ALL_DIGITS.test(right);
    if (leftNumeric && rightNumeric) {
      const numeric = compareNumericIdentifier(left, right);
      if (numeric !== 0) return numeric;
      continue;
    }
    // Numeric identifiers always have LOWER precedence than alphanumeric ones.
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/**
 * `-1` when `a` has lower precedence, `0` when equal, `1` when greater.
 * Throws when either input is not a strict semantic version.
 */
export function compareSemanticVersionPrecedence(a: string, b: string): -1 | 0 | 1 {
  const left = parseSemanticVersion(a);
  const right = parseSemanticVersion(b);
  if (!left) throw new Error(`not a semantic version: ${a}`);
  if (!right) throw new Error(`not a semantic version: ${b}`);

  for (let index = 0; index < 3; index += 1) {
    const core = compareNumericIdentifier(left.core[index]!, right.core[index]!);
    if (core !== 0) return core;
  }
  // Build metadata is deliberately never consulted for precedence.
  return comparePrerelease(left.prerelease, right.prerelease);
}

/** True only when `candidate` has strictly greater precedence than `previous`. */
export function isStrictlyGreaterVersion(candidate: string, previous: string): boolean {
  return compareSemanticVersionPrecedence(candidate, previous) === 1;
}
