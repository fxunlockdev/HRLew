-- ============================================================================
-- 0007_client_logos.sql
-- Client logo metadata + storage bucket for brand assets.
-- ============================================================================

alter table public.clients
  add column if not exists logo_url text,
  add column if not exists logo_file_name text;

insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists client_logos_insert on storage.objects;
create policy client_logos_insert on storage.objects for insert
  with check (bucket_id = 'client-logos' and public.is_active_user());

drop policy if exists client_logos_update on storage.objects;
create policy client_logos_update on storage.objects for update
  using (bucket_id = 'client-logos' and public.is_active_user())
  with check (bucket_id = 'client-logos' and public.is_active_user());

drop policy if exists client_logos_delete on storage.objects;
create policy client_logos_delete on storage.objects for delete
  using (bucket_id = 'client-logos' and public.is_manager_or_admin());
