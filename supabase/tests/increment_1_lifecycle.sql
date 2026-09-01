-- CLEAR ROUTES — INCREMENT 1 IDENTITY LIFECYCLE TESTS (L-A .. L-F)
-- Self-contained: creates fixtures (including scratch auth.users rows), asserts, cleans up.
-- Run as the migration role (postgres). Role switching exercises caller authority.

DO $test$
DECLARE
  inst_a   uuid := 'e1111111-1111-4111-8111-111111111111';
  au_lc    uuid := 'e2222222-2222-4222-8222-222222222222'; -- lifecycle subject
  au_staff uuid := 'e3333333-3333-4333-8333-333333333333'; -- institution_admin staff
  au_adm   uuid := 'e4444444-4444-4444-8444-444444444444'; -- internal admin
  au_part  uuid := 'e5555555-5555-4555-8555-555555555555'; -- ordinary participant
  auth_lc  uuid := 'e7777777-0000-4000-8000-00000000000a';
  auth_lc2 uuid := 'e7777777-0000-4000-8000-00000000000b';
  auth_staff uuid := 'e7777777-0000-4000-8000-00000000000c';
  auth_adm uuid := 'e7777777-0000-4000-8000-00000000000d';
  auth_part uuid := 'e7777777-0000-4000-8000-00000000000e';
  su_a     uuid := 'e8888888-8888-4888-8888-88888888888a';
  iu_adm   uuid := 'e8888888-8888-4888-8888-88888888888b';
  pp_part  uuid := 'e9999999-9999-4999-8999-999999999999';
  n        bigint;
  st       text;
  ts       timestamptz;
  failures text[] := '{}';
BEGIN
  -- ---------------------------------------------------------------- fixtures
  INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
    (auth_lc,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lc@test.local'),
    (auth_lc2,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lc2@test.local'),
    (auth_staff, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lc-staff@test.local'),
    (auth_adm,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lc-adm@test.local'),
    (auth_part,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lc-part@test.local');

  INSERT INTO public.institution (id, name, slug)
    VALUES (inst_a, 'Lifecycle College (test)', 'test-lifecycle-college');

  INSERT INTO public.app_user (id, auth_user_id) VALUES
    (au_lc, auth_lc), (au_staff, auth_staff), (au_adm, auth_adm), (au_part, auth_part);

  INSERT INTO public.staff_user (id, institution_id, app_user_id, display_name)
    VALUES (su_a, inst_a, au_staff, 'Lifecycle Admin Staff');
  INSERT INTO public.staff_role_assignment (staff_user_id, institution_id, role)
    VALUES (su_a, inst_a, 'institution_admin');

  INSERT INTO public.internal_user (id, app_user_id, display_name)
    VALUES (iu_adm, au_adm, 'Internal Admin');
  INSERT INTO public.internal_role_assignment (internal_user_id, role)
    VALUES (iu_adm, 'admin');

  INSERT INTO public.participant_profile (id, app_user_id, display_name)
    VALUES (pp_part, au_part, 'Ordinary Participant');

  -- ===================================== L-A invalid lifecycle combinations
  -- A1 active + NULL auth_user_id
  BEGIN
    INSERT INTO public.app_user (auth_user_id, account_state) VALUES (NULL, 'active');
    failures := failures || 'L-A1 FAIL: active + NULL auth_user_id accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- A2 suspended + NULL auth_user_id
  BEGIN
    INSERT INTO public.app_user (auth_user_id, account_state, auth_unlinked_at)
      VALUES (NULL, 'suspended', now());
    failures := failures || 'L-A2 FAIL: suspended + NULL auth_user_id accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- A3 login_removed + non-NULL auth_user_id
  BEGIN
    INSERT INTO public.app_user (auth_user_id, account_state, auth_unlinked_at)
      VALUES (auth_lc2, 'login_removed', now());
    failures := failures || 'L-A3 FAIL: login_removed + linked auth_user_id accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- A4 anonymised + non-NULL auth_user_id
  BEGIN
    INSERT INTO public.app_user (auth_user_id, account_state, anonymised_at)
      VALUES (auth_lc2, 'anonymised', now());
    failures := failures || 'L-A4 FAIL: anonymised + linked auth_user_id accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- A5 non-anonymised unlinked without auth_unlinked_at
  BEGIN
    INSERT INTO public.app_user (auth_user_id, account_state, auth_unlinked_at)
      VALUES (NULL, 'login_removed', NULL);
    failures := failures || 'L-A5 FAIL: login_removed without auth_unlinked_at accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  -- A6 anonymised requires anonymised_at (pre-existing invariant still enforced)
  BEGIN
    INSERT INTO public.app_user (auth_user_id, account_state, anonymised_at, auth_unlinked_at)
      VALUES (NULL, 'anonymised', NULL, now());
    failures := failures || 'L-A6 FAIL: anonymised without anonymised_at accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ===================================== L-B auth.users deletion
  DELETE FROM auth.users WHERE id = auth_lc;
  SELECT account_state::text, auth_unlinked_at INTO st, ts
    FROM public.app_user WHERE id = au_lc AND auth_user_id IS NULL;
  IF st IS NULL THEN
    failures := failures || 'L-B FAIL: app_user row/id not preserved (or still linked) after auth deletion';
  ELSE
    IF st <> 'login_removed' THEN
      failures := failures || format('L-B FAIL: account_state = %s (expected login_removed)', st);
    END IF;
    IF ts IS NULL THEN failures := failures || 'L-B FAIL: auth_unlinked_at not stamped'; END IF;
  END IF;

  -- ===================================== L-C relink from login_removed
  UPDATE public.app_user SET auth_user_id = auth_lc2 WHERE id = au_lc;
  SELECT account_state::text, auth_unlinked_at INTO st, ts
    FROM public.app_user WHERE id = au_lc;
  IF st <> 'active' THEN
    failures := failures || format('L-C FAIL: relink state = %s (expected active)', st);
  END IF;
  IF ts IS NOT NULL THEN failures := failures || 'L-C FAIL: auth_unlinked_at not cleared on relink'; END IF;
  -- direct repoint of a linked account remains rejected
  BEGIN
    UPDATE public.app_user SET auth_user_id = auth_adm WHERE id = au_lc;
    failures := failures || 'L-C FAIL: linked-auth repoint accepted';
  EXCEPTION WHEN check_violation OR unique_violation THEN NULL;
  END;
  -- anonymised is terminal: no reactivation path
  UPDATE public.app_user
    SET auth_user_id = NULL, account_state = 'anonymised', anonymised_at = now()
    WHERE id = au_lc;
  SELECT account_state::text INTO st FROM public.app_user WHERE id = au_lc;
  IF st <> 'anonymised' THEN
    failures := failures || format('L-C FAIL: service-side anonymisation not applied (state=%s)', st);
  END IF;
  BEGIN
    UPDATE public.app_user SET auth_user_id = auth_lc2 WHERE id = au_lc;
    failures := failures || 'L-C FAIL: anonymised account was relinked';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- ===================================== L-D ordinary authenticated users
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_part, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE format('UPDATE public.app_user SET account_state = ''suspended'' WHERE id = %L', au_part);
    failures := failures || 'L-D FAIL: participant set protected lifecycle state';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE format('UPDATE public.app_user SET account_state = ''suspended'' WHERE id = %L', au_staff);
    failures := failures || 'L-D FAIL: staff set protected lifecycle state on own account';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  RESET ROLE;

  -- ===================================== L-E service_role authority path
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role;
  EXECUTE format('UPDATE public.app_user SET account_state = ''suspended'' WHERE id = %L', au_part);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN failures := failures || 'L-E FAIL: service_role could not set protected lifecycle state'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT account_state::text INTO st FROM public.app_user WHERE id = au_part;
  IF st <> 'suspended' THEN failures := failures || format('L-E FAIL: state = %s (expected suspended)', st); END IF;

  -- ===================================== L-F internal admin vs institution staff
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_adm, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE format('UPDATE public.app_user SET account_state = ''active'' WHERE id = %L', au_part);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN failures := failures || 'L-F FAIL: internal admin could not perform protected lifecycle update'; END IF;
  RESET ROLE;
  -- institution_admin staff gains no internal authority over another account
  PERFORM set_config('request.jwt.claims', json_build_object('sub', auth_staff, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE format('UPDATE public.app_user SET account_state = ''suspended'' WHERE id = %L', au_part);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN failures := failures || 'L-F FAIL: institution staff changed another account lifecycle state'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT account_state::text INTO st FROM public.app_user WHERE id = au_part;
  IF st <> 'active' THEN failures := failures || format('L-F FAIL: state = %s (expected active)', st); END IF;

  -- ---------------------------------------------------------------- teardown
  DELETE FROM public.participant_profile WHERE id = pp_part;
  DELETE FROM public.internal_role_assignment WHERE internal_user_id = iu_adm;
  DELETE FROM public.internal_user WHERE id = iu_adm;
  DELETE FROM public.staff_role_assignment WHERE staff_user_id = su_a;
  DELETE FROM public.staff_user WHERE id = su_a;
  DELETE FROM public.app_user WHERE id IN (au_lc, au_staff, au_adm, au_part);
  DELETE FROM public.institution WHERE id = inst_a;
  DELETE FROM auth.users WHERE id IN (auth_lc2, auth_staff, auth_adm, auth_part);

  IF array_length(failures, 1) IS NOT NULL THEN
    RAISE EXCEPTION E'LIFECYCLE TESTS FAILED:\n%', array_to_string(failures, E'\n');
  END IF;
  RAISE NOTICE 'LIFECYCLE TESTS: ALL PASS';
END
$test$;
