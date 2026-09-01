import { careerPackSchema, type CareerPack } from "./schema";
import { validateCareerPack, type CareerPackIssue } from "./validation";

/**
 * Canonical finalisation boundary.
 *
 * The raw Zod schema remains a validation schema. This helper is the runtime
 * immutability boundary for canonical truth: a finalised pack cannot be mutated
 * through casting, index assignment, `push`, `splice`, `reverse` or property
 * overwrite.
 *
 * Deliberately local to the Career Pack package: no application-wide deep-freeze
 * framework is introduced.
 */

export class CareerPackValidationError extends Error {
  readonly issues: readonly CareerPackIssue[];

  constructor(issues: readonly CareerPackIssue[]) {
    super(
      `invalid canonical Career Pack: ${issues.map((issue) => `${issue.code}${issue.at ? ` (${issue.at})` : ""}: ${issue.message}`).join("; ")}`,
    );
    this.name = "CareerPackValidationError";
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

/**
 * Strict-parse, validate whole-document integrity, fail closed when invalid,
 * and return a deeply runtime-frozen canonical Career Pack.
 */
export function parseCanonicalCareerPack(input: unknown): CareerPack {
  const result = validateCareerPack(input);
  if (!result.valid) throw new CareerPackValidationError(result.issues);
  // Safe: `validateCareerPack` already strict-parsed the document.
  return deepFreeze(careerPackSchema.parse(input));
}

/** Non-throwing variant. */
export function safeParseCanonicalCareerPack(input: unknown):
  | { readonly ok: true; readonly pack: CareerPack }
  | {
      readonly ok: false;
      readonly issues: readonly CareerPackIssue[];
    } {
  const result = validateCareerPack(input);
  if (!result.valid) return { ok: false, issues: result.issues };
  return { ok: true, pack: deepFreeze(careerPackSchema.parse(input)) };
}
