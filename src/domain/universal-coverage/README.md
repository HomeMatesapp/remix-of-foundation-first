# Universal Reality Check Coverage Layer (Increment 13)

Pure, deterministic coverage/orchestration layer. It answers exactly one
question: **given confidently recognised occupation intent, what assessment
pathway may safely be offered?**

Binding principle: **automatic assembly, not automatic invention.**

## What this layer is

A translation from a closed Increment 12 `OccupationResolution` plus a validated
set of available Career Packs into exactly one of four outcomes:

| outcome | meaning |
| --- | --- |
| `full_assessment_available` | one canonical occupation, exactly one validated exact-bound Career Pack; returns pack id, authored version and recomputed content hash |
| `provisional_assessment_available` | recognised occupation, no supported pack; returns a strict provisional safe plan |
| `clarification_required` | Increment 12 ambiguity passed through with deterministic candidates |
| `demand_capture_required` | unrecognised intent; returns a pure capture descriptor preserving raw + normalised query |

## What this layer is NOT

- not a second Decision Engine — `evaluateRealityCheck` is never imported or run;
- not a second Reality Check result contract — no judgement, no requirement state;
- not a Career Pack generator — no synthetic pack, no fabricated route, condition,
  source or evidence grade;
- not a registry, publication service or persistence layer — no DB, no writes;
- not a local-reality, provider, vacancy or geography layer;
- no AI/model/prompt/embedding, network, filesystem, environment, clock or
  randomness.

## Architecture decision

A Career Pack is deliberately **not** synthesised for unsupported occupations.
The frozen Career Pack schema requires real routes, so a placeholder route would
be invention and would contaminate later participant output. Increment 13
therefore owns a small coverage contract instead.

## Provisional safe plan

Determined only by canonical occupation identity. It declares, in machine-readable
structure:

- canonical occupation identity is known;
- `supportDepth: "not_yet_supported"` and `engineBacked: false`;
- structural `limitations` — statements of ABSENCE, never assertions;
- `verificationRequiredBeforeCareerSpecificCertainty: true`;
- `requiredEscalations` — content review, adviser escalation, interest capture.

It declares **no authored question** (`declaresIntakeQuestions: false`). An
escalation requirement is safer than a generic questionnaire that could later be
mistaken for reviewed Career Pack questions.

## Runtime trust boundary

TypeScript is not a runtime trust boundary. The single supported public entry
point is `resolveRealityCheckCoverageFromPacks({ occupationResolution, universe,
availablePacks })`:

- the universe is strict-parsed through the closed Increment 12 canonical
  boundary before anything else happens;
- the supplied Increment 12 `OccupationResolution` is treated as untrusted input
  and reconciled against that canonical universe — exact id AND key must identify
  the same record and the supplied canonical title must match exactly; every
  clarification candidate is reconciled the same way; clarification and unmatched
  reasons must belong to the existing Increment 12 vocabulary;
- output identity is always canonical-universe truth, never a caller field, so
  the local `canonicalTitle` structural check is never proof of legitimacy;
- packs are strict-parsed, exact-bound and content-hashed inside the call path,
  so a fabricated catalogue entry or content hash cannot yield full support;
- the catalogue-based resolver is module-private and is not exported from the
  barrel. Occupation search is never rerun here.

Failures return `ok: false` with frozen issues (`occupation_universe_invalid`,
`occupation_resolution_invalid`, `occupation_resolution_mismatch`, plus the
catalogue codes) rather than throwing or degrading to provisional support.

`freezeCoverageDocument(value)` is genuinely deep: an already frozen parent is
still traversed (`Object.freeze` is shallow), and cycles terminate through a
private visited set no caller can supply.

## Catalogue rules

- pack truth is recomputed (strict canonical parse + SHA-256 content hash); a
  caller-declared occupation mapping or hash is never trusted;
- occupation binding is exact identity only, via the Increment 12 binder;
- output is independent of caller order and universe order;
- fails closed: two materially different packs claiming one occupation returns
  `competing_pack_support`, because frozen governance supplies no current-version
  selection semantic at this layer. Neither max SemVer nor array order decides.

Available packs in test content are an input to the resolver; they are not
evidence of live publication.
