# Immutable Assessment Inputs (Increment 8)

Pure, framework-independent domain layer producing the immutable, hash-pinned
input artefacts a historical Reality Check can later be reconstructed from
exactly.

## Documents

| Document                   | Schema version constant             | Value   |
| -------------------------- | ----------------------------------- | ------- |
| Answer Snapshot            | `ANSWER_SNAPSHOT_SCHEMA_VERSION`    | `1.0.0` |
| Evidence Context Snapshot  | `EVIDENCE_CONTEXT_SCHEMA_VERSION`   | `1.0.0` |

### Answer Snapshot

```
{ schemaVersion, snapshotId, careerPack: { id, version, contentHash },
  answers: [ { question: QuestionRef, value: QuestionAnswerValue } ] }
```

Deterministic input state only. No participant/user/institution identity, no
account ids, no display copy or prompts, no generative metadata, no
eligibility/requirement/route/barrier/action/judgement/ranking outcome, no
draft or progress state, and no self-referential content hash field.

Validation is STRUCTURAL confirmed-answer validation against the exact canonical
Career Pack. It never executes question visibility dependencies or Career Pack
consequential rules: deciding whether a question should have been asked is not
this document's responsibility.

### Evidence Context Snapshot

```
{ schemaVersion, snapshotId, careerPack: { id, version, contentHash },
  entries: [ { evidenceKey, revision: EvidenceRecordRevision } ] }
```

Each entry embeds the exact resolved immutable registry revision, so later
registry changes cannot rewrite historical assessment input state. Coverage is
exact: one entry per Career Pack `evidenceKey`, no extras, no duplicates.

A supplied entry must also SATISFY the Career Pack evidence reference declared
under the same `evidenceKey` (`evidenceBindingMismatches`): exact
`sourceId`/`sourceRecordKey` identity plus every field the reference actually
declares (`recordVersion`, `recordContentHash`, `grade`,
`participantClassification`, `retrievedAt` by exact instant). Otherwise the
document fails closed with `evidence_revision_reference_mismatch`. This check
never consults the current registry: history is validated against the pinned
reference and the embedded revision only. A correctly bound historical revision
carrying withdrawal metadata stays accepted; only the builder refuses withdrawn
revisions as NEW current input.


## Invariants

- The pinned Career Pack reference is always recomputed from canonical truth
  (`{ id, version, contentHash: hashCanonicalCareerPack(pack) }`); a
  caller-supplied hash can never override it.
- Canonical order is deterministic: answers by the full `(moduleCode,
  questionKey)` identity tuple, evidence entries by `evidenceKey`, both via JSON
  tuple encoding so no delimiter assumption exists. Multi-select selections are
  deterministically ordered because selection order carries no meaning.
- Participant text answers are preserved byte for byte; authored Career Pack
  data is never reordered.
- Hashing reuses the existing deterministic canonical JSON + SHA-256
  implementation from Career Pack governance. No second algorithm, no new
  dependency.
- Canonical documents are deeply frozen, including nested arrays, embedded
  revisions, `supersedes` and withdrawal fields.
- Builders fail closed: mismatched pack binding, duplicate/unknown questions,
  answer/kind mismatches, unresolved or contradictory evidence references, and
  withdrawn revisions offered as NEW current input are all errors.
- `reviewDueAt` having passed is never a rejection reason; evidence-strength
  consequences belong to later increments.
- Provenance REUSES `deterministicProvenanceSchema` exactly. Local Reality
  appears only as the already-approved opaque `SnapshotRef`.

## Out of scope

No SQL, migrations, hosted database, RLS/auth, server routes or functions, UI,
storage, session/ownership, receipts, submission endpoints, Decision Engine rule
evaluation, requirement-state derivation, barriers, ranking, judgement, evidence
strength mapping, question visibility execution, Local Reality documents,
postcode/PostGIS, reassessment workflows, generative metadata, live ingestion,
publication or deployment.
