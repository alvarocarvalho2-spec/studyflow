create unique index topics_id_user_id_unique
  on public.topics (id, user_id);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  topic_id uuid,
  front text not null,
  back text not null,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint flashcards_front_length
    check (char_length(btrim(front)) between 1 and 2000),
  constraint flashcards_back_length
    check (char_length(btrim(back)) between 1 and 5000),
  constraint flashcards_interval_range
    check (interval_days between 0 and 3650),
  constraint flashcards_repetitions_range
    check (repetitions between 0 and 10000),
  constraint flashcards_id_user_id_unique unique (id, user_id),
  constraint flashcards_topic_owner_fk
    foreign key (topic_id, user_id)
    references public.topics (id, user_id)
    on delete set null (topic_id)
);

comment on table public.flashcards is
  'User-owned study cards. next_review_at and repetition state are maintained by the private review trigger.';

comment on column public.flashcards.interval_days is
  'Current spaced-repetition interval in whole days; zero means the card was missed and is rescheduled in ten minutes.';

create index flashcards_user_due_idx
  on public.flashcards (user_id, next_review_at);

create index flashcards_topic_user_idx
  on public.flashcards (topic_id, user_id)
  where topic_id is not null;

create table public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references public.profiles (id) on delete cascade,
  flashcard_id uuid not null,
  rating smallint not null,
  interval_before_days integer not null,
  interval_after_days integer not null,
  reviewed_at timestamptz not null default now(),
  next_review_at timestamptz not null,
  constraint flashcard_reviews_rating_range check (rating between 0 and 3),
  constraint flashcard_reviews_interval_before_range
    check (interval_before_days between 0 and 3650),
  constraint flashcard_reviews_interval_after_range
    check (interval_after_days between 0 and 3650),
  constraint flashcard_reviews_card_owner_fk
    foreign key (flashcard_id, user_id)
    references public.flashcards (id, user_id)
    on delete cascade
);

comment on table public.flashcard_reviews is
  'Immutable history of owner-submitted flashcard ratings and the resulting next review schedule.';

comment on column public.flashcard_reviews.rating is
  '0=again, 1=hard, 2=good, 3=easy.';

create index flashcard_reviews_user_history_idx
  on public.flashcard_reviews (user_id, reviewed_at desc);

create index flashcard_reviews_card_history_idx
  on public.flashcard_reviews (flashcard_id, user_id, reviewed_at desc);

alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;

revoke all on table public.flashcards, public.flashcard_reviews
  from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select, delete on table public.flashcards to authenticated;
grant insert (topic_id, front, back) on table public.flashcards to authenticated;
grant update (topic_id, front, back) on table public.flashcards to authenticated;

grant select on table public.flashcard_reviews to authenticated;
grant insert (flashcard_id, rating) on table public.flashcard_reviews to authenticated;

create policy "flashcards_select_own"
  on public.flashcards for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "flashcards_insert_own"
  on public.flashcards for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "flashcards_update_own"
  on public.flashcards for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "flashcards_delete_own"
  on public.flashcards for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "flashcard_reviews_select_own"
  on public.flashcard_reviews for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "flashcard_reviews_insert_own"
  on public.flashcard_reviews for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create trigger flashcards_set_updated_at
  before update on public.flashcards
  for each row execute function private.set_updated_at();

create function private.enforce_flashcard_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text;
  v_flashcard_limit integer;
  v_flashcard_count bigint;
begin
  if v_user_id is null or new.user_id is distinct from v_user_id then
    raise exception 'flashcard_owner_mismatch' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('studyflow.flashcards:' || v_user_id::text, 0)
  );

  select p.plan
    into v_plan
    from public.profiles as p
    where p.id = v_user_id;

  if not found then
    raise exception 'profile_not_found' using errcode = '42501';
  end if;

  select limits.max_flashcards
    into v_flashcard_limit
    from public.plan_limits as limits
    where limits.plan = v_plan;

  if not found then
    raise exception 'plan_limit_configuration_missing' using errcode = 'P0001';
  end if;

  select count(*)
    into v_flashcard_count
    from public.flashcards as f
    where f.user_id = v_user_id;

  if v_flashcard_count >= v_flashcard_limit then
    raise exception 'flashcard_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_flashcard_plan_limit()
  from public, anon, authenticated;

create trigger flashcards_enforce_plan_limit
  before insert on public.flashcards
  for each row execute function private.enforce_flashcard_plan_limit();

create function private.apply_flashcard_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_card public.flashcards%rowtype;
  v_interval_after integer;
  v_repetitions_after integer;
  v_reviewed_at timestamptz := pg_catalog.clock_timestamp();
  v_next_review_at timestamptz;
begin
  if v_user_id is null or new.user_id is distinct from v_user_id then
    raise exception 'flashcard_review_owner_mismatch' using errcode = '42501';
  end if;

  select f.*
    into v_card
    from public.flashcards as f
    where f.id = new.flashcard_id
      and f.user_id = v_user_id
    for update;

  if not found then
    raise exception 'flashcard_not_found' using errcode = 'P0002';
  end if;

  if new.rating not between 0 and 3 then
    raise exception 'invalid_flashcard_rating' using errcode = '22023';
  end if;

  case new.rating
    when 0 then
      v_interval_after := 0;
      v_repetitions_after := 0;
      v_next_review_at := v_reviewed_at + interval '10 minutes';
    when 1 then
      v_interval_after := least(3650, greatest(1, ceil(v_card.interval_days * 1.2)::integer));
      v_repetitions_after := least(10000, v_card.repetitions + 1);
      v_next_review_at := v_reviewed_at + (v_interval_after * interval '1 day');
    when 2 then
      v_interval_after := least(3650, greatest(1, v_card.interval_days * 2));
      v_repetitions_after := least(10000, v_card.repetitions + 1);
      v_next_review_at := v_reviewed_at + (v_interval_after * interval '1 day');
    when 3 then
      v_interval_after := least(3650, greatest(3, v_card.interval_days * 3));
      v_repetitions_after := least(10000, v_card.repetitions + 1);
      v_next_review_at := v_reviewed_at + (v_interval_after * interval '1 day');
    else
      raise exception 'invalid_flashcard_rating' using errcode = '22023';
  end case;

  new.interval_before_days := v_card.interval_days;
  new.interval_after_days := v_interval_after;
  new.reviewed_at := v_reviewed_at;
  new.next_review_at := v_next_review_at;

  update public.flashcards
    set interval_days = v_interval_after,
        repetitions = v_repetitions_after,
        next_review_at = v_next_review_at,
        last_reviewed_at = v_reviewed_at
    where id = v_card.id
      and user_id = v_user_id;

  return new;
end;
$$;

revoke all on function private.apply_flashcard_review()
  from public, anon, authenticated;

create trigger flashcard_reviews_apply_schedule
  before insert on public.flashcard_reviews
  for each row execute function private.apply_flashcard_review();
