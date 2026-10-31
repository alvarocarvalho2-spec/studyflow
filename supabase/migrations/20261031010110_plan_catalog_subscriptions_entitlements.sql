-- Business configuration for plans, server-authoritative feature access, and future billing state.
insert into public.plan_limits (plan, max_subjects, max_flashcards, max_saved_exams)
values ('pro', 20, 2000, 50);

create table public.plan_catalog (
  plan text primary key
    references public.plan_limits (plan) on delete restrict,
  display_name text not null,
  description text not null,
  monthly_price_cents integer not null,
  annual_price_cents integer not null,
  currency text not null default 'BRL',
  benefits text[] not null,
  feature_permissions jsonb not null,
  pricing_note text not null,
  display_order smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_catalog_name_length check (char_length(btrim(display_name)) between 1 and 60),
  constraint plan_catalog_description_length check (char_length(btrim(description)) between 1 and 240),
  constraint plan_catalog_monthly_price_nonnegative check (monthly_price_cents >= 0),
  constraint plan_catalog_annual_price_nonnegative check (annual_price_cents >= 0),
  constraint plan_catalog_currency_valid check (currency = 'BRL'),
  constraint plan_catalog_benefits_valid check (cardinality(benefits) between 1 and 12),
  constraint plan_catalog_permissions_valid check (
    pg_catalog.jsonb_typeof(feature_permissions) = 'object'
    and feature_permissions ?& array[
      'smart_plan', 'adaptive_schedule', 'advanced_quizzes',
      'detailed_statistics', 'learning_goals', 'reports_exports'
    ]
    and pg_catalog.jsonb_typeof(feature_permissions -> 'smart_plan') = 'boolean'
    and pg_catalog.jsonb_typeof(feature_permissions -> 'adaptive_schedule') = 'boolean'
    and pg_catalog.jsonb_typeof(feature_permissions -> 'advanced_quizzes') = 'boolean'
    and pg_catalog.jsonb_typeof(feature_permissions -> 'detailed_statistics') = 'boolean'
    and pg_catalog.jsonb_typeof(feature_permissions -> 'learning_goals') = 'boolean'
    and pg_catalog.jsonb_typeof(feature_permissions -> 'reports_exports') = 'boolean'
  ),
  constraint plan_catalog_pricing_note_length check (char_length(btrim(pricing_note)) between 1 and 240),
  constraint plan_catalog_order_valid check (display_order between 1 and 20)
);

insert into public.plan_catalog (
  plan, display_name, description, monthly_price_cents, annual_price_cents,
  benefits, feature_permissions, pricing_note, display_order
)
values
  (
    'free',
    'StudyFlow Gratuito',
    'Uma base leve para dar ritmo aos seus estudos.',
    0,
    0,
    array[
      'Até 3 matérias',
      'Até 100 flashcards',
      'Até 3 simulados salvos',
      'Revisão espaçada básica',
      'Dashboard essencial'
    ],
    '{"smart_plan": false, "adaptive_schedule": false, "advanced_quizzes": false, "detailed_statistics": false, "learning_goals": false, "reports_exports": false}'::jsonb,
    'Gratuito, sem cobrança.',
    1
  ),
  (
    'pro',
    'StudyFlow Pro',
    'Mais profundidade para personalizar seu aprendizado.',
    1490,
    11990,
    array[
      'Tudo do plano gratuito',
      'SmartPlan e cronograma adaptativo',
      'Até 20 matérias e 2.000 flashcards',
      'Até 50 simulados salvos',
      'Simulados avançados e diagnóstico de dificuldades',
      'Estatísticas detalhadas',
      'Metas de aprendizado, relatórios e exportações'
    ],
    '{"smart_plan": true, "adaptive_schedule": true, "advanced_quizzes": true, "detailed_statistics": true, "learning_goals": true, "reports_exports": true}'::jsonb,
    'Preço de referência. A oferta e os pagamentos ainda não estão disponíveis.',
    2
  );

alter table public.profiles
  add constraint profiles_plan_catalog_fk
  foreign key (plan) references public.plan_catalog (plan) on delete restrict;

alter table public.plan_catalog enable row level security;
revoke all on table public.plan_catalog from public, anon, authenticated;
grant select on table public.plan_catalog to anon, authenticated;

create policy "plan_catalog_select_public"
  on public.plan_catalog for select to anon, authenticated
  using (true);

create policy "plan_limits_select_public"
  on public.plan_limits for select to anon
  using (true);
grant select on table public.plan_limits to anon;

create trigger plan_catalog_set_updated_at
  before update on public.plan_catalog
  for each row execute function private.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique
    references public.profiles (id) on delete cascade,
  plan text not null default 'pro'
    references public.plan_catalog (plan) on delete restrict,
  status text not null,
  billing_interval text not null,
  provider text not null,
  provider_customer_ref text,
  provider_subscription_ref text,
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_plan_pro_only check (plan = 'pro'),
  constraint subscriptions_status_valid check (
    status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'expired')
  ),
  constraint subscriptions_interval_valid check (billing_interval in ('monthly', 'annual')),
  constraint subscriptions_provider_valid check (
    provider in ('stripe', 'mercado_pago', 'manual')
  ),
  constraint subscriptions_period_order check (
    current_period_end is null or current_period_start is null
    or current_period_end >= current_period_start
  ),
  constraint subscriptions_id_user_unique unique (id, user_id)
);

create index subscriptions_status_period_end_idx
  on public.subscriptions (status, current_period_end);

create unique index subscriptions_provider_subscription_uidx
  on public.subscriptions (provider, provider_subscription_ref)
  where provider_subscription_ref is not null;

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from public, anon, authenticated;
grant select (
  plan, status, billing_interval, started_at, current_period_start,
  current_period_end, cancel_at_period_end, canceled_at, created_at, updated_at
) on public.subscriptions to authenticated;
grant all on table public.subscriptions to service_role;

create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

create table private.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null,
  user_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint subscription_events_payload_object check (pg_catalog.jsonb_typeof(payload) = 'object'),
  constraint subscription_events_event_id_unique unique (provider, provider_event_id),
  constraint subscription_events_subscription_owner_fk
    foreign key (subscription_id, user_id)
    references public.subscriptions (id, user_id) on delete cascade
);

create index subscription_events_subscription_history_idx
  on private.subscription_events (subscription_id, user_id, created_at desc);

alter table private.subscription_events enable row level security;
revoke all on table private.subscription_events from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on table private.subscription_events to service_role;

-- Feature access to SmartPlan is checked at the database boundary as well as in Server Actions.
drop policy if exists "study_goals_select_own" on public.study_goals;
create policy "study_goals_select_own"
  on public.study_goals for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "study_goals_insert_own" on public.study_goals;
create policy "study_goals_insert_own"
  on public.study_goals for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'active'
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "study_goals_update_own" on public.study_goals;
create policy "study_goals_update_own"
  on public.study_goals for update to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'active'
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and status in ('active', 'completed')
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "study_goals_delete_own" on public.study_goals;
create policy "study_goals_delete_own"
  on public.study_goals for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "study_plans_select_own" on public.study_plans;
create policy "study_plans_select_own"
  on public.study_plans for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "study_plans_insert_own" on public.study_plans;
create policy "study_plans_insert_own"
  on public.study_plans for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'active'
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "study_plans_archive_own" on public.study_plans;
create policy "study_plans_archive_own"
  on public.study_plans for update to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'active'
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and status = 'archived'
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "planned_tasks_select_own" on public.planned_tasks;
create policy "planned_tasks_select_own"
  on public.planned_tasks for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "planned_tasks_insert_own" on public.planned_tasks;
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
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );

drop policy if exists "planned_tasks_update_own" on public.planned_tasks;
create policy "planned_tasks_update_own"
  on public.planned_tasks for update to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'scheduled'
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  )
  with check (
    (select auth.uid()) = user_id
    and status in ('completed', 'replanned', 'skipped')
    and exists (
      select 1
      from public.profiles as profile
      join public.plan_catalog as catalog on catalog.plan = profile.plan
      where profile.id = (select auth.uid())
        and catalog.feature_permissions ->> 'smart_plan' = 'true'
    )
  );
