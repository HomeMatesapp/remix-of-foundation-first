> FOUNDATION FIRST GOVERNANCE: `docs/fresh-build/master-build-plan.md` is the canonical implementation sequence and increment gate for this project. The material below is frozen architecture/migration history and must not be mistaken for the active build sequence.

# CLEAR ROUTES — FINAL MIGRATION APPROVAL CORRECTIONS 1–3

Scope: corrections 1–3 only. No other ERD structure changed. No migrations, UI, engine, packs or data created.

---

## 1. Institution-created action/barrier privacy

### 1.1 Schema amendments

**`action` (amended)** and **`barrier` (amended)** — same treatment for both:

| Column | Type | Null | Notes |
|---|---|---|---|
| origin | action_origin | NN | `participant \| system \| adviser` (unchanged) |
| career_decision_context_id | uuid | NULL | composite FK `(career_decision_context_id, institution_id) → career_decision_institution_context(id, institution_id)` |
| institution_id | uuid | NULL | owning institution for adviser-created rows |
| created_by_staff_id | uuid | NULL | composite FK `(created_by_staff_id, institution_id) → staff_user(id, institution_id)` |
| owner_staff_id | uuid | NULL | (action only) composite FK `(owner_staff_id, institution_id) → staff_user(id, institution_id)` |

Constraints:
- CHECK `(origin = 'adviser') = (career_decision_context_id IS NOT NULL AND institution_id IS NOT NULL)` — adviser-created progression **must** carry context + institution; participant/system progression **must not**.
- CHECK `origin <> 'adviser' OR created_by_staff_id IS NOT NULL`.
- CHECK `owner_staff_id IS NULL OR institution_id IS NOT NULL` (action).
- Trigger `progression_context_consistency()` `BEFORE INSERT/UPDATE`: the referenced context's `career_decision_id` must equal the row's `career_decision_id`, and its `participant_id` must equal the row's `participant_id`.
- Trigger `progression_origin_immutable()`: `origin`, `career_decision_context_id` and `institution_id` are never updatable after insert — an institution cannot re-home another institution's row, and a participant/system row cannot be converted into an institution-private one or vice versa.

Indexes: `(career_decision_id, origin)`; partial `(institution_id, state)` WHERE `institution_id IS NOT NULL`; `(participant_id, state)` retained.

### 1.2 RLS

Helper (new): `can_access_progression_row(p_participant_id uuid, p_career_decision_id uuid, p_origin action_origin, p_institution_id uuid)` — `SECURITY DEFINER STABLE`:

```
participant  : current_participant_id() = p_participant_id
staff        : p_origin = 'adviser'
                 ? can_access_institution(p_institution_id)
                     AND can_access_career_decision(p_career_decision_id)
                 : can_access_career_decision(p_career_decision_id)
internal     : is_internal('admin')  -- support only, logged
```

Policies on `action` and `barrier` (replacing the v1.1 staff policies):

- **SELECT** — `USING (can_access_progression_row(participant_id, career_decision_id, origin, institution_id))`.
- **INSERT** — participant: `current_participant_id() = participant_id AND origin = 'participant'`. Staff: `origin = 'adviser' AND can_access_institution(institution_id) AND can_access_career_decision(career_decision_id)`. System rows: service role only.
- **UPDATE** — `USING` as SELECT, plus the existing field-authority triggers, plus: staff may update only rows where `origin = 'adviser' AND can_access_institution(institution_id)`; staff may **not** update `origin IN ('participant','system')` rows at all except the permitted adviser-facing state/assignment fields on `system` rows within an institution they hold access to **and** only where a `career_decision_institution_context` exists for their institution (unchanged field whitelist from Addendum §12 applies).
- **DELETE** — no policy on either table (barriers are never deleted; actions are retired by state).

Net effect: `origin IN ('participant','system')` progression is visible to any institution with authorised access to the participant's CareerDecision, exactly as before. `origin='adviser'` progression is visible and manageable **only** to the participant and to authorised staff of `institution_id`. Institution A never sees Institution B's adviser-created action or barrier on the same shared CareerDecision. `attention_signal` derivation is filtered by the same helper so a private row cannot leak through the Needs Attention queue.

No cross-institution sharing mechanism is introduced.

### 1.3 Tests (`/tests/rls`) — both directions

Fixture: participant Mary; `career_decision` (Registered Nurse); contexts for Institution A (Coventry College) and Institution B (Council). Rows: `A_action` (origin adviser, institution A), `A_barrier` (adviser, A), `B_action` (adviser, B), `B_barrier` (adviser, B), `P_action` (participant), `S_barrier` (system).

1. Staff A SELECT `action`/`barrier` for the decision → sees `A_action`, `A_barrier`, `P_action`, `S_barrier`; **not** `B_action`, `B_barrier`.
2. Staff B → mirror assertion; sees B's rows plus participant/system rows, not A's.
3. Staff A `UPDATE B_action SET state='completed'` → 0 rows affected / policy denial. Same for `B_barrier`. Mirror for Staff B on A's rows.
4. Staff A `SELECT ... WHERE id = B_action.id` directly by id → 0 rows (no id-based bypass).
5. Mary SELECT → sees all six rows.
6. Staff A INSERT an adviser action with `institution_id = B` → denied. INSERT with `career_decision_context_id` belonging to B → denied by consistency trigger.
7. Staff A UPDATE `A_action SET institution_id = B` → raises (origin/context immutability).
8. Staff A INSERT adviser action with `career_decision_context_id = NULL` → CHECK violation.
9. INSERT participant-origin action carrying `institution_id` → CHECK violation.
10. `attention_signal` rebuild for Institution A contains no signal referencing `B_action`/`B_barrier`; mirror for B.
11. Staff of a third institution with **no** context row → sees nothing for this decision, including participant/system rows.

---

## 2. Multiple cohort contexts over time

### 2.1 Schema amendments

**`career_decision_institution_context` (amended)** — `cohort_id` **removed**. It remains the stable CareerDecision ↔ Institution relationship: `id`, `career_decision_id`, `institution_id`, `institution_participant_id`, `participant_id`, `status`, `created_at`, `ended_at`, plus `UNIQUE (career_decision_id, institution_id)` and `UNIQUE (id, institution_id)`.

**`career_decision_context_cohort` (new)**

| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | NN | PK |
| career_decision_context_id | uuid | NN | composite FK `(career_decision_context_id, institution_id) → career_decision_institution_context(id, institution_id)` ON DELETE RESTRICT |
| institution_id | uuid | NN | FK `institution(id)` |
| cohort_id | uuid | NN | composite FK `(cohort_id, institution_id) → cohort(id, institution_id)` |
| status | relationship_status | NN | default 'active' |
| started_at | timestamptz | NN | default now() |
| ended_at | timestamptz | NULL | CHECK `ended_at IS NULL OR ended_at >= started_at` |
| created_at | timestamptz | NN | default now() |

Constraints/indexes:
- `UNIQUE (career_decision_context_id, cohort_id)` — the same cohort is not recorded twice for one context.
- `UNIQUE (id, institution_id)` — composite-FK anchor for children.
- Partial `UNIQUE (career_decision_context_id) WHERE status = 'active'` — at most one *current* cohort association per context, while unlimited historical rows are retained.
- Index `(institution_id, cohort_id, status)`; index `(cohort_id)`.
- Trigger `context_cohort_membership_check()`: the participant must have (or have had) a `cohort_membership` for that cohort through the same `institution_participant`.
- Trigger `context_cohort_no_overwrite()`: an existing row is never repointed to a different `cohort_id`; starting a new cohort association sets `status='inactive'` and `ended_at` on the previous row and **inserts** a new row.

Mary's example is therefore two rows under one context: Adult Careers Programme 2027 (`inactive`, ended) and Return to Work Programme 2028 (`active`).

**Children re-anchored for historical reporting.** `support_request`, `adviser_intervention`, `referral`, `follow_up` and `attention_signal` keep `career_decision_context_id` + `institution_id` (Addendum §B) and add a **nullable** `career_decision_context_cohort_id uuid` with composite FK `(career_decision_context_cohort_id, institution_id) → career_decision_context_cohort(id, institution_id)`, captured at creation time so each record stays attributable to the cohort it happened under even after the participant moves cohort. `reality_check.cohort_id` is unchanged (already a point-in-time capture).

### 2.2 RLS

`career_decision_context_cohort`: SELECT/INSERT/UPDATE where `can_access_institution(institution_id)`; no DELETE policy. Participant SELECT on rows for their own decision. `can_access_career_decision()` is unchanged (it resolves through the context table, not the cohort table), so adviser assignment continues to work through `cohort_membership`.

### 2.3 Tests

12. One participant, one `career_decision`, one Institution A context. Insert cohort association for `Adult Careers Programme 2027`; later insert `Return to Work Programme 2028`. Assert: **two** rows exist; the 2027 row has `status='inactive'` and `ended_at IS NOT NULL`; the 2028 row is the only `active` one; the context row itself is unchanged and still unique per (decision, institution).
13. Attempt `UPDATE career_decision_context_cohort SET cohort_id = <2028>` on the 2027 row → raises (no-overwrite trigger).
14. Attempt to insert a second `active` row for the same context → partial unique violation.
15. Attempt to insert a duplicate (context, cohort) pair → unique violation.
16. Insert a cohort association whose `cohort_id` belongs to Institution B → composite FK violation.
17. Insert a cohort association for a cohort the participant has no membership in → membership-check trigger raises.
18. A `support_request` created in 2027 retains `career_decision_context_cohort_id` = the 2027 row after the participant moves to the 2028 cohort; a cohort report for 2027 still counts it, and the 2028 report does not.
19. Institution B staff SELECT `career_decision_context_cohort` → sees none of Institution A's cohort history.

---

## 3. Geographic implementation locked: PostGIS

**Decision: PostGIS.** The Haversine/`numeric` fallback branch is withdrawn; no alternative geographic architecture may be substituted silently.

### 3.1 Migration prerequisite (runs before any geographic DDL)

Ordered gate, as the first geographic migration:

1. Confirm availability: `SELECT * FROM pg_available_extensions WHERE name = 'postgis';`
2. Enable via the approved Supabase approach: `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;` and ensure `extensions` is on the database `search_path` for the roles used.
3. Verify column creation: a scratch table with `geog geography(Point,4326)`.
4. Verify index creation: `CREATE INDEX ... USING GIST (geog)`.
5. Verify radius/distance queries: `ST_DWithin(geog, ST_MakePoint(lng,lat)::geography, miles * 1609.344)` and `ST_Distance(...) / 1609.344` returning approximate miles.
6. Drop the scratch objects; record the verification result in the migration log.

Affected columns (unchanged in shape): `participant_location.geog`, `local_area.centroid`, `provider.geog`, `opportunity.geog`, `local_snapshot_item.item_geog`, each with a GIST index. Participant-facing proximity remains approximate miles/radius ("approximately 4 miles away", "3 relevant opportunities within approximately 10 miles") — no travel-time prediction.

### 3.2 Status of the prerequisite

The backend project has **not been provisioned yet** for this build, so step 1 cannot be executed today; it is the first action of the first migration turn. PostGIS is a supported Supabase extension, so the expected outcome is a pass. Per your instruction, if steps 1–5 fail in the actual target project, work stops immediately and is reported as `MIGRATION BLOCKER: PostGIS unavailable in target project` — no substitute geographic architecture will be introduced.

---

## Confirmation of scope

No other ERD structure changed. Untouched: identity/auth separation (Addendum A), audit immutability (C), local snapshot self-explanation (D), pack-content-hash publication gate (E), location retention/purpose/aggregate governance (F), occupation universe and full-title search precedence, Career Pack canonical-document + projection model, ranking structure, assessment tables and immutability set, evidence and source registries, agents, referral/follow-up, governed vocabularies, and every §10 integrity rule.

Tables added here: `career_decision_context_cohort`. Tables amended here: `action`, `barrier`, `career_decision_institution_context`, `support_request`, `adviser_intervention`, `referral`, `follow_up`, `attention_signal`.

## Final statement

**READY FOR MIGRATIONS** — subject to the §3.1 PostGIS verification gate executing as the first step of the migration sequence. If that gate fails in the target project, the run halts with `MIGRATION BLOCKER: PostGIS unavailable in target project`.

Stopping here. No migrations, UI, Decision Engine, Career Packs or production data created.

---

# FINAL PRE-MIGRATION TECHNICAL PATCH (P1–P2)

Scope: two implementation contradictions only. No ERD architecture revisited.

## P1. Progression origin / institution constraint

### P1.1 Explicit OR-based CHECK (replaces the boolean-equivalence CHECK)

Applies identically to `action` and `barrier`:

```sql
CONSTRAINT progression_origin_provenance CHECK (
  (
    origin = 'adviser'
    AND career_decision_context_id IS NOT NULL
    AND institution_id             IS NOT NULL
    AND created_by_staff_id        IS NOT NULL
  )
  OR
  (
    origin IN ('participant','system')
    AND career_decision_context_id IS NULL
    AND institution_id             IS NULL
    AND created_by_staff_id        IS NULL
  )
)
```

`action` additionally:

```sql
CONSTRAINT action_owner_staff_scope CHECK (
  (origin = 'adviser' AND (owner_staff_id IS NULL OR institution_id IS NOT NULL))
  OR (origin <> 'adviser' AND owner_staff_id IS NULL)
)
```

Superseded and removed: `(origin = 'adviser') = (career_decision_context_id IS NOT NULL AND institution_id IS NOT NULL)`, and the separate `origin <> 'adviser' OR created_by_staff_id IS NOT NULL` CHECK — both are absorbed above. Partially populated institutional provenance is now impossible in either direction.

Unchanged: `progression_context_consistency()` and `progression_origin_immutable()` triggers (§1.1).

### P1.2 Field authority — system/participant ownership exception withdrawn

Addendum §12's adviser-facing whitelist on `origin='system'` rows is **withdrawn in full**. Corrected wording:

- Staff may INSERT/UPDATE **only** rows where `origin = 'adviser'` and `can_access_institution(institution_id)`.
- Staff may **not** update any column of `origin IN ('participant','system')` rows — including `state`, `owner_staff_id`, `due_at`, `institution_id`, `career_decision_context_id`, priority or notes. Read access is unchanged.
- Participant/system progression remains participant-owned shared progression. Participants retain the previously approved participant-progress field permissions (`state`, participant notes, `completed_at`) on their own rows.
- Institution-specific work is expressed as a **separate** `origin='adviser'` row in that institution's `career_decision_context_id`; it never modifies, owns or re-homes the shared row.
- `system` rows are written by the service role only.
- Trigger `progression_field_authority()` amended: raise `insufficient_privilege` when the acting role is staff and `OLD.origin <> 'adviser'`.

### P1.3 RLS wording (corrected)

`can_access_progression_row(...)` unchanged. Policies on `action` / `barrier`:

- **SELECT** — `USING (can_access_progression_row(participant_id, career_decision_id, origin, institution_id))`.
- **INSERT** — participant: `current_participant_id() = participant_id AND origin = 'participant'`. Staff: `origin = 'adviser' AND can_access_institution(institution_id) AND can_access_career_decision(career_decision_id)`. `origin='system'`: service role only.
- **UPDATE** — participant: own rows, `origin IN ('participant','system')`, participant-progress fields only. Staff: `USING (origin = 'adviser' AND can_access_institution(institution_id) AND can_access_career_decision(career_decision_id))` with the same `WITH CHECK`. No staff path to `origin IN ('participant','system')` rows.
- **DELETE** — no policy.

### P1.4 Additional tests (`/tests/rls`, continuing numbering)

20. INSERT `origin='participant'` action with `institution_id` set → CHECK violation. Repeat for `career_decision_context_id` only, and for `created_by_staff_id` only. Repeat all three for `origin='system'` and for `barrier`.
21. INSERT `origin='adviser'` action missing `career_decision_context_id` → CHECK violation; missing `institution_id` → violation; missing `created_by_staff_id` → violation. Mirror for `barrier`.
22. INSERT `origin='participant'` action with `owner_staff_id` set → CHECK violation.
23. Staff A `UPDATE S_action SET owner_staff_id = <staff A>` → denied (0 rows / `insufficient_privilege`). Same for `SET institution_id = A`, `SET career_decision_context_id = <A context>`, `SET state='completed'`. Mirror on `P_action` and on `S_barrier`.
24. Staff A INSERT `origin='adviser'` action in A's context, complete provenance → succeeds; the shared `S_action` row is byte-identical afterwards (no ownership transfer, no state change).
25. Staff B SELECT `action` for the decision → A's new adviser action absent; B's own adviser rows and the participant/system rows present.
26. Mary (participant) SELECT → both the shared system action and A's adviser action visible.
27. Mary `UPDATE P_action SET state='completed'` → succeeds; `UPDATE A_action SET state=...` → denied by field authority (adviser-owned fields).
28. Staff A attempt to convert `P_action` to `origin='adviser'` → `progression_origin_immutable()` raises.

## P2. PostGIS schema qualification

Convention (binding for every geographic migration and query):

- PostGIS is installed once: `CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;`
- **All** PostGIS types, functions and operators are schema-qualified. No application role's `search_path` is broadened.
- Column definitions: `geog extensions.geography(Point,4326)`, `centroid extensions.geography(Point,4326)`, `item_geog extensions.geography(Point,4326)`.
- Indexes: `CREATE INDEX ... USING GIST (geog extensions.gist_geography_ops_nd)` — or plain `USING GIST (geog)` where the default opclass resolves; the opclass is qualified when named.
- Queries: `extensions.ST_DWithin(geog, extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography, miles * 1609.344)` and `extensions.ST_Distance(a, b) / 1609.344` for approximate miles.
- Functions touching geography are declared `SET search_path = public, extensions` internally *and* still use qualified names; qualification is not optional.

Prerequisite gate (unchanged, first geographic migration, in order): verify availability in `pg_available_extensions` → enable in `extensions` → verify `extensions.geography(Point,4326)` column creation on a scratch table → verify GIST index creation → verify qualified `ST_DWithin` / `ST_Distance` radius query → drop scratch objects and record the result. On failure: stop with `MIGRATION BLOCKER: PostGIS unavailable in target project`. No fallback geographic architecture is authorised.

## Confirmation of scope

No other ERD structure changed. Tables, columns, keys, RLS helpers, immutability rules, cohort history model (§2), institution privacy model (§1.2 net effect), identity/auth separation, audit immutability, pack content-hash gate, search precedence and ranking structure are all untouched. This patch changes only: the two CHECK constraints on `action`/`barrier`, withdrawal of the `origin='system'` staff field whitelist, the staff UPDATE policy wording, and PostGIS name qualification.

## Final statement

**READY FOR MIGRATIONS** — subject to the PostGIS verification gate above executing as the first step of the migration sequence.

No migrations created.
