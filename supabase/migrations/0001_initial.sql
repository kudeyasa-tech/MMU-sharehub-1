-- MMU ShareHub — initial Supabase schema
-- Run this file once in the Supabase SQL Editor (Dashboard -> SQL Editor).
-- It creates the two tables and all row level security policies.
-- Safe to re-run: CREATE IF NOT EXISTS / ON CONFLICT are used where possible.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Public profiles
--    One row per Auth user. The email is private; notes keep a copy of the
--    display name so guests can see who shared a file.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- A student may change the display name, but not their identity or join date.
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.created_at is distinct from old.created_at then
    raise exception 'Profile identity fields cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
before update on public.profiles
for each row execute function public.protect_profile_identity();

-- ---------------------------------------------------------------------------
-- 2. Notes metadata
--    Public reads, authenticated writes, owner-only edits and deletes.
-- ---------------------------------------------------------------------------

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 5 and 100),
  subject text not null check (char_length(subject) between 2 and 60),
  faculty text not null check (
    faculty in (
      'Computing & Informatics',
      'Engineering',
      'Business',
      'Creative Multimedia',
      'Applied Communication'
    )
  ),
  year text not null check (year in ('Year 1', 'Year 2', 'Year 3', 'Year 4')),
  description text not null check (char_length(description) between 10 and 500),
  file_url text not null check (
    file_url like 'https://bpygjjejaxzqwgclyrad.supabase.co/storage/v1/object/public/notes/%'
  ),
  file_type text not null check (
    file_type in ('PDF', 'DOC', 'DOCX', 'PPT', 'PPTX', 'TXT', 'JPG', 'JPEG', 'PNG')
  ),
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  uploader_name text not null check (char_length(uploader_name) between 2 and 80),
  created_at timestamptz not null default now()
);

-- Existing tables keep their old CHECK constraint, so replace it explicitly.
alter table public.notes drop constraint if exists notes_file_url_check;
alter table public.notes add constraint notes_file_url_check check (
  file_url like 'https://bpygjjejaxzqwgclyrad.supabase.co/storage/v1/object/public/notes/%'
);

create index if not exists notes_created_at_idx on public.notes (created_at desc);
create index if not exists notes_uploader_id_idx on public.notes (uploader_id);

alter table public.notes enable row level security;

drop policy if exists "Anyone can read notes" on public.notes;
create policy "Anyone can read notes"
on public.notes for select
using (true);

drop policy if exists "Signed-in users can create notes" on public.notes;
create policy "Signed-in users can create notes"
on public.notes for insert
to authenticated
with check (auth.uid() = uploader_id);

drop policy if exists "Uploaders can update their notes" on public.notes;
create policy "Uploaders can update their notes"
on public.notes for update
to authenticated
using (auth.uid() = uploader_id)
with check (auth.uid() = uploader_id);

drop policy if exists "Uploaders can delete their notes" on public.notes;
create policy "Uploaders can delete their notes"
on public.notes for delete
to authenticated
using (auth.uid() = uploader_id);

-- RLS checks who may update a row, but not which columns may change.
-- This trigger keeps the file and ownership fields immutable.
create or replace function public.protect_note_immutable_fields()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
    or new.file_url is distinct from old.file_url
    or new.file_type is distinct from old.file_type
    or new.file_size is distinct from old.file_size
    or new.uploader_id is distinct from old.uploader_id
    or new.uploader_name is distinct from old.uploader_name
    or new.created_at is distinct from old.created_at then
    raise exception 'File, ownership and timestamp fields cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists notes_protect_immutable on public.notes;
create trigger notes_protect_immutable
before update on public.notes
for each row execute function public.protect_note_immutable_fields();

-- ---------------------------------------------------------------------------
-- 2b. Reports
--     Any signed-in student can flag a note. Reporters can see their own
--     reports; note owners and moderators are handled in Phase 5 docs.
-- ---------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (
    reason in (
      'copyright',
      'confidential',
      'plagiarism',
      'inappropriate',
      'broken_file',
      'other'
    )
  ),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
  created_at timestamptz not null default now(),
  unique (note_id, reporter_id)
);

alter table public.reports drop constraint if exists reports_details_check;
alter table public.reports add constraint reports_details_check
  check (char_length(details) <= 500);

alter table public.reports enable row level security;

drop policy if exists "Users can read their own reports" on public.reports;
create policy "Users can read their own reports"
on public.reports for select
to authenticated
using (auth.uid() = reporter_id);

drop policy if exists "Users can submit reports" on public.reports;
create policy "Users can submit reports"
on public.reports for insert
to authenticated
with check (auth.uid() = reporter_id);

grant select on public.reports to authenticated;
grant insert on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Storage bucket for note files
--    Path format: notes/{user-id}/{note-id}/{file-name}
--    The second folder must be the signed-in user's UID.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notes',
  'notes',
  true,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view note files" on storage.objects;
create policy "Anyone can view note files"
on storage.objects for select
using (bucket_id = 'notes');

drop policy if exists "Users can upload to their own folder" on storage.objects;
create policy "Users can upload to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'notes'
  and (storage.foldername(name))[1] = 'notes'
  and (storage.foldername(name))[2] = auth.uid()::text
  and name ~* '\.(pdf|docx?|pptx?|txt|jpe?g|png)$'
);

drop policy if exists "Users can delete their own files" on storage.objects;
create policy "Users can delete their own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'notes'
  and (storage.foldername(name))[1] = 'notes'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 4. Privileges
--    RLS decides which rows are visible; these grants allow the API role to
--    reach the tables at all.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on public.notes to anon, authenticated;
grant insert, update, delete on public.notes to authenticated;

grant select, insert, update on public.profiles to authenticated;

-- Done. See docs/supabase-setup.md for the next steps.
