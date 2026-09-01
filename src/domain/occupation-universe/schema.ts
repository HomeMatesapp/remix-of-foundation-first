import { z } from "zod";

import { stableKeySchema, uuidSchema } from "../contracts";
import {
  OCCUPATION_CANONICAL_TITLE_MIN_LENGTH,
  OCCUPATION_TERM_CATEGORIES,
  OCCUPATION_TITLE_MAX_LENGTH,
  type OccupationTermCategory,
} from "./codes";

/**
 * Canonical occupation record schema.
 *
 * An occupation record is IDENTITY plus searchable authored wording, nothing
 * else. No participant profile, institution, Career Pack content, eligibility,
 * route, evidence, source, salary, demand, provider, location, SOC, score,
 * weight, AI or operational metadata may enter this document — every schema is
 * `.strict()` so undeclared fields are rejected rather than silently stripped.
 */

/**
 * Authored searchable term. Bounded and non-blank, but the authored bytes are
 * preserved verbatim (no trimming transform), because stored content must never
 * be rewritten by the search layer.
 */
const authoredTermSchema = z
  .string()
  .max(OCCUPATION_TITLE_MAX_LENGTH, "must not exceed the authored term length bound")
  .refine((value) => value.trim().length > 0, "must not be blank");

/** Canonical full title: a real full occupation title, not an abbreviation. */
const canonicalTitleSchema = authoredTermSchema.refine(
  (value) => value.trim().length >= OCCUPATION_CANONICAL_TITLE_MIN_LENGTH,
  "must be a full occupation title",
);

const termCollectionSchema = z.array(authoredTermSchema);

export const occupationRecordSchema = z
  .object({
    occupationId: uuidSchema,
    occupationKey: stableKeySchema,
    canonicalTitle: canonicalTitleSchema,
    /** Named sub-fields of the same occupation (e.g. a nursing field). */
    specialisms: termCollectionSchema,
    /** Legitimate alternative full titles for the same occupation. */
    aliases: termCollectionSchema,
    /** Short forms; never fuzzily expanded at search time. */
    abbreviations: termCollectionSchema,
    /** Everyday informal full titles people actually use. */
    colloquialTitles: termCollectionSchema,
    /** Newer full titles that are becoming established. */
    emergingTitles: termCollectionSchema,
  })
  .strict();
export type OccupationRecord = z.infer<typeof occupationRecordSchema>;

export const occupationUniverseInputSchema = z.array(occupationRecordSchema);

/** A frozen, validated set of occupation records. */
export type OccupationUniverse = readonly OccupationRecord[];

/** Minimal deterministic reference to a canonical occupation. */
export interface OccupationRef {
  readonly occupationId: string;
  readonly occupationKey: string;
  readonly canonicalTitle: string;
}

/** An authored term paired with the semantic category it was authored under. */
export interface OccupationTerm {
  readonly term: string;
  readonly category: OccupationTermCategory;
}

/** Category order used for deterministic term enumeration. */
export const TERM_CATEGORY_ORDER: readonly OccupationTermCategory[] = OCCUPATION_TERM_CATEGORIES;

/**
 * Every authored term of a record, in deterministic category order and, within
 * a category, authored order. Authored order NEVER decides a match outcome; it
 * only makes enumeration reproducible.
 */
export function occupationTerms(record: OccupationRecord): readonly OccupationTerm[] {
  const terms: OccupationTerm[] = [{ term: record.canonicalTitle, category: "canonical_title" }];
  for (const term of record.specialisms) terms.push({ term, category: "specialism" });
  for (const term of record.aliases) terms.push({ term, category: "alias" });
  for (const term of record.abbreviations) terms.push({ term, category: "abbreviation" });
  for (const term of record.colloquialTitles) terms.push({ term, category: "colloquial" });
  for (const term of record.emergingTitles) terms.push({ term, category: "emerging" });
  return terms;
}

/** Deterministic reference projection. */
export function occupationRefOf(record: OccupationRecord): OccupationRef {
  return {
    occupationId: record.occupationId,
    occupationKey: record.occupationKey,
    canonicalTitle: record.canonicalTitle,
  };
}
