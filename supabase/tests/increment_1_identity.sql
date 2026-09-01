-- CLEAR ROUTES — MIGRATION INCREMENT 1 TESTS
-- Self-contained: creates fixtures, asserts, cleans up. Raises on first failure.
-- Run as the migration role (postgres). Role switching is used to exercise RLS.

DO $test$
DECLARE
  inst_a  uuid := '11111111-1111-4111-8111-111111111111';
  inst_b  uuid := '22222222-2222-4222-8222-222222222222';
  au_a    uuid := '33333333-3333-4333-8333-333333333333'; -- app_user: staff at A
  au_b    uuid := '44444444-4444-4444-8444-444444444444'; -- app_user: staff at B
  au_m    uuid := '55555555-5555-4555-8555-555555555555'; -- app_user: participant Mary
  au_i    uuid := '66666666-6666-4666-8666-666666666666'; -- app_user: internal governance
  auth_a  uuid := '77777777-0000-4000-8000-00000000000a';
  auth_b  uuid := '77777777-0000-4000-8000-00000000000b';
  auth_m  uuid := '77777777-0000-4000-8000-00000000000c';
  auth_i  uuid := '77777777-0000-4000-8000-00000000000d';
  su_a    uuid := '88888888-8888-4888-8888-88888888888a';
  su_b    uuid := '88888888-8888-4888-8888-88888888888b';
  pp_m    uuid := '99999999-9999-4999-8999-999999999999';
  ip_a    uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  ip_b    uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  iu_i    uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  n       bigint;
  txt     text;
  ok      boolean;
  d       double precision;
  failures text[] := '{}';

BEGIN
  -- ---------------------------------------------------------------- fixtures
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (auth_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inc1-a@test.local'),
    (auth_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inc1-b@test.local'),
    (auth_m, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inc1-m@test.local'),
    (auth_i, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'inc1-i@test.local');

  INSERT INTO public.institution (id, name, slug) VALUES
    (inst_a, 'Coventry College (test)', 'test-coventry-college'),
    (inst_b, 'City Council (test)', 'test-city-council');

  INSERT INTO public.app_user (id, auth_user_id) VALUES
    (au_a, auth_a), (au_b, auth_b), (au_m, auth_m), (au_i, auth_i);

  INSERT INTO public.user_role (app_user_id, role) VALUES
    (au_a, 'staff'), (au_b, 'staff'), (au_m, 'participant'), (au_i, 'internal');

  INSERT INTO public.staff_user (id, institution_id, app_user_id, display_name) VALUES
    (su_a, inst_a, au_a, 'Adviser A'),
    (su_b, inst_b, au_b, 'Adviser B');
  INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role) VALUES
    (su_a, inst_a, 'institution_admin'),
    (su_b, inst_b, 'institution_admin');

  INSERT INTO public.participant_profile (id, app_user_id, display_name)
    VALUES (pp_m, au_m, 'Mary');
  INSERT INTO public.institution_participant (id, institution_id, participant_profile_id, institution_reference, status) VALUES
    (ip_a, inst_a, pp_m, 'CC-0001', 'active'),
    (ip_b, inst_b, pp_m, 'CCL-0001', 'active');

  INSERT INTO public.internal_user (id, app_user_id, display_name)
    VALUES (iu_i, au_i, 'Clear Routes Governance');
  INSERT INTO public.internal_role_assignment (internal_user_id, role)
    VALUES (iu_i, 'approver');

  -- =============================================== T1 RLS enabled everywhere
  SELECT count(*) INTO n
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false;
  IF n <> 0 THEN failures := failures || format('T1 FAIL: %s public tables without RLS', n); END IF;

  -- =============================================== T2 no anon grants
  SELECT count(*) INTO n
  FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
  WHERE ns.nspname = 'public' AND c.relkind IN ('r','v','m','p') AND a.grantee = 'anon'::regrole;
  IF n <> 0 THEN failures := failures || format('T2 FAIL: %s anon table grants', n); END IF;
  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF n <> 0 THEN failures := failures || format('T2 FAIL: %s anon function grants', n); END IF;

  -- =============================================== T3 PostGIS gate
  SELECT n2.nspname INTO txt FROM pg_extension e
    JOIN pg_namespace n2 ON n2.oid = e.extnamespace WHERE e.extname = 'postgis';
  IF txt IS DISTINCT FROM 'extensions' THEN
    failures := failures || format('T3 FAIL: postgis schema = %s', COALESCE(txt, 'NOT INSTALLED'));
  END IF;
  EXECUTE 'CREATE TEMP TABLE _t3 (g extensions.geography(Point,4326))';
  EXECUTE 'INSERT INTO _t3 VALUES (extensions.ST_SetSRID(extensions.ST_MakePoint(-1.5197,52.4068),4326)::extensions.geography)';
  EXECUTE 'SELECT extensions.ST_DWithin(g, extensions.ST_SetSRID(extensions.ST_MakePoint(-1.8904,52.4862),4326)::extensions.geography, 25*1609.344) FROM _t3' INTO ok;
  EXECUTE 'SELECT extensions.ST_Distance(g, extensions.ST_SetSRID(extensions.ST_MakePoint(-1.8904,52.4862),4326)::extensions.geography)/1609.344 FROM _t3' INTO d;
  IF ok IS NOT TRUE OR d IS NULL THEN failures := failures || 'T3 FAIL: qualified radius/distance query'; END IF;
  EXECUTE 'DROP TABLE _t3';

  -- =============================================== T4 duplicate auth_user_id
  BEGIN
    INSERT INTO public.app_user (auth_user_id) VALUES (auth_a);
    failures := failures || 'T4 FAIL: duplicate auth_user_id accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- =============================================== T5 id stable on unlink
  UPDATE public.app_user SET auth_user_id = NULL WHERE id = au_i;
  SELECT count(*) INTO n FROM public.app_user
    WHERE id = au_i AND auth_user_id IS NULL AND auth_unlinked_at IS NOT NULL
      AND account_state = 'login_removed';
  IF n <> 1 THEN failures := failures || 'T5 FAIL: unlink did not preserve app_user row/id'; END IF;
  BEGIN
    UPDATE public.app_user SET id = gen_random_uuid() WHERE id = au_i;
    failures := failures || 'T5 FAIL: app_user.id was mutable';
  EXCEPTION WHEN others THEN NULL;
  END;
  -- relink to a different auth identity is allowed only after unlink; repoint is not
  UPDATE public.app_user SET auth_user_id = auth_i WHERE id = au_i;
  SELECT count(*) INTO n FROM public.app_user WHERE id = au_i AND account_state = 'active';
  IF n <> 1 THEN failures := failures || 'T5 FAIL: relink did not restore active state'; END IF;
  BEGIN
    UPDATE public.app_user SET auth_user_id = gen_random_uuid() WHERE id = au_i;
    failures := failures || 'T5 FAIL: auth_user_id repoint accepted';
  EXCEPTION WHEN others THEN NULL;
  END;

  -- =============================================== T6 one app user, two institutions
  SELECT count(*) INTO n FROM public.institution_participant WHERE participant_profile_id = pp_m;
  IF n <> 2 THEN failures := failures || 'T6 FAIL: participant not linked to two institutions'; END IF;

  -- =============================================== T11 composite tenant anchor
  BEGIN
    INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
      VALUES (su_a, inst_b, 'adviser');
    failures := failures || 'T11 FAIL: cross-institution staff role assignment accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- ============================= T7 tenant isolation as Institution A staff
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_a, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  EXECUTE 'SELECT count(*) FROM public.staff_user' INTO n;
  IF n <> 1 THEN failures := failures || format('T7 FAIL: staff A sees %s staff rows (expected 1)', n); END IF;
  EXECUTE format('SELECT count(*) FROM public.staff_user WHERE id = %L', su_b) INTO n;
  IF n <> 0 THEN failures := failures || 'T7 FAIL: staff A can read institution B staff by id'; END IF;
  EXECUTE 'SELECT count(*) FROM public.institution_participant' INTO n;
  IF n <> 1 THEN failures := failures || format('T7 FAIL: staff A sees %s participant links (expected 1)', n); END IF;
  EXECUTE format('SELECT count(*) FROM public.institution_participant WHERE id = %L', ip_b) INTO n;
  IF n <> 0 THEN failures := failures || 'T7 FAIL: staff A can read institution B participant link by id'; END IF;
  EXECUTE 'SELECT count(*) FROM public.institution' INTO n;
  IF n <> 1 THEN failures := failures || format('T7 FAIL: staff A sees %s institutions (expected 1)', n); END IF;

  -- ===== T9 staff A cannot alter institution B's participant relationship
  EXECUTE format('UPDATE public.institution_participant SET status = ''inactive'' WHERE id = %L', ip_b);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'T9 FAIL: staff A updated institution B participant link'; END IF;
  -- and cannot re-home its own link to another institution
  BEGIN
    EXECUTE format('UPDATE public.institution_participant SET institution_id = %L WHERE id = %L', inst_b, ip_a);
    failures := failures || 'T9 FAIL: institution_id was mutable';
  EXCEPTION WHEN others THEN NULL;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_a, 'role', 'authenticated')::text, true);
  -- staff A may update its own institution's link
  EXECUTE format('UPDATE public.institution_participant SET institution_reference = ''CC-0002'' WHERE id = %L', ip_a);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN failures := failures || 'T9 FAIL: staff A could not update own institution link'; END IF;
  RESET ROLE;

  -- ============================= T7b mirror: Institution B staff
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_b, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE format('SELECT count(*) FROM public.staff_user WHERE id = %L', su_a) INTO n;
  IF n <> 0 THEN failures := failures || 'T7b FAIL: staff B can read institution A staff'; END IF;
  EXECUTE format('SELECT count(*) FROM public.institution_participant WHERE id = %L', ip_a) INTO n;
  IF n <> 0 THEN failures := failures || 'T7b FAIL: staff B can read institution A participant link'; END IF;
  RESET ROLE;

  -- ============================= T8 participant protected fields
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_m, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- Mary legitimately sees both institutions supporting her
  EXECUTE 'SELECT count(*) FROM public.institution_participant' INTO n;
  IF n <> 2 THEN failures := failures || format('T6/T8 FAIL: Mary sees %s of her 2 institution links', n); END IF;
  -- Mary may edit her own profile
  EXECUTE 'UPDATE public.participant_profile SET display_name = ''Mary O.''';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN failures := failures || 'T8 FAIL: participant could not edit own profile'; END IF;
  -- Mary may not set account/anonymisation state
  BEGIN
    EXECUTE 'UPDATE public.app_user SET account_state = ''anonymised'', anonymised_at = now()';
    failures := failures || 'T8 FAIL: participant set anonymisation state';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_m, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- Mary may not rewrite the institution reference her institution owns
  EXECUTE format('UPDATE public.institution_participant SET institution_reference = ''HACK'' WHERE id = %L', ip_a);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'T8 FAIL: participant rewrote institution-owned reference'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- ---------------------------------------------------------------- teardown
  DELETE FROM public.internal_role_assignment WHERE internal_user_id = iu_i;
  DELETE FROM public.internal_user WHERE id = iu_i;
  DELETE FROM public.institution_participant WHERE id IN (ip_a, ip_b);
  DELETE FROM public.participant_profile WHERE id = pp_m;
  DELETE FROM public.staff_role_assignment WHERE institution_id IN (inst_a, inst_b);
  DELETE FROM public.staff_user WHERE id IN (su_a, su_b);
  DELETE FROM public.user_role WHERE app_user_id IN (au_a, au_b, au_m, au_i);
  DELETE FROM public.app_user WHERE id IN (au_a, au_b, au_m, au_i);
  DELETE FROM public.institution WHERE id IN (inst_a, inst_b);
  DELETE FROM auth.users WHERE id IN (auth_a, auth_b, auth_m, auth_i);

  IF array_length(failures, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'INCREMENT 1 TESTS FAILED:\n%', array_to_string(failures, E'\n');
  END IF;
  RAISE NOTICE 'INCREMENT 1 TESTS: ALL PASS';
END
$test$;
