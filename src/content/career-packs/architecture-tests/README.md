# Architecture-test Career Packs (Increment 11)

Four real, evidence-backed Career Packs whose purpose is to prove that the frozen
architecture holds for genuinely different UK career shapes:

| Pack                                 | Why it exists                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registered Nurse (NMC)               | Hard statutory regulation, approved-programme gate, apprenticeship and overseas variants, declared local dependence                                     |
| Electrician                          | Nation-sensitive availability, experience-led assessment milestones, provider-dependent entry, guidance-grade evidence                                  |
| Solicitor of England and Wales (SRA) | Contextual milestones (SQE1, SQE2, qualifying work experience), degree-equivalence verification, apprenticeship alternative to a blocked standard route |
| Photographer                         | Unregulated: no eligibility requirement at all, pure practical fit, portfolio and self-employment readiness                                             |

## Rules this package obeys

- Content is DATA only. No engine code, no UI, no SQL, no network, no clocks, no
  randomness, no AI generation, no scores or weights.
- It consumes the frozen Increment 5 Career Pack schema, Increment 4 question
  modules, Increment 3 archetypes and Increment 2 contracts — unchanged.
- Every pack is finalised through `parseCanonicalCareerPack`, so it is strictly
  validated and deeply frozen at module load.
- Every authored string is a stable machine key. There is no participant-facing
  copy here.
- Every question is consequential: it appears in at least one requirement,
  availability, barrier, unresolved-check, action or ranking rule.
- Evidence grade and participant classification are explicit on every entry, and
  the Decision Engine's evidence ceiling is left to do its work — guidance-grade
  and provider-dependent evidence cannot produce a confident state.
- Absence is never a negative fact: missing answers stay `unknown`, missing local
  data raises an unresolved check, and out-of-scope national criteria are declared
  unavailable rather than generalised.

## Files

- `sources.ts` — stable source identities and source record keys
- `registered-nurse.ts`, `electrician.ts`, `solicitor-england-wales.ts`,
  `photographer.ts` — the canonical packs
- `index.ts` — `ARCHITECTURE_TEST_PACKS`
- `__tests__/fixtures.ts` — deterministic evidence registry and answer snapshots
- `__tests__/architecture-test-careers.test.ts` — validity, same-engine proof,
  diversity and guardrails against real content
- `__tests__/boundaries.test.ts` — content-only isolation

Human-readable provenance for every cited record lives in
`docs/research/increment-11-authoritative-sources.md`.
