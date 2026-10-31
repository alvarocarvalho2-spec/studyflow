begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

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
    '7e22f9a2-7146-4b1c-ae13-37ae8f320001',
    'authenticated',
    'authenticated',
    'flashcards-rls-a-20261030@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '7e22f9a2-7146-4b1c-ae13-37ae8f320002',
    'authenticated',
    'authenticated',
    'flashcards-rls-b-20261030@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select ok(
  (select relrowsecurity from pg_class where oid = 'public.flashcards'::regclass),
  'flashcards has row level security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.flashcard_reviews'::regclass),
  'flashcard reviews has row level security enabled'
);
select is(
  (select max_flashcards from public.plan_limits where plan = 'free'),
  100,
  'free plan allows one hundred flashcards'
);
select is(
  (select plan from public.profiles where id = '7e22f9a2-7146-4b1c-ae13-37ae8f320001'::uuid),
  'free'::text,
  'new flashcard user has the free plan'
);

set local role authenticated;
set local request.jwt.claim.sub = '7e22f9a2-7146-4b1c-ae13-37ae8f320001';

select lives_ok(
  $$insert into public.subjects (name, color) values ('Revisão A', 'violet')$$,
  'user A can create a subject for a flashcard'
);
select lives_ok(
  $$insert into public.topics (subject_id, name, difficulty)
    values ((select id from public.subjects where name = 'Revisão A'), 'Memória A', 3)$$,
  'user A can create a topic for a flashcard'
);
select set_config(
  'test.flashcard_topic_id',
  (select id::text from public.topics where name = 'Memória A'),
  true
);
select lives_ok(
  $$insert into public.flashcards (topic_id, front, back)
    values (current_setting('test.flashcard_topic_id')::uuid, 'Pergunta A', 'Resposta A')$$,
  'user A can create a flashcard linked to their topic'
);
select is(
  (select count(*)::bigint from public.flashcards),
  1::bigint,
  'user A sees their flashcard'
);
select is(
  (select interval_days from public.flashcards where front = 'Pergunta A'),
  0,
  'new flashcard starts with no review interval'
);
select lives_ok(
  $$insert into public.flashcard_reviews (flashcard_id, rating)
    values ((select id from public.flashcards where front = 'Pergunta A'), 2)$$,
  'user A can record a good review'
);
select is(
  (select interval_before_days from public.flashcard_reviews order by reviewed_at desc limit 1),
  0,
  'first review records a zero-day previous interval'
);
select is(
  (select interval_after_days from public.flashcard_reviews order by reviewed_at desc limit 1),
  1,
  'remembered card schedules the first review after one day'
);
select is(
  (select repetitions from public.flashcards where front = 'Pergunta A'),
  1,
  'remembered card increments repetition count'
);
select lives_ok(
  $$insert into public.flashcard_reviews (flashcard_id, rating)
    values ((select id from public.flashcards where front = 'Pergunta A'), 3)$$,
  'user A can record an easy review'
);
select is(
  (select interval_after_days from public.flashcard_reviews order by reviewed_at desc limit 1),
  3,
  'easy review triples the previous one-day interval'
);
select is(
  (select repetitions from public.flashcards where front = 'Pergunta A'),
  2,
  'second remembered review increments repetition count again'
);
select lives_ok(
  $$insert into public.flashcard_reviews (flashcard_id, rating)
    values ((select id from public.flashcards where front = 'Pergunta A'), 0)$$,
  'user A can record a missed review'
);
select is(
  (select interval_after_days from public.flashcard_reviews order by reviewed_at desc limit 1),
  0,
  'missed review resets the interval'
);
select is(
  (select repetitions from public.flashcards where front = 'Pergunta A'),
  0,
  'missed review resets the repetition count'
);
select ok(
  (select next_review_at >= reviewed_at + interval '9 minutes'
      and next_review_at <= reviewed_at + interval '11 minutes'
   from public.flashcard_reviews order by reviewed_at desc limit 1),
  'missed card is scheduled again in about ten minutes'
);
select lives_ok(
  $$insert into public.flashcard_reviews (flashcard_id, rating)
    values ((select id from public.flashcards where front = 'Pergunta A'), 1)$$,
  'user A can record a difficult review'
);
select is(
  (select interval_after_days from public.flashcard_reviews order by reviewed_at desc limit 1),
  1,
  'difficult first review starts at one day'
);
select lives_ok(
  $$insert into public.flashcard_reviews (flashcard_id, rating)
    values ((select id from public.flashcards where front = 'Pergunta A'), 2)$$,
  'user A can record another remembered review'
);
select is(
  (select interval_after_days from public.flashcard_reviews order by reviewed_at desc limit 1),
  2,
  'remembered review doubles the previous interval'
);
select is(
  (select count(*)::bigint from public.flashcard_reviews),
  5::bigint,
  'review history stores every rating'
);

set local request.jwt.claim.sub = '7e22f9a2-7146-4b1c-ae13-37ae8f320002';

select is(
  (select count(*)::bigint from public.flashcards),
  0::bigint,
  'user B cannot see user A flashcards'
);
select is(
  (select count(*)::bigint from public.flashcard_reviews),
  0::bigint,
  'user B cannot see user A review history'
);
select lives_ok(
  $$update public.flashcards set front = 'Alterado por B' where front = 'Pergunta A'$$,
  'user B update request does not access user A flashcard'
);
reset role;
select is(
  (select front from public.flashcards where front = 'Pergunta A'),
  'Pergunta A'::text,
  'user B update leaves user A card unchanged'
);
set local role authenticated;
set local request.jwt.claim.sub = '7e22f9a2-7146-4b1c-ae13-37ae8f320002';
select throws_ok(
  $$insert into public.flashcards (topic_id, front, back)
    values (current_setting('test.flashcard_topic_id')::uuid, 'Pergunta cruzada', 'Resposta')$$,
  '23503',
  'insert or update on table "flashcards" violates foreign key constraint "flashcards_topic_owner_fk"',
  'user B cannot link a card to user A topic'
);
select lives_ok(
  $$insert into public.flashcards (front, back) values ('Pergunta B', 'Resposta B')$$,
  'user B can create their own unassigned flashcard'
);
select is(
  (select count(*)::bigint from public.flashcards),
  1::bigint,
  'user B sees only their own flashcard'
);
select lives_ok(
  $$insert into public.flashcards (front, back)
    select 'Pergunta B ' || n, 'Resposta B ' || n from generate_series(2, 100) as n$$,
  'user B can fill the free flashcard allowance'
);
select is(
  (select count(*)::bigint from public.flashcards),
  100::bigint,
  'user B can reach exactly one hundred cards'
);
select throws_ok(
  $$insert into public.flashcards (front, back) values ('Pergunta B 101', 'Resposta B 101')$$,
  'P0001',
  'flashcard_limit_reached',
  'the database enforces the free flashcard limit'
);

set local request.jwt.claim.sub = '7e22f9a2-7146-4b1c-ae13-37ae8f320001';

select lives_ok(
  $$delete from public.subjects where name = 'Revisão A'$$,
  'user A can delete the flashcard topic parent'
);
select is(
  (select topic_id from public.flashcards where front = 'Pergunta A'),
  null::uuid,
  'deleting a topic keeps the card and clears its optional topic link'
);
select is(
  (select count(*)::bigint from public.flashcard_reviews),
  5::bigint,
  'topic deletion preserves flashcard review history'
);
select lives_ok(
  $$delete from public.flashcards where front = 'Pergunta A'$$,
  'user A can delete their flashcard'
);
select is(
  (select count(*)::bigint from public.flashcard_reviews),
  0::bigint,
  'deleting a flashcard cascades its review history'
);

select * from finish();
rollback;
