create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text,university text,avatar_path text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.projects(id uuid primary key default gen_random_uuid(),owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,name text not null check(length(name) between 1 and 120),description text,status text not null default 'draft' check(status in ('draft','processing','completed','failed')),source_file_path text,source_format text,model_file_path text,thumbnail_path text,conversion_settings jsonb not null default '{}'::jsonb,model_data jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists projects_owner_updated on public.projects(owner_id,updated_at desc);
create table if not exists public.conversion_jobs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,project_id uuid not null references public.projects(id) on delete cascade,input_format text not null,status text not null default 'queued' check(status in('queued','processing','completed','failed')),progress smallint check(progress between 0 and 100),error_code text,error_message text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists jobs_owner_created on public.conversion_jobs(owner_id,created_at desc);
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute procedure public.touch_updated_at();
drop trigger if exists jobs_updated_at on public.conversion_jobs;
create trigger jobs_updated_at before update on public.conversion_jobs for each row execute procedure public.touch_updated_at();
alter table public.profiles enable row level security;alter table public.projects enable row level security;alter table public.conversion_jobs enable row level security;
drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles for all using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists "projects own rows" on public.projects;
create policy "projects own rows" on public.projects for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists "jobs own rows" on public.conversion_jobs;
create policy "jobs own rows" on public.conversion_jobs for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create or replace function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name','')); return new; end; $$;
revoke execute on function public.new_profile() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users for each row execute procedure public.new_profile();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('archify-private','archify-private',false,52428800,array['image/png','image/jpeg','application/dxf','image/vnd.dxf','application/octet-stream','model/vnd.dwf']) on conflict(id) do nothing;
drop policy if exists "users manage own private files" on storage.objects;
create policy "users manage own private files" on storage.objects for all using(bucket_id='archify-private' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='archify-private' and (storage.foldername(name))[1]=auth.uid()::text);

-- Make the RLS-protected tables available through Supabase's Data API.
-- Row Level Security remains the authorization boundary for each user.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.projects, public.conversion_jobs to authenticated;

-- Refresh PostgREST's schema cache so the new tables are visible immediately.
notify pgrst, 'reload schema';
