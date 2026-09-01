-- CLEAR ROUTES — INCREMENT 17 / STAGE D6
-- Prerequisite capability migration. AUTHORED SOURCE ONLY — NOT APPLIED.
--
-- This file is authored source held outside the applied migration directory on
-- purpose. It is the intended NINTH migration in repository order (after the
-- eight migrations inspected at Stage D5 closure). It has not been applied to
-- any database, and nothing below asserts anything about the present state of
-- any target project. Application is a separate, explicit owner hosted-DB gate.
--
-- Scope: establish and VERIFY three prerequisite capabilities required before any
-- Local Reality schema may be authored:
--   1. citext                          (case-insensitive text)
--   2. pg_trgm                         (trigram search support)
--   3. immutable history enforcement   (all-UPDATE and all-DELETE rejection helper)
--
-- Fail-closed contract: every step verifies its own outcome and raises a
-- MIGRATION BLOCKER exception on failure, aborting the whole migration.
--
-- Deliberately NOT in scope: no Local Reality tables, no participant data, no
-- postcode of any kind, no data migration, no PostGIS change (the existing
-- spatial prerequisite is untouched), no normalise_title implementation and no
-- diacritic-removal mechanism selection.

CREATE SCHEMA IF NOT EXISTS extensions;

-- =====================================================================
-- A. citext — case-insensitive text capability
-- =====================================================================

DO $citext_gate$
DECLARE
  v_available text;
  v_installed text;
  v_schema text;
  v_equal boolean;
  v_overmatch boolean;
BEGIN
  -- 1. availability in the target project
  SELECT default_version, installed_version INTO v_available, v_installed
  FROM pg_available_extensions WHERE name = 'citext';
  IF v_available IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: citext unavailable in target project (not available)';
  END IF;

  -- 2. establish in the extensions schema (existing project convention)
  IF v_installed IS NULL THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions';
  END IF;

  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'citext';

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: citext unavailable in target project (enable failed)';
  END IF;

  -- 3. fail closed on an unexpected host schema rather than relying on an
  --    ambiguous search_path or silently relocating a reviewed extension.
  IF v_schema <> 'extensions' THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: citext unavailable in target project (installed in schema %, expected extensions; requires explicit review, not automatic relocation)', v_schema;
  END IF;

  -- 4. verify the schema-qualified type behaves as required. citext provides
  --    case-insensitive comparison ONLY. It is explicitly NOT accent or
  --    diacritic removal, and nothing here claims otherwise.
  EXECUTE 'CREATE TEMP TABLE _d6_citext_gate (v extensions.citext PRIMARY KEY)';
  EXECUTE $ins$INSERT INTO _d6_citext_gate (v) VALUES ('Registered Nurse')$ins$;
  EXECUTE $eq$SELECT EXISTS (SELECT 1 FROM _d6_citext_gate WHERE v = 'registered nurse'::extensions.citext)$eq$
    INTO v_equal;
  EXECUTE $ne$SELECT EXISTS (SELECT 1 FROM _d6_citext_gate WHERE v = 'registered  nurse'::extensions.citext)$ne$
    INTO v_overmatch;

  IF v_equal IS NOT TRUE OR v_overmatch IS NOT FALSE THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: citext unavailable in target project (case-insensitive equality verification failed: equal=%, over-matching=%)', v_equal, v_overmatch;
  END IF;

  EXECUTE 'DROP TABLE _d6_citext_gate';
  RAISE NOTICE 'CITEXT GATE PASS: extensions.citext present, case-insensitive equality verified (no accent-insensitivity claimed)';
END
$citext_gate$;

-- =====================================================================
-- B. pg_trgm — trigram search capability
-- =====================================================================

DO $trgm_gate$
DECLARE
  v_available text;
  v_installed text;
  v_schema text;
  v_similarity double precision;
  v_opclass text;
  v_indexed boolean;
BEGIN
  -- 1. availability in the target project
  SELECT default_version, installed_version INTO v_available, v_installed
  FROM pg_available_extensions WHERE name = 'pg_trgm';
  IF v_available IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: pg_trgm unavailable in target project (not available)';
  END IF;

  -- 2. establish in the extensions schema
  IF v_installed IS NULL THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions';
  END IF;

  SELECT n.nspname INTO v_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: pg_trgm unavailable in target project (enable failed)';
  END IF;

  IF v_schema <> 'extensions' THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: pg_trgm unavailable in target project (installed in schema %, expected extensions; requires explicit review, not automatic relocation)', v_schema;
  END IF;

  -- 3. verify the schema-qualified similarity function actually works
  EXECUTE $sim$SELECT extensions.similarity('electrician', 'electricain')$sim$ INTO v_similarity;
  IF v_similarity IS NULL OR v_similarity <= 0 THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: pg_trgm unavailable in target project (similarity verification failed: %)', v_similarity;
  END IF;

  -- 4. verify the GIN trigram operator class exists in the expected schema and
  --    that a trigram index can actually be built (future occupation search).
  SELECT oc.opcname INTO v_opclass
  FROM pg_opclass oc
  JOIN pg_am am ON am.oid = oc.opcmethod
  JOIN pg_namespace n ON n.oid = oc.opcnamespace
  WHERE am.amname = 'gin' AND n.nspname = 'extensions' AND oc.opcname = 'gin_trgm_ops';
  IF v_opclass IS NULL THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: pg_trgm unavailable in target project (no gin_trgm_ops operator class in extensions schema)';
  END IF;

  EXECUTE 'CREATE TEMP TABLE _d6_trgm_gate (v text)';
  EXECUTE 'CREATE INDEX _d6_trgm_gate_v_idx ON _d6_trgm_gate USING GIN (v extensions.gin_trgm_ops)';
  SELECT true INTO v_indexed FROM pg_class WHERE relname = '_d6_trgm_gate_v_idx';
  IF v_indexed IS NOT TRUE THEN
    RAISE EXCEPTION 'MIGRATION BLOCKER: pg_trgm unavailable in target project (trigram index creation verification failed)';
  END IF;

  EXECUTE 'DROP TABLE _d6_trgm_gate';
  RAISE NOTICE 'PG_TRGM GATE PASS: extensions.pg_trgm present, similarity=%, gin_trgm_ops index build verified', round(v_similarity::numeric, 3);
END
$trgm_gate$;

-- =====================================================================
-- C. full immutable-history enforcement helper
--
-- New, stronger helper for append-only historical tables. It rejects EVERY
-- UPDATE and EVERY DELETE on any table wired to it — it is not a
-- selected-column helper and has no successful mutation return path.
--
-- The existing public.enforce_immutable_columns() helper is intentionally left
-- exactly as previously defined and is neither edited nor repurposed here.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.forbid_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $forbid$
BEGIN
  RAISE EXCEPTION
    '%.% is an immutable historical table: % is not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = '0A000';
END
$forbid$;

COMMENT ON FUNCTION public.forbid_mutation() IS
  'Immutable-history guard: rejects every UPDATE and every DELETE on any table wired to it. Not a selected-column helper; has no successful mutation path.';

-- Foundation privilege convention: not a client-callable business API.
REVOKE ALL ON FUNCTION public.forbid_mutation() FROM PUBLIC, anon, authenticated;

DO $immutable_gate$
DECLARE
  v_update_rejected boolean := false;
  v_delete_rejected boolean := false;
  v_rows integer;
  v_state text;
  v_message text;
BEGIN
  EXECUTE 'CREATE TABLE public._d6_immutable_gate (id integer PRIMARY KEY, v text NOT NULL)';
  EXECUTE 'CREATE TRIGGER _d6_immutable_gate_no_update BEFORE UPDATE ON public._d6_immutable_gate FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation()';
  EXECUTE 'CREATE TRIGGER _d6_immutable_gate_no_delete BEFORE DELETE ON public._d6_immutable_gate FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation()';

  -- 1. INSERT must succeed (append-only, not read-only)
  EXECUTE $ins$INSERT INTO public._d6_immutable_gate (id, v) VALUES (1, 'original')$ins$;

  -- 2. UPDATE must be rejected, and rejection counts ONLY when the authored
  --    guard proves it caused the failure: exact SQLSTATE 0A000 plus a message
  --    naming this scratch table and the UPDATE operation. Any unrelated
  --    exception is re-raised so the migration aborts instead of false-passing.
  BEGIN
    EXECUTE $upd$UPDATE public._d6_immutable_gate SET v = 'tampered' WHERE id = 1$upd$;
  EXCEPTION WHEN feature_not_supported THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    IF v_state = '0A000'
       AND v_message LIKE '%_d6_immutable_gate is an immutable historical table%'
       AND v_message LIKE '%UPDATE is not permitted%' THEN
      v_update_rejected := true;
    ELSE
      RAISE EXCEPTION 'MIGRATION BLOCKER: immutable history enforcement verification failed (UPDATE rejected by an unrelated error: sqlstate=%, message=%)', v_state, v_message;
    END IF;
  END;

  -- 3. DELETE must be rejected, under the same guard-specific proof.
  BEGIN
    EXECUTE $del$DELETE FROM public._d6_immutable_gate WHERE id = 1$del$;
  EXCEPTION WHEN feature_not_supported THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
    IF v_state = '0A000'
       AND v_message LIKE '%_d6_immutable_gate is an immutable historical table%'
       AND v_message LIKE '%DELETE is not permitted%' THEN
      v_delete_rejected := true;
    ELSE
      RAISE EXCEPTION 'MIGRATION BLOCKER: immutable history enforcement verification failed (DELETE rejected by an unrelated error: sqlstate=%, message=%)', v_state, v_message;
    END IF;
  END;


  -- 4. the original row must remain, unchanged
  EXECUTE $cnt$SELECT count(*)::integer FROM public._d6_immutable_gate WHERE id = 1 AND v = 'original'$cnt$
    INTO v_rows;

  IF v_update_rejected IS NOT TRUE OR v_delete_rejected IS NOT TRUE OR v_rows <> 1 THEN
    EXECUTE 'DROP TABLE IF EXISTS public._d6_immutable_gate';
    RAISE EXCEPTION 'MIGRATION BLOCKER: immutable history enforcement verification failed (update_rejected=%, delete_rejected=%, surviving_original_rows=%)',
      v_update_rejected, v_delete_rejected, v_rows;
  END IF;

  -- 5. remove temporary verification objects
  EXECUTE 'DROP TABLE public._d6_immutable_gate';
  RAISE NOTICE 'IMMUTABLE HISTORY GATE PASS: insert allowed, update rejected, delete rejected, original row intact';
END
$immutable_gate$;
