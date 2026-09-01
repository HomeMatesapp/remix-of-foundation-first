-- CLEAR ROUTES — FOUNDATION AUDIT RECONCILIATION TESTS (A1–A4x)
-- Covers R1 (active-role institution access), R2 (roleless internal access),
-- R3 (least-privilege authenticated ACLs), R4 (history-preserving role uniqueness).
-- Self-contained: creates fixtures (including scratch auth.users rows), asserts, cleans up.

DO $test$
DECLARE
  inst_a   uuid := 'f1111111-1111-4111-8111-111111111111';
  inst_b   uuid := 'f2222222-2222-4222-8222-222222222222';
  au_staff uuid := 'f3333333-3333-4333-8333-333333333333';
  au_int   uuid := 'f4444444-4444-4444-8444-444444444444';
  au_p     uuid := 'f5555555-5555-4555-8555-555555555555';
  auth_staff uuid := 'f7777777-0000-4000-8000-00000000000a';
  auth_int   uuid := 'f7777777-0000-4000-8000-00000000000b';
  auth_p     uuid := 'f7777777-0000-4000-8000-00000000000c';
  su_a     uuid := 'f8888888-8888-4888-8888-88888888888a';
  su_b     uuid := 'f8888888-8888-4888-8888-88888888888c';
  iu_x     uuid := 'f8888888-8888-4888-8888-88888888888b';
  pp_p     uuid := 'f9999999-9999-4999-8999-999999999999';
  ip_p     uuid := 'faaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  role_row uuid;
  b        boolean;
  n        bigint;
  txt      text;
  expected text;
  tbl      text;
  failures text[] := '{}';
BEGIN
  -- ---------------------------------------------------------------- fixtures
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (auth_staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aud-staff@test.local'),
         (auth_int,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aud-int@test.local'),
         (auth_p,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aud-p@test.local');

  INSERT INTO public.institution (id, name, slug) VALUES
    (inst_a, 'Audit College (test)', 'test-audit-college'),
    (inst_b, 'Audit Council (test)', 'test-audit-council');

  INSERT INTO public.app_user (id, auth_user_id) VALUES
    (au_staff, auth_staff), (au_int, auth_int), (au_p, auth_p);

  INSERT INTO public.staff_user (id, institution_id, app_user_id, display_name)
    VALUES (su_a, inst_a, au_staff, 'Audit Staff A'),
           (su_b, inst_b, au_staff, 'Audit Staff B');
  INSERT INTO public.internal_user (id, app_user_id, display_name)
    VALUES (iu_x, au_int, 'Audit Internal');

  INSERT INTO public.participant_profile (id, app_user_id, display_name) VALUES (pp_p, au_p, 'Ada');
  INSERT INTO public.institution_participant (id, institution_id, participant_profile_id, status)
    VALUES (ip_p, inst_a, pp_p, 'active');

  -- ================================================== R1 institution access
  -- A1.1 active staff + ZERO role rows => false (and no participant reach)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE format('SELECT public.can_access_institution(%L)', inst_a) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A1.1 FAIL: roleless active staff accessed institution'; END IF;
  EXECUTE format('SELECT public.can_access_participant(%L)', pp_p) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A1.1 FAIL: roleless active staff accessed participant'; END IF;
  RESET ROLE;

  -- A1.2 active staff + active adviser role => true (institution and participant)
  INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
    VALUES (su_a, inst_a, 'adviser') RETURNING id INTO role_row;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE format('SELECT public.can_access_institution(%L)', inst_a) INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'A1.2 FAIL: active adviser denied institution access'; END IF;
  EXECUTE format('SELECT public.can_access_participant(%L)', pp_p) INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'A1.2 FAIL: active adviser denied participant access'; END IF;
  -- A1.5 no cross-institution access introduced (staff_user in inst_b has no role)
  EXECUTE format('SELECT public.can_access_institution(%L)', inst_b) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A1.2 FAIL: cross-institution access granted'; END IF;
  RESET ROLE;

  -- A1.3 all role rows revoked => false (institution and participant)
  UPDATE public.staff_role_assignment SET revoked_at = now() WHERE id = role_row;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE format('SELECT public.can_access_institution(%L)', inst_a) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A1.3 FAIL: fully revoked staff retained institution access'; END IF;
  EXECUTE format('SELECT public.can_access_participant(%L)', pp_p) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A1.3 FAIL: fully revoked staff retained participant access'; END IF;
  -- specific-role check unchanged in meaning: revoked role is not held
  EXECUTE format('SELECT public.has_institution_role(%L, ''adviser'')', inst_a) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A1.3 FAIL: revoked adviser still reported by has_institution_role'; END IF;
  RESET ROLE;

  -- A1.4 a NEW active role restores access
  INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
    VALUES (su_a, inst_a, 'careers_lead');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE format('SELECT public.can_access_institution(%L)', inst_a) INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'A1.4 FAIL: new active role did not restore institution access'; END IF;
  EXECUTE format('SELECT public.can_access_participant(%L)', pp_p) INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'A1.4 FAIL: new active role did not restore participant access'; END IF;
  -- institution staff role must not confer internal status (R2 cross-check)
  EXECUTE 'SELECT public.is_internal()' INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A2.5 FAIL: institution role conferred internal status'; END IF;
  RESET ROLE;

  -- ================================================== R2 internal access
  -- A2.2 active internal_user + ZERO roles => is_internal(NULL) false
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_int, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE 'SELECT public.is_internal()' INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A2.2 FAIL: roleless internal_user satisfied is_internal(NULL)'; END IF;
  RESET ROLE;

  -- A2.1 active viewer role => is_internal(NULL) true, is_internal('admin') false
  INSERT INTO public.internal_role_assignment (internal_user_id, role)
    VALUES (iu_x, 'viewer') RETURNING id INTO role_row;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_int, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE 'SELECT public.is_internal()' INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'A2.1 FAIL: active viewer denied is_internal(NULL)'; END IF;
  EXECUTE 'SELECT public.is_internal(''admin'')' INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A2.1 FAIL: viewer satisfied is_internal(admin)'; END IF;
  RESET ROLE;

  -- A2.3/A2.4 all roles revoked => generic and admin false; new role restores generic
  UPDATE public.internal_role_assignment SET revoked_at = now() WHERE id = role_row;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_int, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE 'SELECT public.is_internal()' INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A2.3 FAIL: fully revoked internal_user satisfied is_internal(NULL)'; END IF;
  EXECUTE 'SELECT public.is_internal(''admin'')' INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'A2.3 FAIL: fully revoked internal_user satisfied is_internal(admin)'; END IF;
  RESET ROLE;
  INSERT INTO public.internal_role_assignment (internal_user_id, role) VALUES (iu_x, 'editor');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_int, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE 'SELECT public.is_internal()' INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'A2.4 FAIL: new active internal role did not restore generic status'; END IF;
  RESET ROLE;

  -- ================================================== R4 role history
  -- lifetime UNIQUE constraints must be gone
  SELECT count(*) INTO n FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public' AND c.contype = 'u'
    AND rel.relname IN ('user_role','internal_role_assignment','staff_role_assignment');
  IF n <> 0 THEN failures := failures || format('A4.0 FAIL: %s lifetime UNIQUE constraints remain on role tables', n); END IF;
  -- active-only partial unique indexes must exist on all three tables
  FOREACH tbl IN ARRAY ARRAY['user_role','internal_role_assignment','staff_role_assignment'] LOOP
    SELECT count(*) INTO n FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = tbl
      AND indexdef ~* 'CREATE UNIQUE INDEX' AND indexdef ~* 'WHERE \(revoked_at IS NULL\)';
    IF n < 1 THEN failures := failures || format('A4.0 FAIL: %s has no active-only partial unique index', tbl); END IF;
  END LOOP;

  -- A4.1 first active grant succeeds (already inserted 'careers_lead'); duplicate active fails
  BEGIN
    INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
      VALUES (su_a, inst_a, 'careers_lead');
    failures := failures || 'A4.2 FAIL: duplicate ACTIVE staff role was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- A4.3 revoke, then a second historical grant of the SAME role succeeds
  UPDATE public.staff_role_assignment
    SET revoked_at = now() WHERE staff_user_id = su_a AND role = 'careers_lead' AND revoked_at IS NULL;
  INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
    VALUES (su_a, inst_a, 'careers_lead');

  -- A4.4 both historical periods retained with distinct windows
  SELECT count(*) INTO n FROM public.staff_role_assignment
    WHERE staff_user_id = su_a AND role = 'careers_lead';
  IF n <> 2 THEN failures := failures || format('A4.4 FAIL: expected 2 historical careers_lead rows, found %s', n); END IF;
  SELECT count(*) INTO n FROM public.staff_role_assignment
    WHERE staff_user_id = su_a AND role = 'careers_lead' AND revoked_at IS NOT NULL;
  IF n <> 1 THEN failures := failures || 'A4.4 FAIL: revoked historical period was rewritten'; END IF;

  -- same for internal roles and platform roles
  BEGIN
    INSERT INTO public.internal_role_assignment (internal_user_id, role) VALUES (iu_x, 'editor');
    failures := failures || 'A4.2 FAIL: duplicate ACTIVE internal role was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE public.internal_role_assignment SET revoked_at = now()
    WHERE internal_user_id = iu_x AND role = 'editor' AND revoked_at IS NULL;
  INSERT INTO public.internal_role_assignment (internal_user_id, role) VALUES (iu_x, 'editor');
  SELECT count(*) INTO n FROM public.internal_role_assignment WHERE internal_user_id = iu_x AND role = 'editor';
  IF n <> 2 THEN failures := failures || 'A4.4 FAIL: internal role history not preserved'; END IF;

  INSERT INTO public.user_role (app_user_id, role) VALUES (au_staff, 'staff');
  BEGIN
    INSERT INTO public.user_role (app_user_id, role) VALUES (au_staff, 'staff');
    failures := failures || 'A4.2 FAIL: duplicate ACTIVE user_role was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE public.user_role SET revoked_at = now() WHERE app_user_id = au_staff AND role = 'staff';
  INSERT INTO public.user_role (app_user_id, role) VALUES (au_staff, 'staff');
  SELECT count(*) INTO n FROM public.user_role WHERE app_user_id = au_staff AND role = 'staff';
  IF n <> 2 THEN failures := failures || 'A4.4 FAIL: user_role history not preserved'; END IF;

  -- A4.5 cross-tenant staff-role protection still enforced
  BEGIN
    INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
      VALUES (su_a, inst_b, 'adviser');
    failures := failures || 'A4.5 FAIL: cross-tenant staff role assignment was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- ================================================== R3 privilege matrix
  FOREACH txt IN ARRAY ARRAY[
    'app_user=SELECT,UPDATE',
    'user_role=SELECT',
    'internal_user=SELECT',
    'internal_role_assignment=SELECT',
    'institution=SELECT,UPDATE',
    'staff_user=SELECT,INSERT,UPDATE',
    'staff_role_assignment=SELECT,INSERT,UPDATE',
    'participant_profile=SELECT,UPDATE',
    'institution_participant=SELECT,INSERT,UPDATE'
  ] LOOP
    tbl := split_part(txt, '=', 1);
    expected := split_part(txt, '=', 2);
    SELECT COALESCE(string_agg(p.privilege_type, ',' ORDER BY
             CASE p.privilege_type WHEN 'SELECT' THEN 1 WHEN 'INSERT' THEN 2 WHEN 'UPDATE' THEN 3 ELSE 9 END), '')
      INTO txt
      FROM information_schema.role_table_grants p
      WHERE p.table_schema = 'public' AND p.table_name = tbl AND p.grantee = 'authenticated';
    IF txt IS DISTINCT FROM expected THEN
      failures := failures || format('A3 FAIL: authenticated on %s = [%s], expected [%s]', tbl, txt, expected);
    END IF;

    -- anon must have zero privileges
    SELECT count(*) INTO n FROM information_schema.role_table_grants p
      WHERE p.table_schema = 'public' AND p.table_name = tbl AND p.grantee = 'anon';
    IF n <> 0 THEN failures := failures || format('A3 FAIL: anon holds %s privileges on %s', n, tbl); END IF;

    -- RLS must remain enabled
    SELECT c.relrowsecurity INTO b FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relname = tbl;
    IF b IS NOT TRUE THEN failures := failures || format('A3 FAIL: RLS not enabled on %s', tbl); END IF;
  END LOOP;

  -- no authenticated DELETE / TRUNCATE / REFERENCES / TRIGGER anywhere in public
  SELECT count(*) INTO n FROM information_schema.role_table_grants p
    WHERE p.table_schema = 'public' AND p.grantee = 'authenticated'
      AND p.privilege_type IN ('DELETE','TRUNCATE','REFERENCES','TRIGGER');
  IF n <> 0 THEN failures := failures || format('A3 FAIL: %s forbidden authenticated privileges remain', n); END IF;

  -- ---------------------------------------------------------------- teardown
  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.institution_participant WHERE id = ip_p;
  DELETE FROM public.participant_profile WHERE id = pp_p;
  DELETE FROM public.staff_role_assignment WHERE staff_user_id IN (su_a, su_b);
  DELETE FROM public.staff_user WHERE id IN (su_a, su_b);
  DELETE FROM public.internal_role_assignment WHERE internal_user_id = iu_x;
  DELETE FROM public.internal_user WHERE id = iu_x;
  DELETE FROM public.user_role WHERE app_user_id IN (au_staff, au_int, au_p);
  DELETE FROM public.app_user WHERE id IN (au_staff, au_int, au_p);
  DELETE FROM public.institution WHERE id IN (inst_a, inst_b);
  DELETE FROM auth.users WHERE id IN (auth_staff, auth_int, auth_p);

  IF array_length(failures, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'FOUNDATION AUDIT RECONCILIATION TESTS FAILED:\n%', array_to_string(failures, E'\n');
  END IF;
  RAISE NOTICE 'FOUNDATION AUDIT RECONCILIATION TESTS: ALL PASS';
END
$test$;
