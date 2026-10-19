-- Default project ownership to the authenticated JWT identity.
-- The projects RLS policy still enforces owner_id = auth.uid().
alter table public.projects alter column owner_id set default auth.uid();
