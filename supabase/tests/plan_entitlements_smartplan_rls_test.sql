begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temporary table test_results (id bigint generated always as identity primary key, result text not null);
grant insert, select on test_results to anon, authenticated;
create temporary table role_assertions (assertion text primary key, passed boolean not null);
grant insert on role_assertions to authenticated;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'b4bd215f-7dad-45b4-9a21-000000000901', 'authenticated', 'authenticated',
    'phase9-free-20261030@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'b4bd215f-7dad-45b4-9a21-000000000902', 'authenticated', 'authenticated',
    'phase9-pro-20261030@example.invalid', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

-- The test grants Pro as a trusted database operator, never through a user request.
update public.profiles
set plan = 'pro'
where id = 'b4bd215f-7dad-45b4-9a21-000000000902'::uuid;

set local role authenticated;
set local request.jwt.claim.sub = 'b4bd215f-7dad-45b4-9a21-000000000901';
insert into public.subjects (name, color) values ('Fase 9 Free', 'violet');
insert into public.topics (subject_id, name, difficulty)
select id, 'Assunto Free', 3 from public.subjects where name = 'Fase 9 Free';
select set_config(
  'test.phase9_free_topic_id',
  (select id::text from public.topics where name = 'Assunto Free'),
  true
);

set local request.jwt.claim.sub = 'b4bd215f-7dad-45b4-9a21-000000000902';
insert into public.subjects (name, color) values ('Fase 9 Pro', 'teal');
insert into public.topics (subject_id, name, difficulty)
select id, 'Assunto Pro', 4 from public.subjects where name = 'Fase 9 Pro';
select set_config(
  'test.phase9_pro_topic_id',
  (select id::text from public.topics where name = 'Assunto Pro'),
  true
);
reset role;

insert into public.study_goals (user_id, topic_id, kind, title)
values
  (
    'b4bd215f-7dad-45b4-9a21-000000000901'::uuid,
    current_setting('test.phase9_free_topic_id')::uuid,
    'custom', 'Meta Free de teste'
  ),
  (
    'b4bd215f-7dad-45b4-9a21-000000000902'::uuid,
    current_setting('test.phase9_pro_topic_id')::uuid,
    'custom', 'Meta Pro de teste'
  );

insert into public.study_plans (user_id, start_date, end_date, summary)
values
  ('b4bd215f-7dad-45b4-9a21-000000000901'::uuid, current_date, current_date + 6, '{"source":"test"}'::jsonb),
  ('b4bd215f-7dad-45b4-9a21-000000000902'::uuid, current_date, current_date + 6, '{"source":"test"}'::jsonb);
select set_config(
  'test.phase9_free_plan_id',
  (select id::text from public.study_plans where user_id = 'b4bd215f-7dad-45b4-9a21-000000000901'::uuid),
  true
);
select set_config(
  'test.phase9_pro_plan_id',
  (select id::text from public.study_plans where user_id = 'b4bd215f-7dad-45b4-9a21-000000000902'::uuid),
  true
);

insert into public.planned_tasks (
  user_id, study_plan_id, topic_id, task_date, position, task_type,
  title, duration_minutes, priority_score, recommendation_reason
)
select
  plan.user_id,
  plan.id,
  topic.id,
  current_date,
  1,
  'study',
  case when plan.user_id = 'b4bd215f-7dad-45b4-9a21-000000000901'::uuid
    then 'Tarefa Free de teste' else 'Tarefa Pro de teste' end,
  15,
  10,
  'Registro de isolamento para teste de acesso.'
from public.study_plans as plan
join public.topics as topic on topic.user_id = plan.user_id
where topic.name in ('Assunto Free', 'Assunto Pro');

insert into public.subscriptions (
  user_id, plan, status, billing_interval, provider,
  provider_customer_ref, provider_subscription_ref
)
values (
  'b4bd215f-7dad-45b4-9a21-000000000902'::uuid,
  'pro', 'active', 'monthly', 'manual',
  'private-customer-reference', 'private-subscription-reference'
);
select set_config(
  'test.phase9_bank_question_id',
  (
    select question.id::text
    from public.question_bank_questions as question
    join private.question_bank_answer_keys as answer_key on answer_key.question_id = question.id
    limit 1
  ),
  true
);
select set_config(
  'test.phase9_bank_correct_position',
  (
    select option_row.position::text
    from private.question_bank_answer_keys as answer_key
    join public.question_bank_options as option_row
      on option_row.id = answer_key.correct_option_id
      and option_row.question_id = answer_key.question_id
    where answer_key.question_id = current_setting('test.phase9_bank_question_id')::uuid
  ),
  true
);

-- Keep the Free user's existing row to verify read isolation, but archive it so
-- the partial unique index does not mask the insert policy being tested below.
update public.study_plans
set status = 'archived'
where user_id = 'b4bd215f-7dad-45b4-9a21-000000000901'::uuid;

insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'public.plan_catalog'::regclass), 'plan catalog has RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'public.plan_limits'::regclass), 'plan limits have RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'public.subscriptions'::regclass), 'subscriptions have RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'private.subscription_events'::regclass), 'private subscription events have RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'public.study_goals'::regclass), 'study goals have RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'public.study_plans'::regclass), 'study plans have RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'public.planned_tasks'::regclass), 'planned tasks have RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'public.question_bank_questions'::regclass), 'shared question bank has RLS enabled');
insert into test_results(result) select ok((select relrowsecurity from pg_class where oid = 'private.question_bank_answer_keys'::regclass), 'shared question answers have RLS enabled');

insert into test_results(result) select is((select max_subjects from public.plan_limits where plan = 'free'), 3::smallint, 'Free subject limit is configured');
insert into test_results(result) select is((select max_flashcards from public.plan_limits where plan = 'free'), 100, 'Free flashcard limit is configured');
insert into test_results(result) select is((select max_saved_exams from public.plan_limits where plan = 'free'), 3::smallint, 'Free quiz limit is configured');
insert into test_results(result) select is((select max_subjects from public.plan_limits where plan = 'pro'), 20::smallint, 'Pro subject limit is configured');
insert into test_results(result) select is((select max_flashcards from public.plan_limits where plan = 'pro'), 2000, 'Pro flashcard limit is configured');
insert into test_results(result) select is((select max_saved_exams from public.plan_limits where plan = 'pro'), 50::smallint, 'Pro quiz limit is configured');
insert into test_results(result) select is((select feature_permissions ->> 'smart_plan' from public.plan_catalog where plan = 'free'), 'false', 'Free plan denies SmartPlan');
insert into test_results(result) select is((select feature_permissions ->> 'smart_plan' from public.plan_catalog where plan = 'pro'), 'true', 'Pro plan enables SmartPlan');
insert into test_results(result) select is((select plan from public.profiles where id = 'b4bd215f-7dad-45b4-9a21-000000000902'::uuid), 'pro', 'trusted plan assignment sets Pro');

insert into test_results(result) select ok(has_table_privilege('anon', 'public.plan_catalog', 'select'), 'anonymous visitors can read plan information');
insert into test_results(result) select ok(has_table_privilege('anon', 'public.plan_limits', 'select'), 'anonymous visitors can read configured limits');
insert into test_results(result) select ok(not has_table_privilege('authenticated', 'public.plan_catalog', 'insert'), 'users cannot edit the plan catalog');
insert into test_results(result) select ok(not has_table_privilege('authenticated', 'public.plan_limits', 'update'), 'users cannot edit plan limits');
insert into test_results(result) select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'users have no table-wide profile update grant');
insert into test_results(result) select ok(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update'), 'users can edit their display name');
insert into test_results(result) select ok(not has_column_privilege('authenticated', 'public.profiles', 'plan', 'update'), 'users cannot change their plan');
insert into test_results(result) select ok(not has_table_privilege('authenticated', 'public.subscriptions', 'insert'), 'users cannot create subscriptions');
insert into test_results(result) select ok(not has_table_privilege('authenticated', 'public.subscriptions', 'update'), 'users cannot change subscription status');
insert into test_results(result) select ok(not has_column_privilege('authenticated', 'public.subscriptions', 'provider_customer_ref', 'select'), 'provider customer references are not readable');
insert into test_results(result) select ok(not has_column_privilege('authenticated', 'public.subscriptions', 'provider_subscription_ref', 'select'), 'provider subscription references are not readable');
insert into test_results(result) select ok(not has_table_privilege('authenticated', 'private.subscription_events', 'select'), 'users cannot read private billing events');
insert into test_results(result) select ok(has_table_privilege('service_role', 'private.subscription_events', 'insert'), 'trusted service role can record billing events');
insert into test_results(result) select ok(not has_table_privilege('authenticated', 'private.question_bank_answer_keys', 'select'), 'users cannot read shared question answer keys');
insert into test_results(result) select ok(not has_table_privilege('anon', 'public.question_bank_questions', 'select'), 'anonymous visitors cannot query the question bank');
insert into test_results(result) select ok(has_table_privilege('authenticated', 'public.question_bank_questions', 'select'), 'signed-in learners can query the shared question bank');
insert into test_results(result) select is(
  (select count(*)::bigint from information_schema.columns
   where table_schema = 'public' and table_name = 'question_bank_options'
     and column_name in ('is_correct', 'correct_option_id')),
  0::bigint,
  'public question bank options do not contain answer keys'
);

set local role anon;
insert into test_results(result) select is((select count(*)::integer from public.plan_catalog), 2, 'anonymous visitor sees both plan descriptions');
insert into test_results(result) select is((select count(*)::integer from public.plan_limits), 2, 'anonymous visitor sees both plan limits');
reset role;

set local role authenticated;
set local request.jwt.claim.sub = 'b4bd215f-7dad-45b4-9a21-000000000901';
insert into test_results(result) select is((select plan from public.profiles where id = auth.uid()), 'free', 'new user keeps the Free plan');
insert into test_results(result) select is((select count(*)::bigint from public.study_goals), 0::bigint, 'Free user cannot read their stored SmartPlan goals');
insert into test_results(result) select is((select count(*)::bigint from public.study_plans), 0::bigint, 'Free user cannot read their stored study plans');
insert into test_results(result) select is((select count(*)::bigint from public.planned_tasks), 0::bigint, 'Free user cannot read their stored planned tasks');
insert into test_results(result) select ok((select count(*) > 0 from public.question_bank_questions), 'Free user can practice from the shared question bank');
insert into test_results(result) select is((select count(status)::bigint from public.subscriptions), 0::bigint, 'Free user cannot see another account subscription');
do $phase9_free_write_checks$
declare
  v_blocked boolean;
begin
  v_blocked := false;
  begin
    update public.profiles set plan = 'pro' where id = auth.uid();
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    update public.profiles set plan = 'free' where id = auth.uid();
  end if;
  insert into role_assertions values ('Free user cannot self-upgrade', v_blocked);

  v_blocked := false;
  begin
    insert into public.study_goals (kind, title) values ('custom', 'Tentativa Free');
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into role_assertions values ('Free user cannot create a SmartPlan goal', v_blocked);

  v_blocked := false;
  begin
    insert into public.study_plans (start_date, end_date, summary)
      values (current_date, current_date + 6, '{}'::jsonb);
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into role_assertions values ('Free user cannot create a study plan', v_blocked);

  v_blocked := false;
  begin
    insert into public.planned_tasks (
      study_plan_id, topic_id, task_date, position, task_type,
      title, duration_minutes, priority_score, recommendation_reason
    ) values (
      current_setting('test.phase9_free_plan_id')::uuid,
      current_setting('test.phase9_free_topic_id')::uuid,
      current_date, 2, 'study', 'Tentativa Free', 15, 10, 'Teste de bloqueio.'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  insert into role_assertions values ('Free user cannot create a planned task', v_blocked);
end;
$phase9_free_write_checks$;
insert into test_results(result) select throws_ok(
  $$select provider_customer_ref from public.subscriptions$$,
  '42501', null,
  'subscription owner cannot read provider identifiers'
);

set local request.jwt.claim.sub = 'b4bd215f-7dad-45b4-9a21-000000000902';
insert into test_results(result) select is((select plan from public.profiles where id = auth.uid()), 'pro', 'Pro account retains its trusted plan');
insert into test_results(result) select is((select count(*)::bigint from public.study_goals), 1::bigint, 'Pro user reads only their own goal');
insert into test_results(result) select is((select count(*)::bigint from public.study_plans), 1::bigint, 'Pro user reads only their own plan');
insert into test_results(result) select is((select count(*)::bigint from public.planned_tasks), 1::bigint, 'Pro user reads only their own tasks');
insert into test_results(result) select is((select count(status)::bigint from public.subscriptions), 1::bigint, 'Pro user reads their own subscription status');
insert into test_results(result) select throws_ok(
  $$select private.copy_question_bank_item_to_quiz(
      null, 'b4bd215f-7dad-45b4-9a21-000000000901'::uuid,
      current_setting('test.phase9_bank_question_id')::uuid, null, 1
    )$$,
  '42501', 'question_bank_owner_mismatch',
  'helper rejects a caller-supplied owner different from auth.uid'
);
insert into test_results(result) select throws_ok(
  $$insert into public.subscriptions (plan, status, billing_interval, provider)
    values ('pro', 'active', 'monthly', 'manual')$$,
  '42501', null,
  'Pro user cannot create a subscription record'
);
insert into test_results(result) select lives_ok(
  $$select public.save_quiz(
      null,
      'Simulado importado da biblioteca',
      null,
      jsonb_build_array(jsonb_build_object(
        'bank_question_id', current_setting('test.phase9_bank_question_id'),
        'topic_id', null
      ))
    )$$,
  'Pro user can import a shared question through the owned quiz action'
);
select set_config(
  'test.phase9_bank_quiz_id',
  (select id::text from public.quizzes where title = 'Simulado importado da biblioteca'),
  true
);
select set_config(
  'test.phase9_bank_quiz_question_id',
  (select id::text from public.questions where quiz_id = current_setting('test.phase9_bank_quiz_id')::uuid),
  true
);
insert into test_results(result) select ok(
  public.load_quiz_editor(current_setting('test.phase9_bank_quiz_id')::uuid)
    -> 'questions' -> 0 -> 'correct_option_index' = 'null'::jsonb,
  'quiz editor does not expose the imported answer key before submission'
);
insert into test_results(result) select lives_ok(
  $$insert into public.study_goals (topic_id, kind, title)
    values (current_setting('test.phase9_pro_topic_id')::uuid, 'custom', 'Nova meta Pro')$$,
  'Pro user can create their own SmartPlan goal'
);
insert into test_results(result) select lives_ok(
  $$update public.study_goals set status = 'completed' where title = 'Meta Pro de teste'$$,
  'Pro user can complete their own SmartPlan goal'
);
insert into test_results(result) select is(
  (select status from public.study_goals where title = 'Meta Pro de teste'),
  'completed',
  'goal completion is saved for its owner'
);
insert into test_results(result) select lives_ok(
  $$update public.planned_tasks set status = 'completed' where title = 'Tarefa Pro de teste'$$,
  'Pro user can complete their own planned task'
);
insert into test_results(result) select is(
  (select status from public.planned_tasks where title = 'Tarefa Pro de teste'),
  'completed',
  'task completion is saved for its owner'
);
select set_config(
  'test.phase9_bank_attempt_id',
  public.submit_quiz_attempt(
    current_setting('test.phase9_bank_quiz_id')::uuid,
    jsonb_build_array(jsonb_build_object(
      'question_id', current_setting('test.phase9_bank_quiz_question_id'),
      'selected_option_id', (
        select option_row.id::text
        from public.question_options as option_row
        where option_row.question_id = current_setting('test.phase9_bank_quiz_question_id')::uuid
          and option_row.position = current_setting('test.phase9_bank_correct_position')::smallint
      )
    ))
  )::text,
  true
);
insert into test_results(result) select is(
  (select correct_count::integer from public.quiz_attempts where id = current_setting('test.phase9_bank_attempt_id')::uuid),
  1,
  'server grades an imported library question after submission'
);
insert into test_results(result) select is(
  (select correct_option_label from public.attempt_answers where attempt_id = current_setting('test.phase9_bank_attempt_id')::uuid),
  (select option_row.label
   from public.question_bank_options as option_row
   where option_row.question_id = current_setting('test.phase9_bank_question_id')::uuid
     and option_row.position = current_setting('test.phase9_bank_correct_position')::smallint),
  'attempt history reveals the imported correct answer only after grading'
);
insert into test_results(result) select results_eq(
  $$update public.study_goals set status = 'completed'
    where title = 'Meta Free de teste' returning id$$,
  $$select null::uuid where false$$,
  'Pro user cannot update a Free account goal'
);

reset role;
insert into test_results(result)
select ok(passed, assertion) from role_assertions order by assertion;
select (select string_agg(result, chr(10) order by id) from test_results) || chr(10) || (select string_agg(value, chr(10)) from finish() as f(value)) as tap_output;
rollback;
