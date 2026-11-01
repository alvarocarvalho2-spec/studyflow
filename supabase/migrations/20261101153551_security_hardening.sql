-- Remove the unused anonymous grants left by Supabase's default public-schema
-- privileges. RLS already blocked anonymous reads, but least privilege is clearer.
revoke all on table public.user_preferences from anon;

-- Cover the reviewer foreign key so reviewer deletion checks do not scan the
-- entire payment request table.
create index if not exists manual_payment_requests_reviewed_by_idx
  on public.manual_payment_requests (reviewed_by);
