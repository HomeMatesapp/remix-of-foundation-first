# Clear Routes — Shared Domain Contracts (Increment 2)

This folder is the **canonical shared application/domain contract layer**. Every later
system — route archetypes, question modules, Career Packs, the Decision Engine,
participant surfaces and institution surfaces — consumes these contracts instead of
inventing its own vocabularies.

Contracts are Zod-first: schemas are the source of truth and TypeScript types are
inferred from them, so runtime validation and static types cannot drift apart.

## What this layer is not

- **TypeScript contracts do not imply database tables.** Nothing here creates,
  describes or reserves schema. Increment 2 contains zero SQL and zero DB changes.
- **No business logic.** Career Packs, route archetypes, question modules and
  Decision Engine rules arrive in later increments.
- **No UI.** No participant-facing copy, labels or presentation lives here.
- **No framework dependencies.** No React, no Supabase client, no browser APIs, no
  routes or components, no database code.

## Binding rules encoded or documented here

- The four protected Reality Check judgement states are exact:
  `realistic_now`, `realistic_with_conditions`, `not_realistic_yet`,
  `more_information_needed`. There is no fifth state and no alias.
- **Decision state remains intentionally undefined in Increment 2.** What a
  participant commits to is a separate concept from what the assessment judges.
- **Eligibility and practical fit are structurally separate**, each with an explicit
  unknown (`null`) rather than a defaulted negative.
- **`unknown` is not `unmet`.** `unknown` and `verification_required` are distinct
  requirement states and must never collapse into negative eligibility.
- **Judgement strength must never exceed evidence strength.** Documented here and
  enforced by the Decision Engine and its guardrails in later increments.
- **AI cannot secretly determine eligibility.** The deterministic provenance envelope
  is strict: it declares no model, prompt or generation fields and *rejects* undeclared
  keys rather than silently stripping them, so AI metadata cannot be smuggled into the
  deterministic core.
- **Deterministic structural results must be reproducible from exact versioned
  inputs**: Career Pack id/version/content hash, Decision Engine version, Answer
  Snapshot, Evidence Context, optional Local Reality snapshot and `evaluated_at`.
- **Protected vocabularies cannot be casually expanded.** Adding or renaming a value
  in the judgement, requirement state, requirement severity, internal evidence grade
  or participant evidence classification vocabularies is a breaking architecture
  change requiring explicit owner approval.

## Deliberate non-decisions

- No eligibility or practical-fit outcome vocabulary was invented; both use explicit
  tri-state booleans until an approved vocabulary exists.
- No ranking policy at all: ranking metadata carries only an optional config key, an
  ordered list of factor keys and an optional 1-based position. No scores, weights,
  directions, factor outcomes or tie-break rules — those belong to the Career Pack and
  Decision Engine increments.
- No barrier severity or barrier priority vocabulary. Requirement severity is
  deliberately NOT reused for barriers.
- No decision-state, occupation, provider or Local Reality vocabularies.
- External `source_record_key` values are not character-whitelisted or normalised; only
  the identity pair `source_id + source_record_key` is frozen. Clear Routes-owned
  internal machine keys use the stricter `stableKeySchema`.

## Files

| File | Contents |
| --- | --- |
| `primitives.ts` | UUID, non-empty text, ISO timestamp, semver, SHA-256, internal stable key, external source record key, versioned/snapshot refs |
| `judgement.ts` | Protected Reality Check judgement enum |
| `requirements.ts` | Requirement state/severity enums, `RequirementAssessment` |
| `evidence.ts` | Internal grades A–D, participant classifications, evidence/source reference |
| `provenance.ts` | Immutable deterministic evaluation provenance envelope |
| `result.ts` | Route ref, barrier item, unresolved check, candidate route evaluation, ranking metadata, overall result (pinned to `DOMAIN_CONTRACT_VERSION`) |
| `version.ts` | `DOMAIN_CONTRACT_VERSION` |
