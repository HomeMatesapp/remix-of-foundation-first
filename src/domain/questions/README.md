# Question Module framework (Increment 4)

Framework-independent, reusable question/module structures that later Career Packs
can compose. Framework version: `1.0.0`.

## What this layer is

- A **governed catalogue of 13 module categories** (internal snake_case codes).
- Strict, serialisable contracts for reusable module and question definitions.
- A deterministic, inspectable dependency/visibility rule system.
- Pure validation helpers for a supplied definition set.

## Hard boundaries

- **Module != Career Pack.** A module is a reusable input structure. How packs
  reference or compose modules is decided in Increment 5.
- **Question != requirement or verdict.** A question captures participant input;
  it never asserts a requirement, an eligibility outcome or a judgement state.
- **Consequence declaration != evaluation logic.** Declaring `eligibility` means
  only "this answer is allowed to matter for that purpose later". No scores,
  weights, thresholds, rules or verdicts live here.
- **Dependency logic controls whether a question is asked**, never whether a
  career is realistic. Missing answers affect visibility only; they are never
  converted into a negative career fact.
- **No participant-facing copy.** No prompts, help text, labels, section titles or
  option labels — only stable internal keys. Copy arrives later as content.
- **No AI interpretation.** No free-text inference of any kind.
- **No Local Reality / postcode lookup / geocoding / PostGIS.** `postcode_geography`
  is a module category only; Local Reality is Increment 17.
- **No persistence.** Answer Snapshot versioning is Increment 8. There are no
  tables, enums or RLS in this increment.

## Fail-closed structural validation

- `questionModuleDefinitionSchema` rejects local contradictions at parse time: a
  child question whose `moduleCode` differs from the parent module, and duplicate
  question keys within the same module.
- `validateQuestionDefinitionSet()` remains defensive whole-set validation
  (duplicate modules, dangling refs, self-dependency, cross-module cycles,
  operator/input compatibility, and comparison values that could never be a valid
  answer to the referenced input).
- Comparison-value checks are purely structural: integer/decimal values must
  respect declared `min`/`max`, select values must be declared option keys, text
  values must be non-blank and respect `minLength`/`maxLength`, and date values
  must be real `YYYY-MM-DD` calendar dates. These are input-shape facts, never
  eligibility thresholds; the framework performs no date arithmetic or age logic.

## Authoring rule

Only consequential questions should be authored: ask a question only if its
answer can alter a consequential outcome (eligibility, practical fit, route
availability, route ranking, barrier identification, unresolved check, next
action). Every `QuestionDefinition` must declare at least one of those purposes.

Module definitions authored on this framework are reusable across many future
Career Packs. The catalogue deliberately contains no invented "universal"
questions: real qualification, registration, finance, background-check and
physical/work-pattern facts must not be flattened into premature generic enums.
