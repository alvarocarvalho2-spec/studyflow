-- Persist focus blocks and expose only the operations needed by the signed-in owner.
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  topic_id uuid,
  planned_minutes smallint not null,
  duration_seconds integer not null default 0,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint study_sessions_planned_minutes_range
    check (planned_minutes in (15, 25, 45)),
  constraint study_sessions_duration_range
    check (duration_seconds between 0 and planned_minutes * 60),
  constraint study_sessions_status_valid
    check (status in ('active', 'completed')),
  constraint study_sessions_state_consistent
    check (
      (status = 'active' and finished_at is null and duration_seconds = 0)
      or (status = 'completed' and finished_at is not null)
    ),
  constraint study_sessions_finish_after_start
    check (finished_at is null or finished_at >= started_at),
  constraint study_sessions_topic_owner_fk
    foreign key (topic_id, user_id)
    references public.topics (id, user_id)
    on delete set null (topic_id)
);

comment on table public.study_sessions is
  'Focus timer sessions. Duration is calculated by the database when the owner finishes a session.';

create unique index study_sessions_one_active_per_user_idx
  on public.study_sessions (user_id)
  where status = 'active';

create index study_sessions_completed_user_finished_idx
  on public.study_sessions (user_id, finished_at desc)
  where status = 'completed';

alter table public.study_sessions enable row level security;

revoke all on table public.study_sessions from public, anon, authenticated;
grant select on table public.study_sessions to authenticated;
grant insert (topic_id, planned_minutes) on table public.study_sessions to authenticated;
grant update (status) on table public.study_sessions to authenticated;

create policy "study_sessions_select_own"
  on public.study_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_sessions_insert_own"
  on public.study_sessions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'active'
    and duration_seconds = 0
    and finished_at is null
  );

create policy "study_sessions_finish_own"
  on public.study_sessions for update to authenticated
  using ((select auth.uid()) = user_id and status = 'active')
  with check ((select auth.uid()) = user_id and status = 'completed');

create function private.set_study_session_duration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_finished_at timestamptz := pg_catalog.clock_timestamp();
begin
  if old.status <> 'active' or new.status <> 'completed' then
    raise exception 'invalid_study_session_transition' using errcode = '22023';
  end if;

  new.finished_at := v_finished_at;
  new.duration_seconds := least(
    old.planned_minutes * 60,
    greatest(
      0,
      floor(extract(epoch from (v_finished_at - old.started_at)))::integer
    )
  );

  return new;
end;
$$;

revoke all on function private.set_study_session_duration()
  from public, anon, authenticated;

create trigger study_sessions_set_duration_on_finish
  before update of status on public.study_sessions
  for each row execute function private.set_study_session_duration();

create function public.get_study_session_summary()
returns table (weekly_focus_seconds bigint, weekly_session_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(session.duration_seconds), 0)::bigint,
    count(*)::bigint
  from public.study_sessions as session
  where session.user_id = (select auth.uid())
    and session.status = 'completed'
    and session.finished_at >= pg_catalog.now() - interval '7 days';
$$;

revoke all on function public.get_study_session_summary()
  from public, anon, authenticated;
grant execute on function public.get_study_session_summary() to authenticated;
