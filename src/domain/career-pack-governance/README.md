# Career Pack Publication & Governance (Increment 6)

Pure TypeScript + Zod governance layer over the canonical Career Pack schema
(Increment 5). No SQL, no migrations, no hosted database writes, no live
publishing, no admin UI, no Decision Engine execution, no AI.

## Contents

| File | Responsibility |
| --- | --- |
| `codes.ts` | Frozen catalogues: 5 lifecycle states, 5 internal roles, capabilities, issue codes |
| `canonical-json.ts` | Deterministic canonical JSON (sorted keys, preserved array order, fail-closed) |
| `hash.ts` | SHA-256 content hash of a canonical pack and of a scenario definition |
| `integrity.ts` | Shared non-circular canonical-pack, hash, actor and timeline integrity checks |
| `semver.ts` | Strict SemVer 2.0.0 validation and precedence (exact numeric comparison; build metadata never affects precedence) |
| `schema.ts` | Strict governance envelope, actor stamps, attestations, state-discriminated records |
| `publication-gate.ts` | Evidence/contract validation of a complete passing attestation set |
| `lifecycle.ts` | Pure forward-only transitions and external record validation |
| `projection.ts` | Deterministic projection manifest derived only from a published record |

## Guarantees

- Lifecycle is exactly `draft -> reviewed -> approved -> published -> withdrawn`,
  forward only. No reinstatement, no deletion, no backward transition.
- `author != reviewer != approver`, enforced for `admin` too. `admin` carries
  capability, never separation bypass.
- Content hash is always computed, never accepted from an author. Any content
  change invalidates prior stage records.
- Publication requires a complete, exact, passing scenario attestation set for
  the exact pack content hash and exact Decision Engine version. A missing or
  failed scenario blocks publication; it is never a warning.
- Publication requires strictly greater SemVer precedence than the latest
  historically published version. Withdrawal never frees a version for reuse.
- Every returned record is deeply runtime-frozen; transitions never mutate input.
- `transitionCareerPackToPublished` changes **in-memory domain state only**. It
  performs no I/O and is not live publishing, which remains an owner hard gate.
- Governance identity, dates and lifecycle state live in the envelope and are
  never written into the hashed canonical pack document.
- Every input is runtime-untrusted: records, actor contexts, engine versions,
  attestations and lineage refs are strict-parsed, so an unknown field (for
  example `model`, `prompt` or `result`) fails closed rather than being ignored.
- Only a FULLY valid prior record can transition, and only a fully valid
  published record can produce a projection manifest.
- Lineage requires a complete pinned `{ id, version, contentHash }` reference.
- The package imports only `zod` and `node:crypto`; a boundary test proves it
  contains no SQL, migrations, database, RLS, auth, network, filesystem,
  deployment, UI or AI usage.
