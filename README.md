# MMU ShareHub

A student-run note library for MMU students. Students who sat a paper upload their notes; everyone else can search, preview and download them for free.

No framework, no build step. Plain HTML, CSS and ES modules, with Supabase for accounts, data and files.

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

## Disclaimer

MMU ShareHub is a student project and is not an official Multimedia University service. Users are responsible for what they upload.
