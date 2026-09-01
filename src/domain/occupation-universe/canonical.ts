import { type OccupationUniverseIssue, type OccupationUniverseValidationResult } from "./codes";
import { normaliseOccupationText } from "./normalise";
import {
  occupationRecordSchema,
  occupationTerms,
  occupationUniverseInputSchema,
  type OccupationRecord,
  type OccupationUniverse,
} from "./schema";

/**
 * Canonical validation and finalisation boundary for the occupation universe.
 *
 * Whole-universe integrity is checked BEFORE anything is frozen and exposed, so
 * an authored contradiction (a stolen canonical title, a duplicated identity, a
 * term duplicated across two categories of one occupation) fails loudly instead
 * of being silently reconciled at search time.
 *
 * There is deliberately no content-hash, version or publication system here: no
 * frozen contract mandates one for the occupation universe, and inventing one
 * would create governance surface this increment does not own.
 */

export class OccupationUniverseValidationError extends Error {
  readonly issues: readonly OccupationUniverseIssue[];

  constructor(issues: readonly OccupationUniverseIssue[]) {
    super(
      `invalid canonical occupation universe: ${issues
        .map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "OccupationUniverseValidationError";
    this.issues = issues;
  }
}

/**
 * Runtime immutability boundary. `Object.freeze` is shallow, so an already
 * frozen parent must still be traversed; only primitives and revisits end the
 * walk.
 */
function deepFreeze<T>(value: T, visited: WeakSet<object>): T {
  if (value === null || typeof value !== "object") return value;
  if (visited.has(value)) return value;
  visited.add(value);
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key], visited);
  }
  return value;
}

/** Validate whole-universe integrity without throwing or freezing. */
export function validateOccupationUniverse(input: unknown): OccupationUniverseValidationResult {
  const parsed = occupationUniverseInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        code: "schema_invalid" as const,
        message: issue.message,
        at: issue.path.join("."),
      })),
    };
  }

  const records: readonly OccupationRecord[] = parsed.data;
  const issues: OccupationUniverseIssue[] = [];

  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  /** normalised canonical title -> owning occupation key */
  const canonicalOwners = new Map<string, string>();

  for (const record of records) {
    if (seenIds.has(record.occupationId)) {
      issues.push({
        code: "duplicate_occupation_id",
        message: "occupation ids must be unique",
        at: record.occupationId,
      });
    }
    seenIds.add(record.occupationId);

    if (seenKeys.has(record.occupationKey)) {
      issues.push({
        code: "duplicate_occupation_key",
        message: "occupation keys must be unique",
        at: record.occupationKey,
      });
    }
    seenKeys.add(record.occupationKey);

    const canonical = normaliseOccupationText(record.canonicalTitle);
    const owner = canonicalOwners.get(canonical);
    if (owner !== undefined) {
      issues.push({
        code: "duplicate_canonical_title",
        message: `canonical title collides with occupation ${owner} under normalisation`,
        at: record.occupationKey,
      });
    } else {
      canonicalOwners.set(canonical, record.occupationKey);
    }

    /* A term duplicated inside one occupation — even across two different
       categories — makes the reported term category ambiguous. */
    const within = new Set<string>();
    for (const { term, category } of occupationTerms(record)) {
      const normalised = normaliseOccupationText(term);
      if (within.has(normalised)) {
        issues.push({
          code: "duplicate_term_within_occupation",
          message: `term is authored more than once (${category})`,
          at: `${record.occupationKey}:${normalised}`,
        });
      }
      within.add(normalised);
    }
  }

  /* Canonical ownership can never be stolen by another occupation's
     non-canonical term. A shared NON-canonical term across occupations is
     allowed: real ambiguity must reach the participant as clarification. */
  for (const record of records) {
    for (const { term, category } of occupationTerms(record)) {
      if (category === "canonical_title") continue;
      const owner = canonicalOwners.get(normaliseOccupationText(term));
      if (owner !== undefined && owner !== record.occupationKey) {
        issues.push({
          code: "canonical_title_conflict",
          message: `${category} equals the canonical title owned by occupation ${owner}`,
          at: `${record.occupationKey}:${normaliseOccupationText(term)}`,
        });
      }
    }
  }

  return issues.length === 0 ? { valid: true, issues: [] } : { valid: false, issues };
}

/** Strict-parse, validate whole-universe integrity, fail closed, deep-freeze. */
export function parseCanonicalOccupationUniverse(input: unknown): OccupationUniverse {
  const result = validateOccupationUniverse(input);
  if (!result.valid) throw new OccupationUniverseValidationError(result.issues);
  const records = occupationUniverseInputSchema
    .parse(input)
    .map((record) => occupationRecordSchema.parse(record));
  return deepFreeze(records as OccupationUniverse, new WeakSet<object>());
}

/** Non-throwing variant. */
export function safeParseCanonicalOccupationUniverse(
  input: unknown,
):
  | { readonly ok: true; readonly universe: OccupationUniverse }
  | { readonly ok: false; readonly issues: readonly OccupationUniverseIssue[] } {
  const result = validateOccupationUniverse(input);
  if (!result.valid) return { ok: false, issues: result.issues };
  return { ok: true, universe: parseCanonicalOccupationUniverse(input) };
}
