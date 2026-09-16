# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Clear Routes ("Foundation First" fresh build): a UK careers platform where a participant runs a
**Reality Check** against a career and gets a deterministic judgement about which routes into that
career are open to them. The product is being built strictly increment by increment; most of the
repo today is the pure domain core plus four "architecture-test" careers used to prove the
architecture generalises.

The project is connected to [Lovable](https://lovable.dev) and syncs through `main`. See
`AGENTS.md`: **never force-push, rebase, amend or squash already-pushed commits** — it rewrites
history on Lovable's side and destroys the owner's project history.

## Governance — read before changing anything

`docs/fresh-build/master-build-plan.md` is the **canonical implementation roadmap and authority**.
Git history, chat summaries and prior agent recollection do not override it.

- Work is gated per increment: *scope implemented → actual diff inspected → tests pass →
  architecture contract preserved → no future-scope leakage → increment closed*. Do not implement
  anything belonging to a later increment, and do not add speculative fields, enums or tables
  "for later".
- §6 lists the non-negotiable cross-increment rules. The load-bearing ones in code:
  `unknown` is never `unmet`; eligibility and practical fit are structurally separate; judgement
  strength never exceeds evidence strength; there are exactly four protected judgement states
  (`realistic_now`, `realistic_with_conditions`, `not_realistic_yet`, `more_information_needed`);
  one shared engine + declarative Career Packs, so a new career must never need new engine code;
  AI may propose but never determines consequential truth.
- §3 lists hard stops requiring owner decision: hosted/production DB migrations, production data
  changes, RLS/auth authority changes, live imports or publication, deployment, paid services,
  dependency/cost commitments, and any genuine architecture contradiction.
- Increment 17 (Postcode & Local Reality) is the open increment; everything through 16 is closed.

## Commands

Package manager is **bun** (`bun.lock`). `bunfig.toml` enforces a 24h `minimumReleaseAge`
supply-chain guard — confirm with the user before adding an exclusion or a dependency.

```sh
bun install
bun run dev              # vite dev
bun run build            # production build (part of every closure gate)
bun run test             # vitest run
bun run test:watch
bun run typecheck        # tsc --noEmit  (the roadmap's gates use `bunx tsgo --noEmit`)
bun run lint             # repo-wide eslint
bun run format           # prettier --write .
```

Single test file / single test:

```sh
bunx vitest run src/domain/decision-engine/__tests__/guardrails.test.ts
bunx vitest run src/domain/decision-engine -t "unknown never means unmet"
```

`vitest.config.ts` only collects `*.test.ts` under `src/{domain,content,features,routes}`; the
environment is `node`, so there is no DOM — tests exercise pure logic, view models and structural
source scans, not rendered components.

### Lint baseline

Repo-wide lint has a documented pre-existing baseline of **462 problems (456 errors, 6 warnings)**,
confined to the generated Supabase integration and shadcn `src/components/ui` files. Do not "fix"
it as a side quest; do keep it unchanged, and keep your own files out of the output. New/changed
domain work is verified with the scoped scripts instead, e.g.:

```sh
bun run lint:contracts          # or lint:decision-engine, lint:career-packs,
bun run lint:local-reality      # lint:evidence-registry, lint:questions, ... (one per invocation)
```

Each closed package has its own `lint:<package>` script in `package.json`; add one when you add a
package and keep every existing scoped lint clean.

## Architecture

Strict one-directional layering. Lower layers never import upward.

1. **`src/domain/*` — pure, framework-free packages.** Zod-first: schemas are the source of truth
   and types are `z.infer`red from them. No React, no Supabase, no network, no filesystem, no
   `process.env`, no ambient clock, no AI. Each package is a barrel (`index.ts`) over a consistent
   file set: `schema.ts` (Zod), `canonical.ts` (parse/normalise/deep-freeze at the boundary),
   `codes.ts` (frozen vocabularies and error codes), plus package-specific logic and a `README.md`
   that states the package's boundary and deliberate non-decisions. **Read that README before
   editing a package** — it records what the package is forbidden to do.
   - `contracts` — the shared vocabulary everything else consumes (judgement, requirement states,
     evidence grades, provenance envelope, result shape). Adding or renaming a value in a protected
     vocabulary is a breaking architecture change needing owner approval.
   - `archetypes`, `questions`, `career-packs`, `career-pack-governance` — the declarative content
     system: route archetypes, reusable question modules, the canonical immutable Career Pack
     document, and its hashing/semver/publication gate.
   - `evidence-registry`, `assessment-inputs` — sources and evidence with provenance and freshness;
     immutable Answer Snapshot and Evidence Context Snapshot.
   - `decision-engine` — ONE deterministic evaluator for every occupation, with zero
     career-specific code. Tri-state Kleene truth (`true | false | null`); missing data yields
     `null`, never `false`; evidence caps certainty symmetrically; ranking is lexicographic with no
     scores or weights. Identical exact inputs produce byte-equivalent output.
   - `occupation-universe`, `universal-coverage` — occupation identity/search, and what happens when
     a searched occupation has no published pack.
   - `local-reality`, `local-reality-persistence` — Increment 17, in progress; fact storage and
     migration-readiness analysis only, concluding nothing about local accessibility yet.
2. **`src/content/*` — authored data, not code.** The four architecture-test careers (electrician,
   registered nurse, solicitor, photographer), their evidence/source records, occupations and
   participant-facing copy. Content is parsed through the domain canonical boundaries and bound by
   content hash; a `*.server.ts` suffix means the content is server-only.
3. **`src/features/*` — presentation.** A `view-model.ts` turns engine output into copy-bound view
   data, with `components/` for rendering. Server access is deliberately narrow: `*.functions.ts`
   declares the TanStack `createServerFn` boundary and nothing else, while the real work lives in a
   sibling `*.server.ts` so server-function splitting cannot strip declarations. There is exactly
   one server boundary for coverage/pack binding and one for evaluation, and they perform no DB
   access, auth, writes or external network calls.
4. **`src/routes/*` — TanStack Start file-based routing.** See `src/routes/README.md` for
   conventions. `routeTree.gen.ts` is generated; never hand-edit. Do not introduce `src/pages/` or
   Next.js/Remix layout conventions. `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`,
   which already bundles the TanStack/React/Tailwind/nitro plugins — adding them manually breaks
   the app.

### Test conventions

Tests are part of the architecture, not just coverage:

- **`__tests__/boundary.test.ts`** — structural scans of a package's own source that *fail the build*
  if forbidden concepts appear (SQL, RLS/auth, network, filesystem, UI framework, AI/model/prompt,
  ambient clock, `process.env`, later-increment concepts). When you add a file to a governed
  package, expect these to police it. Do not weaken a boundary test to make a change pass.
- **`__tests__/reconciliation.test.ts`, `r*-closure.test.ts`, `guardrails.test.ts`** — hostile
  regression tests recording external-inspection findings from a specific increment or
  reconciliation round. Treat them as frozen evidence of a closed decision.
- **`catalogue-immutability.test.ts`** — proves frozen vocabularies and catalogues have not drifted.

## Supabase

`src/integrations/supabase/types.ts` is generated — do not hand-edit it; unexplained drift there has
previously blocked an increment gate.

`supabase/authored-migrations/` holds SQL that is deliberately **authored but not applied**: moving
it into the managed `supabase/migrations/` path would itself perform the hosted apply, which is an
owner-gated action. `supabase/tests/*.sql` are pgTAP-style suites run against the live database
during an increment gate. PostGIS is the locked geographic implementation — no Haversine fallback.
