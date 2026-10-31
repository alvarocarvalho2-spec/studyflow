create index profiles_plan_catalog_idx
  on public.profiles (plan);

create index subscriptions_plan_idx
  on public.subscriptions (plan);

create policy "subscription_events_service_role_all"
  on private.subscription_events for all to service_role
  using (true)
  with check (true);
