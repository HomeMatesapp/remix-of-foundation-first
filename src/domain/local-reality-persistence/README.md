# Local Reality persistence projection contract (Increment 17, Stages D1 + D2 + D3)

Pure, declarative readiness contract that locks the boundary between the CLOSED
Stage A canonical Local Reality snapshot and the frozen relational shape.

It is deliberately NOT:

- a relational client, repository, or any runtime persistence path;
- an executable statement generator (no SQL of any kind is emitted);
- authority to change hosted state.

Prohibited inside this package: raw or normalised participant location values,
coordinate pairs, geocoding, distance/spatial computation, network calls,
database clients, statement execution, relational change application, generative
models, Decision Engine or Career Pack changes, and any new judgement vocabulary.

## Stage D1 history (accurate, not rewritten)

Stage D1 reported four unresolved relational-mapping questions and failed closed
on them: `schema_version_column_not_frozen`,
`search_area_label_column_not_frozen`,
`availability_confidence_vocabulary_not_approved`,
`participant_facing_detail_representation_not_frozen`. That record was correct at
the time and is preserved in `codes.ts` as `RESOLVED_D2_BLOCKER_CODES`.

## Stage D2 decision resolution (current contract truth)

`decisions.ts` records the owner decisions of 2026-08-30:

| Canonical Stage A field     | Relational column                               | Decision                                                                                                                                                       |
| --------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`             | `local_snapshot.schema_version`                 | text NOT NULL, no relational default                                                                                                                           |
| `searchAreaLabel`           | `local_snapshot.search_area_label`              | text NULL, participant-safe display geography only                                                                                                             |
| `availabilityConfidenceKey` | `local_snapshot_item.availability_confidence`   | frozen named type `availability_confidence` NOT NULL, members exactly `known_available \| uncertain \| known_scarce \| unknown`, non-ordinal and uninterpreted |
| `details`                   | `local_snapshot_item.participant_facing_detail` | jsonb NOT NULL, exact Stage A array of `{ detailKey, detailText }`, empty/default `[]`                                                                         |

Exactly FOUR mapping decisions were resolved (the four rows above). Dependency
architecture was NOT resolved: it is separately reaffirmed, not reopened, in
`LOCAL_REALITY_D2_DEPENDENCY_REAFFIRMATION` — `source`, `occupation`,
`route_archetype`, `provider`, `programme`, `opportunity` keep real referential
constraints, with no weakening and no shadow substitutes — and dependency absence
remains the only current blocker.

Unchanged by D2: `participant_id` is envelope-only, `local_snapshot_id` is
parent-envelope-only, `centre_geog`/`item_geog` are nullable established facts
never synthesised, typed references and source identity are exact, all five
precision levels including `coarse` are projected verbatim, and no raw or
normalised participant location field exists anywhere.

### Availability vocabulary is non-ordinal

The four members carry no rank, weight, score, comparator, ordering,
accessibility, availability, eligibility or route meaning, and Stage B does not
interpret them. `known_scarce` is a governed upstream statement and must never be
inferred from a small or empty result count. Any internal declaration order of
the named relational type is an implementation artefact and must never be
exposed or used as product ordering.

### Stage A is not narrowed

Stage A keeps `availabilityConfidenceKey` as an opaque stable key. D2 is the
relational binding gate: `checkRelationalBindingCompatibility()` reports a
binding issue for any item whose key is not exactly one of the four approved
members. Nothing is trimmed, case-folded, aliased or widened.

## Readiness

`assessLocalRealityPersistenceReadiness()` is pure and deterministic and takes an
externally supplied dependency capability snapshot (defaulting to unavailable).
The only remaining blocker is `required_dependency_objects_absent`; when all six
dependency objects are supplied as present, `migrationReady` becomes `true`.

`migrationReady: true` is a CONTRACT/authoring-readiness statement only. It is
NOT authorisation to apply a hosted relational change; that remains a separate
hard owner gate, and no migration has been authored or applied.

## Stage D3 relational dependency foundation (current stage)

`dependency-graph.ts` encodes the exact transitive dependency graph that must
exist before the Stage D2-approved `local_snapshot` and `local_snapshot_item`
definitions could be authored. It is a contract, not a generator: no statement is
emitted, no hosted state is read or changed, and nothing is authorised.

Node classes: `foundation_anchor`, `extension_or_capability`, `closed_type`,
`governed_vocabulary`, `table`, `function_contract`. Node states:
`already_established_by_foundation`, `requires_preflight`, `to_be_authored`,
`definition_blocked`.

- Established foundation anchors: `internal_user`, `participant_profile`,
  `is_internal`, and spatial support verified by the existing explicit
  prerequisite migration (always reached through the qualified `extensions`
  schema; no coordinate-maths fallback exists anywhere).
- Preflight capabilities that are NEVER assumed present: `citext`, `pg_trgm`, and
  the immutable-history enforcement helper. Their verification is supplied
  externally and defaults to unverified.
- Governed vocabularies `source_type`, `opportunity_type` and `route_archetype`
  are TABLES keyed by a stable code, never enum types, and no code value or row
  is seeded or invented here.
- No shadow, minimal or temporary substitute object exists, and no referential
  requirement is relaxed. Absent objects stay absent.

`topologicalOrder()` is deterministic and independent of input order, and fails
closed on duplicate nodes, unknown dependencies and cycles.
`transitiveDependencies("local_snapshot_item")` demonstrably contains all six
separately reaffirmed direct dependency objects plus their prerequisites.

### Unresolved definition findings (fail closed)

`definition-findings.ts` records exactly three unresolved SCHEMA-DEFINITION
findings. They are not permission to guess, and they say nothing about
participant routes, availability, eligibility or judgement:

1. `occupation_status_members_not_frozen`
2. `normalise_title_controlled_suffix_list_not_frozen`
3. `programme_geog_index_without_column`

The final `programme` definition declares no spatial column while a spatial index
is stated for it, so the `programme` node is `definition_blocked` by that
contradiction: no column is synthesised and the stated index requirement is not
silently dropped, and the owner must reconcile it before `programme` can be
authored. The title-normalisation routine is not implemented and its controlled
suffix list is not invented. The external `import_batch_id` field on `provider`,
`programme` and `opportunity` keeps no referential target because the authority
states none.

### Stage D3 readiness (historical)

`assessD3SchemaAuthoringReadiness()` reports graph integrity separately from
schema-authoring readiness. Current state: the graph is structurally valid, and
`schemaAuthoringReady` is `false` while the three findings stand and the preflight
capabilities are unverified. The Stage D2 assessor
`assessLocalRealityPersistenceReadiness()` is unchanged in name and semantics.
Neither result is authorisation to author or apply a relational change.

## Stage D4 schema-definition reconciliation (current authority)

Stage D3 history stands as written above: three findings were discovered and D3
closed while all three were unresolved. Stage D4 does not rewrite that. It records
the product owner's acceptance of all three schema decisions on 2026-08-30, so the
CURRENT authority is:

1. `occupation_status` members are exactly `active | inactive`, default `active`.
   The two members describe catalogue lifecycle only — whether Clear Routes
   currently offers that occupation record — and never real-world availability,
   possibility, eligibility or any career judgement. No third member exists.
2. Canonical title normalisation is exactly lowercase, remove punctuation, remove
   diacritics, collapse whitespace. The controlled suffix list is WITHDRAWN from
   canonical relational identity: no morphological guessing of any kind. Flexible
   search and alias behaviour is a separate later concern, out of scope here.
3. `programme` has NO spatial column and NO spatial dependency, and the relational
   spatial index requirement applies to `provider` and `opportunity` only. Provider
   coordinates are not duplicated onto programme, no programme-location table is
   introduced, and programme locality is represented through its governed provider.

`d4-decisions.ts` freezes those decisions and the three resolved finding codes;
`D4_CURRENT_UNRESOLVED_DEFINITION_FINDINGS` is empty. `D3_DEFINITION_FINDINGS`
still has exactly three entries with unchanged codes as historical discovery.

`d4-reconciled-graph.ts` derives `D4_CURRENT_DEPENDENCY_NODES` from the frozen D3
catalogue without mutating it, and `applyD4Reconciliation()` is FULLY idempotent:
re-applying it to an already-reconciled catalogue deep-equals a single
application, notes and dependency arrays included, because an already-resolved
node is returned unchanged instead of accumulating another resolution marker.
Conflicting or malformed existing D4 resolution metadata fails closed. Each
resolution records EVERY accepted finding that unblocks it, so `occupation` — which
was blocked by both the status-member and title-normalisation findings — records
both codes in canonical D3 order, and no code outside `D4_RESOLVED_FINDING_CODES`
is accepted. Only four node STATES change — `occupation_status`,
`normalise_title`, `occupation` and `programme` all become `to_be_authored` —
while every classification and dependency list stays byte-for-byte as authored at
D3, so `programme` still excludes spatial support and the external
`import_batch_id` targets remain unspecified.

### Stage D4 readiness

`assessD4SchemaAuthoringReadiness()` reports historical D3 findings (3), current
unresolved definition findings (0), owner reconciliation completeness, graph
integrity and unverified preflight capabilities separately. `citext`, `pg_trgm`
and the immutable-history enforcement helper are still NEVER assumed present, so
`schemaAuthoringReady` is `false` by default and becomes `true` only when all
three are explicitly supplied as verified. Even then it is authority to AUTHOR a
definition only — applying a hosted relational change remains a separate owner
gate, and no migration has been authored or applied.

## Stage D5 — preflight capability evidence (current evidence)

Stage D5 adds a pure immutable evidence layer beside Stage D4. It records what the
current repository migration history proves and what it does not prove. All Stage
D1–D4 history above is preserved unchanged; no owner decision is revisited.

Repository inspection is **complete**; capability verification is **not passed**.

- Exactly the eight committed migration files were inspected (`D5_INSPECTED_MIGRATION_PATHS`).
- `citext`: overall status `not_established_in_repository`, evidence strength `none` — no
  migration establishes or verifies it.
- `pg_trgm`: overall status `not_established_in_repository`, evidence strength `none` — no
  migration establishes or verifies it.
- `immutable_history_enforcement`: overall status `not_established_in_repository`, with
  **partial insufficient existing helper evidence** recorded separately as evidence strength
  `partial_insufficient`. `public.enforce_immutable_columns` exists as a generic
  selected-column UPDATE guard driven by `TG_ARGV`, but it has no whole-row UPDATE ban and no
  DELETE rejection path, so it is insufficient for immutable historical tables and is never
  reclassified as full enforcement. Partial evidence never changes the overall capability
  status and can never make `verified` true.

- All three overall `verified` flags are false. None is described as installed, live or
  available: the scope is "not established by current repository migration history /
  requires prerequisite authoring and later target-project verification". Repository
  absence is not a claim about any hosted target state.
- The spatial (PostGIS) foundation stays a separately recorded, already-established
  repository fact (`D5_ESTABLISHED_FOUNDATION_EVIDENCE`) and is not one of the three.

`assessD5RepositoryPreflights()` returns a deterministic frozen result with
`repositoryPreflightComplete: true` (inspection complete, **not** capabilities passed),
`prerequisiteAuthoringRequired: true`, `localSchemaAuthoringReady: false` and
`hostedApplyAuthorised: false`. `toD4PreflightCapabilityInput()` bridges only truly
repository-verified evidence into the unchanged Stage D4 assessor; under current
evidence every field is false and `assessD4SchemaAuthoringReadiness()` stays false.

Next work is **prerequisite capability migration authoring** — capabilities for `citext`
and `pg_trgm` with explicit target verification, and a full immutable-history helper that
rejects every UPDATE and every DELETE — followed by proving the accepted deterministic
`normalise_title` operations (including diacritic removal) during that SQL authoring.
Stage D5 selects no mechanism or extension that is not already approved, authors no SQL,
and hosted application remains unauthorised at a separate owner gate.

## Stage D6 — prerequisite capability AUTHORING (authored, not applied)

Stage D6 adds one authored prerequisite migration beside the unchanged Stage D4 and
Stage D5 layers. All Stage D1–D5 history above is preserved; no owner decision is
revisited, and Stage D5 remains the frozen eight-migration repository evidence
snapshot taken at its own closure point.

- Authored source: `supabase/authored-migrations/20260830220000_stage-d6-prerequisite-capabilities.sql`.
  It is the intended **ninth** migration in repository order, held as authored source
  outside the applied migration directory because it has **not been applied** and must
  not be applied implicitly.
- The three prerequisite keys remain exactly `citext`, `pg_trgm` and
  `immutable_history_enforcement`. Each carries authoring status `authored_not_applied`
  and `targetProjectVerified: false`.
- Authoring is **not** verification. No statement in the manifest, the migration source
  or this document claims that any target project has `citext`, `pg_trgm` or the
  immutable-history guard. Repository authoring says nothing about hosted state.
- The authored migration fails closed: it checks availability first and raises a clear
  `MIGRATION BLOCKER` for an unavailable extension, refuses an extension established in
  an unexpected schema instead of relying on an ambiguous search path or relocating it
  without review, and aborts when its own verification fails. Both extensions are
  established in the existing `extensions` schema convention, with no application-role
  search-path broadening.
- `citext` verification is a scratch, schema-qualified case-insensitive equality check
  only. It claims no accent or diacritic insensitivity. `pg_trgm` verification checks the
  schema-qualified similarity function, the expected GIN trigram operator class in the
  `extensions` schema, and a concrete trigram index build on a scratch relation.
- The new `public.forbid_mutation()` guard rejects **every** UPDATE and **every** DELETE
  on any table wired to it: no selected-column semantics, no successful mutation return
  path, narrow explicit function search path, and no client-callable surface. The
  pre-existing `public.enforce_immutable_columns()` selected-column helper is left exactly
  as previously defined and is neither edited nor repurposed. Verification proves that an
  append succeeds, both mutation paths are rejected, the appended row survives unchanged,
  and the scratch objects are removed. Reconciliation R1: a rejection counts **only** when
  the authored guard demonstrably caused it — the scratch blocks catch the guard's specific
  condition and use `GET STACKED DIAGNOSTICS` to require the exact guard SQLSTATE (`0A000`)
  together with a message naming the scratch table and the specific operation. Any unrelated
  exception aborts the migration instead of being counted as a successful rejection.

- No Local Reality relational table, participant data, postcode of any kind, data
  migration or spatial change appears in Stage D6. The spatial foundation stays a
  separate prior repository fact. `normalise_title` is still not implemented and **no**
  diacritic-removal mechanism (including `unaccent`) is selected; both remain later
  schema-authoring proof obligations.

`assessD6PrerequisiteAuthoring()` returns a deterministic frozen result with
`repositoryMigrationAuthored: true`, `targetProjectVerified: false`,
`d4SchemaAuthoringReady: false` and `hostedApplyAuthorised: false`.
`toD4PreflightCapabilityInputFromD6()` contributes nothing by construction, so
`assessD4SchemaAuthoringReadiness()` stays false. Stage D4 readiness is **not** satisfied.

Next: external diff inspection of the authored migration source, then an explicit owner
hosted-apply gate. There is no implicit application path.

## Stage D6 — HOSTED PREREQUISITE APPLY AND TARGET VERIFICATION

The authored prerequisite source above was applied at an explicit owner hosted-database
gate and then verified in the target project itself. `d6-target-verification.ts` records
that outcome BESIDE the authoring manifest: authoring semantics are unchanged, and Stage
D5 remains the frozen eight-migration repository evidence snapshot taken at its own
closure point.

- Hosted migration version `20260830222016`, applied as
  `supabase/migrations/20260830222016_d673d404-1627-42e9-8321-5d194a5b78c2.sql`. Its
  content is the authored D6 source unmodified; the applied inventory moved from eight to
  nine and the eight prior managed migrations remain historically intact.
- `citext` 1.6 and `pg_trgm` 1.6 are installed in schema `extensions`. Schema-qualified
  case-insensitive equality holds without over-matching, `extensions.similarity` returns
  0.5 for the near-miss occupation title, and `gin_trgm_ops` is present in `extensions`.
- `public.forbid_mutation()` exists as a SECURITY INVOKER trigger function with
  `search_path=public`, with no EXECUTE privilege for `authenticated`. The scratch gate
  passed: append allowed, UPDATE and DELETE each rejected under exact SQLSTATE `0A000`
  with the guard-specific table and operation message, appended row intact, scratch
  objects removed. `public.enforce_immutable_columns()` is unchanged.
- No Local Reality relational table, participant postcode storage, data import, spatial
  change, `unaccent` selection or `normalise_title` implementation was introduced.

`assessD6TargetVerification()` returns `hostedApplySucceeded: true`,
`targetProjectVerified: true`, `d4PreflightSatisfied: true` and
`relationalSchemaAuthorised: false`. `toD4PreflightCapabilityInputFromD6Verification()`
bridges target verification (never authoring) into the unchanged
`assessD4SchemaAuthoringReadiness()`, which is now satisfied at AUTHORING level only.

Next: external inspection of this hosted apply and verification diff, then roadmap closure
of the gate. The Local Reality relational schema is neither authored nor authorised.

## Stage D7 — relational schema AUTHORING (authored source, NOT applied)

Authored source: `supabase/authored-migrations/20260831210000_stage-d7-local-reality-relational-foundation.sql`,
the intended TENTH migration in repository order. It has not been applied anywhere;
hosted application remains a separate owner gate.

Authored objects (all independently valid frozen objects):

- closed named types with exactly their frozen members: `occupation_status`,
  `source_state`, `source_authority`, `evidence_scope`, `availability_confidence`
  (explicitly non-ordinal);
- governed vocabulary tables `source_type`, `opportunity_type`, `route_archetype` as
  extensible case-insensitive code tables, never enum types, with **no seed rows**;
- `source` (canonical URL uniqueness, withdrawn-not-deleted semantics, inherited v1.0
  read/index semantics: the authenticated read policy excludes `withdrawn` sources while
  internal governance retains access via the existing helper, and `state` and
  `authority_level` carry the inherited indexes);
- `taxonomy_import_batch` (non-negative record count);
- `provider` — authored EXACTLY to the frozen column authority
  (`EXTERNAL_ENTITY_COLUMNS` in `dependency-graph.ts`): same columns in contract order,
  same nullability, same types, **no business or lifecycle defaults** (the ONLY default
  is the global uuid primary-key convention `gen_random_uuid()` on `id`, restored by R2),
  no `created_at`/`updated_at` and no touch trigger (the observation facts are
  `first_seen_at`/`last_seen_at`/`last_verified_at`), `provider_type` and `last_seen_at`
  NOT NULL, `postcode_sector` as nullable `extensions.citext` (coarse organisation fact
  only), `status` plain text NOT NULL with no invented vocabulary, composite source
  identity uniqueness, nullable established `extensions.geography(Point,4326)` fact plus
  GIST index, and unreferenced `import_batch_id` because no target is stated;
- `local_snapshot` (authored by R2) — the Stage D2-approved participant Local Reality
  envelope, authored EXACTLY to the frozen D1/D2 authority (`PROPOSED_COLUMNS` /
  `SNAPSHOT_FIELD_PROJECTIONS`) with no extra columns: uuid PK with the global
  `gen_random_uuid()` default, delete-restricted `participant_profile` FK, closed
  `resolution_level` CHECK (`full_postcode|sector|outward|coarse|none`), nullable
  established `centre_geog` point plus GIST index, `radius_miles` 1–100 or null,
  `schema_version` and `captured_at` NOT NULL with **no default** (canonical values are
  supplied verbatim), participant-safe `search_area_label`, and NO raw/normalised
  postcode, lat/lng, retention or location-derivation field. IMMUTABLE HISTORY: separate
  `public.forbid_mutation()` BEFORE UPDATE and BEFORE DELETE triggers (raising for every
  caller including `service_role`), no touch trigger, no write policy or authenticated
  write privilege — reads use the established participant access pattern
  (`current_participant_id()` / `can_access_participant()` / internal admin) and inserts
  remain a service-role/server-boundary concern.

Conventions: row level security on every authored table, full table privilege for
`service_role`, read-only least privilege for `authenticated` (no write policy at all, so
writes fail closed), nothing for `anon`, and every referential action restricts deletes.

Fail-closed authoring: the migration creates a fresh Stage D7 layer, so it refuses to
adopt pre-existing objects of unverified shape. An absence gate before any DDL fails the
migration if any Stage D7 type, table, index or trigger name already exists (including
`local_snapshot`, its GIST index and both immutability trigger names); dependency
preconditions prove `participant_profile`, `public.forbid_mutation()`,
`current_participant_id()` and `can_access_participant(uuid)` exist before authoring;
all DDL is direct `CREATE` (no `IF NOT EXISTS`, no drop-and-recreate); and
self-verification checks the exact provider and local_snapshot frozen shapes (columns,
id-only defaults, trigger sets) plus the source indexes.

### Stage D7 R1 reconciliation

External inspection of the initial authoring commit
(`1d9a1ea8cd7dd37e0ea1e31b2fc7f21a02cf5242`) found confirmed drift from the frozen
provider column authority and the inherited source semantics. `D7_R1_RECONCILIATION`
records the exact corrections: provider reduced to exactly the frozen columns with no
invented defaults/timestamps/trigger, corrected nullability and types
(`last_seen_at`/`provider_type` NOT NULL, `postcode_sector` citext, `status` plain text),
source authenticated reads excluding withdrawn rows plus the inherited state/authority
indexes, and IF-NOT-EXISTS adoption replaced by the absence gate with direct CREATE.
Repository authoring only: no hosted database was contacted and nothing was applied.

### Stage D7 R2 reconciliation

External inspection of the R1 state (`f3e55574cb7aacd7e15b4a969de4b819940087fd`) found
two remaining contract issues, recorded in `D7_R2_RECONCILIATION` without erasing the R1
history:

1. **Provider uuid PK default.** R1 correctly removed the invented table-specific
   business/lifecycle defaults but over-corrected the primary key: the uuid primary-key
   default `gen_random_uuid()` is the frozen GLOBAL relational convention, not a
   table-specific invention. `provider.id` now carries it again; every other provider
   column still has NO default, and self-verification/tests now REQUIRE the id default
   while forbidding all others.
2. **local_snapshot was wrongly deferred.** Its frozen dependency chain is ONLY
   `participant_profile` + `postgis` + `immutable_history_enforcement` — all
   established/target-verified — so the already-authorised rule "author every
   independent frozen object whose complete dependency chain is valid" requires it. It
   is now authored (shape above). `local_snapshot_item` remains deferred for its OWN
   reason: its typed references need the unauthored programme/opportunity/occupation
   chain.

Repository authoring only: no hosted database was contacted and nothing was applied.

Deferred, not authored: `normalise_title`, `occupation`, `programme`, `opportunity`,
`local_snapshot_item`. The normalisation SEMANTICS remain accepted and unchanged
(lowercase, remove punctuation, remove diacritics, collapse whitespace, no morphology).
The blocker is a MECHANISM decision: no diacritic-removal mechanism has been
owner-approved, so no immutable helper and no generated canonical-title column can be
authored, and everything downstream of the occupation catalogue stays unauthored —
`local_snapshot_item` because its typed references need `programme`/`opportunity`, which
need `occupation`. `local_snapshot` itself is no longer in this chain. No extension is
selected and no character mapping is invented.

### Stage D7 R2.1 reconciliation

External inspection of the R2 state (`36ac3b3bdd5163b2b3169afeaad5ddbbacebbf51`) found one
functional migration-time defect and one stale comment, recorded additively in
`D7_R2_1_RECONCILIATION` with the R1 and R2 records left intact:

1. **Foundation-signature precondition.** The prerequisite gate looked up
   `public.is_internal()`, which does not match the foundation function's catalogue
   identity `public.is_internal(public.internal_role)` just because its argument declares
   `DEFAULT NULL`. That could have falsely blocked a future D7 apply. The lookup and its
   blocker text now use the exact declared signature; the intentional zero-argument calls
   `public.is_internal()` remain valid through the default argument and are unchanged.
2. **Stale present-tense programme comment.** The blocked-chain commentary still claimed
   programme carried its own definition contradiction; closed D4 resolved that. Programme
   is deferred solely because it references the unauthored occupation catalogue.

Repository authoring only: no hosted database was contacted, nothing was applied, the nine
managed migrations are unchanged, and `hostedApplyAuthorised` remains false.

## Stage D8 — diacritic-removal mechanism proof (`unaccent` immutable wrapper)

Current stage. The product owner has APPROVED `unaccent` as the accent-removal
dependency **direction only**, on the explicit condition that a deterministic immutable
wrapper is designed and proven before `normalise_title()` uses it. That approval carries
no hosted authority: the extension is installed nowhere, and nothing is applied.

Record: `d8-unaccent-wrapper-proof.ts`. Authored, not-applied proof source:
`supabase/authored-migrations/20260901090000_stage-d8-unaccent-immutable-wrapper-proof.sql`
(intended eleventh migration; managed migrations remain exactly nine).

The design, and why it is a proof rather than a keyword claim:

- The convenient one-argument `unaccent(text)` form is declared **STABLE** upstream
  because it resolves the accent dictionary through the caller's ambient resolution path.
  Wrapping that and re-declaring the wrapper IMMUTABLE would be a false claim, so the
  design never calls it.
- The wrapper calls the **dictionary-explicit** two-argument form, which is declared
  IMMUTABLE upstream, and pins the dictionary to the schema-qualified literal
  `'extensions.unaccent'::regdictionary`, so the same input can never be routed to a
  different dictionary by path, role or session. The wrapper itself carries a
  function-local `SET search_path = pg_catalog` — no role, database or session path is
  modified anywhere.
- Before the wrapper is created, the source verifies that the dictionary exists in the
  `extensions` schema, resolves from the frozen literal, uses the expected accent
  template, and is the dictionary owned by the approved extension. Every check fails
  closed with a `MIGRATION BLOCKER`, and an absence gate refuses to adopt a pre-existing
  wrapper of unknown shape.
- Immutability is then proved by the **server**, not by the author: the source builds a
  scratch relation with a stored generated column over the wrapper, which the database
  accepts only for a genuinely immutable expression, checks the derived value, and drops
  the scratch relation again.
- **Residual risk is stated, not hidden.** The dictionary's rule content is external
  server-side data; replacing or redefining it would change past results and silently
  invalidate dependent stored columns. It is governed: one frozen identity, one wrapper
  entry point, verified here, and any redefinition or relocation requires re-proof.

Wrapper contract is narrow: text in, accent-stripped text out. No lowercasing, no
punctuation removal, no whitespace collapsing or trimming, no singularisation, stemming,
lemmatisation or other morphology, no transliteration beyond what the approved dictionary
itself defines, and no invented character mapping.

`normalise_title()` is still NOT implemented. Its accepted operation order remains exactly
lowercase → remove punctuation → remove diacritics → collapse whitespace, with no
morphology. `occupation`, `programme`, `opportunity` and `local_snapshot_item` remain
unauthored, no generated occupation column exists, and no participant, postcode or
location scope is touched. Authoring cannot claim target verification, and
`hostedApplyAuthorised` remains false.

### Stage D8 — R1 external-inspection reconciliation (BLOCKED / NOT PROVEN)

The Stage D8 section above is retained as historical evidence. External inspection of
platform commit `349378b14ae7df1202f89d8e7bdf655ca8399d26` found a **critical proof
defect**, and the wrapper proof is now recorded as **BLOCKED — NOT PROVEN**:

- **False upstream volatility claim.** The official contrib install script
  `contrib/unaccent/unaccent--1.1.sql` declares **both** overloads —
  `unaccent(regdictionary, text)` and `unaccent(text)` — as
  `LANGUAGE C STABLE STRICT PARALLEL SAFE`. The earlier claim that the two-argument form
  is IMMUTABLE upstream is false; the exact recorded expectation is **STABLE for both**.
- **Circular proof logic.** A stored generated column over the wrapper cannot prove
  semantic immutability: the restriction inspects the *declared* volatility contract of
  the function in the generation expression, which the wrapper had already asserted.
- **Identity is not content.** Pinning `'extensions.unaccent'::regdictionary` freezes
  dictionary *selection* only. The dictionary's rules content is external server-side
  data backed by rules files and alterable through dictionary configuration, so the
  residual mutability remains unresolved under the owner's condition.

Consequently: no `IMMUTABLE` wrapper is authored or retained as an accepted design. The
authored source is now a fail-closed **blocker artifact**,
`supabase/authored-migrations/20260901090000_stage-d8-unaccent-mechanism-blocker.sql`,
which raises before any extension establishment or wrapper creation. The original source
is preserved verbatim, non-promotable, at
`supabase/authored-migrations/superseded/20260901090000_stage-d8-unaccent-immutable-wrapper-proof.SUPERSEDED-R1.sql.txt`.

`assessD8UnaccentWrapperProof()` now reports `wrapperDesignProven: false` with a non-empty
blocker list. The owner's approval of `unaccent` was conditional and the condition is
**not satisfied**. Managed migrations remain exactly nine with no accent extension,
hosted install/apply/target verification remain false, `normalise_title()` remains
unimplemented, and `occupation`, `programme`, `opportunity` and `local_snapshot_item`
remain unauthored. Stage D8 is **not closed**; the next step is a fresh owner/technical
decision on how diacritic removal is to be satisfied at all. No replacement mechanism is
selected here.

### Stage D9 — application-computed, database-stored `title_normalised` (owner-approved)

The product owner approved an architecture change: `occupation.title_normalised` is **no
longer a database-generated column** produced by a database `normalise_title()` function.
Clear Routes computes the canonical normalised title in application/domain code **before
persistence**, and the database stores that supplied canonical value in an ordinary
`text NOT NULL` column while its uniqueness/search constraints stay authoritative.

This supersedes **only** the earlier D4/D7 generated-column *mechanism* decision. All
Stage D1–D8 records above stand unchanged as history.

- **Normalisation behaviour is unchanged.** The canonical order remains exactly
  lowercase → remove punctuation → remove diacritics → collapse whitespace, restated from
  the frozen `NORMALISE_TITLE_OPERATIONS` authority rather than re-declared.
- **Mechanism.** Standard Unicode handling only: locale-independent `toLowerCase()`;
  Unicode-aware punctuation removal (any character that is not a letter, number, combining
  mark or whitespace becomes a *space separator*, so punctuation can never concatenate
  adjacent words); `normalize("NFD")` plus `\p{M}` combining-mark removal; then whitespace
  collapse and trim. No `unaccent`, no accent lookup table, no transliteration package, no
  locale-specific title rules, and no morphology of any kind.
- **Purity.** `normaliseCanonicalTitle` is pure, total, deterministic and idempotent: text
  in, canonical text out, with no database, network, environment, clock or state access.
- **Persistence boundary.** `buildOccupationTitleWriteValues(canonicalTitle)` is the only
  authored way to produce write values, and `assertOccupationTitleWriteValues` fails closed
  on any externally supplied `title_normalised` that is not exactly the canonical
  derivation. Blank titles, and titles that normalise to an empty canonical identity, are
  rejected before persistence.
- **Database integrity.** `title_normalised text NOT NULL` as a stored **ordinary** column
  (never `GENERATED`), `canonical_title text NOT NULL`, the frozen active-title uniqueness
  rule and the frozen trigram indexes all remain authoritative in the database. No database
  trigger reimplements normalisation: that would recreate the dual-source-of-truth problem
  this decision removes and is not owner-approved.
- **`normalise_title()` is no longer required** and must not be authored. `unaccent`
  remains rejected/blocked and does not return as a dependency of any node. Stage D8
  remains historically **BLOCKED / NOT PROVEN**.
- **Dependency reconciliation.** `D9_CURRENT_DEPENDENCY_NODES` removes `normalise_title`
  from `occupation.dependsOn` and changes nothing else, idempotently.
- **Occupation SQL was NOT authored.** The normalisation blocker is cleared, but a
  different, pre-existing blocker stands: this package's frozen column authority
  enumerates exact columns for `provider`, `programme` and `opportunity` only. Occupation's
  complete frozen column list, its word-count column definition and its exact
  partial-uniqueness predicate are not enumerated, so authoring it would require inventing
  columns. Stage D9 therefore stops at the contract/readiness layer
  (`occupation_column_contract_not_enumerated`).
- **Boundaries held.** No hosted contact, no new authored SQL source, managed migrations
  remain exactly nine, `programme`/`opportunity`/`local_snapshot_item` remain unauthored,
  and `hostedApplyAuthorised` remains false.

## Stage D9 R1 — external-inspection reconciliation (additive)

External inspection of D9 commit `f7a0ac43dbc7c8040ba2df2b1d52ffb2359b32ba` found the
application normalisation implementation materially sound, and the occupation authoring
blocker **overstated**. This reconciliation is additive; the original D9 record stands as
history.

- `normaliseCanonicalTitle`, the persistence guards, the Unicode-only mechanism, the D8
  BLOCKED / NOT PROVEN history and the D9 removal of `normalise_title` / `unaccent` from
  the `occupation` dependency list are **unchanged** — no defect was found.
- The blocker `occupation_column_contract_not_enumerated` is **superseded / overstated**
  and retained only as `D9_OCCUPATION_AUTHORING_BLOCKER_SUPERSEDED_R1`.
- The approved ERD v1.1 record (section 2.1, occupation) already freezes the complete
  column list, nullability, FKs, `status occupation_status NOT NULL DEFAULT 'active'`,
  `UNIQUE(code)`, `UNIQUE(title_normalised) WHERE status = 'active'`, the `family`/`sector`
  indexes, the `title_normalised` GIN trigram index and `is_internal('approver')` write
  authority. These are transcribed in `D9_R1_OCCUPATION_FROZEN_BY_ERD` so no later stage
  may report them as unspecified.
- The sole remaining occupation-definition gap is
  `occupation_title_word_count_generated_expression_not_frozen`: the ERD freezes
  `title_word_count smallint NOT NULL GENERATED` but not its generated expression. The
  D9 owner approval moved only where `title_normalised` is computed; `title_word_count`
  remains database-generated and its expression is deliberately **not** chosen here.
- Occupation SQL therefore remains **NOT authored**, solely for that reason.
  `programme`, `opportunity` and `local_snapshot_item` remain unauthored. Managed
  migrations remain exactly 9. `hostedApplyAuthorised` and `targetProjectVerified`
  remain `false`; no hosted contact was made.
