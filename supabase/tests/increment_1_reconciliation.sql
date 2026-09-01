-- CLEAR ROUTES — INCREMENT 1 RECONCILIATION TESTS (R1–R10)
-- Self-contained: creates fixtures (including scratch auth.users rows), asserts, cleans up.

DO $test$
DECLARE
  inst_a  uuid := 'd1111111-1111-4111-8111-111111111111';
  inst_b  uuid := 'd2222222-2222-4222-8222-222222222222';
  au_del  uuid := 'd3333333-3333-4333-8333-333333333333'; -- app_user whose login is deleted
  au_dual uuid := 'd4444444-4444-4444-8444-444444444444'; -- app_user: internal + staff
  au_p    uuid := 'd5555555-5555-4555-8555-555555555555'; -- participant
  auth_del uuid := 'd7777777-0000-4000-8000-00000000000a';
  auth_dual uuid := 'd7777777-0000-4000-8000-00000000000b';
  auth_p  uuid := 'd7777777-0000-4000-8000-00000000000c';
  su_dual uuid := 'd8888888-8888-4888-8888-88888888888a';
  iu_dual uuid := 'd8888888-8888-4888-8888-88888888888b';
  pp_p    uuid := 'd9999999-9999-4999-8999-999999999999';
  ip_p    uuid := 'daaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  n        bigint;
  b        boolean;
  txt      text;
  st       text;
  vals     text[];
  failures text[] := '{}';
BEGIN
  -- ---------------------------------------------------------------- fixtures
  INSERT INTO auth.users (id, instance_id, aud, role, email)
  VALUES (auth_del,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rec-del@test.local'),
         (auth_dual, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rec-dual@test.local'),
         (auth_p,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rec-p@test.local');

  INSERT INTO public.institution (id, name, slug) VALUES
    (inst_a, 'Recon College (test)', 'test-recon-college'),
    (inst_b, 'Recon Council (test)', 'test-recon-council');

  INSERT INTO public.app_user (id, auth_user_id) VALUES
    (au_del, auth_del), (au_dual, auth_dual), (au_p, auth_p);

  -- one app_user holding BOTH an internal identity and an institution staff identity
  INSERT INTO public.internal_user (id, app_user_id, display_name)
    VALUES (iu_dual, au_dual, 'Dual Internal');
  INSERT INTO public.internal_role_assignment (internal_user_id, role) VALUES (iu_dual, 'editor');
  INSERT INTO public.staff_user (id, institution_id, app_user_id, display_name)
    VALUES (su_dual, inst_a, au_dual, 'Dual Staff');
  INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
    VALUES (su_dual, inst_a, 'adviser');

  INSERT INTO public.participant_profile (id, app_user_id, display_name) VALUES (pp_p, au_p, 'Pat');
  INSERT INTO public.institution_participant (id, institution_id, participant_profile_id, status)
    VALUES (ip_p, inst_a, pp_p, 'invited');

  -- ============================== R1/R2 auth deletion preserves app identity
  DELETE FROM auth.users WHERE id = auth_del;
  SELECT count(*) INTO n FROM public.app_user
    WHERE id = au_del AND auth_user_id IS NULL
      AND account_state = 'login_removed' AND auth_unlinked_at IS NOT NULL;
  IF n <> 1 THEN
    SELECT account_state::text INTO st FROM public.app_user WHERE id = au_del;
    failures := failures || format('R1/R2 FAIL: app_user after auth deletion state=%s', COALESCE(st, 'ROW GONE'));
  END IF;
  -- FK is ON DELETE SET NULL, not CASCADE
  SELECT confdeltype INTO txt FROM pg_constraint WHERE conname = 'app_user_auth_user_fkey';
  IF txt IS DISTINCT FROM 'n' THEN
    failures := failures || format('R1 FAIL: auth FK delete action = %s (expected n/SET NULL)', COALESCE(txt,'MISSING'));
  END IF;

  -- ============================== R3 exact institution role set
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumlabel) INTO vals
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'institution_role';
  IF vals IS DISTINCT FROM ARRAY['adviser','careers_lead','institution_admin','read_only'] THEN
    failures := failures || format('R3 FAIL: institution_role = %s', vals);
  END IF;

  -- ============================== R4 exact internal role set
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumlabel) INTO vals
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'internal_role';
  IF vals IS DISTINCT FROM ARRAY['admin','approver','editor','reviewer','viewer'] THEN
    failures := failures || format('R4 FAIL: internal_role = %s', vals);
  END IF;

  -- ============================== R5 no unapproved role names anywhere
  SELECT count(*) INTO n FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname IN ('institution_role','internal_role')
    AND e.enumlabel::text IN ('manager','viewer','platform_admin','governance','content_steward','support')
    AND NOT (t.typname = 'internal_role' AND e.enumlabel::text = 'viewer');
  IF n <> 0 THEN failures := failures || format('R5 FAIL: %s unapproved role labels remain', n); END IF;
  SELECT count(*) INTO n FROM pg_policies
  WHERE schemaname = 'public'
    AND (COALESCE(qual,'') || COALESCE(with_check,'')) ~ '(manager|platform_admin|content_steward|governance)';
  IF n <> 0 THEN failures := failures || format('R5 FAIL: %s policies reference unapproved roles', n); END IF;
  -- separation trigger/function gone
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.proname = 'identity_separation_check';
  IF n <> 0 THEN failures := failures || 'R5 FAIL: identity_separation_check still exists'; END IF;
  -- unapproved fields gone
  SELECT count(*) INTO n FROM information_schema.columns
    WHERE table_schema='public' AND ((table_name='app_user' AND column_name='is_system_account')
      OR (table_name='participant_profile' AND column_name='contact_email'));
  IF n <> 0 THEN failures := failures || 'R6 FAIL: unapproved identity fields remain'; END IF;

  -- ============================== R6 dual identity, no permission crossover
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_dual, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE 'SELECT public.is_internal(''editor'')' INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'R6 FAIL: dual identity lacks internal editor role'; END IF;
  EXECUTE format('SELECT public.has_institution_role(%L, ''adviser'')', inst_a) INTO b;
  IF b IS NOT TRUE THEN failures := failures || 'R6 FAIL: dual identity lacks institution adviser role'; END IF;
  -- internal editor does NOT grant institution admin or cross-institution access
  EXECUTE format('SELECT public.has_institution_role(%L, ''institution_admin'')', inst_a) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'R6 FAIL: internal identity conferred institution_admin'; END IF;
  EXECUTE format('SELECT public.can_access_institution(%L)', inst_b) INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'R6 FAIL: dual identity accessed unrelated institution'; END IF;
  -- staff adviser role does NOT grant internal admin authority
  EXECUTE 'SELECT public.is_internal(''admin'')' INTO b;
  IF b IS NOT FALSE THEN failures := failures || 'R6 FAIL: staff identity conferred internal admin'; END IF;
  RESET ROLE;

  -- ============================== R7/R8 participant link lifecycle + access
  FOREACH txt IN ARRAY ARRAY['invited','active','inactive','withdrawn','archived'] LOOP
    IF txt IN ('inactive','withdrawn','archived') THEN
      EXECUTE format('UPDATE public.institution_participant SET status = %L, ended_at = now() WHERE id = %L', txt, ip_p);
    ELSE
      EXECUTE format('UPDATE public.institution_participant SET status = %L, ended_at = NULL WHERE id = %L', txt, ip_p);
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 1 THEN failures := failures || format('R7 FAIL: status %s not accepted', txt); END IF;

    PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_dual, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    EXECUTE format('SELECT public.can_access_participant(%L)', pp_p) INTO b;
    IF txt = 'active' AND b IS NOT TRUE THEN
      failures := failures || 'R8 FAIL: active link did not grant staff participant access';
    ELSIF txt <> 'active' AND b IS NOT FALSE THEN
      failures := failures || format('R8 FAIL: %s link granted staff participant access', txt);
    END IF;
    RESET ROLE;
  END LOOP;

  -- ============================== R9 no unapproved cascades on identity/role history
  SELECT count(*) INTO n FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public' AND c.contype = 'f' AND c.confdeltype = 'c'
    AND rel.relname IN ('user_role','internal_role_assignment','staff_role_assignment',
                        'internal_user','staff_user','participant_profile','institution_participant','app_user');
  IF n <> 0 THEN failures := failures || format('R9 FAIL: %s cascade FKs on identity/role tables', n); END IF;
  -- history rows survive a delete attempt on their parent
  BEGIN
    DELETE FROM public.internal_user WHERE id = iu_dual;
    failures := failures || 'R9 FAIL: internal_user with role history was deletable';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM public.staff_user WHERE id = su_dual;
    failures := failures || 'R9 FAIL: staff_user with role history was deletable';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  SELECT count(*) INTO n FROM public.internal_role_assignment WHERE internal_user_id = iu_dual;
  IF n <> 1 THEN failures := failures || 'R9 FAIL: internal role history disappeared'; END IF;

  -- ============================== R10 helper search_path narrowed (no extensions)
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname IN ('current_app_user_id','current_participant_id','is_internal',
                      'has_institution_role','can_access_institution','can_access_participant')
    AND array_to_string(p.proconfig, ',') <> 'search_path=public';
  IF n <> 0 THEN failures := failures || format('R10 FAIL: %s helpers with wrong search_path', n); END IF;

  -- ---------------------------------------------------------------- teardown
  PERFORM set_config('request.jwt.claims', NULL, true);
  DELETE FROM public.institution_participant WHERE id = ip_p;
  DELETE FROM public.participant_profile WHERE id = pp_p;
  DELETE FROM public.staff_role_assignment WHERE staff_user_id = su_dual;
  DELETE FROM public.staff_user WHERE id = su_dual;
  DELETE FROM public.internal_role_assignment WHERE internal_user_id = iu_dual;
  DELETE FROM public.internal_user WHERE id = iu_dual;
  DELETE FROM public.app_user WHERE id IN (au_del, au_dual, au_p);
  DELETE FROM public.institution WHERE id IN (inst_a, inst_b);
  DELETE FROM auth.users WHERE id IN (auth_dual, auth_p);

  IF array_length(failures, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'RECONCILIATION TESTS FAILED:\n%', array_to_string(failures, E'\n');
  END IF;
  RAISE NOTICE 'RECONCILIATION TESTS: ALL PASS';
END
$test$;
