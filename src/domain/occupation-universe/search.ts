import {
  PROTECTED_GENERIC_COLLISION_WORDS,
  type OccupationClarificationReason,
  type OccupationMatchMode,
  type OccupationTermCategory,
  type OccupationUnmatchedReason,
} from "./codes";
import { isBlankNormalised, normaliseOccupationText, normalisedTokens } from "./normalise";
import {
  occupationRefOf,
  occupationTerms,
  type OccupationRecord,
  type OccupationRef,
  type OccupationUniverse,
} from "./schema";

/**
 * Deterministic occupation-intent resolution.
 *
 * Matching is FULL-STRING only. Token overlap, prefix containment and substring
 * coincidence never resolve an occupation by themselves, which is what stops
 * `engineer` becoming Software Engineer or `officer` becoming Police Officer.
 *
 * The resolver is pure: no clock, no randomness, no environment, no network, no
 * database, no AI. Identical universe + identical query always produce an
 * identical result.
 */

export interface ResolvedOccupation {
  readonly outcome: "resolved";
  readonly occupationId: string;
  readonly occupationKey: string;
  readonly canonicalTitle: string;
  /** The authored term that matched, verbatim as authored. */
  readonly matchedTerm: string;
  readonly termCategory: OccupationTermCategory;
  readonly matchMode: OccupationMatchMode;
}

export interface OccupationClarificationRequired {
  readonly outcome: "clarification_required";
  readonly reason: OccupationClarificationReason;
  readonly candidates: readonly OccupationRef[];
}

export interface OccupationUnmatched {
  readonly outcome: "unmatched";
  readonly reason: OccupationUnmatchedReason;
  /** Preserved for the caller's immediate use only. Nothing here is persisted. */
  readonly rawQuery: string;
  readonly normalisedQuery: string;
}

export type OccupationResolution =
  ResolvedOccupation | OccupationClarificationRequired | OccupationUnmatched;

/* -------------------------------------------------------------------------- */
/* Fuzzy thresholds                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Fuzzy matching is only ever attempted for reasonably long full titles. Short
 * strings and abbreviations must match exactly: a single edit on `RN` or `EWA`
 * reaches a completely different occupation.
 */
export const FUZZY_MIN_QUERY_LENGTH = 8;

/** Shortest authored term eligible to be a fuzzy target. */
export const FUZZY_MIN_TERM_LENGTH = 8;

/** Allowed edits: 1 up to 15 characters, 2 from 16 characters. */
export function fuzzyDistanceBudget(length: number): number {
  return length >= 16 ? 2 : 1;
}

/* -------------------------------------------------------------------------- */
/* Deterministic ordering                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Code-unit ordering by occupation key. `localeCompare` is deliberately avoided
 * so candidate ordering cannot depend on the ambient locale, and authored array
 * order can never leak into output.
 */
function compareRefs(left: OccupationRef, right: OccupationRef): number {
  if (left.occupationKey < right.occupationKey) return -1;
  if (left.occupationKey > right.occupationKey) return 1;
  return 0;
}

function orderedRefs(records: readonly OccupationRecord[]): readonly OccupationRef[] {
  const byKey = new Map<string, OccupationRef>();
  for (const record of records) byKey.set(record.occupationKey, occupationRefOf(record));
  return [...byKey.values()].sort(compareRefs);
}

/* -------------------------------------------------------------------------- */
/* Bounded Damerau-Levenshtein                                                */
/* -------------------------------------------------------------------------- */

/**
 * Optimal string alignment distance (Damerau-Levenshtein restricted to adjacent
 * transpositions), bounded by `budget`. Returns `budget + 1` when the true
 * distance exceeds the budget. Chosen because it is small, inspectable and
 * exactly models the typo classes we intend to tolerate: one insertion, one
 * deletion, one substitution, one adjacent transposition.
 */
export function boundedEditDistance(a: string, b: string, budget: number): number {
  const over = budget + 1;
  if (Math.abs(a.length - b.length) > budget) return over;
  if (a === b) return 0;

  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1) {
    rows.push(new Array<number>(b.length + 1).fill(over));
  }
  const at = (i: number, j: number): number => (rows[i] as number[])[j] as number;
  const set = (i: number, j: number, value: number): void => {
    (rows[i] as number[])[j] = value;
  };

  for (let i = 0; i <= a.length; i += 1) if (i <= budget) set(i, 0, i);
  for (let j = 0; j <= b.length; j += 1) if (j <= budget) set(0, j, j);

  for (let i = 1; i <= a.length; i += 1) {
    const from = Math.max(1, i - budget);
    const to = Math.min(b.length, i + budget);
    for (let j = from; j <= to; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      set(i, j, Math.min(best, over));
    }
  }
  return Math.min(at(a.length, b.length), over);
}

/* -------------------------------------------------------------------------- */
/* Index                                                                      */
/* -------------------------------------------------------------------------- */

interface IndexedTerm {
  readonly record: OccupationRecord;
  readonly term: string;
  readonly normalised: string;
  readonly category: OccupationTermCategory;
}

function indexedTerms(universe: OccupationUniverse): readonly IndexedTerm[] {
  const entries: IndexedTerm[] = [];
  for (const record of universe) {
    for (const { term, category } of occupationTerms(record)) {
      entries.push({ record, term, normalised: normaliseOccupationText(term), category });
    }
  }
  return entries;
}

function resolvedFrom(entry: IndexedTerm, matchMode: OccupationMatchMode): ResolvedOccupation {
  return {
    outcome: "resolved",
    occupationId: entry.record.occupationId,
    occupationKey: entry.record.occupationKey,
    canonicalTitle: entry.record.canonicalTitle,
    matchedTerm: entry.term,
    termCategory: entry.category,
    matchMode,
  };
}

function distinctRecords(entries: readonly IndexedTerm[]): readonly OccupationRecord[] {
  const byKey = new Map<string, OccupationRecord>();
  for (const entry of entries) byKey.set(entry.record.occupationKey, entry.record);
  return [...byKey.values()];
}

function clarification(
  reason: OccupationClarificationReason,
  records: readonly OccupationRecord[],
): OccupationClarificationRequired {
  return { outcome: "clarification_required", reason, candidates: orderedRefs(records) };
}

/**
 * Occupations plausibly implicated by a protected generic word. Whole-token
 * containment only — never a substring, so `engineer` does not pull in
 * `engineering technician` wording by accident of characters alone.
 */
function genericCandidates(
  entries: readonly IndexedTerm[],
  word: string,
): readonly OccupationRecord[] {
  return distinctRecords(
    entries.filter((entry) => normalisedTokens(entry.normalised).includes(word)),
  );
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Binding precedence, explicit and in this exact order:
 * 0. protected generic collision word — never auto-resolves;
 * 1. exact canonical full title (authored bytes);
 * 2. exact authored non-canonical full term (authored bytes);
 * 3. normalised full-term equivalence, canonical titles first;
 * 4. conservative high-confidence fuzzy full-term matching;
 * 5. clarification while multiple candidates remain plausible;
 * 6. unmatched when confidence is insufficient.
 */
export function resolveOccupationIntent(
  universe: OccupationUniverse,
  rawQuery: string,
): OccupationResolution {
  const normalisedQuery = normaliseOccupationText(rawQuery);
  if (isBlankNormalised(normalisedQuery)) {
    return { outcome: "unmatched", reason: "blank_query", rawQuery, normalisedQuery };
  }

  const entries = indexedTerms(universe);

  /* 0 — protected generic collision words. */
  if (PROTECTED_GENERIC_COLLISION_WORDS.includes(normalisedQuery)) {
    const candidates = genericCandidates(entries, normalisedQuery);
    return candidates.length > 0
      ? clarification("generic_collision_word", candidates)
      : { outcome: "unmatched", reason: "no_match", rawQuery, normalisedQuery };
  }

  /* 1 — exact canonical full title. Canonical ownership is absolute. */
  const exactCanonical = entries.filter(
    (entry) => entry.category === "canonical_title" && entry.term === rawQuery,
  );
  if (exactCanonical.length === 1) return resolvedFrom(exactCanonical[0] as IndexedTerm, "exact");
  if (exactCanonical.length > 1) {
    return clarification("exact_term_collision", distinctRecords(exactCanonical));
  }

  /* 2 — exact authored non-canonical full term. */
  const exactAuthored = entries.filter(
    (entry) => entry.category !== "canonical_title" && entry.term === rawQuery,
  );
  const exactAuthoredRecords = distinctRecords(exactAuthored);
  if (exactAuthoredRecords.length === 1) {
    return resolvedFrom(exactAuthored[0] as IndexedTerm, "exact");
  }
  if (exactAuthoredRecords.length > 1) {
    return clarification("exact_term_collision", exactAuthoredRecords);
  }

  /* 3 — normalised equivalence. Canonical titles are considered first so a
     normalised canonical title always outranks a normalised alias. */
  const normalisedMatches = entries.filter((entry) => entry.normalised === normalisedQuery);
  const normalisedCanonical = normalisedMatches.filter(
    (entry) => entry.category === "canonical_title",
  );
  if (normalisedCanonical.length === 1) {
    return resolvedFrom(normalisedCanonical[0] as IndexedTerm, "normalised");
  }
  if (normalisedCanonical.length > 1) {
    return clarification("normalised_term_collision", distinctRecords(normalisedCanonical));
  }
  if (normalisedMatches.length > 0) {
    const records = distinctRecords(normalisedMatches);
    if (records.length === 1)
      return resolvedFrom(normalisedMatches[0] as IndexedTerm, "normalised");
    return clarification("normalised_term_collision", records);
  }

  /* 4 — conservative fuzzy full-term matching. */
  if (normalisedQuery.length < FUZZY_MIN_QUERY_LENGTH) {
    return { outcome: "unmatched", reason: "no_match", rawQuery, normalisedQuery };
  }
  const budget = fuzzyDistanceBudget(normalisedQuery.length);

  /* Safety margin, not tie-breaking: EVERY term inside the accepted budget is a
     plausible candidate. A fuzzy resolution is therefore only allowed when the
     whole accepted budget implicates exactly one occupation. A best distance of
     1 with a runner-up occupation at distance 2 is still ambiguous and must
     clarify — the runner-up is not "worse", it is simply undecidable at this
     tolerance. */
  const qualifying: IndexedTerm[] = [];
  for (const entry of entries) {
    if (entry.normalised.length < FUZZY_MIN_TERM_LENGTH) continue;
    if (boundedEditDistance(normalisedQuery, entry.normalised, budget) > budget) continue;
    qualifying.push(entry);
  }

  if (qualifying.length === 0) {
    return { outcome: "unmatched", reason: "below_fuzzy_threshold", rawQuery, normalisedQuery };
  }
  const fuzzyRecords = distinctRecords(qualifying);
  if (fuzzyRecords.length > 1) return clarification("fuzzy_collision", fuzzyRecords);

  /* A single occupation may be reached through several of its own terms; pick
     deterministically by canonical category order, then by normalised term,
     never by authored array position or by distance ordering. */
  const categoryRank = (category: OccupationTermCategory): number =>
    category === "canonical_title" ? 0 : 1;
  const chosen = [...qualifying].sort((left, right) => {
    const rank = categoryRank(left.category) - categoryRank(right.category);
    if (rank !== 0) return rank;
    if (left.normalised < right.normalised) return -1;
    if (left.normalised > right.normalised) return 1;
    return 0;
  })[0] as IndexedTerm;
  return resolvedFrom(chosen, "fuzzy");
}
