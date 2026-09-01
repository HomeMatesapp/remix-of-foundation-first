-- CLEAR ROUTES — INCREMENT 17 / STAGE D10
-- public.occupation. AUTHORED SOURCE ONLY — NOT APPLIED.
--
-- This file is authored source held outside the applied migration directory on
-- purpose. It is the intended ELEVENTH migration in repository order (after the
-- nine applied migrations and the authored-but-unapplied Stage D7 layer). It has
-- not been applied to any database and asserts nothing about the present state
-- of any target project. Application is a separate, explicit owner hosted-DB gate.
--
-- SCOPE: exactly one table, public.occupation, with its frozen constraints,
-- indexes, privileges and row level security.
--
-- NOT IN SCOPE: occupation_alias, programme, opportunity, local_snapshot_item,
-- any seed row, any normalise_title() function, any unaccent mechanism, any
-- normalisation trigger, and any change to an existing foundation helper.
--
-- title_normalised is an ORDINARY stored text column supplied by application
-- code (Stage D9 owner decision). It is NEVER generated in the database.
--
-- title_word_count is the frozen Stage D10 generated column: the number of
-- canonical words in the already-canonical title_normalised, split on the
-- single ASCII space that D9 guarantees is the only inter-word separator.
-- Built-in immutable primitives only (string_to_array, array_length, CASE,
-- cast): no regular expression, no unaccent, no custom function, no
-- re-normalisation and no morphology. The empty string is guarded explicitly
-- because string_to_array('', ' ') returns a one-element array, which would
-- otherwise report one word for a title with no words. That arm is defence in
-- depth only: the application persistence boundary already rejects blank and
-- non-normalisable canonical titles, and no CHECK constraint on
-- title_normalised is added here.
--
-- FAIL-CLOSED AUTHORING: this migration creates a FRESH Stage D10 layer. It
-- refuses to run if any object it intends to create already exists, rather than
-- silently accepting a pre-existing object of unknown shape. All DDL below is
-- direct CREATE after the absence gate — no IF NOT EXISTS, no CREATE OR
-- REPLACE, no DROP-and-recreate.

-- =====================================================================
-- 0. Fail-closed preconditions
-- =====================================================================

DO $preconditions$
DECLARE
  v_schema text;
  v_relation text;
BEGIN
  -- 0a. Extensions, verified by exact installation schema.
  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'citext';
  IF v_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: citext is not established in the extensions schema';
  END IF;

  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';
  IF v_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: pg_trgm is not established in the extensions schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_opclass oc
    JOIN pg_am am ON am.oid = oc.opcmethod
    JOIN pg_namespace n ON n.oid = oc.opcnamespace
    WHERE am.amname = 'gin' AND n.nspname = 'extensions' AND oc.opcname = 'gin_trgm_ops'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: extensions.gin_trgm_ops operator class is absent';
  END IF;

  -- 0b. Frozen prerequisite objects (Stage D7 layer and identity foundation).
  IF to_regtype('public.occupation_status') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: frozen type public.occupation_status is absent';
  END IF;

  FOREACH v_relation IN ARRAY ARRAY[
    'public.source', 'public.taxonomy_import_batch', 'public.internal_user'
  ] LOOP
    IF to_regclass(v_relation) IS NULL THEN
      RAISE EXCEPTION 'MIGRATION BLOCKER: prerequisite table % is absent', v_relation;
    END IF;
  END LOOP;

  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: foundation helper public.set_updated_at() is absent';
  END IF;

  -- The foundation declares is_internal(_role public.internal_role DEFAULT NULL);
  -- a default argument does not change the catalogue identity, so the lookup
  -- uses the full declared signature.
  IF to_regprocedure('public.is_internal(public.internal_role)') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: foundation helper public.is_internal(public.internal_role) is absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    WHERE e.enumtypid = to_regtype('public.internal_role') AND e.enumlabel = 'approver'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: internal_role member approver is absent; write authority cannot be authored';
  END IF;

  -- 0c. Absence gate: no Stage D10 object may already exist in any shape.
  FOREACH v_relation IN ARRAY ARRAY[
    'public.occupation',
    'public.occupation_active_title_normalised_key',
    'public.occupation_family_idx',
    'public.occupation_sector_idx',
    'public.occupation_title_normalised_trgm'
  ] LOOP
    IF to_regclass(v_relation) IS NOT NULL THEN
      RAISE EXCEPTION 'MIGRATION BLOCKER: pre-existing Stage D10 object % has an unverified shape; refusing to adopt it', v_relation;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('occupation_select', 'occupation_insert_internal', 'occupation_update_internal')
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: a pre-existing Stage D10 policy name has an unverified shape; refusing to adopt it';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal AND tg.tgname = 'occupation_touch_trg'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: a pre-existing occupation_touch_trg has an unverified shape; refusing to adopt it';
  END IF;

  -- The superseded database normalisation mechanism must not exist.
  IF to_regprocedure('public.normalise_title(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: public.normalise_title(text) exists; the Stage D9 decision forbids it';
  END IF;
END $preconditions$;

-- =====================================================================
-- 1. occupation
-- =====================================================================

CREATE TABLE public.occupation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code extensions.citext NOT NULL UNIQUE,
  canonical_title text NOT NULL,
  title_normalised text NOT NULL,
  title_word_count smallint NOT NULL GENERATED ALWAYS AS ((CASE WHEN title_normalised = '' THEN 0 ELSE array_length(string_to_array(title_normalised, ' '), 1) END)::smallint) STORED,
  description text,
  family text,
  sector text,
  regulatory_classification text,
  status public.occupation_status NOT NULL DEFAULT 'active',
  taxonomy_source_id uuid REFERENCES public.source (id) ON DELETE RESTRICT,
  taxonomy_external_ref text,
  import_batch_id uuid REFERENCES public.taxonomy_import_batch (id) ON DELETE RESTRICT,
  maintained_by uuid REFERENCES public.internal_user (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.occupation.title_normalised IS
  'Ordinary stored column supplied by application code (Stage D9). Never generated in the database and never normalised by a trigger.';
COMMENT ON COLUMN public.occupation.title_word_count IS
  'Generated: count of canonical words in title_normalised, split on the single ASCII space guaranteed by the application canonical normaliser. The empty string yields 0.';

-- Exact partial active-title uniqueness.
CREATE UNIQUE INDEX occupation_active_title_normalised_key
  ON public.occupation (title_normalised) WHERE status = 'active';

CREATE INDEX occupation_family_idx ON public.occupation (family);
CREATE INDEX occupation_sector_idx ON public.occupation (sector);

CREATE INDEX occupation_title_normalised_trgm
  ON public.occupation USING GIN (title_normalised extensions.gin_trgm_ops);

-- =====================================================================
-- 2. updated_at maintenance (existing foundation helper, unchanged)
-- =====================================================================

CREATE TRIGGER occupation_touch_trg BEFORE UPDATE ON public.occupation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- 3. Privileges — service_role full table privilege, authenticated explicit
--    least privilege, anon nothing at all. No DELETE is ever granted.
-- =====================================================================

GRANT ALL ON public.occupation TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.occupation TO authenticated;
REVOKE ALL ON public.occupation FROM anon;

-- =====================================================================
-- 4. Row level security — authenticated read; internal approver-only writes.
--    No institution write access exists anywhere. No delete policy exists.
-- =====================================================================

ALTER TABLE public.occupation ENABLE ROW LEVEL SECURITY;

CREATE POLICY occupation_select ON public.occupation
  FOR SELECT TO authenticated USING (true);

CREATE POLICY occupation_insert_internal ON public.occupation
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal('approver'::public.internal_role));

CREATE POLICY occupation_update_internal ON public.occupation
  FOR UPDATE TO authenticated
  USING (public.is_internal('approver'::public.internal_role))
  WITH CHECK (public.is_internal('approver'::public.internal_role));

-- =====================================================================
-- 5. Self-verification — fail closed on any drift from the frozen contract.
-- =====================================================================

DO $verify$
DECLARE
  v_columns text[];
  v_index text;
  v_expr text;
BEGIN
  IF to_regclass('public.occupation') IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: public.occupation is absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c WHERE c.oid = to_regclass('public.occupation') AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: row level security is not enabled on public.occupation';
  END IF;

  SELECT array_agg(a.attname ORDER BY a.attnum) INTO v_columns
  FROM pg_attribute a
  WHERE a.attrelid = to_regclass('public.occupation')
    AND a.attnum > 0 AND NOT a.attisdropped;
  IF v_columns IS DISTINCT FROM ARRAY[
    'id', 'code', 'canonical_title', 'title_normalised', 'title_word_count',
    'description', 'family', 'sector', 'regulatory_classification', 'status',
    'taxonomy_source_id', 'taxonomy_external_ref', 'import_batch_id',
    'maintained_by', 'created_at', 'updated_at'
  ] THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: occupation columns drifted from the frozen contract: %',
      array_to_string(v_columns, ', ');
  END IF;

  -- title_normalised must be an ordinary stored column, never generated.
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.occupation')
      AND a.attname = 'title_normalised' AND a.attgenerated <> ''
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: occupation.title_normalised must not be a generated column';
  END IF;

  -- title_word_count must be stored-generated and depend only on title_normalised.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.occupation')
      AND a.attname = 'title_word_count' AND a.attgenerated = 's' AND a.attnotnull
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: occupation.title_word_count must be NOT NULL GENERATED ALWAYS ... STORED';
  END IF;

  SELECT pg_get_expr(d.adbin, d.adrelid) INTO v_expr
  FROM pg_attribute a
  JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = to_regclass('public.occupation') AND a.attname = 'title_word_count';
  IF v_expr IS NULL
     OR v_expr NOT LIKE '%string_to_array%'
     OR v_expr LIKE '%regexp%'
     OR v_expr LIKE '%unaccent%'
     OR v_expr LIKE '%normalise_title%'
     OR v_expr LIKE '%canonical_title%' THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: occupation.title_word_count generated expression drifted: %', v_expr;
  END IF;

  FOREACH v_index IN ARRAY ARRAY[
    'occupation_active_title_normalised_key', 'occupation_family_idx',
    'occupation_sector_idx', 'occupation_title_normalised_trgm'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i WHERE i.indexrelid = to_regclass('public.' || v_index)
    ) THEN
      RAISE EXCEPTION 'MIGRATION BLOCKER: authored index % is absent', v_index;
    END IF;
  END LOOP;

  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'occupation'
  ) <> 3 THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: occupation must carry exactly the three authored policies';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'occupation' AND grantee = 'anon'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: anon holds a privilege on public.occupation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'occupation'
      AND grantee = 'authenticated' AND privilege_type = 'DELETE'
  ) THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: authenticated must never hold DELETE on public.occupation';
  END IF;

  IF (SELECT count(*) FROM public.occupation) <> 0 THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: public.occupation must be authored empty; no occupation is seeded';
  END IF;
END $verify$;
