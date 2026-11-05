# VVIP · NeoVista — website

Astro 7 static site for **NeoVista by Odhav Developers** (vapisvip.com).
The original jQuery/Bootstrap site is preserved untouched in [`legacy/`](legacy/) for reference.

## Commands

| Command           | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `npm install`     | Install dependencies (Node 20+)                                 |
| `npm run dev`     | Dev server at http://localhost:4321 (the form needs PHP, see below) |
| `npm run build`   | Production build into `dist/`                                   |
| `npm run preview` | Serve the production build                                       |
| `npm run check`   | Type-check all `.astro` / `.ts` files                            |

To test the enquiry form locally, serve the build with PHP: `php -S 127.0.0.1:4321 -t dist`.

## Deploying

Upload the **contents of `dist/`** to the Apache/PHP host. It contains the static pages plus
`mail.php`, PHPMailer (`assets/mailer/…`), `.htaccess` (caching, gzip, 404 page), `robots.txt`
and `sitemap.xml`.

## Routes (all legacy URLs preserved)

| URL                     | Source                                   |
| ----------------------- | ---------------------------------------- |
| `/`, `/index.html`      | `src/pages/index.astro`                  |
| `/neovista.html`        | `src/pages/neovista.astro` (new property detail page) |
| `/blog-details.html`    | `src/content/blog/blog-details.md`       |
| `/blog-details-2.html`  | `src/content/blog/blog-details-2.md`     |
| `/blog-details-3.html`  | `src/content/blog/blog-details-3.md`     |
| `/404.html`             | `src/pages/404.astro`                    |
| `/sitemap.xml`          | `src/pages/sitemap.xml.ts` (generated)   |

`build.format: 'file'` makes Astro emit `name.html` files, so every old URL and in-page anchor
(`#about-sec`, `#property-sec`, `#blog-sec`, `#contact-sec`, `#contact-sec1`, `#service-sec`, `#hero`) still works.

To add an article, drop a Markdown file in `src/content/blog/`; the file name becomes the URL.

## Structure

```
src/
  data/site.ts          all business content: contact, nav, stats, towers, amenities, gallery, FAQ
  content/blog/*.md     articles (typed frontmatter in src/content.config.ts)
  layouts/BaseLayout    <head>/SEO/fonts, header, footer, visit dialog, scroll-top
  components/           Header, Footer, ContactForm, VisitDialog, Gallery, Faq, Location, BlogCard…
  components/home/      Hero, Campaign, About, Signature, Towers, Amenities, Symbol, Insights, Contact
  scripts/main.ts       header, menu, dialogs, reveals, parallax, counters, active nav
  scripts/forms.ts      enquiry form → mail.php (same contract as the original jQuery handler)
  styles/global.css     design tokens, type scale, buttons, motion primitives, prose
  assets/images/        source images (Astro generates responsive WebP at build time)
public/                 mail.php, PHPMailer, favicons, amenity icons, .htaccess, robots, og-image
```

## Design system

- **Brand (unchanged):** charcoal `#1A1A1A` / ink `#0D0D0C`, bronze `#BF7840` with the
  `#FCC280 → #AB612E` icon gradient; Montserrat (headings) + Open Sans (body), self-hosted
  through Astro's font API with metric-matched fallbacks (no layout shift, no Google Fonts request).
- **Tokens:** `--container` 1360px, fluid `--gutter` (18→48px), `--section`, `--section-head-gap`,
  `--grid-gap`, `--stack` and fluid `clamp()` type scale, all in `src/styles/global.css`.
- **Motion:** CSS transitions + IntersectionObserver + Web Animations API, no animation library.
  Word-by-word heading reveals, clip-path image reveals, parallax, cross-document view transitions.
  Everything respects `prefers-reduced-motion`, and content stays visible without JavaScript.

## Interactive features

Intro curtain (once per session, skippable) · scroll-aware header with active-section state and a
Blogs dropdown · full-screen menu (`<dialog>`) · “Schedule a visit” modal · campaign carousel
(progress bars, swipe, keys, pause) · tower explorer (ARIA tabs, arrow keys) · signature
experience selector (auto-advance, pausable) · gallery with category filters (FLIP animation)
and keyboard/swipe lightbox · amenities scroll-snap strip · FAQ accordion · reading progress bar
on articles · count-up stats · scroll-to-top progress ring.

## Known follow-ups (not changed in this migration)

- `public/mail.php` contains the SMTP2Go password in plain text and it is in git history.
  Rotate it and load it from an environment variable or a file outside the web root.
- `mail.php` uses `FILTER_SANITIZE_STRING`, deprecated since PHP 8.1. It works today, but should be
  replaced with `htmlspecialchars()`-based handling before a PHP 9 upgrade.
