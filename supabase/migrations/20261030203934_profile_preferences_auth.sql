create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 60)
);

comment on table public.profiles is
  'Minimal application profile keyed to Supabase Auth; credentials remain in auth.users.';

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  available_days smallint[] not null default array[1, 2, 3, 4, 5]::smallint[],
  daily_available_minutes smallint not null default 60,
  theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_timezone_length
    check (char_length(timezone) between 1 and 64),
  constraint user_preferences_available_days_valid
    check (
      cardinality(available_days) <= 7
      and array_position(available_days, null) is null
      and available_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    ),
  constraint user_preferences_daily_minutes_range
    check (daily_available_minutes between 5 and 720),
  constraint user_preferences_theme_valid
    check (theme in ('system', 'light', 'dark'))
);

comment on table public.user_preferences is
  'Personal study and display settings. Weekdays use ISO numbering: Monday=1 through Sunday=7.';

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

grant usage on schema public to authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select on table public.user_preferences to authenticated;
grant update (timezone, available_days, daily_available_minutes, theme)
  on table public.user_preferences to authenticated;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "user_preferences_select_own"
  on public.user_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_preferences_update_own"
  on public.user_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> new.id then
    raise exception 'auth user id does not match request';
  end if;

  insert into public.profiles (id) values (new.id);
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();
