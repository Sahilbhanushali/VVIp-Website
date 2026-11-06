# VVIP CMS — architecture, operations & deployment

The public website and the admin dashboard are one Astro 7 application running on Node
(`@astrojs/node`, standalone) with MariaDB. Public pages are rendered from the database and
cached in memory; every publish purges the cache, so changes are live immediately while
repeat requests are served in ~2 ms.

```
Browser ──► Nginx (TLS, gzip, /media & /_astro from disk) ──► Node (PM2) ──► MariaDB
                                                               └─► UPLOAD_DIR (media files)
```

## 1. Code map

| Area | Location |
| --- | --- |
| Public catch-all route (every CMS page) | `src/pages/[...path].astro` |
| Section components (one per predefined section type) | `src/components/sections/*` |
| Article / legal / 404 templates | `src/components/templates/*` |
| Admin screens | `src/pages/admin/**` (layout: `src/layouts/AdminLayout.astro`) |
| Admin & public APIs | `src/pages/api/**` |
| Request pipeline (auth, CSRF, cache, maintenance, headers) | `src/middleware.ts` |
| Business logic (no UI) | `src/server/*.ts` — `auth`, `permissions`, `content`, `admin-pages`, `admin-properties`, `admin-media`, `media`, `inquiries`, `analytics`, `settings`, `seo-insights`, `gsc`, `mailer`, `markdown`, `cache`, `db`, `crypto` |
| Section schemas (server validation) | `src/server/sections.ts` |
| Section/property/settings form specs (admin UI) | `src/scripts/admin/*-fields.ts`, rendered by `form-builder.ts` |
| Migrations | `db/migrations/*.sql` (`npm run db:migrate`) |
| Content migration from the original site | `scripts/seed.ts` + `db/seed-assets/` |

## 2. Content model

* **Pages** — every public URL is a row in `pages` with an explicit `path`, so legacy URLs
  (`/index.html`, `/neovista.html`, `/blog-details*.html`) keep working. Templates:
  `home`, `standard` (built from sections), `property`, `article` (Markdown), `legal` (Markdown).
* **Sections** — `page_sections` rows of a predefined type (Hero, Campaign, About, Featured
  property, Tower explorer, Gallery, Amenities, Brand story, Latest articles, Contact, FAQ,
  Location, Property overview, Experiences grid, Testimonials, Rich text, Property listing).
  Each type has a strict Zod schema; editors change content, never markup.
* **Drafts & publishing** — editors change a working copy. *Publish* stores an immutable
  snapshot in `page_revisions`; the public site only ever reads published snapshots.
  `?preview=1` shows the working copy to signed-in users. The last 30 versions can be restored.
* **Properties** — `properties` + `property_images` (caption, filter category, tile shape),
  `property_amenities`, `property_specs`, `property_categories`. Each property owns a
  companion page at `/<slug>.html`; publishing/unpublishing the property publishes/unpublishes
  the page, adds/removes it from `/properties.html`, the header dropdown and the sitemap.
* **Media** — files in `UPLOAD_DIR/<random key>/w{240,480,960,1600,2560}.webp`
  (or `video.mp4|webm`); only metadata is in the database.
* **Settings** — typed JSON values per key (`site`, `contact`, `social`, `header`, `footer`,
  `seo`, `analytics`, `cookie_consent`, `maintenance`, `mail`, `enquiry_types`).
* **Navigation** — `navigation_items` for `header` (with dropdowns: latest articles,
  properties, or own sub-links), `footer`, `legal`.

## 3. Security

* Argon2id password hashes; no default credentials; no public registration.
* Session token = 256-bit random value in an `HttpOnly`, `SameSite=Lax`, `Secure` (production)
  cookie; only its SHA-256 is stored. 12-hour lifetime, 2-hour idle timeout.
* Per-session CSRF token required on every mutating admin API call; same-origin checks on
  unauthenticated endpoints; Astro `checkOrigin` for form posts; `security.allowedDomains`
  pins trusted hosts.
* Login: 5 failures lock the account for 15 minutes; 20 failures per IP per 15 minutes are
  refused; responses never reveal whether an email exists. Password reset links expire after
  30 minutes, are single-use and end all sessions.
* Role-based access control checked **server-side** on every API route
  (`requirePerm(module, action)`); the role matrix is editable under *Users & roles*.
  Roles: Super Admin, Administrator, Editor, Analytics Viewer.
* Uploads are validated by decoding the file (not by extension/MIME), re-encoded (EXIF
  stripped), stored under random names; SVG/HTML/executables are rejected; size limits 15 MB
  (images) / 80 MB (video); path traversal is impossible by construction.
* Markdown never renders raw HTML; link schemes are restricted.
* The SMTP password stored in Settings is AES-256-GCM encrypted with `APP_SECRET` and is
  write-only in the UI. `SMTP_*` environment variables take precedence.
* Analytics: random anonymous IDs, no cookies, no raw IPs, Global Privacy Control respected,
  optional consent banner, bots and signed-in admins excluded, configurable retention.
* Activity log records sign-ins, edits, publishing, deletions, exports and settings changes.

## 4. API reference (all under `/api/admin`, JSON, CSRF header `X-CSRF-Token` on writes)

| Endpoint | Methods | Permission |
| --- | --- | --- |
| `auth/login`, `auth/forgot`, `auth/reset` | POST | public (same-origin, rate-limited) |
| `auth/logout`, `auth/password` | POST | signed in |
| `pages`, `pages/:id` | GET, POST / GET, PUT, DELETE | pages:read/create/update/delete |
| `pages/:id/{publish,unpublish,duplicate,restore,add-section,reorder}` | POST | pages:publish / create / update |
| `sections/:id` | PUT, POST (duplicate), DELETE | pages:update |
| `properties`, `properties/:id`, `properties/bulk`, `properties/export` | … | properties:* |
| `categories` | POST | properties:update |
| `media`, `media/:id` (POST = replace file) | GET, POST, PUT, DELETE | media:* |
| `inquiries`, `inquiries/:id`, `inquiries/:id/{notes,resend}`, `inquiries/bulk`, `inquiries/export` | … | inquiries:* |
| `analytics-export` | GET | analytics:export |
| `navigation` | PUT | navigation:update |
| `settings/:key`, `settings/tools` | PUT / POST | settings:manage (seo key: seo:update) |
| `users`, `users/:id`, `roles` | … | users:* |
| `search`, `markdown` | GET / POST | filtered by read permissions |

Public: `POST /api/inquiry` (same contract as the old `mail.php`: `{ success, message, errors }`),
`POST /api/track` (analytics beacon), `GET /media/*`, `GET /sitemap.xml`, `GET /robots.txt`.

## 5. Deployment

Server-specific runbook (paths, port, Nginx, PM2, cron): **[deploy/DEPLOY.md](../deploy/DEPLOY.md)**.

* App: `/var/www/projects/vvip` · PM2 process `vvip` · Node on `127.0.0.1:4380`
* Nginx: `/etc/nginx/sites-available/vapisvip.com.conf` (source: `deploy/nginx/vapisvip.com.conf`)
* Uploads: `/var/www/projects/vvip/storage/uploads` (git-ignored, survives deploys)

## 6. Backups & restore

`deploy/backup.sh` writes a consistent `mysqldump --single-transaction` and a tarball of the
uploads to `BACKUP_DIR` (default `~/backups/vvip`), keeping 14 days. Copy them off the
server (e.g. `rclone`/S3) for disaster recovery.

```bash
gunzip -c db-YYYYMMDD-HHMM.sql.gz | mariadb -u root vvip_cms
tar -xzf media-YYYYMMDD-HHMM.tar.gz -C /var/www/projects/vvip/storage
pm2 reload vvip
```

## 7. Migrations

Add a new file `db/migrations/NNN_description.sql`; `npm run db:migrate` applies pending files
in order and records them in `schema_migrations`. Never edit an applied migration.

## 8. Optional: Google Search Console

Create a service account with the Search Console API enabled, save its JSON key outside the
web root, set `GSC_SERVICE_ACCOUNT_FILE`, add the service-account email as a user on the
Search Console property, and enter the property (e.g. `sc-domain:vapisvip.com`) in
*SEO → Global SEO*. Until then the SEO screen states that it is not connected — no search
numbers are ever estimated.

## 9. Operational notes

* Run a single PM2 instance (rate limits are per process). The HTML cache is invalidated
  across processes through a version counter in the database if you scale out.
* Email failures never lose a lead: inquiries are stored first; the notification status is
  shown per inquiry with a *Resend* button. Use *Settings → Forms & email → Send test email*.
* Maintenance mode returns HTTP 503 with `Retry-After` to visitors; signed-in admins still see
  the full site.
* Time zone: timestamps are stored in UTC; the admin displays `APP_TIMEZONE`, and analytics
  days follow `APP_TZ_OFFSET`.
