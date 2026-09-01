/**
 * Deterministic canonical JSON serialisation.
 *
 * Rules:
 * - object keys are sorted deterministically (code-unit order) at every depth
 * - array order is PRESERVED exactly (authored order is canonical data)
 * - properties whose value is `undefined` are omitted, exactly like JSON
 * - only JSON-safe scalars are accepted; anything else fails closed rather than
 *   being guessed at
 */

export class CanonicalJsonError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(`${message} (at ${path || "$"})`);
    this.name = "CanonicalJsonError";
    this.path = path;
  }
}

function serialise(value: unknown, path: string): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new CanonicalJsonError("non-finite number is not canonically serialisable", path);
      }
      return JSON.stringify(value);
    case "string":
      return JSON.stringify(value);
    case "bigint":
      throw new CanonicalJsonError("bigint is not canonically serialisable", path);
    case "function":
      throw new CanonicalJsonError("function is not canonically serialisable", path);
    case "symbol":
      throw new CanonicalJsonError("symbol is not canonically serialisable", path);
    case "undefined":
      throw new CanonicalJsonError("undefined is not canonically serialisable here", path);
    default:
      break;
  }

  if (Array.isArray(value)) {
    const parts = value.map((entry, index) => {
      if (entry === undefined) {
        throw new CanonicalJsonError(
          "undefined array element is not canonically serialisable",
          `${path}[${index}]`,
        );
      }
      return serialise(entry, `${path}[${index}]`);
    });
    return `[${parts.join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalJsonError(
      "only plain objects, arrays and JSON scalars are canonically serialisable",
      path,
    );
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  const parts = keys.map(
    (key) => `${JSON.stringify(key)}:${serialise(record[key], path ? `${path}.${key}` : key)}`,
  );
  return `{${parts.join(",")}}`;
}

/** Deterministic canonical JSON string for a JSON-safe value. */
export function canonicalJsonStringify(value: unknown): string {
  return serialise(value, "");
}
