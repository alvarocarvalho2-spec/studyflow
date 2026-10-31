create index topics_subject_user_idx
  on public.topics (subject_id, user_id);

grant insert (name, color) on table public.subjects to authenticated;

create policy "subjects_insert_own"
  on public.subjects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create function private.enforce_subject_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_subject_limit smallint;
  v_subject_count bigint;
begin
  if v_user_id is null or new.user_id <> v_user_id then
    raise exception 'subject_owner_mismatch' using errcode = '42501';
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

  return new;
end;
$$;

revoke all on function private.enforce_subject_plan_limit()
  from public, anon, authenticated;

create trigger subjects_enforce_plan_limit
  before insert on public.subjects
  for each row execute function private.enforce_subject_plan_limit();

drop function public.create_subject(text, text);
