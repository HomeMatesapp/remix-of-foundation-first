# Evidence & Source Registry (Increment 7)

Pure TypeScript + Zod evidence registry. No SQL, no migrations, no hosted
database, no RLS/auth, no live ingestion or network access, no publication, no
Decision Engine behaviour, no Evidence Context Snapshots, no UI.

## Contents

| File            | Responsibility                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `codes.ts`      | Registry schema version and frozen registry / reference issue-code catalogues                                                                                 |
| `schema.ts`     | Strict source definition, record identity, pinned revision ref, withdrawal and record revision schemas; canonical registry document; deterministic addressing |
| `validation.ts` | Fail-closed whole-registry integrity: identity uniqueness, content-hash coherence, supersession lineage                                                       |
| `canonical.ts`  | Canonical parser: strict parse + integrity validation + deep runtime freeze                                                                                   |
| `freshness.ts`  | Pure `asOf`-driven review-due evaluation                                                                                                                      |
| `lookup.ts`     | Deterministic source / exact-revision / lineage / terminal / current-usable resolution                                                                        |
| `reference.ts`  | Pure reconciliation of the shared `evidenceReferenceSchema` against the registry                                                                              |

## Consumed, never redefined

Evidence grades (`A`, `B`, `C`, `D`), the four participant classifications
(`confirmed_requirement`, `provider_dependent`, `general_guidance`,
`needs_verification`), `evidenceReferenceSchema`, `sourceRecordKeySchema`, UUID,
stable key, ISO timestamp, SemVer and SHA-256 primitives all come from
`src/domain/contracts`. Strict SemVer 2.0.0 precedence is reused from
`src/domain/career-pack-governance/semver`.

## Deliberately NOT invented

Source categories, tiers, provider enums, URLs, participant-facing copy,
commercial metadata, ingestion credentials, operational fields, raw retrieved
document bodies, a large freshness-status vocabulary, and any grade-to-judgement
compatibility matrix.

## Guarantees

- Canonical record identity is exactly `sourceId + sourceRecordKey`. The external
  `sourceRecordKey` is preserved verbatim: never trimmed-and-stored, normalised,
  rewritten or hash-replaced. Only blank keys are rejected.
- `grade` and `participantClassification` are REQUIRED on canonical records. No
  code here promotes, infers or manufactures stronger evidence than stored: `D`
  stays `D`, and missing evidence never becomes certainty.
- Supersession is explicit and fail-closed: the prior revision must exist, share
  the same identity, and have strictly lower SemVer precedence. Duplicate exact
  revisions, self-supersession, cycles, branching successors, content-hash
  contradictions and disconnected or multi-root lineages are all rejected.
- A lineage may legitimately begin with an imported current revision (a root with
  no `supersedes`). Missing history is never fabricated.
- Withdrawal preserves history: a withdrawn revision stays exactly resolvable for
  provenance, but is never returned as usable current evidence. There is no
  deletion, no reinstatement, no admin operation.
- Freshness is pure: `asOf` is always supplied. No deadline means not due; before
  the deadline is not due; at or after it is due. A deadline earlier than
  `retrievedAt` fails closed at schema level.
- Current-revision selection is derived only from explicit lineage, never from
  array order or wall-clock time. Ambiguity fails registry validation.
- The canonical registry is deeply runtime-frozen, so caller mutation through
  casting cannot change lookup or resolution results.

## Authority boundary

`A` is strongest and `D` weakest, as fixed by Increment 2. The exact mapping from
evidence grade / participant classification to Reality Check judgement strength is
NOT implemented here; Increments 9 and 10 own decision and guardrail enforcement.
This package only preserves declared strength and lineage without inventing
stronger truth.
