-- T-005 security lock-down (KI-004), prepared 26 Oct 2026, applied only with the owner's approval.
-- Removes the temporary policies that give the anonymous (public) key full access to every portal table.
-- Row-level security is already ON for all four tables, and the portal server uses the service-role key,
-- which isn't affected by these policies. After this, only the server can read or write.
drop policy if exists temp_dev_all on public.portal_kv;
drop policy if exists temp_dev_all on public.portal_records;
drop policy if exists temp_dev_all on public.portal_sessions;
drop policy if exists temp_dev_all on public.portal_staff;
