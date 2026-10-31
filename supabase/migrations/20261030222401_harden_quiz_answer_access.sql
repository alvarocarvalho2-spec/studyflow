alter function public.save_quiz(uuid, text, text, jsonb) security invoker;

create policy "quizzes_insert_own"
  on public.quizzes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "quizzes_update_own"
  on public.quizzes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "questions_insert_own"
  on public.questions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "questions_delete_own"
  on public.questions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "question_options_insert_own"
  on public.question_options for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "quiz_answer_keys_insert_own"
  on private.quiz_answer_keys for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant insert (user_id, title, description) on public.quizzes to authenticated;
grant update (title, description) on public.quizzes to authenticated;
grant insert (quiz_id, user_id, topic_id, prompt, explanation, position)
  on public.questions to authenticated;
grant delete on public.questions to authenticated;
grant insert (question_id, quiz_id, user_id, label, position)
  on public.question_options to authenticated;
grant usage on schema private to authenticated;
grant insert on table private.quiz_answer_keys to authenticated;

create or replace function public.load_quiz_editor(p_quiz_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_questions jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select quiz.* into v_quiz
  from public.quizzes as quiz
  where quiz.id = p_quiz_id and quiz.user_id = v_user_id;

  if not found then
    raise exception 'quiz_not_found' using errcode = 'P0002';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'prompt', question.prompt,
        'topic_id', question.topic_id,
        'explanation', question.explanation,
        'options', (
          select coalesce(
            pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object('text', option_row.label)
              order by option_row.position
            ), '[]'::jsonb
          )
          from public.question_options as option_row
          where option_row.question_id = question.id and option_row.user_id = v_user_id
        ),
        'correct_option_index', null
      ) order by question.position
    ), '[]'::jsonb
  ) into v_questions
  from public.questions as question
  where question.quiz_id = p_quiz_id and question.user_id = v_user_id;

  return pg_catalog.jsonb_build_object(
    'id', v_quiz.id,
    'title', v_quiz.title,
    'description', v_quiz.description,
    'questions', v_questions
  );
end;
$$;

alter table public.quiz_attempts
  add column submission_answers jsonb not null;

create policy "quiz_attempts_insert_own"
  on public.quiz_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke select on table public.quiz_attempts from authenticated;
grant select (
  id, quiz_id, user_id, quiz_title, total_questions, answered_count,
  correct_count, score_percent, submitted_at
) on public.quiz_attempts to authenticated;
grant insert (quiz_id, submission_answers) on public.quiz_attempts to authenticated;

create function private.prepare_quiz_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_question public.questions%rowtype;
  v_answer jsonb;
  v_question_id uuid;
  v_selected_option_id uuid;
  v_correct_option_id uuid;
  v_total integer;
  v_answered integer := 0;
  v_correct integer := 0;
begin
  if v_user_id is null or new.user_id is distinct from v_user_id then
    raise exception 'quiz_attempt_owner_mismatch' using errcode = '42501';
  end if;
  if pg_catalog.jsonb_typeof(new.submission_answers) is distinct from 'array' then
    raise exception 'invalid_quiz_answers' using errcode = '22023';
  end if;

  select quiz.* into v_quiz
  from public.quizzes as quiz
  where quiz.id = new.quiz_id and quiz.user_id = v_user_id
  for share;
  if not found then
    raise exception 'quiz_not_found' using errcode = 'P0002';
  end if;

  select pg_catalog.count(*) into v_total
  from public.questions as question
  where question.quiz_id = new.quiz_id and question.user_id = v_user_id;
  if v_total not between 1 and 30
    or pg_catalog.jsonb_array_length(new.submission_answers) <> v_total then
    raise exception 'answer_every_question_before_submitting' using errcode = '22023';
  end if;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(new.submission_answers) as item(value)
    where pg_catalog.jsonb_typeof(item.value) is distinct from 'object'
      or item.value ->> 'question_id' is null
      or item.value ->> 'selected_option_id' is null
      or item.value ->> 'question_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or item.value ->> 'selected_option_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) or (
    select pg_catalog.count(distinct item.value ->> 'question_id')
    from pg_catalog.jsonb_array_elements(new.submission_answers) as item(value)
  ) <> v_total then
    raise exception 'invalid_quiz_answers' using errcode = '22023';
  end if;

  for v_answer in
    select item.value from pg_catalog.jsonb_array_elements(new.submission_answers) as item(value)
  loop
    v_question_id := (v_answer ->> 'question_id')::uuid;
    v_selected_option_id := (v_answer ->> 'selected_option_id')::uuid;
    if not exists (
      select 1 from public.questions as question
      where question.id = v_question_id
        and question.quiz_id = new.quiz_id
        and question.user_id = v_user_id
    ) or not exists (
      select 1 from public.question_options as option_row
      where option_row.id = v_selected_option_id
        and option_row.question_id = v_question_id
        and option_row.quiz_id = new.quiz_id
        and option_row.user_id = v_user_id
    ) then
      raise exception 'answer_does_not_match_quiz' using errcode = '22023';
    end if;
  end loop;

  for v_question in
    select question.* from public.questions as question
    where question.quiz_id = new.quiz_id and question.user_id = v_user_id
    order by question.position
  loop
    select (item.value ->> 'selected_option_id')::uuid into v_selected_option_id
    from pg_catalog.jsonb_array_elements(new.submission_answers) as item(value)
    where item.value ->> 'question_id' = v_question.id::text;

    select answer_key.correct_option_id into v_correct_option_id
    from private.quiz_answer_keys as answer_key
    where answer_key.question_id = v_question.id and answer_key.user_id = v_user_id;
    if v_correct_option_id is null then
      raise exception 'answer_key_missing' using errcode = 'P0001';
    end if;

    v_answered := v_answered + 1;
    if v_selected_option_id = v_correct_option_id then
      v_correct := v_correct + 1;
    end if;
  end loop;

  new.quiz_title := v_quiz.title;
  new.total_questions := v_total;
  new.answered_count := v_answered;
  new.correct_count := v_correct;
  new.score_percent := pg_catalog.round((v_correct::numeric * 100) / v_total, 2);
  new.submitted_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function private.prepare_quiz_attempt() from public, anon, authenticated;

create function private.snapshot_quiz_attempt_answers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.questions%rowtype;
  v_answer jsonb;
  v_selected_option_id uuid;
  v_selected_label text;
  v_correct_label text;
  v_topic_label text;
  v_is_correct boolean;
begin
  for v_question in
    select question.* from public.questions as question
    where question.quiz_id = new.quiz_id and question.user_id = new.user_id
    order by question.position
  loop
    select item.value into v_answer
    from pg_catalog.jsonb_array_elements(new.submission_answers) as item(value)
    where item.value ->> 'question_id' = v_question.id::text;

    v_selected_option_id := (v_answer ->> 'selected_option_id')::uuid;
    select option_row.label into v_selected_label
    from public.question_options as option_row
    where option_row.id = v_selected_option_id and option_row.question_id = v_question.id;

    select option_row.label into v_correct_label
    from private.quiz_answer_keys as answer_key
    join public.question_options as option_row
      on option_row.id = answer_key.correct_option_id
      and option_row.question_id = answer_key.question_id
      and option_row.user_id = answer_key.user_id
    where answer_key.question_id = v_question.id and answer_key.user_id = new.user_id;

    v_topic_label := null;
    if v_question.topic_id is not null then
      select topic.name into v_topic_label
      from public.topics as topic
      where topic.id = v_question.topic_id and topic.user_id = new.user_id;
    end if;

    v_is_correct := v_selected_option_id = (
      select answer_key.correct_option_id
      from private.quiz_answer_keys as answer_key
      where answer_key.question_id = v_question.id and answer_key.user_id = new.user_id
    );

    insert into public.attempt_answers (
      attempt_id, quiz_id, user_id, question_position, topic_label,
      question_prompt, selected_option_label, correct_option_label,
      explanation, is_correct
    ) values (
      new.id, new.quiz_id, new.user_id, v_question.position, v_topic_label,
      v_question.prompt, v_selected_label, v_correct_label,
      v_question.explanation, v_is_correct
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.snapshot_quiz_attempt_answers() from public, anon, authenticated;

create trigger quiz_attempts_prepare
  before insert on public.quiz_attempts
  for each row execute function private.prepare_quiz_attempt();

create trigger quiz_attempts_snapshot_answers
  after insert on public.quiz_attempts
  for each row execute function private.snapshot_quiz_attempt_answers();

drop function public.submit_quiz_attempt(uuid, jsonb);

create function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  insert into public.quiz_attempts (quiz_id, submission_answers)
  values (p_quiz_id, p_answers)
  returning id into v_attempt_id;

  return v_attempt_id;
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
