begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'e91af513-1c03-4abc-8a89-ff3b2cb2e101',
    'authenticated',
    'authenticated',
    'phase2-rls-a-20261030@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    'e91af513-1c03-4abc-8a89-ff3b2cb2e102',
    'authenticated',
    'authenticated',
    'phase2-rls-b-20261030@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_preferences'::regclass),
  'user_preferences has row level security enabled'
);
select is(
  (select count(*)::bigint from public.profiles where id in (
    'e91af513-1c03-4abc-8a89-ff3b2cb2e101'::uuid,
    'e91af513-1c03-4abc-8a89-ff3b2cb2e102'::uuid
  )),
  2::bigint,
  'auth signup creates profiles'
);
select is(
  (select count(*)::bigint from public.user_preferences where user_id in (
    'e91af513-1c03-4abc-8a89-ff3b2cb2e101'::uuid,
    'e91af513-1c03-4abc-8a89-ff3b2cb2e102'::uuid
  )),
  2::bigint,
  'auth signup creates default preferences'
);

set local role authenticated;
set local request.jwt.claim.sub = 'e91af513-1c03-4abc-8a89-ff3b2cb2e101';

select is((select count(*)::bigint from public.profiles), 1::bigint, 'user A sees only their profile');
select is((select count(*)::bigint from public.user_preferences), 1::bigint, 'user A sees only their preferences');
select lives_ok(
  $$update public.profiles set display_name = 'Probe A' where id = 'e91af513-1c03-4abc-8a89-ff3b2cb2e101'::uuid$$,
  'user A can update their display name'
);
select results_eq(
  $$update public.profiles set display_name = 'Should not change A' where id = 'e91af513-1c03-4abc-8a89-ff3b2cb2e102'::uuid returning id$$,
  $$select null::uuid where false$$,
  'user A cannot update user B profile'
);

set local request.jwt.claim.sub = 'e91af513-1c03-4abc-8a89-ff3b2cb2e102';

select is((select count(*)::bigint from public.profiles), 1::bigint, 'user B sees only their profile');
select is((select count(*)::bigint from public.user_preferences), 1::bigint, 'user B sees only their preferences');
select results_eq(
  $$update public.profiles set display_name = 'Should not change B' where id = 'e91af513-1c03-4abc-8a89-ff3b2cb2e101'::uuid returning id$$,
  $$select null::uuid where false$$,
  'user B cannot update user A profile'
);
select lives_ok(
  $$update public.user_preferences set daily_available_minutes = 45 where user_id = 'e91af513-1c03-4abc-8a89-ff3b2cb2e102'::uuid$$,
  'user B can update their own preferences'
);
select results_eq(
  $$update public.user_preferences set daily_available_minutes = 90 where user_id = 'e91af513-1c03-4abc-8a89-ff3b2cb2e101'::uuid returning user_id$$,
  $$select null::uuid where false$$,
  'user B cannot update user A preferences'
);

select * from finish();
rollback;
