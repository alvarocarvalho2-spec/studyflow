begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temporary table test_results (
  id bigint generated always as identity primary key,
  result text not null
);
grant insert, select on test_results to authenticated;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '6d2fa6a1-9df2-41da-8000-000000000001', 'authenticated', 'authenticated',
    'quizzes-rls-a-20261030@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '6d2fa6a1-9df2-41da-8000-000000000002', 'authenticated', 'authenticated',
    'quizzes-rls-b-20261030@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into test_results(result) select ok(
  (select relrowsecurity from pg_class where oid = 'public.quizzes'::regclass),
  'quizzes has row level security enabled'
);
insert into test_results(result) select ok(
  (select relrowsecurity from pg_class where oid = 'public.questions'::regclass),
  'questions has row level security enabled'
);
insert into test_results(result) select ok(
  (select relrowsecurity from pg_class where oid = 'public.question_options'::regclass),
  'question options have row level security enabled'
);
insert into test_results(result) select ok(
  (select relrowsecurity from pg_class where oid = 'public.quiz_attempts'::regclass),
  'quiz attempts have row level security enabled'
);
insert into test_results(result) select ok(
  (select relrowsecurity from pg_class where oid = 'public.attempt_answers'::regclass),
  'attempt answers have row level security enabled'
);
insert into test_results(result) select ok(
  (select relrowsecurity from pg_class where oid = 'private.quiz_answer_keys'::regclass),
  'private answer keys have row level security enabled'
);
insert into test_results(result) select is(
  (select max_saved_exams from public.plan_limits where plan = 'free'),
  3::smallint,
  'free plan allows three saved quizzes'
);
insert into test_results(result) select ok(
  not has_table_privilege('authenticated', 'private.quiz_answer_keys', 'select'),
  'authenticated users cannot query private answer keys'
);
insert into test_results(result) select ok(
  not has_column_privilege('authenticated', 'public.quiz_attempts', 'submission_answers', 'select'),
  'authenticated users cannot query their raw submitted choices'
);
insert into test_results(result) select is(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'question_options'
     and column_name in ('is_correct', 'correct_option_id')),
  0::bigint,
  'public question options do not contain a correct-answer field'
);

set local role authenticated;
set local request.jwt.claim.sub = '6d2fa6a1-9df2-41da-8000-000000000001';

select set_config(
  'test.quiz_id',
  public.save_quiz(
    null,
    'Conhecimentos gerais',
    'Simulado de validacao',
    '[
      {"prompt":"What is the capital of Brazil?","topic_id":null,"explanation":"Brasilia is the federal capital.","options":[{"text":"Rio de Janeiro"},{"text":"Brasilia"},{"text":"Salvador"}],"correct_option_index":1},
      {"prompt":"How much is 2 + 2?","topic_id":null,"explanation":null,"options":[{"text":"3"},{"text":"4"}],"correct_option_index":1}
    ]'::jsonb
  )::text,
  true
);
insert into test_results(result) select is(
  (select count(*) from public.quizzes),
  1::bigint,
  'owner can see the quiz they created'
);
insert into test_results(result) select is(
  (select count(*) from public.questions where quiz_id = current_setting('test.quiz_id')::uuid),
  2::bigint,
  'quiz stores its questions'
);
insert into test_results(result) select is(
  (select count(*) from public.question_options where quiz_id = current_setting('test.quiz_id')::uuid),
  5::bigint,
  'quiz stores public option text without answer flags'
);
insert into test_results(result) select ok(
  public.load_quiz_editor(current_setting('test.quiz_id')::uuid)->'questions'->0->'correct_option_index' = 'null'::jsonb,
  'editor payload does not reveal the correct answer before an attempt'
);
select set_config(
  'test.question_one',
  (select id::text from public.questions where quiz_id = current_setting('test.quiz_id')::uuid and position = 1),
  true
);
select set_config(
  'test.question_two',
  (select id::text from public.questions where quiz_id = current_setting('test.quiz_id')::uuid and position = 2),
  true
);

set local request.jwt.claim.sub = '6d2fa6a1-9df2-41da-8000-000000000002';
insert into test_results(result) select is((select count(*) from public.quizzes), 0::bigint, 'another user cannot see the quiz');
insert into test_results(result) select is((select count(*) from public.questions), 0::bigint, 'another user cannot see its questions');
insert into test_results(result) select is((select count(*) from public.question_options), 0::bigint, 'another user cannot see its options');
insert into test_results(result) select throws_ok(
  $$select public.load_quiz_editor(current_setting('test.quiz_id')::uuid)$$,
  'P0002', 'quiz_not_found', 'another user cannot load the quiz editor or its answer key'
);
insert into test_results(result) select throws_ok(
  $$select public.submit_quiz_attempt(current_setting('test.quiz_id')::uuid, '[]'::jsonb)$$,
  'P0002', 'quiz_not_found', 'another user cannot submit an attempt for the quiz'
);
insert into test_results(result) select is((select count(*) from public.quiz_attempts), 0::bigint, 'another user cannot see quiz attempts');
insert into test_results(result) select is((select count(*) from public.attempt_answers), 0::bigint, 'another user cannot see submitted answers');

set local request.jwt.claim.sub = '6d2fa6a1-9df2-41da-8000-000000000001';
insert into test_results(result) select throws_ok(
  $$select public.submit_quiz_attempt(current_setting('test.quiz_id')::uuid, '[]'::jsonb)$$,
  '22023', 'answer_every_question_before_submitting', 'database rejects attempts that have not answered every question'
);
select set_config(
  'test.attempt_id',
  public.submit_quiz_attempt(
    current_setting('test.quiz_id')::uuid,
    jsonb_build_array(
      jsonb_build_object(
        'question_id', current_setting('test.question_one'),
        'selected_option_id', (select id::text from public.question_options
          where question_id = current_setting('test.question_one')::uuid and position = 2)
      ),
      jsonb_build_object(
        'question_id', current_setting('test.question_two'),
        'selected_option_id', (select id::text from public.question_options
          where question_id = current_setting('test.question_two')::uuid and position = 1)
      )
    )
  )::text,
  true
);
insert into test_results(result) select is(
  (select correct_count::integer from public.quiz_attempts where id = current_setting('test.attempt_id')::uuid),
  1,
  'server grades the selected answers'
);
insert into test_results(result) select is(
  (select score_percent from public.quiz_attempts where id = current_setting('test.attempt_id')::uuid),
  50::numeric,
  'server calculates the percentage score'
);
insert into test_results(result) select is(
  (select correct_option_label from public.attempt_answers
   where attempt_id = current_setting('test.attempt_id')::uuid and question_position = 1),
  'Brasilia',
  'history reveals the correct answer only after grading'
);
insert into test_results(result) select is((select count(*) from public.quiz_attempts), 1::bigint, 'owner can see the saved attempt');
insert into test_results(result) select is((select count(*) from public.attempt_answers), 2::bigint, 'attempt history snapshots every question');
insert into test_results(result) select is(
  (select count(*) from public.attempt_answers where is_correct),
  1::bigint,
  'attempt history records which answers were correct'
);

insert into test_results(result) select lives_ok(
  $$select public.save_quiz(
      current_setting('test.quiz_id')::uuid,
      'Conhecimentos gerais atualizados',
      null,
      '[{"prompt":"New version of question","topic_id":null,"explanation":null,"options":[{"text":"A"},{"text":"B"}],"correct_option_index":0}]'::jsonb
    )$$,
  'owner can edit their quiz'
);
insert into test_results(result) select is(
  (select question_prompt from public.attempt_answers where attempt_id = current_setting('test.attempt_id')::uuid and question_position = 1),
  'What is the capital of Brazil?',
  'editing a quiz does not rewrite previous attempt snapshots'
);
insert into test_results(result) select is(
  (select quiz_title from public.quiz_attempts where id = current_setting('test.attempt_id')::uuid),
  'Conhecimentos gerais',
  'history keeps the quiz title used in the attempt'
);

insert into test_results(result) select lives_ok(
  $$select public.save_quiz(null, 'Simulado 2', null, '[{"prompt":"P?","options":[{"text":"A"},{"text":"B"}],"correct_option_index":0}]'::jsonb)$$,
  'owner can save a second quiz'
);
insert into test_results(result) select lives_ok(
  $$select public.save_quiz(null, 'Simulado 3', null, '[{"prompt":"P?","options":[{"text":"A"},{"text":"B"}],"correct_option_index":0}]'::jsonb)$$,
  'owner can save a third quiz within the free limit'
);
insert into test_results(result) select throws_ok(
  $$select public.save_quiz(null, 'Simulado 4', null, '[{"prompt":"P?","options":[{"text":"A"},{"text":"B"}],"correct_option_index":0}]'::jsonb)$$,
  'P0001', 'quiz_limit_reached', 'database blocks quizzes above the free plan limit'
);
insert into test_results(result) select throws_ok(
  $$select public.save_quiz(current_setting('test.quiz_id')::uuid, 'Invalid', null, '[{"prompt":"P?","options":[{"text":"A"}],"correct_option_index":0}]'::jsonb)$$,
  '22023', 'invalid_question', 'database rejects questions with fewer than two options'
);

insert into test_results(result) select lives_ok(
  $$delete from public.quizzes where id = current_setting('test.quiz_id')::uuid$$,
  'owner can delete their quiz'
);
insert into test_results(result) select is(
  (select count(*) from public.quiz_attempts where id = current_setting('test.attempt_id')::uuid),
  0::bigint,
  'deleting a quiz deletes its dependent attempt history'
);

select (select string_agg(result, E'\n' order by id) from test_results)
  || E'\n' || (select string_agg(value, E'\n') from finish() as f(value)) as tap_output;
rollback;
