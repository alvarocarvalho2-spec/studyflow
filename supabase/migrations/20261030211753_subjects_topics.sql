alter table public.profiles
  add column plan text not null default 'free',
  add constraint profiles_plan_valid check (plan in ('free', 'pro'));

comment on column public.profiles.plan is
  'Server-managed entitlement tier. Users may update display_name only.';

create table public.plan_limits (
  plan text primary key check (plan in ('free', 'pro')),
  max_subjects smallint not null check (max_subjects >= 0),
  max_flashcards integer not null check (max_flashcards >= 0),
  max_saved_exams smallint not null check (max_saved_exams >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.plan_limits is
  'Central business configuration for server-enforced plan limits. Pro limits are added when that offer launches.';

insert into public.plan_limits (plan, max_subjects, max_flashcards, max_saved_exams)
values ('free', 3, 100, 3);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  color text not null default 'violet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_name_length check (char_length(btrim(name)) between 1 and 60),
  constraint subjects_color_valid check (color in ('violet', 'blue', 'teal', 'amber', 'rose', 'slate')),
  constraint subjects_id_user_id_unique unique (id, user_id)
);

comment on table public.subjects is
  'A study subject owned by one authenticated user.';

create unique index subjects_user_name_lower_uidx
  on public.subjects (user_id, lower(btrim(name)));

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject_id uuid not null,
  name text not null,
  difficulty smallint not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint topics_difficulty_range check (difficulty between 1 and 5),
  constraint topics_subject_owner_fk
    foreign key (subject_id, user_id)
    references public.subjects (id, user_id)
    on delete cascade
);

comment on table public.topics is
  'A study topic linked to a subject owned by the same user; difficulty is the user-perceived level from 1 to 5.';

create unique index topics_subject_name_lower_uidx
  on public.topics (subject_id, lower(btrim(name)));

create index topics_user_subject_idx
  on public.topics (user_id, subject_id);

alter table public.plan_limits enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;

revoke all on table public.plan_limits, public.subjects, public.topics
  from public, anon, authenticated;
grant usage on schema public to authenticated;

grant select on table public.plan_limits to authenticated;
grant select, delete on table public.subjects to authenticated;
grant update (name, color) on table public.subjects to authenticated;
grant select, delete on table public.topics to authenticated;
grant insert (subject_id, name, difficulty) on table public.topics to authenticated;
grant update (subject_id, name, difficulty) on table public.topics to authenticated;

create policy "plan_limits_select_authenticated"
  on public.plan_limits for select
  to authenticated
  using (true);

create policy "subjects_select_own"
  on public.subjects for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "subjects_update_own"
  on public.subjects for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "subjects_delete_own"
  on public.subjects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "topics_select_own"
  on public.topics for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "topics_insert_own"
  on public.topics for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "topics_update_own"
  on public.topics for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "topics_delete_own"
  on public.topics for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function private.set_updated_at();

create trigger topics_set_updated_at
  before update on public.topics
  for each row execute function private.set_updated_at();

create function public.create_subject(p_name text, p_color text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_subject_limit smallint;
  v_subject_count bigint;
  v_subject_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid_subject_name' using errcode = '22023';
  end if;

  if p_color is null or p_color not in ('violet', 'blue', 'teal', 'amber', 'rose', 'slate') then
    raise exception 'invalid_subject_color' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select p.plan
    into v_plan
    from public.profiles as p
    where p.id = v_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = '42501';
  end if;

  select limits.max_subjects
    into v_subject_limit
    from public.plan_limits as limits
    where limits.plan = v_plan;

  if not found then
    raise exception 'plan_limit_configuration_missing' using errcode = 'P0001';
  end if;

  select count(*)
    into v_subject_count
    from public.subjects as s
    where s.user_id = v_user_id;

  if v_subject_count >= v_subject_limit then
    raise exception 'subject_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.subjects (user_id, name, color)
  values (v_user_id, btrim(p_name), p_color)
  returning id into v_subject_id;

  return v_subject_id;
end;
$$;

revoke all on function public.create_subject(text, text) from public, anon, authenticated;
grant execute on function public.create_subject(text, text) to authenticated;
