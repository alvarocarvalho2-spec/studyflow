begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

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
    '7e22f9a2-7146-4b1c-ae13-37ae8f310001',
    'authenticated',
    'authenticated',
    'subjects-rls-a-20261030@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '7e22f9a2-7146-4b1c-ae13-37ae8f310002',
    'authenticated',
    'authenticated',
    'subjects-rls-b-20261030@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select ok(
  (select relrowsecurity from pg_class where oid = 'public.subjects'::regclass),
  'subjects has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.topics'::regclass),
  'topics has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.plan_limits'::regclass),
  'plan limits has row level security enabled'
);
select is(
  (select plan from public.profiles where id = '7e22f9a2-7146-4b1c-ae13-37ae8f310001'::uuid),
  'free'::text,
  'new profiles start on the free plan'
);

set local role authenticated;
set local request.jwt.claim.sub = '7e22f9a2-7146-4b1c-ae13-37ae8f310001';

select lives_ok(
  $$insert into public.subjects (name, color) values ('Matemática', 'violet')$$,
  'user A can create a first subject'
);
select lives_ok(
  $$insert into public.subjects (name, color) values ('História', 'amber')$$,
  'user A can create a second subject'
);
select lives_ok(
  $$insert into public.subjects (name, color) values ('Biologia', 'teal')$$,
  'user A can create a third subject'
);
select throws_ok(
  $$insert into public.subjects (name, color) values ('Física', 'blue')$$,
  'P0001',
  'subject_limit_reached',
  'the free subject limit is enforced in the database'
);
select is(
  (select count(*)::bigint from public.subjects),
  3::bigint,
  'user A cannot exceed three subjects'
);
select lives_ok(
  $$insert into public.topics (subject_id, name, difficulty)
    values ((select id from public.subjects where name = 'Matemática'), 'Frações', 4)$$,
  'user A can add a topic to their subject'
);
select is(
  (select count(*)::bigint from public.topics),
  1::bigint,
  'user A sees their topic'
);
select lives_ok(
  $$update public.topics set difficulty = 5 where name = 'Frações'$$,
  'user A can update their topic difficulty'
);
select is(
  (select difficulty::integer from public.topics where name = 'Frações'),
  5,
  'the topic difficulty update is saved'
);
select lives_ok(
  $$delete from public.topics where name = 'Frações'$$,
  'user A can delete their topic'
);
select lives_ok(
  $$insert into public.topics (subject_id, name, difficulty)
    values ((select id from public.subjects where name = 'Matemática'), 'Frações', 4)$$,
  'user A can add the topic again'
);
select lives_ok(
  $$update public.subjects set name = 'Matemática avançada' where name = 'Matemática'$$,
  'user A can update their subject'
);
select is(
  (select count(*)::bigint from public.subjects where name = 'Matemática avançada'),
  1::bigint,
  'the subject update is saved'
);
select lives_ok(
  $$insert into public.topics (subject_id, name, difficulty)
    values ((select id from public.subjects where name = 'Biologia'), 'Ecologia', 2)$$,
  'user A can add a topic to a second subject'
);
select lives_ok(
  $$delete from public.subjects where name = 'Biologia'$$,
  'user A can delete their subject'
);
select is(
  (select count(*)::bigint from public.subjects),
  2::bigint,
  'deleting a subject removes that subject only'
);
select is(
  (select count(*)::bigint from public.topics),
  1::bigint,
  'deleting a subject cascades to its topics'
);
select lives_ok(
  $$insert into public.subjects (name, color) values ('Física', 'blue')$$,
  'deleting a subject makes room under the free limit'
);
select is(
  (select count(*)::bigint from public.subjects),
  3::bigint,
  'user A can return to the three-subject free limit'
);

set local request.jwt.claim.sub = '7e22f9a2-7146-4b1c-ae13-37ae8f310002';

select is(
  (select count(*)::bigint from public.subjects),
  0::bigint,
  'user B cannot see user A subjects'
);
select is(
  (select count(*)::bigint from public.topics),
  0::bigint,
  'user B cannot see user A topics'
);
select lives_ok(
  $$insert into public.subjects (name, color) values ('Química', 'rose')$$,
  'user B can create their own subject'
);
select is(
  (select count(*)::bigint from public.subjects),
  1::bigint,
  'user B sees only their subject'
);
select lives_ok(
  $$insert into public.topics (subject_id, name, difficulty)
    values ((select id from public.subjects where name = 'Química'), 'Ligações químicas', 3)$$,
  'user B can add a topic to their subject'
);
select is(
  (select count(*)::bigint from public.topics),
  1::bigint,
  'user B sees only their topic'
);

select * from finish();
rollback;
