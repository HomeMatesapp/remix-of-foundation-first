-- CLEAR ROUTES — INCREMENT 17 / STAGE D7 (R1+R2-reconciled)
-- Local Reality RELATIONAL FOUNDATION. AUTHORED SOURCE ONLY — NOT APPLIED.
--
-- This file is authored source held outside the applied migration directory on
-- purpose. It is the intended TENTH migration in repository order (after the
-- nine applied migrations, the ninth being the Stage D6 hosted prerequisite
-- apply). It has not been applied to any database, and nothing below asserts
-- anything about the present state of any target project. Application is a
-- separate, explicit owner hosted-DB gate.
--
-- SCOPE (independently valid frozen objects only)
--   1. closed named relational types:
--        occupation_status, source_state, source_authority, evidence_scope,
--        availability_confidence
--   2. governed vocabulary tables (extensible text-code tables, NO seed rows):
--        source_type, opportunity_type, route_archetype
--   3. source
--   4. taxonomy_import_batch
--   5. provider
--   6. local_snapshot (R2: its frozen dependency chain is ONLY
--      participant_profile + PostGIS + the established immutable-history
--      helper, all present, so the authorised rule "author every independent
--      frozen object whose complete dependency chain is valid" requires it)
--
-- DELIBERATELY NOT IN SCOPE (dependency chain blocked; see the Stage D7 record)
--   normalise_title, occupation, programme, opportunity, local_snapshot_item.
--   local_snapshot_item stays deferred because its typed references need the
--   unauthored programme/opportunity/occupation chain; its parent envelope
--   no longer does.
--   The accepted normalise_title contract is exactly: lowercase, remove
--   punctuation, remove diacritics, collapse whitespace. No diacritic-removal
--   MECHANISM has been owner-approved, so no immutable implementation is
--   authored, no extension (`unaccent` or otherwise) is selected and no
--   diacritic mapping is invented here. Everything that depends on the
--   generated occupation columns therefore remains unauthored.
--
-- ALSO NOT IN SCOPE: no vocabulary seed rows, no participant data, no
-- participant postcode or participant location of any kind, no data migration,
-- no PostGIS installation change (the existing spatial prerequisite is reused
-- unchanged and reached only through the qualified `extensions` schema), no
-- singularisation/stemming/morphology, no external API, no AI.
--
-- CONVENTIONS PRESERVED: public schema, snake_case singular, row level security
-- on every table, service_role full table privilege, authenticated explicit
-- least privilege, anon nothing, referential actions restrict deletes by
-- default (nothing cascades), governed vocabularies are tables keyed by a
-- case-insensitive code and never enum types.
--
-- PROVIDER COLUMN AUTHORITY: the provider table below carries EXACTLY the
-- frozen external-entity columns recorded in the accepted dependency contract
-- (`EXTERNAL_ENTITY_COLUMNS`), in that contract's order, with that contract's
-- exact nullability and types. The frozen contract states NO business or
-- lifecycle defaults for any provider column, so none are authored — every
-- provider observation value must be stated explicitly through the governed
-- service_role import path. The ONE exception is the id primary key, which
-- carries the frozen GLOBAL relational convention default gen_random_uuid()
-- (R2 correction: R1 over-removed it together with the invented
-- table-specific defaults). The
-- frozen contract declares no provider created_at/updated_at, so those columns
-- and any touch trigger are deliberately ABSENT: first_seen_at/last_seen_at/
-- last_verified_at are the frozen observation facts.
--
-- FAIL-CLOSED AUTHORING: this migration creates a FRESH Stage D7 layer. It
-- refuses to run if any object it intends to create already exists, rather
-- than silently accepting a pre-existing object of unknown shape. All DDL
-- below is therefore direct CREATE after the absence gate — no IF NOT EXISTS,
-- no DROP-and-recreate, no CREATE OR REPLACE.

-- =====================================================================
-- 0. Fail-closed preconditions
--    0a. Foundation dependencies must be established exactly as expected.
--    0b. Absence gate: no Stage D7 object may already exist in any shape.
-- =====================================================================

DO $preconditions$
DECLARE
  v_schema text;
  v_type text;
  v_relation text;
BEGIN
  -- 0a. Foundation dependencies (established by earlier applied migrations).
  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'citext';
  IF v_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: citext is not established in the extensions schema';
  END IF;

  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'postgis';
  IF v_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: PostGIS is not established in the extensions schema';
  END IF;

  IF to_regclass('public.internal_user') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: identity foundation table public.internal_user is absent';
  END IF;

  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: foundation helper public.set_updated_at() is absent';
  END IF;

  -- The foundation declares is_internal(_role public.internal_role DEFAULT NULL);
  -- a default argument does not change the function's catalogue identity, so the
  -- lookup must use the full declared signature. Calls may still omit the argument.
  IF to_regprocedure('public.is_internal(public.internal_role)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: foundation helper public.is_internal(public.internal_role) is absent';
  END IF;


  IF to_regtype('public.relationship_status') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: foundation type public.relationship_status is absent';
  END IF;

  IF to_regclass('public.participant_profile') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: identity foundation table public.participant_profile is absent';
  END IF;

  IF to_regprocedure('public.forbid_mutation()') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: immutable-history helper public.forbid_mutation() is absent';
  END IF;

  IF to_regprocedure('public.current_participant_id()') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: foundation helper public.current_participant_id() is absent';
  END IF;

  IF to_regprocedure('public.can_access_participant(uuid)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: foundation helper public.can_access_participant(uuid) is absent';
  END IF;

  -- 0b. Absence gate. This migration authors a fresh Stage D7 layer; a
  -- pre-existing object with any of these names has an unverified shape and
  -- MUST fail the migration closed before any DDL runs.
  FOREACH v_type IN ARRAY ARRAY[
    'occupation_status', 'source_state', 'source_authority',
    'evidence_scope', 'availability_confidence'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = v_type
    ) THEN
      RAISE EXCEPTION 'MIGRATION BLOCKER: pre-existing Stage D7 object public.% has an unverified shape; refusing to adopt it', v_type;
    END IF;
  END LOOP;

  FOREACH v_relation IN ARRAY ARRAY[
    'public.source_type', 'public.opportunity_type', 'public.route_archetype',
    'public.source', 'public.taxonomy_import_batch', 'public.provider',
    'public.local_snapshot', 'public.provider_geog_gist',
    'public.local_snapshot_centre_geog_gist', 'public.source_state_idx',
    'public.source_authority_level_idx'
  ] LOOP
    IF to_regclass(v_relation) IS NOT NULL THEN
      RAISE EXCEPTION 'MIGRATION BLOCKER: pre-existing Stage D7 object % has an unverified shape; refusing to adopt it', v_relation;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal
      AND tg.tgname IN ('local_snapshot_forbid_update_trg', 'local_snapshot_forbid_delete_trg')
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: a pre-existing Stage D7 trigger name (local_snapshot_forbid_update_trg or local_snapshot_forbid_delete_trg) has an unverified shape; refusing to adopt it';
  END IF;
END $preconditions$;

-- =====================================================================
-- 1. Closed named relational types
--    Frozen member vocabularies exactly as approved. Declaration order carries
--    no product meaning; availability_confidence is explicitly NON-ORDINAL.
-- =====================================================================

CREATE TYPE public.occupation_status AS ENUM ('active', 'inactive');

CREATE TYPE public.source_state AS ENUM
  ('healthy', 'redirected', 'suspect', 'broken', 'withdrawn', 'under_review');

CREATE TYPE public.source_authority AS ENUM
  ('primary_authoritative', 'official_provider_employer', 'strong_secondary', 'exploratory');

CREATE TYPE public.evidence_scope AS ENUM
  ('national', 'regional', 'provider_specific', 'employer_specific');

CREATE TYPE public.availability_confidence AS ENUM
  ('known_available', 'uncertain', 'known_scarce', 'unknown');

COMMENT ON TYPE public.occupation_status IS
  'Repository/catalogue lifecycle only. Never a participant statement and never a statement about a career.';
COMMENT ON TYPE public.availability_confidence IS
  'NON-ORDINAL closed vocabulary. Members carry no ranking, no ordering and no proven-confidence meaning.';

-- =====================================================================
-- 2. Governed vocabulary tables (NO seed rows)
--    Extensible text-code tables, deliberately NOT enum types. No code value is
--    seeded or invented: population is separate governed content work.
--    `created_by` is required governance provenance; `approved_by` is nullable
--    because approval can be pending. Neither is ever cascaded away.
-- =====================================================================

CREATE TABLE public.source_type (
  code extensions.citext PRIMARY KEY,
  name text NOT NULL,
  description text,
  status public.relationship_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.opportunity_type (
  code extensions.citext PRIMARY KEY,
  name text NOT NULL,
  description text,
  status public.relationship_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.route_archetype (
  code extensions.citext PRIMARY KEY,
  name text NOT NULL,
  description text,
  status public.relationship_status NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3. source
--    Never hard-deleted: an unusable source is moved to the `withdrawn` state
--    and retained. No delete cascade is authored anywhere against it.
--    Inherited v1.0 read/index semantics are preserved: the authenticated read
--    policy in section 8 excludes withdrawn sources (internal governance may
--    still read them), and state/authority_level carry the inherited indexes.
--    canonical_url uniqueness already provides its own unique index.
-- =====================================================================

CREATE TABLE public.source (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url text NOT NULL UNIQUE,
  organisation text NOT NULL,
  source_type_code extensions.citext NOT NULL REFERENCES public.source_type (code) ON DELETE RESTRICT,
  authority_level public.source_authority NOT NULL,
  scope public.evidence_scope NOT NULL,
  licence_reference text,
  state public.source_state NOT NULL DEFAULT 'healthy',
  last_reviewed_at timestamptz,
  maintained_by uuid REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_state_idx ON public.source (state);
CREATE INDEX source_authority_level_idx ON public.source (authority_level);

COMMENT ON TABLE public.source IS
  'Evidence sources are withdrawn, never hard-deleted; withdrawn rows are retained for historical readability.';

-- =====================================================================
-- 4. taxonomy_import_batch
--    Governance record of one adapter import run. Prerequisite of occupation,
--    which is NOT authored at this stage.
-- =====================================================================

CREATE TABLE public.taxonomy_import_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_key text NOT NULL,
  source_id uuid REFERENCES public.source (id) ON DELETE RESTRICT,
  licence_reference text,
  record_count integer NOT NULL DEFAULT 0,
  imported_by uuid NOT NULL REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taxonomy_import_batch_record_count_non_negative CHECK (record_count >= 0)
);

-- =====================================================================
-- 5. provider
--    Externally sourced organisation, authored EXACTLY to the frozen
--    external-entity column contract: same columns, same order, same
--    nullability, same types — and nothing else. The frozen contract states
--    no business or lifecycle defaults, so none exist: the governed
--    service_role import path states every observation value. The ONLY
--    default is the id primary key's frozen GLOBAL relational convention
--    default gen_random_uuid(), restored by R2 after R1 over-removed it.
--    It declares no created_at/updated_at and no touch trigger,
--    so none are authored; first_seen_at/last_seen_at/last_verified_at are the
--    frozen observation facts. `postcode_sector` is a COARSE ORGANISATION
--    location fact from reviewed source data — it is never a participant
--    location and no participant postcode of any precision is stored anywhere
--    in this migration. `geog` is a nullable ESTABLISHED fact and is never
--    synthesised. `import_batch_id` is intentionally an unreferenced uuid: no
--    referential target is stated by the frozen contract and none is invented.
--    `status` is plain text with no vocabulary or default invented.
-- =====================================================================

CREATE TABLE public.provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.source (id) ON DELETE RESTRICT,
  source_record_key text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  last_verified_at timestamptz,
  import_batch_id uuid,
  name text NOT NULL,
  provider_type text NOT NULL,
  postcode_sector extensions.citext,
  geog extensions.geography(Point,4326),
  licence_reference text,
  status text NOT NULL,
  CONSTRAINT provider_source_identity_unique UNIQUE (source_id, source_record_key)
);

CREATE INDEX provider_geog_gist ON public.provider USING GIST (geog);

COMMENT ON COLUMN public.provider.postcode_sector IS
  'Coarse organisation area from reviewed source data. Never a participant location and never a full postcode.';
COMMENT ON COLUMN public.provider.import_batch_id IS
  'Unreferenced by design: the frozen contract states no referential target, so none is invented.';
COMMENT ON COLUMN public.provider.status IS
  'Plain text by frozen contract. No status vocabulary and no default is stated, so none is invented.';

-- =====================================================================
-- 6. local_snapshot (authored by R2)
--    Stage D2-approved participant Local Reality envelope, authored EXACTLY to
--    the frozen D1/D2 authority (`PROPOSED_COLUMNS` and
--    `SNAPSHOT_FIELD_PROJECTIONS`) with no extra columns. Its frozen
--    dependency chain is ONLY participant_profile + PostGIS + the established
--    immutable-history helper, all present, so the authorised D7 rule requires
--    it now; it was wrongly deferred before R2.
--    IMMUTABLE HISTORY: public.forbid_mutation() raises unconditionally for
--    every caller including service_role, wired as SEPARATE BEFORE UPDATE and
--    BEFORE DELETE row triggers. There is no update path, no touch trigger and
--    no updated_at column.
--    `id` carries the frozen GLOBAL uuid primary-key default. schema_version
--    and captured_at deliberately carry NO default: the canonical values are
--    supplied verbatim by the future server boundary. `centre_geog` is a
--    nullable ESTABLISHED fact only and is never synthesised.
--    `search_area_label` is a participant-safe coarse label only. NO raw or
--    normalised participant postcode, no lat/lng pair, no retention field and
--    no location-derivation field of any kind exists on this table.
-- =====================================================================

CREATE TABLE public.local_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participant_profile (id) ON DELETE RESTRICT,
  resolution_level text NOT NULL,
  centre_geog extensions.geography(Point,4326),
  radius_miles smallint,
  transport_mode text,
  schema_version text NOT NULL,
  search_area_label text,
  captured_at timestamptz NOT NULL,
  CONSTRAINT local_snapshot_resolution_level_check CHECK (resolution_level IN ('full_postcode', 'sector', 'outward', 'coarse', 'none')),
  CONSTRAINT local_snapshot_radius_miles_check CHECK (radius_miles IS NULL OR radius_miles BETWEEN 1 AND 100)
);

CREATE INDEX local_snapshot_centre_geog_gist ON public.local_snapshot USING GIST (centre_geog);

CREATE TRIGGER local_snapshot_forbid_update_trg BEFORE UPDATE ON public.local_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE TRIGGER local_snapshot_forbid_delete_trg BEFORE DELETE ON public.local_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

COMMENT ON TABLE public.local_snapshot IS
  'Immutable participant Local Reality envelope. No raw or normalised participant location value is ever stored: the centre point is a nullable established fact and the search area label is coarse display geography only.';

-- =====================================================================
-- 7. updated_at maintenance (existing foundation helper, unchanged)
--    Only tables whose accepted contract carries updated_at get a touch
--    trigger. provider deliberately has NO touch trigger (its frozen contract
--    declares no updated_at column) and local_snapshot has NO touch trigger
--    (immutable history has no update path at all).
-- =====================================================================

CREATE TRIGGER source_type_touch_trg BEFORE UPDATE ON public.source_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER opportunity_type_touch_trg BEFORE UPDATE ON public.opportunity_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER route_archetype_touch_trg BEFORE UPDATE ON public.route_archetype
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER source_touch_trg BEFORE UPDATE ON public.source
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 8. Privileges — service_role full table privilege, authenticated explicit
--    least privilege (read only), anon nothing at all. local_snapshot inserts
--    therefore remain a service-role/server-boundary concern: authenticated
--    holds no write privilege on it and no write policy exists.
-- =====================================================================

GRANT ALL ON public.source_type TO service_role;
GRANT ALL ON public.opportunity_type TO service_role;
GRANT ALL ON public.route_archetype TO service_role;
GRANT ALL ON public.source TO service_role;
GRANT ALL ON public.taxonomy_import_batch TO service_role;
GRANT ALL ON public.provider TO service_role;
GRANT ALL ON public.local_snapshot TO service_role;

GRANT SELECT ON public.source_type TO authenticated;
GRANT SELECT ON public.opportunity_type TO authenticated;
GRANT SELECT ON public.route_archetype TO authenticated;
GRANT SELECT ON public.source TO authenticated;
GRANT SELECT ON public.taxonomy_import_batch TO authenticated;
GRANT SELECT ON public.provider TO authenticated;
GRANT SELECT ON public.local_snapshot TO authenticated;

REVOKE ALL ON public.source_type FROM anon;
REVOKE ALL ON public.opportunity_type FROM anon;
REVOKE ALL ON public.route_archetype FROM anon;
REVOKE ALL ON public.source FROM anon;
REVOKE ALL ON public.taxonomy_import_batch FROM anon;
REVOKE ALL ON public.provider FROM anon;
REVOKE ALL ON public.local_snapshot FROM anon;

-- =====================================================================
-- 9. Row level security — enabled on every table.
--    Read-only policies for authenticated; NO write policy is authored, so all
--    writes through the Data API fail closed. Import governance data is
--    internal-only. The inherited v1.0 source read semantics are preserved:
--    authenticated reads never expose withdrawn sources, while internal
--    governance retains read access through the existing helper.
--    local_snapshot reads use the EXISTING participant access pattern already
--    established by participant_profile semantics — own profile, established
--    institution access helper, or internal admin. No new helper is invented.
-- =====================================================================

ALTER TABLE public.source_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_archetype ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_import_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY source_type_select ON public.source_type
  FOR SELECT TO authenticated USING (true);

CREATE POLICY opportunity_type_select ON public.opportunity_type
  FOR SELECT TO authenticated USING (true);

CREATE POLICY route_archetype_select ON public.route_archetype
  FOR SELECT TO authenticated USING (true);

CREATE POLICY source_select ON public.source
  FOR SELECT TO authenticated
  USING (state <> 'withdrawn' OR public.is_internal());

CREATE POLICY provider_select ON public.provider
  FOR SELECT TO authenticated USING (true);

CREATE POLICY taxonomy_import_batch_select ON public.taxonomy_import_batch
  FOR SELECT TO authenticated USING (public.is_internal());

CREATE POLICY local_snapshot_select ON public.local_snapshot
  FOR SELECT TO authenticated
  USING (
    participant_id = public.current_participant_id()
    OR public.can_access_participant(participant_id)
    OR public.is_internal('admin'::public.internal_role)
  );

-- =====================================================================
-- 10. Self-verification — fail closed if any authored object is missing or if
--    the provider or local_snapshot shape drifts from its frozen contract.
-- =====================================================================

DO $verify$
DECLARE
  v_table text;
  v_type text;
  v_index text;
  v_missing text[] := ARRAY[]::text[];
  v_provider_columns text[];
  v_snapshot_columns text[];
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.source_type', 'public.opportunity_type', 'public.route_archetype',
    'public.source', 'public.taxonomy_import_batch', 'public.provider',
    'public.local_snapshot'
  ] LOOP
    IF to_regclass(v_table) IS NULL THEN
      v_missing := v_missing || v_table;
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_class c WHERE c.oid = to_regclass(v_table) AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'MIGRATION BLOCKER: row level security is not enabled on %', v_table;
    END IF;
  END LOOP;

  FOREACH v_type IN ARRAY ARRAY[
    'occupation_status', 'source_state', 'source_authority',
    'evidence_scope', 'availability_confidence'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = v_type
    ) THEN
      v_missing := v_missing || ('public.' || v_type);
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: authored objects absent: %', array_to_string(v_missing, ', ');
  END IF;

  FOREACH v_index IN ARRAY ARRAY[
    'provider_geog_gist', 'local_snapshot_centre_geog_gist',
    'source_state_idx', 'source_authority_level_idx'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indexrelid = to_regclass('public.' || v_index)
    ) THEN
      RAISE EXCEPTION 'MIGRATION BLOCKER: authored index % is absent', v_index;
    END IF;
  END LOOP;

  -- provider must hold EXACTLY the frozen column set, in contract order, with
  -- the global uuid primary-key default on id, no other default of any kind,
  -- and no touch trigger.
  SELECT array_agg(a.attname ORDER BY a.attnum) INTO v_provider_columns
  FROM pg_attribute a
  WHERE a.attrelid = to_regclass('public.provider')
    AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_provider_columns IS DISTINCT FROM ARRAY[
    'id', 'source_id', 'source_record_key', 'first_seen_at', 'last_seen_at',
    'last_verified_at', 'import_batch_id', 'name', 'provider_type',
    'postcode_sector', 'geog', 'licence_reference', 'status'
  ] THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: provider columns drifted from the frozen contract: %',
      array_to_string(v_provider_columns, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = to_regclass('public.provider')
      AND a.attname = 'id'
      AND pg_get_expr(d.adbin, d.adrelid) = 'gen_random_uuid()'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: provider.id must carry the global uuid primary-key default gen_random_uuid()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.provider')
      AND a.attnum > 0 AND NOT a.attisdropped AND a.atthasdef
      AND a.attname <> 'id'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: provider carries a non-id column default; the frozen contract states none';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger tg
    WHERE tg.tgrelid = to_regclass('public.provider') AND NOT tg.tgisinternal
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: provider carries a trigger; the frozen contract declares none';
  END IF;

  -- local_snapshot must hold EXACTLY the frozen D1/D2 column set, with the
  -- global uuid primary-key default on id and NO other default, and must be
  -- immutable through exactly the two forbid_mutation triggers.
  SELECT array_agg(a.attname ORDER BY a.attnum) INTO v_snapshot_columns
  FROM pg_attribute a
  WHERE a.attrelid = to_regclass('public.local_snapshot')
    AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_snapshot_columns IS DISTINCT FROM ARRAY[
    'id', 'participant_id', 'resolution_level', 'centre_geog', 'radius_miles',
    'transport_mode', 'schema_version', 'search_area_label', 'captured_at'
  ] THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: local_snapshot columns drifted from the frozen contract: %',
      array_to_string(v_snapshot_columns, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = to_regclass('public.local_snapshot')
      AND a.attname = 'id'
      AND pg_get_expr(d.adbin, d.adrelid) = 'gen_random_uuid()'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: local_snapshot.id must carry the global uuid primary-key default gen_random_uuid()';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.local_snapshot')
      AND a.attnum > 0 AND NOT a.attisdropped AND a.atthasdef
      AND a.attname <> 'id'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: local_snapshot carries a non-id column default; schema_version and captured_at are supplied verbatim';
  END IF;

  IF (
    SELECT count(*) FROM pg_trigger tg
    WHERE tg.tgrelid = to_regclass('public.local_snapshot') AND NOT tg.tgisinternal
      AND tg.tgname IN ('local_snapshot_forbid_update_trg', 'local_snapshot_forbid_delete_trg')
  ) <> 2 THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: local_snapshot must carry both immutable-history triggers (local_snapshot_forbid_update_trg and local_snapshot_forbid_delete_trg)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger tg
    WHERE tg.tgrelid = to_regclass('public.local_snapshot') AND NOT tg.tgisinternal
      AND tg.tgname NOT IN ('local_snapshot_forbid_update_trg', 'local_snapshot_forbid_delete_trg')
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: local_snapshot carries an unexpected trigger; immutable history permits only the two forbid_mutation triggers';
  END IF;
END $verify$;
