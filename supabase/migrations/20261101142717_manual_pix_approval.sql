create table public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  billing_interval text not null,
  amount_cents integer not null,
  payer_name text not null,
  status text not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_payment_interval_valid check (billing_interval in ('monthly', 'annual')),
  constraint manual_payment_amount_positive check (amount_cents > 0),
  constraint manual_payment_payer_name_length check (char_length(btrim(payer_name)) between 1 and 100),
  constraint manual_payment_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint manual_payment_review_fields_consistent check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('approved', 'rejected') and reviewed_at is not null)
  )
);

create unique index manual_payment_one_pending_per_user_idx
  on public.manual_payment_requests (user_id)
  where status = 'pending';

create index manual_payment_pending_created_idx
  on public.manual_payment_requests (created_at)
  where status = 'pending';

alter table public.manual_payment_requests enable row level security;
revoke all on table public.manual_payment_requests from public, anon, authenticated;
grant select (
  id, user_id, billing_interval, amount_cents, payer_name, status, reviewed_at, created_at, updated_at
) on public.manual_payment_requests to authenticated;
grant insert (user_id, billing_interval, payer_name)
  on public.manual_payment_requests to authenticated;
grant all on table public.manual_payment_requests to service_role;
grant update (plan) on public.profiles to service_role;

create policy "manual_payment_requests_select_own"
  on public.manual_payment_requests for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "manual_payment_requests_insert_own_pending"
  on public.manual_payment_requests for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
  );

create function private.set_manual_payment_request_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select case new.billing_interval
    when 'monthly' then catalog.monthly_price_cents
    else catalog.annual_price_cents
  end
    into new.amount_cents
    from public.plan_catalog as catalog
   where catalog.plan = 'pro';

  if new.amount_cents is null or new.amount_cents <= 0 then
    raise exception 'The Pro plan price is not configured.' using errcode = '22023';
  end if;

  new.payer_name := pg_catalog.btrim(new.payer_name);
  new.status := 'pending';
  new.reviewed_at := null;
  new.reviewed_by := null;
  new.created_at := pg_catalog.now();
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_manual_payment_request_amount() from public, anon, authenticated;

create trigger manual_payment_requests_set_amount
  before insert on public.manual_payment_requests
  for each row execute function private.set_manual_payment_request_amount();

create trigger manual_payment_requests_set_updated_at
  before update on public.manual_payment_requests
  for each row execute function private.set_updated_at();

create or replace function public.review_manual_payment_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_decision text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_request public.manual_payment_requests%rowtype;
  v_current_period_end timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if p_decision is null or p_decision not in ('approve', 'reject') or p_reviewer_id is null then
    raise exception 'Invalid manual payment review.' using errcode = '22023';
  end if;

  select request.*
    into v_request
    from public.manual_payment_requests as request
   where request.id = p_request_id
   for update;

  if not found then
    raise exception 'Manual payment request not found.' using errcode = 'P0002';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Manual payment request was already reviewed.' using errcode = 'P0001';
  end if;

  if p_decision = 'reject' then
    update public.manual_payment_requests
       set status = 'rejected', reviewed_at = pg_catalog.now(), reviewed_by = p_reviewer_id
     where id = v_request.id;
    return 'rejected';
  end if;

  select subscription.current_period_end
    into v_current_period_end
    from public.subscriptions as subscription
   where subscription.user_id = v_request.user_id
   for update;

  v_period_start := greatest(
    coalesce(v_current_period_end, pg_catalog.now()),
    pg_catalog.now()
  );
  v_period_end := v_period_start + case
    when v_request.billing_interval = 'annual' then interval '1 year'
    else interval '1 month'
  end;

  insert into public.subscriptions as current_subscription (
    user_id, plan, status, billing_interval, provider,
    started_at, current_period_start, current_period_end,
    cancel_at_period_end, canceled_at
  ) values (
    v_request.user_id, 'pro', 'active', v_request.billing_interval, 'manual',
    v_period_start, v_period_start, v_period_end,
    false, null
  )
  on conflict (user_id) do update set
    plan = 'pro',
    status = 'active',
    billing_interval = excluded.billing_interval,
    provider = 'manual',
    provider_customer_ref = null,
    provider_subscription_ref = null,
    started_at = coalesce(current_subscription.started_at, excluded.started_at),
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = false,
    canceled_at = null,
    updated_at = pg_catalog.now();

  update public.profiles
     set plan = 'pro'
   where id = v_request.user_id;

  update public.manual_payment_requests
     set status = 'approved', reviewed_at = pg_catalog.now(), reviewed_by = p_reviewer_id
   where id = v_request.id;

  return 'approved';
end;
$$;

revoke all on function public.review_manual_payment_request(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.review_manual_payment_request(uuid, uuid, text)
  to service_role;
