# Shared Decision Engine (Increment 9)

ONE deterministic evaluator for every occupation. There is no career-specific,
occupation-specific or slug-specific code in this package: all consequential
behaviour comes from validated declarative Career Pack data plus the exact
immutable assessment-input snapshots.

## Boundary

- `evaluateRealityCheck(input)` — throws `DecisionEngineError` on invalid or
  conflicting input.
- `safeEvaluateRealityCheck(input)` — `{ ok: true, evaluation } | { ok: false, issues }`.
- `runCareerPackScenario(input)` — pure runner for the seven frozen scenario
  assertion kinds. No writes, no run records, no attestation.
- `DECISION_ENGINE_VERSION = "1.0.0"`.

Inputs: the exact canonical Career Pack, canonical Answer Snapshot, canonical
Evidence Context Snapshot, a caller-supplied `evaluatedAt`, and optionally an
opaque Local Reality `SnapshotRef`. Every document is revalidated through its own
existing canonical boundary and hashes are recomputed — caller hashes are never
trusted.

Purity: no ambient clock, environment, filesystem, network, database, live
Evidence Registry, AI/model/prompt authority or mutable state. Identical exact
inputs, including `evaluatedAt` and the optional local snapshot, produce
byte-equivalent structural output.

## Output envelope

The frozen `realityCheckResultSchema` is unchanged. The engine-local, strict,
deep-frozen envelope adds only what that contract has no field for:

- `result` — parses through the frozen result contract.
- `routeAvailability` — every DECLARED route in canonical route-key order, with
  `true | false | null` (`null` = unresolved).
- `triggeredActionKeys` — canonical, de-duplicated stable keys.

## Mechanics

- **Truth** is tri-state Kleene logic (`true | false | null`). A missing answer
  yields `null` for every comparison operator, never `false`.
- **Requirements** invent no precedence. Only a determinately-true rule asserts
  its declared state; conflicting true states fail closed; an unresolved
  competing state collapses a concrete state to `unknown`. Missing data can never
  independently produce `unmet`.
- **Evidence** caps judgement strength: a requirement declaring evidence keeps a
  consequential `met`/`unmet` only when an attached embedded revision is a
  confirmed requirement at grade A/B/C and not withdrawn; otherwise the state is
  capped at `verification_required`. Embedded historical revisions are never
  mutated.
- **Availability** comes only from a route's declared availability rules.
  Determinate `false` excludes the route from candidates but it stays visible in
  `routeAvailability`; conflicts fail closed; missing answers never remove a route.
- **Eligibility and practical fit** are structurally separate; only mandatory
  requirements can make a purpose `false` or `null`.
- **Ranking** is lexicographic over authored factor order with no scores,
  weights or arithmetic. Zero configs = unranked; more than one config fails
  closed with `ambiguous_ranking_configuration`.
- **Judgement** is exactly the four protected values. Unknown always outranks a
  negative conclusion, and a blocking barrier alone is a known condition rather
  than `not_realistic_yet`.

## Increment 10 guardrails

These are structural protections, not tuning. They are proven by hostile
regression and scenario tests in `__tests__/guardrails.test.ts` and hold for
every Career Pack because the engine is shared and career-agnostic.

- **Negative certainty is a last-resort structural conclusion.** `not_realistic_yet`
  is only reachable when EVERY route declared by the exact canonical Career Pack
  is definitively blocked and no unresolved fact could change that. The relevant
  route set is exactly the declared route set: there is no hidden relevance flag,
  route filter or selection policy.
- **Missing or unknown never means false or unmet.** An unresolvable condition
  yields `null`, a requirement resolves to `unknown`, mandatory eligibility and
  practical fit become `null`, and the judgement is `more_information_needed`. A
  missing boolean answer satisfies neither branch of a comparison.
- **Evidence authority caps certainty in both directions.** The ceiling applies
  symmetrically to a would-be `met` and a would-be `unmet`, so weak, unverified
  or withdrawn evidence can never manufacture a negative conclusion.
- **Provider-dependent evidence is non-generalising.** The existing
  `provider_dependent` participant classification cannot drive consequential
  `met`/`unmet` certainty even at grade A: the state is capped at
  `verification_required`, eligibility stays `null`, and no sibling route inherits
  a negative consequence. No provider identity, provider scope or provider field
  exists anywhere in this package.
- **Declared bridging routes are ordinary declared routes.** A route whose
  `archetypeComposition` includes the governed `bridging` archetype is evaluated by
  the same shared logic, with no special precedence, weighting, copy or
  eligibility semantics, and it cannot be skipped before a negative result.
- **Local Reality remains unresolved until Increment 17.** A declared local
  requirement surfaces its declared unresolved check and preserves uncertainty; its
  absence never makes a route unavailable, ineligible or negative.
- **No AI is a truth authority.** No model, prompt or generated content
  participates in any consequential state, and no ranking score or weight exists.

## Out of scope here

SQL, migrations, RLS, auth, UI, routing, server functions, local/geographic fact
evaluation, provider and vacancy data, participant-facing prose, and any
Increment 10+ policy.
