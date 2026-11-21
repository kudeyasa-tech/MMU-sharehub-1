# Deployment guide — GitHub + Vercel + Supabase

The site is a static website. There is no build step, no server and no
`npm install`. Vercel serves the HTML, CSS, JavaScript and assets.

Supabase handles authentication, the database and files. **Supabase setup is
done in the Supabase dashboard** — Vercel does not deploy SQL or policies.

---

## 1. Push the project to GitHub

If the folder is not a Git repository yet:

```powershell
cd "D:\Code\mmu sharehub"
git init -b main
git add .
git commit -m "Initial ShareHub build"
```

If Git asks for your name and email:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Create a new **empty** repository on <https://github.com/new>:

- Name: `mmu-sharehub`
- Do **not** add a README, `.gitignore` or licence — this project already has them.

Connect and push:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/mmu-sharehub.git
git push -u origin main
```

Commit after each change:

```powershell
git add .
git commit -m "Describe the change"
git push
```

Small commits make bugs easier to find.

---

## 2. Import the repository into Vercel

1. Go to <https://vercel.com> and sign in with GitHub.
2. Click **Add New… → Project**.
3. Import `mmu-sharehub`.
4. Framework preset: **Other**.
5. Build command: leave empty.
6. Output directory: leave empty (project root).
7. Click **Deploy**.

`vercel.json` enables clean URLs and adds a few security headers.

---

## 3. Add the Vercel domain to Supabase

Supabase Auth only accepts requests from domains you allow.

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to `https://YOUR-PROJECT.vercel.app/`.
3. Add to **Redirect URLs** (exact URL, no wildcard):

```text
https://YOUR-PROJECT.vercel.app/
```

4. If you use a custom domain, add that too.

Vercel preview deployments have random URLs. Add them if you want to test auth
on previews, or just test on the main domain.

See `docs/supabase-setup.md` for the full Auth setup.

---

## 4. Supabase data setup

Run `supabase/migrations/0001_initial.sql` once in the **production** Supabase
SQL Editor. Vercel does **not** do this.

Afterwards check:

- Table Editor → `profiles` and `notes` exist.
- Storage → `notes` bucket exists and is public.
- Authentication → Email provider is enabled.

No API keys need to be added to Vercel. The anon key is public and already in
`js/supabase-config.js`.

---

## 5. Pre-launch checklist

### General

- [ ] Every page and footer link opens.
- [ ] `https://your-site.vercel.app/browse` works (clean URL).
- [ ] No mixed-content warnings in the browser console.
- [ ] Supabase project is not paused.

### Authentication

- [ ] Register a new account.
- [ ] Log out and log in again.
- [ ] Refresh and confirm the session is remembered.
- [ ] Navbar switches between guest and signed-in states.
- [ ] Guests see a sign-in gate on `upload.html` and `profile.html`.
- [ ] Wrong password shows a friendly error.
- [ ] Password reset works.
- [ ] Production domain is in Supabase URL Configuration.

### Note management

- [ ] Profile lists the signed-in student's uploads.
- [ ] Edit a note's title and description; the change appears on Browse.
- [ ] The file URL cannot be changed through the edit form or direct API calls.
- [ ] Delete a note; it disappears from Browse and Storage after confirmation.
- [ ] A second account cannot edit or delete the first account's note.

### Details and reports

- [ ] Clicking a note title opens `note.html?id=...` with the full description.
- [ ] Preview and Download work from the detail page.
- [ ] Related notes from the same subject appear below.
- [ ] A signed-in student can submit a report; guests are sent to login.
- [ ] The same student cannot report the same note twice.
- [ ] Reports appear in Supabase → Table Editor → `reports`.

### Uploads

- [ ] Upload a small PDF.
- [ ] Files over 20 MB are rejected.
- [ ] `.exe`, `.bat`, `.js` and `.html` are rejected.
- [ ] Progress bar reaches 100%.
- [ ] `notes` table contains the correct metadata.
- [ ] File is stored under `notes/{uid}/...`.
- [ ] A guest can open and download the file.

### Security

- [ ] SQL migration is run in production.
- [ ] Two-account ownership test passes (see `docs/database-policies.md`).
- [ ] No `service_role` key exists in the repository.
- [ ] Public bucket contains only notes meant to be shared.

---

## 6. Custom domain (optional)

1. In Vercel: Project → **Settings → Domains**.
2. Add your domain and follow the DNS instructions.
3. Add the exact `https://yourdomain.com/` to Supabase Redirect URLs.
4. Update **Site URL** in Supabase to your custom domain.

A `vercel.app` domain is fine for a student project.

---

## 7. Updating the site

After any change:

```powershell
git add .
git commit -m "Update ShareHub"
git push
```

Vercel automatically redeploys `main`. No build settings need to change.

If a deployment fails:

1. Open the deployment → **Build Logs**.
2. For a static project, failures are usually root-directory configuration.
3. Check that `index.html` is at the repository root.
4. Redeploy from **Deployments → … → Redeploy** after fixing.

---

## 8. Troubleshooting

### Login fails only in production

The domain is not allowed in Supabase. Add the `vercel.app` URL to
Authentication → URL Configuration (Site URL + Redirect URLs).

### "Supabase is not configured yet"

The placeholders in `js/supabase-config.js` were committed. Replace them with
your project URL and anon key, commit and push.

### "row level security" / `42501`

The SQL migration was not run in the production project, or you are trying to
write someone else's row.

### Uploads fail with 413 or a MIME error

The Storage bucket limit or allowed MIME types were changed. Re-run
`0001_initial.sql` to restore the 20 MB and document/image settings.

### The site works locally but not on Vercel after a while

Free Supabase projects pause after one week of inactivity. Open the Supabase
dashboard and press **Restore**.
