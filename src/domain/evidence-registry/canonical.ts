import type { EvidenceRegistryIssue } from "./codes";
import { evidenceRegistrySchema, type EvidenceRegistry } from "./schema";
import { validateEvidenceRegistry } from "./validation";

/**
 * Canonical finalisation boundary.
 *
 * A finalised registry cannot be mutated through casting, index assignment,
 * `push`, `splice`, `reverse` or property overwrite, so caller mutation can
 * never change lookup or resolution outcomes.
 */

export class EvidenceRegistryValidationError extends Error {
  readonly issues: readonly EvidenceRegistryIssue[];

  constructor(issues: readonly EvidenceRegistryIssue[]) {
    super(
      `invalid canonical evidence registry: ${issues
        .map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`)
        .join("; ")}`,
    );
    this.name = "EvidenceRegistryValidationError";
    this.issues = issues;
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Strict-parse, validate whole-registry integrity, fail closed, deep-freeze. */
export function parseCanonicalEvidenceRegistry(input: unknown): EvidenceRegistry {
  const result = validateEvidenceRegistry(input);
  if (!result.valid) throw new EvidenceRegistryValidationError(result.issues);
  return deepFreeze(evidenceRegistrySchema.parse(input));
}

/** Non-throwing variant. */
export function safeParseCanonicalEvidenceRegistry(
  input: unknown,
):
  | { readonly ok: true; readonly registry: EvidenceRegistry }
  | { readonly ok: false; readonly issues: readonly EvidenceRegistryIssue[] } {
  const result = validateEvidenceRegistry(input);
  if (!result.valid) return { ok: false, issues: result.issues };
  return { ok: true, registry: deepFreeze(evidenceRegistrySchema.parse(input)) };
}
