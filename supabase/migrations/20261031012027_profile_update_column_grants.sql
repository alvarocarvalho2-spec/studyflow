-- Supabase's default table grants can survive alongside the column-level grant
-- declared in the original profile migration. Revoke them explicitly, then
-- expose only profile reads and the user-editable display name.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
