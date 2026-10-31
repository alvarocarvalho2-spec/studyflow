create index quiz_answer_keys_option_owner_idx
  on private.quiz_answer_keys (correct_option_id, question_id, user_id);

create index quiz_answer_keys_question_owner_idx
  on private.quiz_answer_keys (question_id, quiz_id, user_id);

create index attempt_answers_attempt_owner_idx
  on public.attempt_answers (attempt_id, quiz_id, user_id);

create index question_options_question_owner_idx
  on public.question_options (question_id, quiz_id, user_id);

create index questions_topic_owner_idx
  on public.questions (topic_id, user_id)
  where topic_id is not null;

create index quizzes_user_owner_idx
  on public.quizzes (user_id);

create function private.validate_quiz_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quiz_id uuid;
  v_question_count integer;
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'quizzes' then
      v_quiz_id := old.id;
    else
      v_quiz_id := old.quiz_id;
    end if;
  else
    if tg_table_name = 'quizzes' then
      v_quiz_id := new.id;
    else
      v_quiz_id := new.quiz_id;
    end if;
  end if;

  if not exists (select 1 from public.quizzes where id = v_quiz_id) then
    return null;
  end if;

  select pg_catalog.count(*) into v_question_count
  from public.questions as question
  where question.quiz_id = v_quiz_id;

  if v_question_count not between 1 and 30 then
    raise exception 'quiz_requires_questions' using errcode = '23514';
  end if;

  if exists (
    select question.id
    from public.questions as question
    left join public.question_options as option_row
      on option_row.question_id = question.id
      and option_row.quiz_id = question.quiz_id
      and option_row.user_id = question.user_id
    left join private.quiz_answer_keys as answer_key
      on answer_key.question_id = question.id
      and answer_key.quiz_id = question.quiz_id
      and answer_key.user_id = question.user_id
    where question.quiz_id = v_quiz_id
    group by question.id
    having pg_catalog.count(distinct option_row.id) not between 2 and 6
      or pg_catalog.count(distinct answer_key.question_id) <> 1
  ) then
    raise exception 'quiz_question_requires_options_and_one_answer_key' using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on function private.validate_quiz_content() from public, anon, authenticated;

create constraint trigger quizzes_validate_content
  after insert or update on public.quizzes
  deferrable initially deferred
  for each row execute function private.validate_quiz_content();

create constraint trigger questions_validate_content
  after insert or update or delete on public.questions
  deferrable initially deferred
  for each row execute function private.validate_quiz_content();

create constraint trigger question_options_validate_content
  after insert or update or delete on public.question_options
  deferrable initially deferred
  for each row execute function private.validate_quiz_content();

create constraint trigger quiz_answer_keys_validate_content
  after insert or update or delete on private.quiz_answer_keys
  deferrable initially deferred
  for each row execute function private.validate_quiz_content();
