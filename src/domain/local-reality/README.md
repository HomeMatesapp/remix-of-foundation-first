# Local Reality — Stage A snapshot contract

Pure, framework-independent domain package for the immutable historical **Local
Reality snapshot**. Stage A is **fact storage only**.

## What this package is

- `LOCAL_REALITY_SNAPSHOT_SCHEMA_VERSION = "1.0.0"` — document schema version only.
- A strict, whole-document validated, canonically ordered, deep-frozen snapshot
  of the local facts that were established and shown.
- Typed object references: exactly one of `providerId` / `programmeId` /
  `opportunityId`, matching `objectType`. No polymorphic object id.
- Source-owned identity: `sourceId` + verbatim `sourceRecordKey` (never
  normalised, never hash-replaced). Uniqueness is enforced per object namespace
  on `(objectType, sourceId, sourceRecordKey)`; the typed UUID is a separate
  exact reference, not part of the dedupe key. U+0000 is rejected fail-closed
  because the approved `source_record_key text` projection cannot store it; the
  shared Increment 2 / Increment 7 contract is unchanged.
- `signalKey` is a **required opaque governed signal identity** (frozen
  `local_snapshot_item.signal_key`). It is uninterpreted: it is not eligibility,
  not local accessibility and not any Stage B resolution.
- `organisationName`, `itemTitle` and `locationLabel` are nullable per the frozen
  addendum, so history is never forced to fabricate text. A label is screened for
  full-postcode shapes only when it is actually present.
- `approxDistanceMiles` is a **snapshotted already-established fact**, recorded
  to one decimal place at most and bounded to 9999.9 so it stays projectable to
  the approved `numeric(5,1)` column. Nothing here computes distance; geographic
  computation belongs to the later PostGIS work behind the DB gate.
- `approxRadiusMiles` is a whole number of miles, 1–100 inclusive, matching the
  frozen `smallint` column.
- `capturedAt` is the snapshot timestamp. No speculative freshness field is
  declared.
- `availabilityConfidenceKey` is an **opaque governed key**. The frozen ERD names
  an `availability_confidence` enum but its members are not defined by the
  authoritative documents, so none are invented. The key is uninterpreted: it is
  not proven confidence and carries no ordering. DB projection MUST bind it to
  the approved enum/vocabulary before migration.


## What this package is deliberately not

- No local-accessibility conclusion, no opportunity-status interpretation, no
  local labour-demand model, no Career Pack local-requirement resolution
  (Stage B), no UI (Stage C).
- No raw postcode of any precision, no coordinates, no geocoding, no distance or
  travel-time computation, no retention-period constant.
- No database, migration, SQL, RLS, auth, network, filesystem, environment, AI,
  Decision Engine, Compare/Choose/progress/dashboard or aggregate-intelligence
  concept.

Formal eligibility, practical suitability, local accessibility, current
opportunity availability, local labour demand and participant preference remain
separate dimensions. Finding no suitable or current opportunity is never route
non-existence or structural unavailability, and incomplete, unavailable, closed
or expired opportunity data never makes a career route impossible.

## Hashing

`./hash` is the server-authority module and the sole `node:crypto` path, reusing
the existing canonical JSON + SHA-256 governance implementation. It is not
exported from `index.ts`. The canonical document never contains its own content
hash; `localRealitySnapshotRef()` produces the existing `SnapshotRef { id,
contentHash }` shape by recomputation.

## Stage B — Local Requirement resolver (`./resolve`)

`resolveLocalRequirements()` is pure and deterministic and sits BESIDE the closed
Decision Engine: it never imports, calls, mutates or filters it. Per declared
Career Pack local requirement it answers only whether the supplied governed
snapshot holds matching signal evidence, binding by exact stable-key equality
(`LocalSnapshotItem.signalKey === CareerPackLocalRequirement.localFactKey`) with
no alias, normalisation, case folding, fuzzy matching, inference or AI.

Local-only states, sharing no protected requirement or judgement vocabulary:

- `location_not_supplied` — no snapshot, or `precisionLevel === "none"`.
- `matching_local_evidence_present` — usable location and one or more exactly
  matching items, returned as canonical-ordered `itemId`s.
- `local_evidence_insufficient` — usable location, no matching signal items.

`local_evidence_insufficient` means only that the snapshot holds no matching
governed evidence. There is deliberately no `no_current_example_found` state: the
frozen snapshot records positive established facts and carries no replayable
"search executed, zero results" record, so a truthful searched-and-found-none
state is deferred until such a contract is separately approved.

Authored `unresolvedCheckKey` is surfaced non-destructively as
`outstandingCheckKey` or `resolvedCheckKey` inside this local envelope only.
Snapshot signals not declared by the supplied pack are ignored. The opaque
`availabilityConfidenceKey` is neither read nor ordered.
