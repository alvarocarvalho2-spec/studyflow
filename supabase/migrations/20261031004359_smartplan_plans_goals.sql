-- User goals, versioned weekly plans, and explainable tasks for SmartPlan v1.
create table public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  topic_id uuid,
  kind text not null,
  title text not null,
  target_date date,
  status text not null default 'active',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_goals_kind_valid check (kind in ('exam', 'mastery', 'custom')),
  constraint study_goals_status_valid check (status in ('active', 'completed')),
  constraint study_goals_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint study_goals_completion_consistent check (
    (status = 'active' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  ),
  constraint study_goals_id_user_id_unique unique (id, user_id),
  constraint study_goals_topic_owner_fk
    foreign key (topic_id, user_id)
    references public.topics (id, user_id)
    on delete set null (topic_id)
);

create index study_goals_topic_owner_idx
  on public.study_goals (topic_id, user_id)
  where topic_id is not null;

create index study_goals_active_deadline_idx
  on public.study_goals (user_id, target_date)
  where status = 'active' and target_date is not null;

create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  algorithm_version text not null default 'v1',
  status text not null default 'active',
  summary jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  constraint study_plans_date_range check (end_date between start_date and start_date + 6),
  constraint study_plans_algorithm_version check (algorithm_version = 'v1'),
  constraint study_plans_status_valid check (status in ('active', 'archived')),
  constraint study_plans_summary_object check (jsonb_typeof(summary) = 'object'),
  constraint study_plans_id_user_id_unique unique (id, user_id)
);

create unique index study_plans_one_active_per_user_idx
  on public.study_plans (user_id)
  where status = 'active';

create table public.planned_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  study_plan_id uuid not null,
  topic_id uuid not null,
  goal_id uuid,
  task_date date not null,
  position smallint not null,
  task_type text not null,
  title text not null,
  duration_minutes smallint not null,
  priority_score numeric(7, 2) not null,
  recommendation_reason text not null,
  status text not null default 'scheduled',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint planned_tasks_position_range check (position between 1 and 210),
  constraint planned_tasks_type_valid check (task_type in ('study', 'review', 'practice')),
  constraint planned_tasks_title_length check (char_length(btrim(title)) between 1 and 140),
  constraint planned_tasks_duration_range check (duration_minutes in (15, 25, 45)),
  constraint planned_tasks_score_range check (priority_score between 0 and 1000),
  constraint planned_tasks_reason_length check (char_length(btrim(recommendation_reason)) between 1 and 500),
  constraint planned_tasks_status_valid check (status in ('scheduled', 'completed', 'replanned', 'skipped')),
  constraint planned_tasks_completion_consistent check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint planned_tasks_plan_position_unique unique (study_plan_id, task_date, position),
  constraint planned_tasks_id_user_id_unique unique (id, user_id),
  constraint planned_tasks_plan_owner_fk
    foreign key (study_plan_id, user_id)
    references public.study_plans (id, user_id)
    on delete cascade,
  constraint planned_tasks_topic_owner_fk
    foreign key (topic_id, user_id)
    references public.topics (id, user_id)
    on delete cascade,
  constraint planned_tasks_goal_owner_fk
    foreign key (goal_id, user_id)
    references public.study_goals (id, user_id)
    on delete set null (goal_id)
);

create index planned_tasks_plan_date_position_idx
  on public.planned_tasks (study_plan_id, user_id, task_date, position);

create index planned_tasks_topic_owner_idx
  on public.planned_tasks (topic_id, user_id);

create index planned_tasks_goal_owner_idx
  on public.planned_tasks (goal_id, user_id)
  where goal_id is not null;

alter table public.study_goals enable row level security;
alter table public.study_plans enable row level security;
alter table public.planned_tasks enable row level security;

revoke all on table public.study_goals, public.study_plans, public.planned_tasks
  from public, anon, authenticated;

grant select, delete on table public.study_goals to authenticated;
grant insert (topic_id, kind, title, target_date) on public.study_goals to authenticated;
grant update (topic_id, kind, title, target_date, status) on public.study_goals to authenticated;

grant select on table public.study_plans to authenticated;
grant insert (start_date, end_date, algorithm_version, summary) on public.study_plans to authenticated;
grant update (status) on public.study_plans to authenticated;

grant select on table public.planned_tasks to authenticated;
grant insert (
  study_plan_id, topic_id, goal_id, task_date, position, task_type,
  title, duration_minutes, priority_score, recommendation_reason
) on public.planned_tasks to authenticated;
grant update (status) on public.planned_tasks to authenticated;

create policy "study_goals_select_own"
  on public.study_goals for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_goals_insert_own"
  on public.study_goals for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'active');

create policy "study_goals_update_own"
  on public.study_goals for update to authenticated
  using ((select auth.uid()) = user_id and status = 'active')
  with check ((select auth.uid()) = user_id and status in ('active', 'completed'));

create policy "study_goals_delete_own"
  on public.study_goals for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_plans_select_own"
  on public.study_plans for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_plans_insert_own"
  on public.study_plans for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'active');

create policy "study_plans_archive_own"
  on public.study_plans for update to authenticated
  using ((select auth.uid()) = user_id and status = 'active')
  with check ((select auth.uid()) = user_id and status = 'archived');

create policy "planned_tasks_select_own"
  on public.planned_tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "planned_tasks_insert_own"
  on public.planned_tasks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'scheduled'
    and exists (
      select 1 from public.study_plans as plan
      where plan.id = study_plan_id
        and plan.user_id = (select auth.uid())
        and plan.status = 'active'
    )
  );

create policy "planned_tasks_update_own"
  on public.planned_tasks for update to authenticated
  using ((select auth.uid()) = user_id and status = 'scheduled')
  with check ((select auth.uid()) = user_id and status in ('completed', 'replanned', 'skipped'));

create trigger study_goals_set_updated_at
  before update on public.study_goals
  for each row execute function private.set_updated_at();

create function private.set_study_goal_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'active' or new.status <> 'completed' then
    raise exception 'invalid_study_goal_transition' using errcode = '22023';
  end if;
  new.completed_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;

revoke all on function private.set_study_goal_completed_at()
  from public, anon, authenticated;

create trigger study_goals_set_completed_at
  before update of status on public.study_goals
  for each row execute function private.set_study_goal_completed_at();

create function private.set_planned_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'scheduled' or new.status not in ('completed', 'replanned', 'skipped') then
    raise exception 'invalid_planned_task_transition' using errcode = '22023';
  end if;
  if new.status = 'completed' then
    new.completed_at := pg_catalog.clock_timestamp();
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke all on function private.set_planned_task_completed_at()
  from public, anon, authenticated;

create trigger planned_tasks_set_completed_at
  before update of status on public.planned_tasks
  for each row execute function private.set_planned_task_completed_at();

create function public.save_study_plan(
  p_start_date date,
  p_end_date date,
  p_summary jsonb,
  p_tasks jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_old_plan_id uuid;
  v_new_plan_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_start_date is null
    or p_end_date is distinct from p_start_date + 6
    or pg_catalog.jsonb_typeof(p_summary) is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_tasks) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_tasks) > 210 then
    raise exception 'invalid_study_plan_payload' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_to_recordset(p_tasks) as task(task_date date)
    where task.task_date is null
      or task.task_date < p_start_date
      or task.task_date > p_end_date
  ) then
    raise exception 'planned_task_date_outside_plan' using errcode = '22023';
  end if;

  select plan.id into v_old_plan_id
  from public.study_plans as plan
  where plan.user_id = v_user_id and plan.status = 'active'
  for update;

  if v_old_plan_id is not null then
    update public.study_plans
      set status = 'archived'
      where id = v_old_plan_id and user_id = v_user_id and status = 'active';

    update public.planned_tasks
      set status = 'replanned'
      where study_plan_id = v_old_plan_id
        and user_id = v_user_id
        and status = 'scheduled';
  end if;

  insert into public.study_plans (start_date, end_date, algorithm_version, summary)
  values (p_start_date, p_end_date, 'v1', p_summary)
  returning id into v_new_plan_id;

  insert into public.planned_tasks (
    study_plan_id, topic_id, goal_id, task_date, position, task_type,
    title, duration_minutes, priority_score, recommendation_reason
  )
  select
    v_new_plan_id,
    task.topic_id,
    task.goal_id,
    task.task_date,
    task.position,
    task.task_type,
    task.title,
    task.duration_minutes,
    task.priority_score,
    task.recommendation_reason
  from pg_catalog.jsonb_to_recordset(p_tasks) as task(
    topic_id uuid,
    goal_id uuid,
    task_date date,
    position smallint,
    task_type text,
    title text,
    duration_minutes smallint,
    priority_score numeric,
    recommendation_reason text
  );

  return v_new_plan_id;
end;
$$;

revoke all on function public.save_study_plan(date, date, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_study_plan(date, date, jsonb, jsonb)
  to authenticated;
