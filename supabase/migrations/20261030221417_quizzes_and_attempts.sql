create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quizzes_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint quizzes_description_length check (description is null or char_length(description) <= 1000),
  constraint quizzes_id_user_id_unique unique (id, user_id)
);

comment on table public.quizzes is
  'User-created quizzes. Correct answers are stored in the private schema.';

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null default auth.uid(),
  topic_id uuid,
  prompt text not null,
  explanation text,
  position smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_prompt_length check (char_length(btrim(prompt)) between 1 and 3000),
  constraint questions_explanation_length check (explanation is null or char_length(explanation) <= 2000),
  constraint questions_position_range check (position between 1 and 30),
  constraint questions_id_user_id_unique unique (id, user_id),
  constraint questions_id_quiz_user_unique unique (id, quiz_id, user_id),
  constraint questions_quiz_position_unique unique (quiz_id, position),
  constraint questions_quiz_owner_fk
    foreign key (quiz_id, user_id)
    references public.quizzes (id, user_id)
    on delete cascade,
  constraint questions_topic_owner_fk
    foreign key (topic_id, user_id)
    references public.topics (id, user_id)
    on delete set null (topic_id)
);

create index questions_quiz_order_idx
  on public.questions (quiz_id, user_id, position);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  quiz_id uuid not null,
  user_id uuid not null default auth.uid(),
  label text not null,
  position smallint not null,
  created_at timestamptz not null default now(),
  constraint question_options_label_length check (char_length(btrim(label)) between 1 and 500),
  constraint question_options_position_range check (position between 1 and 6),
  constraint question_options_id_question_user_unique unique (id, question_id, user_id),
  constraint question_options_question_position_unique unique (question_id, position),
  constraint question_options_question_owner_fk
    foreign key (question_id, quiz_id, user_id)
    references public.questions (id, quiz_id, user_id)
    on delete cascade
);

create index question_options_question_order_idx
  on public.question_options (question_id, user_id, position);

create table private.quiz_answer_keys (
  question_id uuid primary key,
  quiz_id uuid not null,
  user_id uuid not null,
  correct_option_id uuid not null,
  created_at timestamptz not null default now(),
  constraint quiz_answer_keys_question_fk
    foreign key (question_id, quiz_id, user_id)
    references public.questions (id, quiz_id, user_id)
    on delete cascade,
  constraint quiz_answer_keys_option_fk
    foreign key (correct_option_id, question_id, user_id)
    references public.question_options (id, question_id, user_id)
    on delete cascade
);

comment on table private.quiz_answer_keys is
  'Private answer keys. No Data API role has access; grading runs through an owner-scoped function.';

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null,
  user_id uuid not null default auth.uid(),
  quiz_title text not null,
  total_questions smallint not null,
  answered_count smallint not null default 0,
  correct_count smallint not null default 0,
  score_percent numeric(5, 2) not null default 0,
  submitted_at timestamptz not null default now(),
  constraint quiz_attempts_total_range check (total_questions between 1 and 30),
  constraint quiz_attempts_answered_range check (answered_count between 0 and total_questions),
  constraint quiz_attempts_correct_range check (correct_count between 0 and answered_count),
  constraint quiz_attempts_score_range check (score_percent between 0 and 100),
  constraint quiz_attempts_id_quiz_user_unique unique (id, quiz_id, user_id),
  constraint quiz_attempts_quiz_owner_fk
    foreign key (quiz_id, user_id)
    references public.quizzes (id, user_id)
    on delete cascade
);

create index quiz_attempts_user_history_idx
  on public.quiz_attempts (user_id, submitted_at desc);

create index quiz_attempts_quiz_history_idx
  on public.quiz_attempts (quiz_id, user_id, submitted_at desc);

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  quiz_id uuid not null,
  user_id uuid not null default auth.uid(),
  question_position smallint not null,
  topic_label text,
  question_prompt text not null,
  selected_option_label text,
  correct_option_label text not null,
  explanation text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  constraint attempt_answers_position_range check (question_position between 1 and 30),
  constraint attempt_answers_snapshot_length check (
    char_length(question_prompt) between 1 and 3000
    and char_length(correct_option_label) between 1 and 500
    and (selected_option_label is null or char_length(selected_option_label) <= 500)
    and (explanation is null or char_length(explanation) <= 2000)
  ),
  constraint attempt_answers_attempt_position_unique unique (attempt_id, question_position),
  constraint attempt_answers_attempt_owner_fk
    foreign key (attempt_id, quiz_id, user_id)
    references public.quiz_attempts (id, quiz_id, user_id)
    on delete cascade
);

create index attempt_answers_attempt_order_idx
  on public.attempt_answers (attempt_id, user_id, question_position);

alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.attempt_answers enable row level security;
alter table private.quiz_answer_keys enable row level security;

revoke all on table public.quizzes, public.questions, public.question_options,
  public.quiz_attempts, public.attempt_answers, private.quiz_answer_keys
  from public, anon, authenticated;

grant usage on schema public to authenticated;
grant select, delete on table public.quizzes to authenticated;
grant select on table public.questions, public.question_options,
  public.quiz_attempts, public.attempt_answers to authenticated;

create policy "quizzes_select_own"
  on public.quizzes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "quizzes_delete_own"
  on public.quizzes for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "questions_select_own"
  on public.questions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "question_options_select_own"
  on public.question_options for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "quiz_attempts_select_own"
  on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "attempt_answers_select_own"
  on public.attempt_answers for select to authenticated
  using ((select auth.uid()) = user_id);

create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function private.set_updated_at();

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function private.set_updated_at();

create function private.enforce_quiz_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_quiz_limit integer;
  v_quiz_count bigint;
begin
  if v_user_id is null or new.user_id is distinct from v_user_id then
    raise exception 'quiz_owner_mismatch' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('studyflow.quizzes:' || v_user_id::text, 0)
  );

  select profile.plan into v_plan
  from public.profiles as profile
  where profile.id = v_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = '42501';
  end if;

  select limits.max_saved_exams into v_quiz_limit
  from public.plan_limits as limits
  where limits.plan = v_plan;

  if not found then
    raise exception 'plan_limit_configuration_missing' using errcode = 'P0001';
  end if;

  select pg_catalog.count(*) into v_quiz_count
  from public.quizzes as quiz
  where quiz.user_id = v_user_id;

  if v_quiz_count >= v_quiz_limit then
    raise exception 'quiz_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_quiz_plan_limit()
  from public, anon, authenticated;

create trigger quizzes_enforce_plan_limit
  before insert on public.quizzes
  for each row execute function private.enforce_quiz_plan_limit();

create function public.save_quiz(
  p_quiz_id uuid,
  p_title text,
  p_description text,
  p_questions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz_id uuid;
  v_question jsonb;
  v_option jsonb;
  v_options jsonb;
  v_question_id uuid;
  v_option_id uuid;
  v_title text := pg_catalog.btrim(p_title);
  v_description text := nullif(pg_catalog.btrim(p_description), '');
  v_correct_index integer;
  v_option_count integer;
  v_option_position integer;
  v_question_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if v_title is null or char_length(v_title) not between 1 and 120
    or (v_description is not null and char_length(v_description) > 1000)
    or pg_catalog.jsonb_typeof(p_questions) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_questions) not between 1 and 30 then
    raise exception 'invalid_quiz' using errcode = '22023';
  end if;

  if p_quiz_id is null then
    insert into public.quizzes (user_id, title, description)
    values (v_user_id, v_title, v_description)
    returning id into v_quiz_id;
  else
    update public.quizzes as quiz
    set title = v_title, description = v_description
    where quiz.id = p_quiz_id and quiz.user_id = v_user_id
    returning quiz.id into v_quiz_id;

    if not found then
      raise exception 'quiz_not_found' using errcode = 'P0002';
    end if;

    delete from public.questions as question
    where question.quiz_id = v_quiz_id and question.user_id = v_user_id;
  end if;

  for v_question in select item.value from pg_catalog.jsonb_array_elements(p_questions) as item(value)
  loop
    v_question_position := v_question_position + 1;
    v_options := v_question -> 'options';

    if pg_catalog.jsonb_typeof(v_question) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_options) is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_options) not between 2 and 6
      or nullif(v_question ->> 'prompt', '') is null
      or char_length(pg_catalog.btrim(v_question ->> 'prompt')) > 3000
      or (v_question ->> 'explanation' is not null and char_length(v_question ->> 'explanation') > 2000)
      or coalesce(v_question ->> 'correct_option_index', '') !~ '^[0-5]$' then
      raise exception 'invalid_question' using errcode = '22023';
    end if;

    v_correct_index := (v_question ->> 'correct_option_index')::integer;
    v_option_count := pg_catalog.jsonb_array_length(v_options);
    if v_correct_index >= v_option_count then
      raise exception 'invalid_correct_option' using errcode = '22023';
    end if;

    insert into public.questions (
      quiz_id, user_id, topic_id, prompt, explanation, position
    )
    values (
      v_quiz_id,
      v_user_id,
      nullif(v_question ->> 'topic_id', '')::uuid,
      pg_catalog.btrim(v_question ->> 'prompt'),
      nullif(pg_catalog.btrim(v_question ->> 'explanation'), ''),
      v_question_position
    )
    returning id into v_question_id;

    for v_option, v_option_position in
      select item.value, (item.ordinality - 1)::integer
      from pg_catalog.jsonb_array_elements(v_options) with ordinality as item(value, ordinality)
    loop
      if pg_catalog.jsonb_typeof(v_option) is distinct from 'object'
        or nullif(pg_catalog.btrim(v_option ->> 'text'), '') is null
        or char_length(pg_catalog.btrim(v_option ->> 'text')) > 500 then
        raise exception 'invalid_question_option' using errcode = '22023';
      end if;

      insert into public.question_options (
        question_id, quiz_id, user_id, label, position
      )
      values (
        v_question_id,
        v_quiz_id,
        v_user_id,
        pg_catalog.btrim(v_option ->> 'text'),
        v_option_position + 1
      )
      returning id into v_option_id;

      if v_option_position = v_correct_index then
        insert into private.quiz_answer_keys (question_id, quiz_id, user_id, correct_option_id)
        values (v_question_id, v_quiz_id, v_user_id, v_option_id);
      end if;
    end loop;
  end loop;

  return v_quiz_id;
end;
$$;

revoke all on function public.save_quiz(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_quiz(uuid, text, text, jsonb) to authenticated;

create function public.load_quiz_editor(p_quiz_id uuid)
returns jsonb
language plpgsql
security definer
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
        'correct_option_index', (
          select option_row.position - 1
          from private.quiz_answer_keys as answer_key
          join public.question_options as option_row
            on option_row.id = answer_key.correct_option_id
            and option_row.question_id = answer_key.question_id
            and option_row.user_id = answer_key.user_id
          where answer_key.question_id = question.id
            and answer_key.user_id = v_user_id
        )
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

revoke all on function public.load_quiz_editor(uuid) from public, anon, authenticated;
grant execute on function public.load_quiz_editor(uuid) to authenticated;

create function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quiz public.quizzes%rowtype;
  v_question public.questions%rowtype;
  v_attempt_id uuid := gen_random_uuid();
  v_question_id uuid;
  v_selected_option_id uuid;
  v_correct_option_id uuid;
  v_selected_label text;
  v_correct_label text;
  v_topic_label text;
  v_is_correct boolean;
  v_total_questions integer;
  v_answered_count integer := 0;
  v_correct_count integer := 0;
  v_result_answers jsonb;
  v_answer jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'invalid_quiz_answers' using errcode = '22023';
  end if;

  select quiz.* into v_quiz
  from public.quizzes as quiz
  where quiz.id = p_quiz_id and quiz.user_id = v_user_id
  for share;

  if not found then
    raise exception 'quiz_not_found' using errcode = 'P0002';
  end if;

  select pg_catalog.count(*) into v_total_questions
  from public.questions as question
  where question.quiz_id = p_quiz_id and question.user_id = v_user_id;

  if v_total_questions not between 1 and 30 then
    raise exception 'quiz_not_ready' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_answers) as item(value)
    where pg_catalog.jsonb_typeof(item.value) is distinct from 'object'
      or item.value ->> 'question_id' is null
      or item.value ->> 'question_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (item.value ->> 'selected_option_id' is not null
        and item.value ->> 'selected_option_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then
    raise exception 'invalid_quiz_answers' using errcode = '22023';
  end if;

  if (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p_answers))
    <> (select pg_catalog.count(distinct item.value ->> 'question_id')
        from pg_catalog.jsonb_array_elements(p_answers) as item(value)) then
    raise exception 'duplicate_quiz_answer' using errcode = '22023';
  end if;

  for v_answer in select item.value from pg_catalog.jsonb_array_elements(p_answers) as item(value)
  loop
    v_question_id := (v_answer ->> 'question_id')::uuid;
    if not exists (
      select 1 from public.questions as question
      where question.id = v_question_id
        and question.quiz_id = p_quiz_id
        and question.user_id = v_user_id
    ) then
      raise exception 'question_not_in_quiz' using errcode = '22023';
    end if;

    v_selected_option_id := nullif(v_answer ->> 'selected_option_id', '')::uuid;
    if v_selected_option_id is not null and not exists (
      select 1 from public.question_options as option_row
      where option_row.id = v_selected_option_id
        and option_row.question_id = v_question_id
        and option_row.quiz_id = p_quiz_id
        and option_row.user_id = v_user_id
    ) then
      raise exception 'option_not_in_question' using errcode = '22023';
    end if;
  end loop;

  insert into public.quiz_attempts (
    id, quiz_id, user_id, quiz_title, total_questions,
    answered_count, correct_count, score_percent
  ) values (
    v_attempt_id, p_quiz_id, v_user_id, v_quiz.title, v_total_questions,
    0, 0, 0
  );

  for v_question in
    select question.* from public.questions as question
    where question.quiz_id = p_quiz_id and question.user_id = v_user_id
    order by question.position
  loop
    v_selected_option_id := null;
    select nullif(item.value ->> 'selected_option_id', '')::uuid
      into v_selected_option_id
    from pg_catalog.jsonb_array_elements(p_answers) as item(value)
    where item.value ->> 'question_id' = v_question.id::text;

    select answer_key.correct_option_id, correct_option.label
      into v_correct_option_id, v_correct_label
    from private.quiz_answer_keys as answer_key
    join public.question_options as correct_option
      on correct_option.id = answer_key.correct_option_id
      and correct_option.question_id = answer_key.question_id
      and correct_option.user_id = answer_key.user_id
    where answer_key.question_id = v_question.id
      and answer_key.user_id = v_user_id;

    if v_correct_option_id is null then
      raise exception 'answer_key_missing' using errcode = 'P0001';
    end if;

    v_selected_label := null;
    if v_selected_option_id is not null then
      select option_row.label into v_selected_label
      from public.question_options as option_row
      where option_row.id = v_selected_option_id
        and option_row.question_id = v_question.id
        and option_row.user_id = v_user_id;
      v_answered_count := v_answered_count + 1;
    end if;

    v_is_correct := coalesce(v_selected_option_id = v_correct_option_id, false);
    if v_is_correct then
      v_correct_count := v_correct_count + 1;
    end if;

    v_topic_label := null;
    if v_question.topic_id is not null then
      select topic.name into v_topic_label
      from public.topics as topic
      where topic.id = v_question.topic_id and topic.user_id = v_user_id;
    end if;

    insert into public.attempt_answers (
      attempt_id, quiz_id, user_id, question_position, topic_label,
      question_prompt, selected_option_label, correct_option_label,
      explanation, is_correct
    ) values (
      v_attempt_id, p_quiz_id, v_user_id, v_question.position, v_topic_label,
      v_question.prompt, v_selected_label, v_correct_label,
      v_question.explanation, v_is_correct
    );
  end loop;

  update public.quiz_attempts as attempt
  set answered_count = v_answered_count,
      correct_count = v_correct_count,
      score_percent = round((v_correct_count::numeric * 100) / v_total_questions, 2)
  where attempt.id = v_attempt_id and attempt.user_id = v_user_id;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'position', answer.question_position,
        'topic', answer.topic_label,
        'prompt', answer.question_prompt,
        'selected', answer.selected_option_label,
        'correct', answer.correct_option_label,
        'explanation', answer.explanation,
        'is_correct', answer.is_correct
      ) order by answer.question_position
    ), '[]'::jsonb
  ) into v_result_answers
  from public.attempt_answers as answer
  where answer.attempt_id = v_attempt_id and answer.user_id = v_user_id;

  return pg_catalog.jsonb_build_object(
    'attempt_id', v_attempt_id,
    'quiz_id', p_quiz_id,
    'quiz_title', v_quiz.title,
    'total_questions', v_total_questions,
    'answered_count', v_answered_count,
    'correct_count', v_correct_count,
    'score_percent', round((v_correct_count::numeric * 100) / v_total_questions, 2),
    'answers', v_result_answers
  );
end;
$$;

revoke all on function public.submit_quiz_attempt(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;
