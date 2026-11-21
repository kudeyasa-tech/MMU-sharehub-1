# Database and security policies

This document explains how `supabase/migrations/0001_initial.sql` protects
MMU ShareHub. The browser code is never the security boundary — Supabase's row
level security (RLS) and Storage policies are.

---

## 1. Why we need server-side rules

Anyone can open DevTools and call the Supabase REST API directly. They can skip
every JavaScript check. RLS runs in Postgres, so it applies to those requests
too.

The anon key in `js/supabase-config.js` is public by design. A `service_role`
key would bypass RLS and must **never** appear in frontend code.

---

## 2. Tables

### `profiles`

```text
id         uuid  primary key, references auth.users(id)
email      text
name       text  2–80 characters
created_at timestamptz
```

| Operation | Who | Rule |
|---|---|---|
| Read | Owner only | `auth.uid() = id` |
| Insert | Owner only | `auth.uid() = id` |
| Update | Owner only | `auth.uid() = id` |

A `BEFORE UPDATE` trigger called `profiles_protect_identity` keeps `id`, `email`
and `created_at` unchanged. Only the display name can be edited through the API.

There is deliberately **no client-side delete policy**. Deleting a user is done
from Supabase Auth, and the foreign key removes the profile.

Public note cards never expose this table. They use the `uploader_name` copy
stored with each note.

### `reports`

```text
id          uuid
note_id     uuid  references notes(id) on delete cascade
reporter_id uuid  references auth.users(id) on delete cascade
reason      text  copyright | confidential | plagiarism | inappropriate | broken_file | other
details     text  max 500 characters
status      text  open | reviewed | resolved
created_at  timestamptz
```

| Operation | Who | Rule |
|---|---|---|
| Read | Reporter only | `auth.uid() = reporter_id` |
| Insert | Signed-in user | `auth.uid() = reporter_id` |

A `unique (note_id, reporter_id)` constraint stops the same student reporting
the same note twice. Deleting a note also deletes its reports. There is no
admin moderation screen yet — review reports in the Supabase Table Editor.

### `notes`

```text
id            uuid
title         text    5–100 characters
subject       text    2–60 characters
faculty       text    one of five faculties
year          text    Year 1–4
description   text    10–500 characters
file_url      text    this project's public notes Storage URL only
file_type     text    PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, JPEG, PNG
file_size     bigint  > 0 and <= 20 MB
uploader_id   uuid    references auth.users(id)
uploader_name text
created_at    timestamptz
```

| Operation | Who | Rule |
|---|---|---|
| Read | Everyone | Public library |
| Insert | Signed-in user | `auth.uid() = uploader_id` |
| Update | Uploader | `auth.uid() = uploader_id` |
| Delete | Uploader | `auth.uid() = uploader_id` |

Guests can browse and open notes but cannot write. The `CHECK` constraints also
reject bad metadata even if a student bypasses the form. In particular,
`file_url` must begin with this project's public notes bucket URL, so a direct
API call cannot point a card at an unrelated website. If you move to a different
Supabase project, update the host in `0001_initial.sql` and re-run the migration.

> **Immutable fields:** the migration adds a `BEFORE UPDATE` trigger called
> `notes_protect_immutable`. Even the owner cannot change `id`, `file_url`,
> `file_type`, `file_size`, `uploader_id`, `uploader_name` or `created_at` through
> the API. Only the five editable metadata fields can change. If you run an old
> copy of the migration, re-run it to install the trigger.

---

## 3. Storage bucket

The bucket is named `notes` and is public so guests can preview and download
files.

Path format:

```text
notes/{user-id}/{note-id}/{file-name}
```

Policies:

| Operation | Who | Condition |
|---|---|---|
| Read | Everyone | `bucket_id = 'notes'` |
| Insert | Signed-in user | Second folder equals `auth.uid()`, filename has an allowed extension |
| Delete | Signed-in user | Second folder equals `auth.uid()` |
| Update | Nobody | Replace the file by deleting and re-uploading |

The bucket also enforces:

- Maximum file size: **20 MB**
- Allowed MIME types: PDF, Word, PowerPoint, plain text, JPEG, PNG
- Allowed filename endings: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.txt`, `.jpg`, `.jpeg`, `.png`

The extension check matters because a browser can misreport a MIME type. The
frontend repeats these checks in `js/storage.js` for fast feedback, but the
Storage configuration is the real rule.

The browser also checks the file URL origin again with `js/security.js` before
opening a preview or starting a download. That stops a tampered row from
sending students to another site.

**Delete order:** the profile page deletes the `notes` row first, then removes
the Storage object. If the second step fails, the file becomes an invisible
orphan rather than a live note with a broken download link. Clean up orphans
periodically in the Storage dashboard.

---

## 4. What the policies do not solve

- **Malware:** an allowed PDF or DOCX can still contain malicious content. There
  is no virus scanner. Add moderation before a public launch.
- **Spam:** a signed-in user can upload many files until the 1 GB free limit is
  reached. Supabase spend caps only apply to paid plans.
- **Copyright:** the upload form asks students to confirm they can share the
  notes, but that is a trust agreement, not enforcement.
- **Public bucket:** anyone with a file URL can download it. That is intentional
  for a note library. Do not put private documents here.
- **Paused free project:** after one week of inactivity, requests fail until the
  project is restored in the dashboard.

---

## 5. Testing the rules

Use two browsers (or one normal window and one private window).

1. Account A registers and uploads a note.
2. Signed-out visitor reads the note → should work.
3. Signed-out visitor tries to insert a note → should fail.
4. Account B tries to update or delete A's note → should fail.
5. Account B tries to upload into A's Storage folder → should fail.
6. Account A updates their own note → should work.

In the Supabase dashboard you can also open **Authentication → Policies** or
query as a role with SQL:

```sql
select * from public.notes;               -- anon can read
insert into public.notes (...) values (...) -- anon is rejected
```

---

## 6. Production checklist

- [ ] SQL migration has been run in the production Supabase project.
- [ ] Email confirmation choice is intentional.
- [ ] Production domain is in Auth → URL Configuration (Site URL + Redirect URLs).
- [ ] The `notes` bucket is public and has the 20 MB limit.
- [ ] Two-account ownership test passes.
- [ ] No `service_role` key exists in frontend files.
- [ ] A moderation/report process exists before advertising the site widely.
- [ ] You remember that free projects pause after a week of inactivity.
