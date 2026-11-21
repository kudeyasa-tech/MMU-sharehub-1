# MMU ShareHub

A free, student-run note-sharing website. Past students upload exam notes, and new
students browse, preview and download them — so good study material does not
disappear at the end of a semester.

Built by a solo first-year Computer Science student, with plain HTML, CSS and
JavaScript. No React, no build step, no framework.

> **Current status: Phase 5 in progress (Polish and launch).**
> The library now has note detail pages, related notes and a report flow.
> Remaining work is final two-account testing and the Vercel deployment, which
> needs your GitHub/Vercel accounts. Re-run the SQL migration to install the
> reports table and the missing Storage bucket.

---

## 1. What works right now

- [x] Responsive header, mobile menu and footer on every page
- [x] Home page with hero, search, recent notes and how-it-works sections
- [x] Browse page with working search, filters, sorting and shareable URLs
- [x] Note cards with file type, size, uploader and real preview/download actions
- [x] Login and register forms with native validation and password show/hide
- [x] Supabase Authentication: email/password + Google sign-in, logout, password reset
- [x] Session-aware navbar with an avatar + name for signed-in students
- [x] `profiles` rows created on sign-up and restored on later logins
- [x] Upload and profile pages gated by sign-in state
- [x] Drag-and-drop file selection with type and 20 MB validation
- [x] Real upload progress and Storage path `notes/{uid}/{noteId}/{filename}`
- [x] Note metadata saved to the `notes` table; orphaned files cleaned up
- [x] Browse and home pages read live notes when the tables exist
- [x] Signed-in profile shows real details and the student's uploads
- [x] Clean, minimal academic design (Notion / Google Drive / StuDocu vibes)
- [x] SQL migration with RLS policies and a 20 MB Storage bucket
- [x] Setup, security and deployment guides in `docs/`
- [x] No build step — open it with a local web server and it runs

### What is not connected yet

| Feature | Phase |
|---|---|
| Moderate reported notes in an admin view | Later |
| Production testing and Vercel deployment | Phase 5 (needs your accounts) |

Sample notes are used only until the SQL migration is run. After that, the
library reads your real Supabase data.

---

## 2. Why Supabase instead of Firebase?

Firebase Auth and Firestore are free, but **Firebase Storage requires a credit
card** (the Blaze plan). Supabase Free needs no card and includes Auth, Postgres
and 1 GB of file storage in one place.

| Service | Supabase Free |
|---|---|
| Authentication | Yes, up to 50k MAU |
| Database | 500 MB Postgres |
| File storage | 1 GB, 50 MB per file |
| Cost | $0, no card |

Free projects pause after 1 week of inactivity. Restore them from the dashboard
before a demo. See `docs/supabase-setup.md`.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | HTML5, CSS3, vanilla ES modules | Beginner-friendly and easy to explain |
| Auth | Supabase Auth (email/password) | Handles passwords, sessions and reset emails |
| Database | PostgreSQL via Supabase | RLS policies protect each row |
| File storage | Supabase Storage (Phase 3) | Public bucket, 20 MB limit |
| Hosting | Vercel free tier | Static hosting with a Git-based workflow |
| Version control | Git + GitHub | Free, familiar and required for Vercel |

The Supabase JS SDK is loaded from a CDN with dynamic ES module imports, so
there is no `npm install` and no bundler. It is only downloaded after you paste
a real config, which keeps offline development clean.

---

## 4. Requirements

- A modern browser (Chrome, Edge, Firefox or Safari)
- Python 3 **or** Node.js, to run a local web server
- A Supabase account (free, no card)
- A GitHub account
- A Vercel account (can sign in with GitHub)

---

## 5. Run the project locally

```powershell
cd "D:\Code\mmu sharehub"
python -m http.server 5500
```

Then open:

```text
http://localhost:5500
```

Stop the server with `Ctrl + C`.

If `python` is not recognised, try `py -m http.server 5500`.

Node.js alternative: `npx serve . -l 5500`.

### Why not double-click `index.html`?

The project uses `<script type="module">`. Browsers block module imports on
`file://` URLs for security reasons. A local server makes the pages behave the
same way they will on Vercel.

### Test the Phase 3 build

Before running the SQL migration, sample notes still load. After the migration:

1. Register an account. The navbar changes to your name + **Log out**.
2. Open `profile.html` — your name, email and join date come from Supabase.
3. Open `upload.html`, choose a PDF or image, and watch the progress bar.
4. You land on `browse.html` with a toast confirming the note is live.
5. Open **Preview** in a new tab, then try **Download**.
6. Reopen `profile.html` — your upload is listed with its size and subject.
7. Try selecting an `.exe` file: upload.js and the Storage bucket both reject it.
8. Try uploading without signing in: the gate blocks the form.

If you see a 404 for `/rest/v1/notes` in the console, the SQL migration has not
been run yet. See `docs/supabase-setup.md`.

---

## 6. Project structure

```text
mmu-sharehub/
├── index.html                  Home page
├── browse.html                 Browse + search + filters
├── note.html                   Note details + report form
├── upload.html                 Upload gate and upload form
├── profile.html                My notes / profile
├── login.html                  Login form
├── register.html               Registration form
│
├── css/
│   └── styles.css              All styles and responsive breakpoints
│
├── js/
│   ├── supabase-config.js      Paste Supabase URL and anon key here
│   ├── supabase.js             Shared SDK bootstrap (CDN)
│   ├── auth.js                 Register, login, logout, reset, auth state
│   ├── auth-page.js            Login/register form controller
│   ├── main.js                 Navbar, gates, toasts, password toggles, notes
│   ├── database.js             Data layer; sample data now, Postgres later
│   ├── notes.js                Shared note-card renderer + escaping helpers
│   ├── browse.js               Search, filters and sorting
│   ├── storage.js              File type/size validation (upload in Phase 3)
│   ├── mock-data.js            Offline sample notes
│   ├── upload.js               Upload form with progress
│   ├── note.js                 Note detail page + report form
│   └── profile.js              Profile details and note management
│
├── supabase/
│   └── migrations/
│       └── 0001_initial.sql    Tables, RLS policies and Storage bucket
│
├── assets/
│   ├── favicon.svg
│   └── logo-mark.svg
│
├── docs/
│   ├── supabase-setup.md       Step-by-step Supabase guide
│   ├── database-policies.md    RLS explanation and threat model
│   └── deployment.md           Vercel + GitHub guide
│
├── vercel.json                 Vercel clean URLs + security headers
├── .gitignore
└── README.md
```

### Which files should you change later?

- **Phase 3:** `js/storage.js`, `js/upload.js`, `js/database.js`, `upload.html`.
- **Phase 4:** `js/database.js`, `js/browse.js`, `js/profile.js`, `profile.html`.
- **Phase 5:** no code change needed for a static Vercel deployment.

Phase 2 is implemented in `js/supabase.js`, `js/auth.js`, `js/auth-page.js`,
`js/main.js`, `js/profile.js`, `login.html` and `register.html`.

---

## 7. Pages

| Page | Guest | Signed-in student |
|---|---|---|
| `index.html` | Browse recent notes and search | Same |
| `browse.html` | Search, filter, preview and download | Same |
| `login.html` / `register.html` | Create account / log in | Redirect to profile |
| `upload.html` | See sign-in gate | Upload form (publishing in Phase 3) |
| `profile.html` | See sign-in gate | Real profile details (note list in Phase 4) |

The navbar contains both a `.auth-guest` block and a hidden `.auth-user` block.
`watchAuthState()` shows the correct one as soon as the Supabase session is known.

---

## 8. How the offline sample data works

The sample library uses `js/mock-data.js` and the public functions in
`js/database.js`:

```js
import { getNotes, filterNotes } from "./database.js";

const notes = await getNotes();
const results = filterNotes(notes, {
  query: "database",
  faculty: "Business",
  year: "Year 2",
  sort: "newest",
});
```

The field names match the planned `notes` table. In Phase 4, only the inside of
`getNotes()` changes to a Supabase query; the pages keep using the same
interface.

Sample notes are clearly labelled in the UI. They do not represent real uploads.

---

## 9. Database model

### `profiles`

```js
{
  id: "supabase-auth-uuid",
  email: "student@student.mmu.edu.my",
  name: "Aisyah Rahman",
  created_at: "2026-11-21T..."
}
```

- Read, insert and update: owner only
- No client-side delete
- The email is not public

### `notes`

```js
{
  id: "uuid",
  title: "Database Systems — Final Revision Notes",
  subject: "Database Systems",
  faculty: "Computing & Informatics",
  year: "Year 2",
  description: "Normalization, SQL joins and exam-style practice questions.",
  file_url: "https://...supabase.co/storage/v1/object/public/notes/...",
  file_type: "PDF",
  file_size: 4800000,
  uploader_id: "supabase-auth-uuid",
  uploader_name: "Aisyah Rahman",
  created_at: "2026-11-21T..."
}
```

- Read: anyone
- Insert: signed-in user whose UID matches `uploader_id`
- Update/delete: uploader only

Full rules and limitations are in `docs/database-policies.md`.

---

## 10. Security notes

Full details: [`docs/database-policies.md`](docs/database-policies.md).

The short version:

1. **Frontend checks are UX, not security.** A user can bypass JavaScript.
   Supabase RLS enforces ownership server-side.
2. **Guests can read notes but cannot write.** Writing requires a signed-in owner.
3. **Storage paths include the UID.** A user can only write inside
   `notes/{their-uid}/...`.
4. **The anon key is public.** Never put a `service_role` key in frontend code.
5. **Escape database text before inserting it into HTML.** `js/notes.js` does
   this with `escapeHtml()`.
6. **Virus scanning is out of scope.** Blocking executables reduces risk, but a
   PDF or DOCX can still contain malicious content.
7. **Free projects pause after a week of inactivity.** Restore before a demo.

---

## 11. Supabase setup (summary)

Full walkthrough: [`docs/supabase-setup.md`](docs/supabase-setup.md).

1. Create a free project at <https://supabase.com>.
2. Copy the Project URL and anon key from Project Settings → API.
3. Paste them into `js/supabase-config.js`.
4. Run `supabase/migrations/0001_initial.sql` in the SQL Editor.
5. Check Authentication → Email provider.
6. Add the exact `http://localhost:5500/` to Auth Redirect URLs (no wildcard).
7. Register a test account and check `profiles` in Table Editor.
8. Continue with Phase 2 testing above.

The project is **still fully usable offline** before any of this is done.

---

## 12. GitHub setup

```powershell
git init -b main
git add .
git commit -m "Phase 1 + 2: UI foundation and Supabase authentication"
```

Create an empty repository on GitHub (no README, no `.gitignore`), then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/mmu-sharehub.git
git push -u origin main
```

Before each phase:

```powershell
git add .
git commit -m "Phase 3: file uploads and note metadata"
git push
```

---

## 13. Deploy to Vercel

Full walkthrough: [`docs/deployment.md`](docs/deployment.md).

1. Push the project to GitHub.
2. In Vercel: **Add New → Project → Import** your repository.
3. Framework preset: **Other**.
4. Build command: leave empty.
5. Output directory: leave empty (project root).
6. Deploy.
7. Add your `*.vercel.app` domain to Supabase Auth → URL Configuration.
8. Run the SQL migration in the production Supabase project.

Vercel hosts the static files. It does **not** configure Supabase.

---

## 14. Phase roadmap

### Phase 1 — Setup and UI foundation ✅

- Folder structure and Git-ready project
- All six pages and responsive design
- Offline sample data, search, filters and sort
- Auth/upload/profile gates

### Phase 2 — Authentication ✅ (this build)

- Shared Supabase bootstrap with a CDN SDK
- Register, log in, log out, password reset and session persistence
- `profiles` rows with RLS policies
- Session-aware navbar and protected upload/profile panels
- Real profile details and friendly error messages
- Clean, minimal academic redesign across all pages

### Phase 3 — Storage and uploads ✅ (this build)

- Upload form connected to Supabase Storage with real progress
- Drag-and-drop file selection with type and 20 MB validation
- Metadata saved to the `notes` table; orphaned files cleaned up
- Preview and download buttons use public file URLs
- Browse and home pages read live notes when the tables exist
- Profile lists the signed-in student's uploads

### Phase 4 — Note management ✅ (this build)

- Edit title, subject, faculty, year and description from the profile page
- Delete a note and its Storage file with a confirmation dialog
- Database trigger prevents changing file or ownership fields
- Profile lists live uploads with real counts and quick actions

### Phase 5 — Polish and launch (this build)

- Note detail pages with full description, file actions and related notes
- Private report flow for copyrighted, confidential, plagiarised or broken notes
- Report table with RLS in the SQL migration
- Responsive polish and full-page smoke tests
- Deployment checklist is ready; Vercel deployment needs your GitHub/Vercel login

### Final launch checklist (remaining)

- Test all auth, upload, preview, download, edit, delete and report flows
- Test RLS with a second account
- Deploy to Vercel and smoke-test production
- Add the production domain to Supabase Site URL + Redirect URLs

---

## 15. Beginner troubleshooting

### “The page looks unstyled” or “Failed to load module script”

You opened the HTML file directly. Run a local server (section 5).

### “Supabase is not configured yet”

Paste your project URL and anon key into `js/supabase-config.js` and reload.
Until then the site stays in guest mode with sample notes.

### “row level security” / `42501`

The SQL migration was not run, or you are trying to write someone else's row.
Run `supabase/migrations/0001_initial.sql` in the Supabase SQL Editor.

### “Email not confirmed”

Supabase email confirmation is on by default. Open the confirmation link, or
turn confirmation off in Authentication → Providers → Email for a classroom demo.

### The sample cards do not appear

Open the browser console. `js/main.js` uses top-level `await` and ES modules;
the page must be served over HTTP and the browser must be modern.

### A Vercel URL works without `.html`

`vercel.json` enables clean URLs. Vercel redirects `/browse.html` to `/browse`.
Both forms work. Links inside the project use `.html`, which is fine.

---

## 16. Licence and affiliation

This is a student project. It is **not** an official Multimedia University
service or website. Use the name and branding responsibly.

You may add an MIT licence if you plan to publish the source publicly.
