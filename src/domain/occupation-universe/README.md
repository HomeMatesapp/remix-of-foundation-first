# Clear Routes — Occupation Universe & Search (Increment 12)

Pure, deterministic, UK-first occupation identity and occupation-intent resolution.

Nothing here touches SQL, Supabase, RLS, auth, UI, routes, network, filesystem,
environment, clock, randomness, geography, providers, salary, demand, vacancies,
SOC import, the Decision Engine or AI. It is data plus deterministic matching.

## What an occupation record is

Identity plus searchable authored wording, and nothing else:

| Field | Meaning |
| --- | --- |
| `occupationId` | Stable UUID identity (Increment 2 primitive) |
| `occupationKey` | Stable internal machine key (Increment 2 primitive) |
| `canonicalTitle` | The single owning full title |
| `specialisms` | Named sub-fields of the same occupation |
| `aliases` | Legitimate alternative full titles |
| `abbreviations` | Short forms; never fuzzily expanded |
| `colloquialTitles` | Everyday informal full titles |
| `emergingTitles` | Newer full titles becoming established |

No participant, institution, Career Pack content, eligibility, route, evidence,
source, salary, demand, provider, location, SOC, score, weight or operational
metadata belongs in an occupation record. Every schema is `.strict()`.

## Canonical validation (fails closed)

`parseCanonicalOccupationUniverse` rejects: unknown fields, blank/overlong
titles and terms, duplicate occupation ids, duplicate occupation keys, duplicate
canonical titles under the search normalisation, the same term authored twice
inside one occupation (even across two categories), and any non-canonical term
that equals another occupation's canonical title.

The same NON-canonical term shared by two occupations is deliberately allowed:
that ambiguity is real and must surface as clarification, never as a silent pick.
A validated universe is deep-frozen; authored strings are stored verbatim.

## Normalisation

One normaliser, `normaliseOccupationText`: `NFKC` → collapse all whitespace runs
to a single space → trim → locale-independent `toLowerCase()`. No stemming, no
synonyms, no embeddings, no punctuation stripping — each of those can merge
genuinely distinct titles. Normalisation is for comparison only.

## Resolution precedence

0. protected generic collision word → never auto-resolves;
1. exact canonical full title (authored bytes);
2. exact authored non-canonical full term (collision → clarification);
3. normalised full-term equivalence (canonical titles outrank other categories);
4. conservative high-confidence fuzzy full-term matching;
5. clarification while several candidates remain plausible;
6. unmatched when confidence is insufficient.

Results are one of `resolved`, `clarification_required`, `unmatched`. A resolved
result reports the occupation id/key, canonical title, the matched authored term,
its term category and the match mode (`exact` | `normalised` | `fuzzy`). No
user-facing confidence score is exposed. `unmatched` carries the raw and
normalised query for the caller's immediate use only — capture of unmatched
demand is Increment 13 and is not implemented here.

Candidate ordering is code-unit ordering by `occupationKey`; `localeCompare` is
never used, so ordering cannot depend on locale or authored array position.

## Collision protection

`PROTECTED_GENERIC_COLLISION_WORDS` covers the roadmap's high-risk generic terms
(`consultant`, `manager`, `officer`, `engineer`, `adviser`, plus the common
spelling `advisor`) and a few equally generic siblings. A query that is merely
one of these words returns `clarification_required` when any occupation uses that
whole token, and `unmatched` otherwise. It never resolves, even when exactly one
plausible candidate exists today.

More generally, matching is full-string only. Token overlap, prefix containment
and substring coincidence can never by themselves resolve an occupation.

## Fuzzy matching and thresholds

A local bounded optimal-string-alignment (Damerau-Levenshtein with adjacent
transpositions) distance, chosen because it is small and inspectable and models
exactly the typo classes intended: one insertion, deletion, substitution or
adjacent transposition.

- `FUZZY_MIN_QUERY_LENGTH = 8` — shorter queries must match exactly. A single
  edit on `RN` or `EWA` reaches an entirely different occupation.
- `FUZZY_MIN_TERM_LENGTH = 8` — abbreviations are never fuzzy targets.
- Budget: 1 edit up to 15 normalised characters, 2 edits from 16. Long titles
  legitimately attract two typos; short ones do not.
- **Safety margin, not tie-breaking.** Every term inside the accepted budget is a
  plausible candidate. A fuzzy resolution is allowed only when the whole accepted
  budget implicates exactly one occupation. Two or more distinct occupations
  inside the budget give `fuzzy_collision` clarification — including a best
  distance of 1 with a runner-up occupation at distance 2.
- Within one winning occupation, the emitted term is chosen deterministically:
  canonical title first, then code-unit order of the normalised term.
- Above the budget the result is `unmatched` (`below_fuzzy_threshold`).
- No distance, score or confidence value is ever exposed in the public result.


## Career Pack binding

`bindCareerPackOccupation` resolves an existing `CareerPackOccupationRef`:
prefers exact `occupationId` when present (id and key must agree or it fails
closed), otherwise resolves the exact `occupationKey`. Unknown id, unknown key
and mismatched id+key all fail closed. Binding never uses aliases, normalisation
or fuzzy matching, and never mutates a Career Pack.

`careerPackOccupationRefSchema.occupationId` stays optional; `CAREER_PACK_SCHEMA_VERSION`
and `DECISION_ENGINE_VERSION` are unchanged at `1.0.0`.
