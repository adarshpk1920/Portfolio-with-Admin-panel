# Interactive Portfolio Website with Admin Panel

A modern, responsive portfolio website with a secure admin panel. All portfolio content (case studies, images, categories and the homepage text) is managed from the dashboard, with no code edits needed. New projects appear on the public site as soon as they are published, and each one gets its own case-study page.

**Live demo:** `<add your deployment URL here>`
**Admin panel:** `<deployment URL>/admin`

| Admin login | |
|---|---|
| Email | `admin@portfolio.dev` |
| Password | `Admin@12345` |

> These are the default credentials, set by `ADMIN_EMAIL` / `ADMIN_PASSWORD` the first time the app starts. You can change them later under **Admin → Account**.

---

## Features

### Public website
- **Landing page** with Hero, About, Services and Portfolio sections plus a working **Contact** form (messages go to the admin inbox).
- **Responsive** layouts for mobile, tablet and desktop, with a collapsible mobile menu.
- **Animations and interactivity:** headline word-by-word reveal, a typing effect, scroll-triggered reveals, animated counters, a scroll progress bar, 3D tilt cards, magnetic buttons, a cursor glow, a spotlight hover on service cards, floating hero cards with parallax, an infinite tech marquee, animated category filters and an image lightbox.
- **Dark / light theme** toggle, saved per visitor, with no flash on load.
- **Dynamic case-study pages** (`/projects/:slug`) showing client, role, year, tech stack, rich Markdown content, a gallery, previous/next navigation and related projects.
- Accessible: semantic HTML, skip link, keyboard focus styles, ARIA labels, and `prefers-reduced-motion` support.

### Admin panel (`/admin`)
- **Secure sign-in and logout** (details in the security section below).
- **Dashboard** with stats (total / published / drafts / unread messages), recent projects and the latest messages.
- **Projects:**
  - Create, edit and delete projects.
  - Fields: title, auto slug, category, summary, Markdown case study (with a formatting toolbar and live preview), client, role, year, tech stack, live and repo URLs.
  - **Cover image upload** with instant preview, plus **gallery uploads** (up to 12 images, with captions and per-image removal).
  - **Publish / unpublish** with one click from the list or the editor.
  - **Featured** flag.
  - Reorder projects (this order controls the public site).
  - Search and filter by status or category.
  - **Preview drafts** before publishing.
- **Categories:** add, rename and delete. Projects in a deleted category become uncategorised rather than deleted.
- **Messages:** contact-form inbox, with read/unread, reply by email and delete.
- **Site content:** edit the hero text, rotating specialities, about text, stats, contact details and social links.
- **Account:** change your name, login email and password.

### Security
- Passwords hashed with **bcrypt** (cost 12). Login runs in constant time whether or not the email exists.
- **Session cookies**: `httpOnly`, `SameSite=Lax`, `Secure` in production, 8-hour rolling expiry. The **session ID is regenerated on login** to prevent session fixation. Sessions are stored in SQLite.
- **CSRF protection** (synchroniser token) on every admin form and request that changes data.
- **Rate limiting** on login (10 failed attempts per 15 min) and on the contact form. The contact form also has a honeypot field to catch spam bots.
- **Helmet** security headers with a strict **Content Security Policy** (no inline scripts).
- **Upload hardening**: an allow-list of image MIME types, **file signature (magic byte) checks**, a size limit, random file names, no SVG uploads, and files from failed requests are cleaned up.
- **Markdown is sanitised** (`sanitize-html`) before rendering, so stored content cannot inject scripts.
- Every SQL query uses prepared statements.

---

## Tech stack

| Layer | Choice |
|---|---|
| Server | Node.js 20+, Express 5 |
| Views | EJS (server-rendered, SEO-friendly) |
| Database | SQLite via `better-sqlite3` (WAL mode, foreign keys, indexes) |
| Auth | `express-session` with a SQLite session store, `bcryptjs` |
| Uploads | `multer`, stored on disk under `DATA_DIR/uploads` |
| Security | `helmet`, `express-rate-limit`, CSRF middleware, `sanitize-html` |
| Frontend | Vanilla JS and modern CSS (no framework, no build step) |
| Tests | `node:test` + `supertest` (14 integration tests) |

## Project structure

```
server.js                 App entry point
src/
  app.js                  Express setup: security headers, sessions, error handling
  config.js               Environment configuration
  db.js                   Schema migrations + first-run seed
  seed-data.js            Demo content (editable in the admin)
  models.js               Data-access layer (all SQL lives here)
  lib/util.js             slugify, Markdown rendering + sanitising, URL validation
  lib/render-project.js   Shared case-study renderer (public page + admin preview)
  middleware/             auth/CSRF/flash, upload validation, SQLite session store
  routes/public.js        Landing page, case-study pages, contact form
  routes/admin.js         Login/logout, dashboard, projects, categories, messages, settings, account
views/                    EJS templates (public + admin)
public/                   CSS, JS, images
test/app.test.js          Integration tests
```

### Database schema
`users`, `projects`, `project_images` (cascade delete), `categories` (`ON DELETE SET NULL` on projects), `messages`, `settings` (key/value), `sessions`.

---

## Run locally

```bash
npm install
cp .env.example .env      # optional: change the admin credentials / secret
npm start                 # http://localhost:3000  ·  admin: http://localhost:3000/admin
npm test                  # run the integration tests
```

On first start, the database is created in `./data` and filled with six sample case studies. Delete the `data/` folder to reset everything.

## Deployment

The database and uploaded images live in `DATA_DIR`. **The host must give `DATA_DIR` a persistent disk or volume**, or content will be lost on redeploy.

### Render (recommended)
1. Push this repo to GitHub.
2. On Render, choose **New → Blueprint** and select the repo. `render.yaml` sets up the web service, a 1 GB persistent disk and a generated `SESSION_SECRET`.
3. Set `ADMIN_PASSWORD` when prompted, then deploy.

### Railway / Fly.io / any Docker host
A `Dockerfile` is included. Mount a volume at `/data` and set these variables:

```
NODE_ENV=production
SESSION_SECRET=<long random string>
ADMIN_EMAIL=admin@portfolio.dev
ADMIN_PASSWORD=<your password>
```

### Environment variables
| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | – | `production` turns on secure cookies, proxy trust and caching |
| `SESSION_SECRET` | random | **Required in production.** Signs session cookies |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | see `.env.example` | First admin account (created only when no users exist) |
| `DATA_DIR` | `./data` | SQLite database + uploads location |
| `MAX_UPLOAD_MB` | `5` | Max size per image |
