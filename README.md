# VVIP · NeoVista — website & CMS

Astro 7 (Node adapter) + MariaDB. The public website (vapisvip.com) and a full admin
dashboard at `/admin` for pages, sections, properties, media, inquiries, analytics, SEO,
navigation, legal pages, settings, users and roles.

The original static site is preserved in [`legacy/`](legacy/) for reference only.
Architecture, security, API, deployment and backups: **[docs/CMS.md](docs/CMS.md)**.

## Quick start (local)

```bash
npm install
cp .env.example .env            # set DATABASE_*, APP_SECRET (openssl rand -hex 32), UPLOAD_DIR=./storage/uploads
npm run db:migrate              # create tables
npm run db:seed                 # import the existing website content, images and articles
npm run admin:create            # create your Super Admin (no default accounts exist)
npm run dev                     # http://localhost:4321  ·  admin: http://localhost:4321/admin
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (`dist/`) |
| `npm start` | Run the production server (`dist/server/entry.mjs`) |
| `npm run check` | Type-check |
| `npm run db:migrate` | Apply pending SQL migrations (`db/migrations`) |
| `npm run db:seed` | First-install content migration (`--reset` rebuilds content; never touches users or leads) |
| `npm run admin:create` | Create/reset an admin (interactive, or `ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD` env) |
| `npm run analytics:retention` | Delete analytics older than the configured retention |
| `deploy/backup.sh` | Database + media backup (cron) |

Deployment: **[deploy/DEPLOY.md](deploy/DEPLOY.md)** — `deploy/ecosystem.config.cjs` (PM2, port 4380),
`deploy/nginx/vapisvip.com.conf`, `deploy/backup.sh`, `.env.example`.

## What the dashboard manages

* **Pages & articles** — homepage and every page built from predefined, validated sections
  (add, edit, reorder by drag & drop, enable/disable, duplicate, delete), articles and legal
  documents in Markdown, drafts, preview, publish/unpublish, version history & restore,
  per-page SEO and social sharing.
* **Properties** — full CRUD with gallery (captions, filter categories, tile shapes), amenities,
  specifications, pricing, location, SEO; search, filters, sorting, pagination, bulk actions,
  duplicate, CSV export. Published properties appear automatically on `/properties.html`,
  the header dropdown, featured sections and the sitemap.
* **Media library** — uploads with content validation, responsive WebP variants, alt text,
  folders, search, replace-in-place, usage tracking, safe delete.
* **Inquiries** — every website form submission stored (with property, landing page, referrer
  and UTM attribution), statuses (new → converted/closed/spam), follow-ups, internal notes,
  change history, CSV export, Nodemailer notifications.
* **Analytics** — first-party, cookie-less: visitors, sessions, page views, engagement,
  sources (direct/organic/social/referral/campaign/email), devices, browsers, regions,
  landing/exit pages, conversions (forms, phone, email, WhatsApp, CTA clicks), date ranges
  and previous-period comparison.
* **SEO** — global defaults, health checks (missing/duplicate metadata, alt text, broken
  internal links, indexability, sitemap), optional Google Search Console data.
* **Navigation, settings, users & roles, activity log, account.**

## Public routes (all legacy URLs preserved)

`/`, `/index.html`, `/neovista.html`, `/properties.html`, `/blog-details.html`,
`/blog-details-2.html`, `/blog-details-3.html`, `/privacy-policy`, `/terms-and-conditions`,
plus any page created in the CMS. `/sitemap.xml` and `/robots.txt` are generated.
