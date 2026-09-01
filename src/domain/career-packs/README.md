# Career Pack canonical schema (Increment 5)

Framework-independent, immutable, versioned canonical Career Pack document.

`CAREER_PACK_SCHEMA_VERSION = "1.0.0"`.

## Single source of truth / projection boundary

- The immutable versioned canonical Career Pack document **is the single source of truth** for one career's deterministic assessment content.
- Any future relational tables are **deterministic projections only**.
- A projection may **never** become an independent authoring or truth source.
- Rebuilding any projection must be possible from the canonical pack version alone.
- **No database projection or table is introduced in Increment 5.**

## Version boundaries

Three unrelated versions must never be conflated:

- `schemaVersion` — the pack **document framework** version (`CAREER_PACK_SCHEMA_VERSION`).
- `version` — the **content** version of one authored pack (semantic version).
- the Decision Engine version — Increment 9, not represented here.

## What this package is not

- **Not evaluator code.** The pack is declarative data plus validated declarative rules. Rule application, precedence, defaults, tie-breaking, ranking execution and guardrails are Increments 9–10. One shared Decision Engine later consumes structured versioned packs; a normal new career must never require a new software evaluator.
- **Route archetypes are referenced and composed**, using Increment 3's exact current composition contract. They are never copied or reimplemented here.
- **Question dependency rules remain visibility-only** forever. The pack's consequential condition DSL (`packRuleSchema`) is a structurally distinct contract; `dependencyRuleSchema` is never used as decision logic.
- **Requirement definition != requirement assessment result.** A requirement definition carries no `state`; `met/unmet/unknown/verification_required/not_applicable` is produced later.
- **Eligibility != practical fit.** Routes reference the two requirement sets separately, and a requirement declares one or both purposes.
- **Unknown != unmet.** Nothing in this package converts unknown or missing data to `unmet` or `false`. Validation reports structural contradictions only.
- **Evidence refs != evidence registry.** The pack carries a local `evidenceKey -> evidenceReference` catalogue. Source records, authority review, freshness, withdrawal and supersession are Increment 7.
- **Local requirements != Local Reality implementation.** A local requirement declares an opaque `localFactKey` and its consequential purposes. No postcode parsing, PostGIS, distances, radii, providers, training, apprenticeships, employers, vacancies, demand models or local snapshots exist here (Increment 17). Missing local data is never a negative fact.
- **Review/confidence boundary != publication governance.** Only optional `reviewKey` / `confidenceKey` exist. The governed meaning of those keys, author != reviewer != approver identities, review dates, draft/reviewed/approved/published lifecycle, publish timestamps, withdrawal state, content hashing and the publication gate are intentionally **deferred to Increment 6**. There is deliberately no author-supplied `contentHash`.
- **Scenarios are immutable definitions, not runs.** No execution, run records, engine version, scenario hash or publication pass/fail state.
- **No participant-facing copy and no real career instances.** No Registered Nurse / Electrician / Solicitor / Photographer packs (Increment 11). Tests use synthetic internal stable keys only.

## Ranking

Ranking configuration is an ordered, non-empty list of factors, each with a stable `factorKey` and a declarative `preferWhen` condition, optionally route-scoped. **Authored order is the data.** There are no weights, scores, directions, arithmetic or tie-break policy fields anywhere.

## Integrity and immutability

`validateCareerPack(input)` is a pure whole-document check that fails closed on invalid embedded question sets, duplicate stable keys, duplicate supplied UUID identities, dangling route/requirement/barrier/check/action/evidence/local/ranking references, condition operator/input/value incompatibilities and scenario fixture/assertion problems. A pack with any integrity issue is **invalid**; invalid references are never silently dropped.

Canonical coherence rules that are structural, not Decision Engine logic:

- A route may list a requirement under `eligibilityRequirementKeys` / `practicalFitRequirementKeys` only when that requirement declares the matching purpose (`reference_purpose_mismatch`).
- A route's `availabilityRuleKeys` must reference availability rules whose `routeKey` is that same route (`reference_owner_mismatch`). A route may omit availability rules.
- `ruleKey` is one canonical namespace across `requirementRules`, `routeAvailabilityRules`, `barrierRules`, `unresolvedCheckRules` and `actionRules`; the same rule key must never mean two different rules.
- `explanationKey` on an unresolved check is a stable internal machine key, never participant-facing copy.


`parseCanonicalCareerPack(input)` strict-parses, validates, throws `CareerPackValidationError` when invalid, and returns a **deeply runtime-frozen** canonical object. The deep freeze is local to this package by design.

## Automatic assembly, not automatic invention

The pack structure exists so that reviewed content can be assembled deterministically. Nothing here invents requirements, evidence or claims, and AI is never a runtime eligibility authority.
