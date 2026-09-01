import { createHash } from "node:crypto";

import type { CareerPack, CareerPackScenario } from "../career-packs";
import { canonicalJsonStringify } from "./canonical-json";

/**
 * Deterministic SHA-256 content hashing over canonical JSON.
 *
 * `node:crypto` is used deliberately: this is a server-authority governance
 * package and no external hashing dependency is introduced.
 *
 * An author-supplied hash can never override computed truth: nothing here
 * accepts a caller hash as an input to the computation.
 */

/** Lowercase 64-character hex SHA-256 of a UTF-8 string. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Deterministic content hash of a canonical Career Pack document. */
export function hashCanonicalCareerPack(pack: CareerPack): string {
  return sha256Hex(canonicalJsonStringify(pack));
}

/** Deterministic content hash of one immutable canonical scenario definition. */
export function hashCareerPackScenarioDefinition(scenario: CareerPackScenario): string {
  return sha256Hex(canonicalJsonStringify(scenario));
}
