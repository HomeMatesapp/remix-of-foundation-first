# Route Archetype Framework

Framework version: `1.0.0` (`ROUTE_ARCHETYPE_FRAMEWORK_VERSION`).

A **route archetype** is an INTERNAL, reusable route skeleton. It exists so that
later Career Packs can explicitly compose common UK career-route structures
without anyone writing a career-specific engine.

## Architecture boundary

- Archetype **!=** participant-facing route. A participant may later see
  "Nursing degree"; internal content may use `regulated_undergraduate`.
  (Documentation example only — no nursing-specific code exists here.)
- Archetype **!=** occupation.
- Archetype **!=** Career Pack. Career-specific requirements and rules live in
  versioned Career Packs, later.
- Archetype **!=** Decision Engine rule. The Decision Engine later interprets
  pack-defined rules; there is zero career-specific engine code in this package.
- Archetypes provide reusable structural scaffolds only.
- A route may compose multiple archetypes where genuinely justified, e.g. a
  `bridging` structure followed by another route structure.
- **Do not force a route into an archetype that does not fit.** Absence of a
  suitable archetype is preferable to forcing a wrong one.
- Archetype selection is an explicit content-authoring decision. There is no
  fuzzy inference, no AI classification, no automatic route-to-archetype
  matching and no runtime eligibility logic.

## Persistence note

The catalogue is deliberately **not** a PostgreSQL enum or table. Route archetype
stays a governed text/code concept at the persistence layer; this TypeScript
registry is the governed validator.

## Current catalogue (stable order)

`regulated_undergraduate`, `postgraduate_conversion`, `degree_apprenticeship`,
`apprenticeship`, `vocational_qualification`, `licence_certification`,
`portfolio_experience`, `self_employed`, `employer_led_training`,
`graduate_scheme`, `direct_employment`, `experience_led_progression`,
`bridging`, `regulator_verification`.

This is the currently governed catalogue, not a permanently exhaustive taxonomy.
Adding, removing or renaming an archetype is a governed framework change, never
an ad-hoc string.

## Stage keys

`stageKeys` are ordered, unique, internal machine keys describing a common
structural sequence. They are scaffolding, **not** business rules, and must never
encode eligibility thresholds, qualification grades, provider requirements,
evidence strength, questions, ranking scores or weights, costs, durations,
salaries, local availability, participant-facing copy, actions or
occupation-specific logic. They are not UI labels.

The definition and composition schemas are `.strict()`, so any attempt to add
policy vocabulary (`required`, `optional`, `blocking`, `severity`, `weight`,
`score`, `condition`, `rule`, `question`, …) fails validation.

## API

- `ROUTE_ARCHETYPE_CODES`, `RouteArchetypeCode`
- `ROUTE_ARCHETYPE_FRAMEWORK_VERSION`
- `routeArchetypeCodeSchema`, `routeArchetypeRefSchema`
- `routeArchetypeDefinitionSchema` / `RouteArchetypeDefinition`
- `routeArchetypeCompositionSchema` / `RouteArchetypeComposition`
- `listCurrentRouteArchetypes()` — stable catalogue order
- `resolveRouteArchetype(code, version)` — exact match, fails closed
- `isKnownRouteArchetypeRef(ref)`
- `resolveRouteArchetypeComposition(composition)` — ordered, fails closed

## Dependencies

Framework-independent. This package imports only `zod` and
`src/domain/contracts`. No React, no Supabase, no browser APIs, no UI, no
routes/components and no database access.
