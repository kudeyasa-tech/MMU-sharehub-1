# Supabase setup guide

This guide takes you from an empty Supabase account to a project ready for
Phase 2 (Authentication). The site still works offline with sample notes, so you
do not need to finish this today.

**Cost:** Supabase Free is $0/month and needs **no credit card**.

---

## Before you start: know the free limits

The Free plan includes:

- 500 MB database size
- 1 GB file storage (50 MB maximum per file)
- 50,000 monthly active users
- 5 GB egress
- 2 active projects

Two things to remember:

1. Free projects are **paused after 1 week of inactivity**. Open the dashboard
   and press **Restore** before a demo if needed.
2. 1 GB of file storage is roughly 50 files at 20 MB each. That is plenty for a
   class project, but you will need Pro if the library grows.

---

## 1. Create the project

1. Open <https://supabase.com> and sign in with GitHub or email.
2. Click **New project**.
3. Name: `mmu-sharehub`.
4. Set a database password and save it somewhere safe.
5. Region: choose the closest one. For Malaysia, `Southeast Asia (Singapore)`
   is a good choice.
6. Click **Create new project** and wait 1–2 minutes.

---

## 2. Copy the URL and anon key

1. Open **Project Settings** (gear icon) → **API**.
2. Copy **Project URL**. It looks like `https://abcdefgh.supabase.co`.
3. Copy the **anon / public** key. It is a long string starting with `eyJ...`.

> **Is the anon key secret?** No. It is designed for browser use. Security comes
> from the row level security policies in `supabase/migrations/0001_initial.sql`.
> Never put a `service_role` key in frontend code.

4. Open `js/supabase-config.js` and replace the two placeholders:

```js
export const supabaseUrl = "https://abcdefgh.supabase.co";
export const supabaseAnonKey = "eyJ...";
```

`isSupabaseConfigured` becomes `true` and the auth forms turn on.

---

## 3. Run the SQL migration

1. In the Supabase dashboard, open **SQL Editor**.
2. Click **New query**.
3. Paste the entire contents of `supabase/migrations/0001_initial.sql`.
4. Click **Run**.

This creates:

- `profiles` — one private row per user
- `notes` — public note metadata
- `notes` Storage bucket — public reads, owner-only writes
- All row level security policies

If you re-run it later, it is safe: the file uses `IF NOT EXISTS` and
`DROP POLICY IF EXISTS`.

---

## 4. Configure email authentication

1. Open **Authentication → Providers → Email**.
2. Make sure Email is enabled.
3. **Confirm email**:
   - **On (default and safer):** after registering, Supabase sends a confirmation
     email. The site shows "Check your email for the confirmation link", and the
     student logs in afterwards.
   - **Off (easier for a classroom demo):** registration signs the student in
     immediately. The site redirects straight to their profile.
4. Open **Authentication → URL Configuration**.
5. Set **Site URL** to `http://localhost:5500/` while developing.
6. Add these **Redirect URLs** (exact URLs, no wildcard):

```text
http://localhost:5500/
https://YOUR-PROJECT.vercel.app/
```

Supabase's dashboard only accepts the exact base URL here, not `http://localhost:5500/**`. The app sends password-reset and confirmation links back to the base URL, then redirects in the browser to the right page.

---

## 4b. Enable Google sign-in (optional)

The site already has **Continue with Google** buttons. To activate them:

**In Google Cloud:**

1. Open <https://console.cloud.google.com/apis/credentials>.
2. Select or create a project.
3. Click **Create credentials → OAuth client ID**.
4. Choose **Web application**.
5. Under **Authorized JavaScript origins**, add:
   ```text
   https://mmu-sharehub-1.vercel.app
   http://localhost:5500
   ```
6. Under **Authorized redirect URIs**, add exactly:
   ```text
   https://bpygjjejaxzqwgclyrad.supabase.co/auth/v1/callback
   ```
7. Click **Create**, then copy the **Client ID** and **Client secret**.

If the OAuth consent screen is in Testing mode, add your own Google email as a
**Test user** under Audience; otherwise sign-in will be blocked.

**In Supabase:**

1. Open **Authentication → Providers → Google**.
2. Turn **Enable Sign in with Google** on.
3. Paste the Google **Client ID** into the **Client IDs** box.
4. Paste the Google **Client secret** into the **Client Secret (for OAuth)** box.
5. Click **Save**.

> These are Google's OAuth credentials, **not** the Supabase URL or publishable
> key. The Client ID usually ends in `.apps.googleusercontent.com`.

After saving, the button on `login.html` and `register.html` opens Google's
consent screen. Google returns to Supabase's callback, then Supabase returns to
the site's base URL and the app redirects to `profile.html`.

---

## 5. Verify the setup

1. Start your local server: `python -m http.server 5500`.
2. Open `http://localhost:5500/register.html`.
3. Register a test account.
4. In Supabase, check **Authentication → Users** for the new user.
5. Open **Table Editor → profiles** — you should see a matching row.
6. Log out, then log in again. The navbar should show your name.
7. Try **Forgot password?** and check your email.
8. Open **Storage → notes** — the bucket should exist and be public.
9. Open `upload.html`, sign in and publish a small PDF. The progress bar should
   fill, and you should land on Browse with a success toast.
10. Open **Table Editor → notes** — a row should match your upload.
11. Open **Preview** and **Download** on the new card.
12. Reopen `profile.html` — the note should be listed under Your uploads.

If the browser console shows `404 /rest/v1/notes`, the SQL migration has not
been run. Re-run section 3.

---

## 6. Common problems

| Problem | Likely cause | Fix |
|---|---|---|
| "Supabase is not configured yet" | Placeholders still in config | Replace both values in `js/supabase-config.js` |
| "Invalid login credentials" | Wrong password, or user not confirmed | Check the password or confirm the email |
| "Email not confirmed" | Confirmation is on | Open the link in the confirmation email |
| "row level security" / `42501` | SQL migration not run | Run `0001_initial.sql` in SQL Editor |
| "Failed to fetch" | Wrong URL, offline, or blocked network | Check the Project URL and your connection |
| "Email link is invalid or expired" | Redirect URL not allowed | Add the exact `http://localhost:5500/` to Redirect URLs |
| Reset link opens the home page | Expected | The app processes the token, then redirects to `login.html?reset=1` where you set a new password |
| Site works, then pauses | Free project inactivity | Restore the project in the Supabase dashboard |

---

## 7. What comes next

Phase 3 is implemented: uploads, progress, metadata and public preview/download
links all work once the SQL migration is run.

Phases 4 and 5 are implemented: note management, note detail pages and the
report flow are all in the code. **Re-run the migration** to install the
`reports` table, the immutable-field trigger and the missing `notes` Storage
bucket if you ran an older copy. It is safe to run again.

Remaining work is final testing with two accounts and the Vercel deployment,
which needs your own accounts. Follow `docs/deployment.md`.
