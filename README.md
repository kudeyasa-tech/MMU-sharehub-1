# MMU ShareHub

A student-run note library for MMU students. Students who sat a paper upload their notes; everyone else can search, preview and download them for free.

No framework, no build step. Plain HTML, CSS and ES modules, with Supabase for accounts, data and files.

---

## Current status

Phase 5 polish and launch preparation is done in code. What remains is two-account testing and deployment from your own GitHub/Vercel accounts.

- Responsive paper-and-stamp design across seven pages
- Supabase email/password and Google sign-in
- Public note library with search, filters and sorting
- Uploads to Supabase Storage with progress and 20 MB checks
- Note detail pages, related notes and a private report flow
- Profile page with edit and delete for your own notes
- Row level security, storage policies and a runnable SQL migration

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | HTML5, CSS3, vanilla ES modules |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Database | PostgreSQL through Supabase |
| Files | Supabase Storage, public `notes` bucket |
| Hosting | Vercel static hosting |
| Version control | Git + GitHub |

The Supabase JS SDK is loaded from `esm.sh` only after a real config is present. There is no `npm install` for the site itself.

Supabase free tier needs no credit card. Free projects pause after one week of inactivity; restore them from the dashboard before a demo.

---

## Run locally

A local server is required because ES modules do not load from `file://`.

```powershell
cd "D:\Code\mmu sharehub"
npx serve . -l 5500
```

or:

```powershell
py -m http.server 5500
```

Then open `http://localhost:5500`.

---

## Setup

1. Create a free project at <https://supabase.com>.
2. Paste the Project URL and publishable/anon key into `js/supabase-config.js`.
3. Run the whole of `supabase/migrations/0001_initial.sql` in the Supabase SQL Editor. Re-run it any time; it is idempotent.
4. Enable Email and Google providers under Authentication → Providers.
5. Set the Site URL and Redirect URLs under Authentication → URL Configuration. Supabase accepts exact base URLs here, for example `http://localhost:5500/` and `https://YOUR-PROJECT.vercel.app/`.
6. For Google, create a Web OAuth client in Google Cloud. Add `https://YOUR-PROJECT.supabase.co/auth/v1/callback` as an authorized redirect URI and add the Site URL as an authorized JavaScript origin.
7. Deploy to Vercel. Framework preset: **Other**. Build command: empty. Output directory: empty.

Full guides live in `docs/supabase-setup.md` and `docs/deployment.md`.

---

## Pages

| Page | What it does |
|---|---|
| `index.html` | Hero, sample/real recent notes, how it works |
| `browse.html` | Search, filters and sorting |
| `note.html` | Full note details, preview/download, report |
| `upload.html` | Sign-in gate, file validation, upload with progress |
| `profile.html` | Your account and your uploaded notes |
| `login.html` | Email/password, Google sign-in, password reset |
| `register.html` | Email/password or Google sign-up |

---

## Project structure

```text
index.html  browse.html  note.html  upload.html  profile.html
login.html  register.html  README.md  vercel.json
assets/       logo and favicon
css/          styles.css
docs/         setup, deployment and database policy guides
js/           app modules
supabase/     migrations/0001_initial.sql
```

Key modules:

- `js/security.js` — URL and UUID checks used before opening files
- `js/supabase.js`, `js/supabase-config.js` — SDK bootstrap and config
- `js/auth.js`, `js/auth-page.js` — sessions and auth forms
- `js/database.js` — note and report data access
- `js/main.js` — shared UI and navbar state
- `js/notes.js`, `js/note.js` — note cards and note detail page
- `js/upload.js`, `js/storage.js` — upload flow and file validation
- `js/profile.js`, `js/browse.js` — profile and library pages

---

## Security model

- Frontend checks are for feedback. Supabase RLS and Storage policies are the real boundary.
- Notes are public to read, but only the uploader can edit or delete them.
- Profiles are private to their owner. A trigger stops identity fields from changing.
- Storage files live under `notes/{user-id}/{note-id}/{file-name}` with a 20 MB limit, an extension allow-list and an owner-only write policy.
- `file_url` must point at this project's public notes bucket. The browser repeats that check before opening or downloading.
- Reports are private to the reporter. There is no moderation screen yet.

See `docs/database-policies.md` for the full rules and their limits.

---

## Testing

- `npx html-validate "*.html"` — HTML validation
- `npx esbuild "js/*.js" --outdir=<temp> --format=esm` — syntax check
- Browser smoke test on desktop and 390px mobile
- Supabase needs two real accounts for ownership tests

There is no automated test suite yet.

---

## Remaining work

- Add a moderation screen for reports.
- Add automated browser tests.
- Pin CDN scripts with Subresource Integrity once a build step is introduced.
- Run the two-account ownership test before a public launch.

---

## Disclaimer

MMU ShareHub is a student project and is not an official Multimedia University service. Users are responsible for what they upload.
