#!/usr/bin/env node
/**
 * Content migration: moves the existing website (copy, images, articles,
 * navigation, contact details) into the CMS database. Run once after
 * `npm run db:migrate`. Refuses to overwrite existing content unless
 * `--reset` is passed (which wipes content tables — never users or leads).
 *
 *   node scripts/seed.ts            # first install
 *   node scripts/seed.ts --reset    # rebuild content from the original site
 */
import fs from 'node:fs';
import path from 'node:path';
import { all, one, run, pool } from '../src/server/db.ts';
import { storeUpload, type Media } from '../src/server/media.ts';
import { DEFAULT_ROLES, MODULE_ACTIONS, MODULES } from '../src/server/permissions.ts';
import { parseSection } from '../src/server/sections.ts';
import { SETTINGS_SCHEMAS } from '../src/server/settings.ts';
import { publishPage } from '../src/server/content.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'db', 'seed-assets');
const reset = process.argv.includes('--reset');

/* ─────────────── roles & permissions (always reconciled) ─────────────── */
for (const m of MODULES) for (const a of MODULE_ACTIONS[m]) await run('INSERT IGNORE INTO permissions (module, action) VALUES (?,?)', [m, a]);
const permRows = await all<{ id: number; k: string }>("SELECT id, CONCAT(module, ':', action) AS k FROM permissions");
const permId = new Map(permRows.map((r) => [r.k, r.id]));
for (const r of DEFAULT_ROLES) {
  await run('INSERT INTO roles (slug, name, description, is_system) VALUES (?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)', [r.slug, r.name, r.description]);
  const role = (await one<{ id: number }>('SELECT id FROM roles WHERE slug = ?', [r.slug]))!;
  const has = await one<{ n: number }>('SELECT COUNT(*) AS n FROM role_permissions WHERE role_id = ?', [role.id]);
  if (!has?.n || r.slug === 'super_admin') {
    await run('DELETE FROM role_permissions WHERE role_id = ?', [role.id]);
    for (const p of r.perms) if (permId.has(p)) await run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)', [role.id, permId.get(p)]);
  }
}
console.log('✓ roles & permissions');

const existing = await one<{ n: number }>('SELECT COUNT(*) AS n FROM pages');
if (existing!.n > 0 && !reset) {
  console.log('Content already exists — skipping content migration (use --reset to rebuild it).');
  await pool().end();
  process.exit(0);
}
if (reset) {
  for (const t of ['page_revisions', 'page_sections', 'pages', 'navigation_items', 'property_images', 'property_amenities', 'property_specs', 'properties', 'property_categories', 'settings', 'media'])
    await run(`DELETE FROM ${t}`);
  console.log('✓ content tables cleared');
}

/* ─────────────────────────────── media ─────────────────────────────── */
const M: Record<string, Media> = {};
async function media(key: string, file: string, alt: string, folder: string, description?: string) {
  const buf = fs.readFileSync(path.join(ASSETS, 'images', file));
  M[key] = await storeUpload(buf, path.basename(file), { alt, folder, description });
  process.stdout.write('.');
  return M[key];
}
await media('logo', 'brand/say-yes-logo.png', 'VVIP — Say Yes', 'brand');
await media('key', 'brand/key.png', 'Golden key', 'brand');
await media('banner', 'brand/neovista-banner.jpg', 'NeoVista — Crafted with business sense', 'brand');
await media('towers', 'neovista-towers.jpg', 'NeoVista twin commercial towers at Char Rasta, Vapi', 'property');
await media('facade', 'neovista-facade.jpg', 'NeoVista façade with twin towers and landscaped podium', 'property');
await media('showroom', 'showroom-space.jpg', 'Tower A’s dedicated retail showrooms at street level, with luxury brand storefronts', 'property');
await media('say1', 'campaign/say-yes-01.jpg', 'NeoVista Vapi luxury commercial property — VVIPs, it’s time to Say Yes', 'campaign');
await media('say2', 'campaign/say-yes-02.jpg', 'NeoVista Vapi business towers — VVIPs, it’s time to Say Yes', 'campaign');
await media('say3', 'campaign/say-yes-03.jpg', 'NeoVista Vapi luxury offices — VVIPs, it’s time to Say Yes', 'campaign');
await media('valet', 'features/valet.jpg', 'Valet attendant receiving car keys at the NeoVista porte-cochère', 'property');
await media('dropoff', 'features/drop-off.jpg', 'Covered vehicle drop-off bay with timber ceiling and feature lighting', 'property');
await media('foyer', 'features/foyer.jpg', 'Double-height reception foyer with lounge seating and glazed façade', 'property');
await media('passage', 'features/passage.jpg', 'Marble lift lobby passage with gallery displays', 'property');
await media('blog1', 'blog/odhav-commitment.jpg', 'Odhav Developers Commercial Property in Vapi, Gujarat - NeoVista Business Towers', 'blog');
await media('blog2', 'blog/vapi-skyline.jpg', 'Vapi Commercial Hub Transformation', 'blog');
const amenityFiles: [string, string, string][] = [
  ['Art Gallery Foyer', 'art-gallery', 'amenities/art-gallery.jpg'], ['Well Ventilated', 'ventilated', 'amenities/ventilated.jpg'],
  ['Car Lift', 'car-lift', 'amenities/car-lift.jpg'], ['CCTV', 'cctv', 'amenities/cctv.jpg'], ['Check-In Point', 'check-in', 'amenities/check-in.jpg'],
  ['Entrance Lobby', 'lobby', 'amenities/lobby.jpg'], ['Fire Extinguisher', 'fire-safety', 'amenities/fire-safety.jpg'], ['Lifts', 'lifts', 'amenities/lifts.jpg'],
  ['Wide Passage', 'wide-passage', 'amenities/wide-passage.jpg'], ['Security', 'security', 'amenities/security.jpg'], ['Podium', 'podium', 'amenities/podium.jpg'],
];
for (const [name, icon, file] of amenityFiles) await media(`am_${icon}`, file, name, 'amenities');
console.log(`\n✓ media library (${Object.keys(M).length} files)`);

/* ─────────────────────────────── settings ─────────────────────────────── */
const settings: Record<string, unknown> = {
  site: {
    name: 'VVIP Properties', tagline: 'The Key To Vapi’s VIP Era.', developer: 'Odhav Developers', logo_media_id: M.logo.id, favicon_media_id: null,
    menu_about:
      'This isn’t just an address, it’s an experience for those who lead, inspire, and redefine success. From the grand arrival to every flawless detail, VVIP is more than a title, it’s a feeling. Here, ambition meets prestige. You’ve earned this. Welcome to VVIP: where the extraordinary do business.',
  },
  contact: {
    address: 'NeoVista, Char Rasta, Near DCB Bank, Vapi Gujarat - 396195',
    phones: [{ label: '+91 968 766 4411', href: 'tel:+919687664411' }, { label: '+91 968 766 4433', href: 'tel:+919687664433' }],
    emails: [{ label: 'mail@vapisvip.com', href: 'mailto:mail@vapisvip.com' }, { label: 'odhavdevelopersgroup@gmail.com', href: 'mailto:odhavdevelopersgroup@gmail.com' }],
    whatsapp: '',
    maps_url: 'https://www.google.com/maps/search/?api=1&query=NeoVista%2C%20Char%20Rasta%2C%20Vapi',
    map_embed:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4534.513912030461!2d72.91672785523166!3d20.3687889419132!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be0cf16b18c0ac3%3A0xee1fdc02320b054e!2sNeoVista!5e0!3m2!1sen!2sin!4v1747652827706!5m2!1sen!2sin',
    hours: [{ days: 'Monday – Friday', time: '9:00 – 18:00' }, { days: 'Saturday', time: '10:00 – 16:00' }],
  },
  social: [
    { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61576362355214', icon: 'facebook' },
    { name: 'Instagram', href: 'https://www.instagram.com/_neo_vista_?igsh=MXhnYXZsODZ1azRjbQ==', icon: 'instagram' },
    { name: 'LinkedIn', href: 'https://www.linkedin.com/company/odhav-developers-groups/', icon: 'linkedin' },
  ],
  header: { show_phone: true, cta_label: 'Schedule a visit', cta_enabled: true },
  footer: {
    statement: 'Step into NeoVista, the definitive address for Vapi’s most visionary entrepreneurs, thriving enterprises, and',
    statement_highlight: 'future forward leaders.',
    about: 'As a Vapi’s VIP, you’re not just securing a space, you’re unlocking a world of distinction, strategic advantage, and premium amenities designed for high performing businesses.',
    credit: 'itsmedigital.in',
    copyright_name: 'VapisVIP',
  },
  seo: {
    site_title: 'VVIP NeoVista',
    default_description: "Discover NeoVista, Vapi's premier luxury commercial property by Odhav Developers. Elite offices, retail showrooms, and hospitality spaces in the heart of Vapi, Gujarat.",
    default_og_image_id: M.say2.id,
    canonical_domain: 'https://vapisvip.com',
    allow_indexing: true,
    sitemap_enabled: true,
    organization_name: 'VVIP Commercial Properties | NeoVista Business Towers',
    organization_description: 'Premium luxury office spaces, retail showrooms, and healthcare facilities in Vapi, Gujarat. VVIP offers state of the art commercial properties with valet parking, art gallery foyers, and VIP amenities.',
    rating_value: 4.8,
    rating_count: 47,
    gsc_site_url: '',
  },
  analytics: { enabled: true, retention_days: 395, require_consent: false },
  cookie_consent: { enabled: false },
  maintenance: { enabled: false },
  mail: { enabled: true, notify_to: 'mail@vapisvip.com', from: 'VVIP Website <noreply@vapisvip.com>' },
  enquiry_types: ['Real Estate', 'Apartment', 'Residencial', 'Showrooms', 'Offices', 'Deluxe'],
};
for (const [k, v] of Object.entries(settings)) {
  const parsed = (SETTINGS_SCHEMAS as any)[k].parse(v);
  await run('INSERT INTO settings (setting_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [k, JSON.stringify(parsed)]);
}
await run("INSERT INTO settings (setting_key, value) VALUES ('cache_version', '1') ON DUPLICATE KEY UPDATE value = value");
console.log('✓ settings');

/* ─────────────────────────────── property ─────────────────────────────── */
await run("INSERT INTO property_categories (name, slug) VALUES ('Commercial', 'commercial'), ('Mixed-use', 'mixed-use')");
const cat = (await one<{ id: number }>("SELECT id FROM property_categories WHERE slug='mixed-use'"))!;
const prop = await run(
  `INSERT INTO properties (slug, title, tagline, summary, description, property_type, category_id, developer, location, address, latitude, longitude,
     price_label, availability, is_featured, status, main_image_id, seo_title, seo_description, og_image_id, published_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, UTC_TIMESTAMP())`,
  [
    'neovista', 'NeoVista', 'Business Towers',
    'A visionary twin tower marvel by Odhav Developers — designer offices, retail showrooms and a dedicated healthcare & hospitality tower under one iconic address.',
    'NeoVista is a RERA‑registered, all‑commercial project conceived as a twin‑tower landmark offering offices, showrooms, hospitality and healthcare‑ready spaces under one address. For businesses, it offers a curated mix of unit sizes and typologies — from compact offices for professionals to high‑frontage retail floors and specialised spaces that can house clinics or wellness centres.',
    'Commercial', cat.id, 'Odhav Developers', 'Char Rasta, Vapi, Gujarat', 'NeoVista, Char Rasta, Near DCB Bank, Vapi Gujarat - 396195', 20.3687889, 72.9167278,
    'Price on request', 'on_request', 1, 'published', M.facade.id,
    'NeoVista Property Details | Offices, Showrooms & Healthcare Spaces in Vapi',
    'Explore NeoVista at Char Rasta, Vapi — a RERA-registered, all-commercial twin-tower landmark by Odhav Developers with designer offices, retail showrooms, healthcare and hospitality spaces.',
    M.facade.id,
  ],
);
const PID = prop.insertId;
const specs: [string, string][] = [
  ['Project type', 'All-commercial'], ['Registration', 'RERA-registered'], ['Towers', 'Twin towers — A & B'],
  ['Spaces', 'Designer offices, Retail showrooms, Healthcare, Hospitality'],
];
for (const [i, [label, value]] of specs.entries()) await run('INSERT INTO property_specs (property_id, label, value, position) VALUES (?,?,?,?)', [PID, label, value, i]);
const gallery: [string, string, string, string][] = [
  ['towers', 'NeoVista twin towers', 'Architecture', 'wide'], ['valet', 'Valet arrival', 'Arrival', 'tall'], ['facade', 'Façade & podium', 'Architecture', 'std'],
  ['foyer', 'Double-height foyer', 'Interiors', 'std'], ['showroom', 'Tower A retail showrooms', 'Architecture', 'wide'], ['am_lobby', 'Entrance lobby', 'Interiors', 'tall'],
  ['dropoff', 'Drop-off bay', 'Arrival', 'std'], ['passage', 'Lift lobby passage', 'Interiors', 'std'], ['say1', 'VVIPs, it’s time to Say Yes', 'Campaign', 'wide'], ['say3', 'The VIP lounge', 'Campaign', 'wide'],
];
for (const [i, [k, caption, category, shape]] of gallery.entries())
  await run('INSERT INTO property_images (property_id, media_id, position, caption, category, shape) VALUES (?,?,?,?,?,?)', [PID, M[k].id, i, caption, category, shape]);
for (const [i, [name, icon]] of amenityFiles.entries())
  await run('INSERT INTO property_amenities (property_id, name, icon, media_id, position) VALUES (?,?,?,?,?)', [PID, name, icon, M[`am_${icon}`].id, i]);
console.log('✓ property: NeoVista');

/* ─────────────────────────────── pages ─────────────────────────────── */
type SectionSeed = [type: string, label: string, data: Record<string, unknown>];
async function page(p: Record<string, unknown>, sections: SectionSeed[] = []) {
  const cols = Object.keys(p);
  const res = await run(`INSERT INTO pages (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, Object.values(p));
  for (const [i, [type, label, data]] of sections.entries())
    await run('INSERT INTO page_sections (page_id, type, label, position, data) VALUES (?,?,?,?,?)', [res.insertId, type, label, i, JSON.stringify(parseSection(type, data))]);
  await publishPage(res.insertId, null);
  return res.insertId;
}

const featureItems = [
  { subtitle: 'Valet Parking', title: 'Because Time is Prestige', text: 'NeoVista is the first commercial project in Vapi to offer valet service for both business and hospitality, catering to Vapi’s VIP community.', media_id: M.valet.id, alt: M.valet.alt },
  { subtitle: 'Drop Off', title: 'Flow, Function & First Class Access', text: 'Thoughtful drop off points ensure seamless navigation for office users, visitors.', media_id: M.dropoff.id, alt: M.dropoff.alt },
  { subtitle: 'Double Heighted Foyer', title: 'First Impressions, The Royal One!', text: 'Bow down to timeless elegance. Where every detail speaks of royalty. NeoVista greets every visitor with grandeur.', media_id: M.foyer.id, alt: M.foyer.alt },
  { subtitle: 'Passage', title: 'A State-Of-The-Art Lobby', text: 'With expansive ten foot long gallery displays designed to captivate, inspire, and elevate every impression.', media_id: M.passage.id, alt: M.passage.alt },
];
const towersData = {
  eyebrow: 'The Towers', title: 'Where the extraordinary *do business.*',
  lead: 'This isn’t just an address, it’s an experience for those who lead, inspire, and redefine success. From the grand arrival to every flawless detail, VVIP is more than a title, it’s a feeling.',
  tabs: [
    { code: 'A', kicker: 'Tower A', title: 'The Powerhouse of Business', text: 'From elite lounges and designer offices to curated retail and sky lounges, this is where the top 1% come to build, grow, and lead. A luxury-first approach to business infrastructure tailored for entrepreneurs and empire builders.', media_id: M.towers.id, position: '58% 40%', tags: ['Designer offices', 'Elite lounges', 'Sky lounges'] },
    { code: 'A', kicker: 'Tower A', title: 'Dedicated Retail Showrooms', text: 'A curated space where luxury brands meet discerning buyers in an atmosphere of elegance and exclusivity. More than retail, it’s a statement of prestige.', media_id: M.showroom.id, position: '50% 100%', tags: ['High-frontage retail', 'Luxury brands', 'Street presence'] },
    { code: 'B', kicker: 'Tower B', title: 'Vapi’s Most Advanced Healthcare & Hospitality Hub', text: 'Tower B is meticulously designed as a future-forward space, ideal for both healthcare and hospitality ventures.', media_id: M.facade.id, position: '78% 50%', tags: ['Healthcare-ready', 'Hospitality', 'Dedicated tower'] },
  ],
};
const contactData = { eyebrow: 'Contact Us', title: 'Schedule a *visit*', lead: 'As a Vapi’s VIP, you’re not just securing a space, you’re unlocking a world of distinction. Visit NeoVista or reach our team directly.', card_title: 'Send us a message', show_map: true };
const galleryHead = { eyebrow: 'Gallery', title: 'Inside the *VIP era*', lead: 'From grand valet arrivals and gallery inspired foyers to designer offices — explore NeoVista in pictures.' };
const amenitiesHead = { eyebrow: 'Facilities', title: 'Real *Amenities*', lead: 'We are a real estate firm with over 26+ years of expertise, and our main goal is to provide amazing locations to our partners and clients.' };

await page(
  {
    path: '/', title: 'Home', template: 'home', status: 'draft', is_system: 1,
    seo_title: 'NeoVista Vapi | Luxury Commercial Property & Business Towers in Gujarat',
    seo_description: "Discover NeoVista, Vapi's premier luxury commercial property by Odhav Developers. Elite offices, retail showrooms, and hospitality spaces in the heart of Vapi, Gujarat.",
    seo_keywords: 'NeoVista Vapi, luxury commercial property Vapi, office spaces Vapi, retail showrooms Vapi, healthcare hub Vapi, Odhav Developers Vapi, best real estate Vapi, commercial real estate Gujarat, NeoVista business towers, VVIP properties Vapi, Vapi business center, healthcare tower Vapi, premium retail spaces Vapi, NeoVista luxury offices, commercial property in Vapi, business properties Gujarat',
    og_title: 'NeoVista Vapi - Luxury Commercial Property in Gujarat',
    og_description: "Premium office spaces, retail showrooms & healthcare facilities in Vapi's most prestigious commercial towers",
    og_image_id: M.say2.id,
  },
  [
    ['hero', 'Hero', {
      eyebrow: 'NeoVista · Char Rasta, Vapi', title: 'The Key To *Vapi’s VIP* Era.',
      lead: 'NeoVista is a symbol of success and a benchmark of prestige — a visionary twin tower marvel by Odhav Developers.',
      image: { media_id: M.towers.id, alt: M.towers.alt, position: '38% 50%' },
      primary: { label: 'Schedule a visit', href: '#contact-sec', opens_visit: true }, secondary: { label: 'Explore NeoVista', href: '#about-sec' },
      card_enabled: true, card_kicker: 'Now presenting', card_title: 'NeoVista Business Towers', card_text: 'Designer offices · Retail showrooms · Healthcare · Hospitality',
      card_link: { label: 'View property', href: '/neovista.html' },
      stats: [{ value: 26, suffix: '+', label: 'Years' }, { value: 4.5, decimals: 1, label: 'Million Sq.Ft' }, { value: 20, suffix: '+', label: 'Projects Delivered' }, { value: 2500, suffix: '+', label: 'Happy Families' }],
    }],
    ['campaign', 'Say Yes campaign', { label: 'Say Yes campaign', slides: ['say1', 'say2', 'say3'].map((k) => ({ media_id: M[k].id, alt: M[k].alt })) }],
    ['about', 'About NeoVista', {
      eyebrow: 'About NeoVista', title: 'Two Towers. One Vision. *Infinite Impact.*',
      lead: 'Every landmark has a purpose. VAPI’S VIP is a transformative vision that unites business, healthcare, hospitality and lifestyle under one iconic address. Rising proudly above the city, its twin towers redefine what it means to build for the future.',
      image: { media_id: M.facade.id, alt: M.facade.alt }, caption_left: 'NeoVista', caption_right: 'Char Rasta · Vapi · Gujarat',
      card_title: 'By Odhav Developers — building South Gujarat since 1999.',
      card_paragraphs: [
        'In today’s real estate market, where options are endless but reliability is rare, Odhav Developers has quietly and consistently earned its place as a trusted name.',
        'With over 26 years of experience in South Gujarat, our journey hasn’t been about flashy promises, it’s been about doing the right things, one project at a time.',
      ],
      card_link: { label: 'A real commitment', href: '/blog-details.html' },
    }],
    ['featured_property', 'Featured property', {
      eyebrow: 'Listing', title: 'Featured *Property*', lead: 'We are a real estate firm with over 26+ years of legacy, and our main goal is to provide amazing locations to our partners and clients.',
      property_id: PID, badge: 'Featured', primary: { label: 'Property details', href: '/neovista.html' }, secondary: { label: 'Call sales', href: 'tel:+919687664411' },
      experiences_label: 'Signature experiences', experiences: featureItems,
    }],
    ['towers', 'Tower explorer', { ...towersData, link: { label: 'Explore the full property', href: '/neovista.html' } }],
    ['gallery', 'Gallery', { ...galleryHead, source: 'property', property_id: PID }],
    ['amenities', 'Amenities', { ...amenitiesHead, source: 'property', property_id: PID }],
    ['brand_story', 'NeoVista brand story', {
      eyebrow: 'Crafted with business sense', title: 'NeoVista is a Symbol of *Success*',
      lead: 'A visionary twin tower marvel, it redefines the city’s business landscape with an unmistakable aura of luxury. Strategically located in the heart of Vapi, it rises with purpose, offering a seamless blend of architectural excellence, thoughtful planning, and elite amenities.',
      text: 'From grand valet arrivals and gallery inspired foyers to designer offices and a dedicated Hospitality tower, every detail is curated for those who demand more.',
      image: { media_id: M.banner.id, alt: M.banner.alt },
      primary: { label: 'Schedule a visit', href: '#contact-sec', opens_visit: true }, secondary: { label: 'View features', href: '#property-sec' },
    }],
    ['insights', 'Latest articles', { eyebrow: 'Blogs', title: 'Notes on Vapi’s *rising skyline*', lead: 'Perspectives from Odhav Developers on Vapi’s commercial growth, Char Rasta’s transformation and what it takes to build an address worth saying yes to.', count: 3 }],
    ['contact', 'Contact', contactData],
  ],
);

await page(
  {
    path: '/neovista.html', title: 'NeoVista', template: 'property', status: 'draft', property_id: PID,
    seo_title: 'NeoVista Property Details | Offices, Showrooms & Healthcare Spaces in Vapi',
    seo_description: 'Explore NeoVista at Char Rasta, Vapi — a RERA-registered, all-commercial twin-tower landmark by Odhav Developers with designer offices, retail showrooms, healthcare and hospitality spaces.',
    seo_keywords: 'NeoVista property details, NeoVista Vapi, commercial property Vapi, office space Char Rasta, retail showroom Vapi, healthcare space Vapi, Odhav Developers',
  },
  [
    ['property_overview', 'Overview', {
      eyebrow: 'Overview', title: 'A symbol of success, a *benchmark of prestige.*',
      lead: 'A visionary twin tower marvel, it redefines the city’s business landscape with an unmistakable aura of luxury. Strategically located in the heart of Vapi, it rises with purpose, offering a seamless blend of architectural excellence, thoughtful planning, and elite amenities.',
      text: 'NeoVista is a RERA‑registered, all‑commercial project conceived as a twin‑tower landmark offering offices, showrooms, hospitality and healthcare‑ready spaces under one address. For businesses, it offers a curated mix of unit sizes and typologies — from compact offices for professionals to high‑frontage retail floors and specialised spaces that can house clinics or wellness centres.',
      image_a: { media_id: M.foyer.id, alt: 'Double-height reception foyer at NeoVista' }, image_b: { media_id: M.valet.id, alt: 'Valet arrival at NeoVista' },
      quote: '“Two Towers. One Vision. Infinite Impact.”', show_stats: true,
    }],
    ['towers', 'Tower explorer', towersData],
    ['experiences_grid', 'Arrival experiences', { eyebrow: 'Arrival', title: 'Signature *experiences*', lead: 'From the grand arrival to every flawless detail, VVIP is more than a title, it’s a feeling.', items: featureItems }],
    ['gallery', 'Gallery', { ...galleryHead, source: 'property', property_id: PID }],
    ['amenities', 'Amenities', { ...amenitiesHead, source: 'property', property_id: PID }],
    ['location', 'Location', {
      eyebrow: 'Location', title: 'The heart of *Vapi*', show_map: true,
      items: [
        { title: 'Char Rasta junction', text: 'One of the city’s key junctions, linking the GIDC industrial estate, residential neighbourhoods and the wider regional road network.' },
        { title: 'Mumbai & Surat', text: 'Located midway between these two economic powerhouses — just 2–3 hours from each.' },
        { title: 'Expressway network', text: 'Quick reach of National/State highways and the expressway network connecting Vapi to Mumbai, Surat and Vadodara.' },
        { title: 'High-speed rail', text: 'The upcoming Mumbai–Ahmedabad bullet train corridor is expected to compress business travel times.' },
        { title: 'Daman airport', text: 'Regional air connectivity for executives and visitors through the Daman airport project.' },
        { title: 'Everyday convenience', text: 'Five-minute access to premium retail and dining, hospitals, banks and business centres.' },
      ],
    }],
    ['faq', 'FAQ', {
      eyebrow: 'Questions', title: 'Before you *say yes*', lead: 'The essentials about NeoVista, answered. Anything else, our team is a call away.',
      items: [
        { q: 'Where is NeoVista located?', a: 'NeoVista is at Char Rasta, near DCB Bank, Vapi, Gujarat — 396195. Char Rasta is one of Vapi’s key junctions, linking GIDC, residential neighbourhoods and the regional road network.' },
        { q: 'What kind of spaces are available?', a: 'NeoVista is an all-commercial, twin-tower project. Tower A houses designer offices, elite lounges and dedicated retail showrooms; Tower B is designed for healthcare and hospitality ventures.' },
        { q: 'Is the project RERA-registered?', a: 'Yes. NeoVista is a RERA-registered, all-commercial project at Vapi.' },
        { q: 'Who is the developer?', a: 'NeoVista is developed by Odhav Developers, who have over 26 years of experience in South Gujarat, 20+ projects delivered and 2,500+ happy families.' },
        { q: 'What amenities does NeoVista offer?', a: 'Valet parking, thoughtful drop-off points, a double-height foyer, an art gallery foyer, car lift, CCTV, check-in point, fire safety systems, lifts, wide passages, 24/7 security and a podium.' },
        { q: 'How can I schedule a site visit?', a: 'Use the “Schedule a visit” form, call +91 968 766 4411, or visit us Monday–Friday 9:00–18:00 and Saturday 10:00–16:00. Pricing is shared on request.' },
      ],
    }],
    ['contact', 'Contact', { ...contactData, show_map: false }],
  ],
);

await page(
  { path: '/properties.html', title: 'Properties', template: 'standard', status: 'draft', seo_title: 'Properties | VVIP — Commercial Real Estate in Vapi', seo_description: 'Browse commercial properties by Odhav Developers in Vapi, Gujarat — offices, retail showrooms, healthcare and hospitality spaces.' },
  [
    ['property_list', 'Property listing', { eyebrow: 'Properties', title: 'Addresses worth *saying yes* to', lead: 'Explore our current commercial developments in Vapi.', show_filters: true }],
    ['contact', 'Contact', { ...contactData, show_map: false }],
  ],
);

/* Articles (original Markdown, images rewritten to media-library URLs) */
const imageMap: Record<string, Media> = {
  'blog/vapi-skyline.jpg': M.blog2, 'neovista-towers.jpg': M.towers, 'showroom-space.jpg': M.showroom, 'neovista-facade.jpg': M.facade, 'blog/odhav-commitment.jpg': M.blog1,
};
const coverMap: Record<string, Media> = { 'blog-details.md': M.blog1, 'blog-details-2.md': M.blog2, 'blog-details-3.md': M.facade };
for (const file of ['blog-details.md', 'blog-details-2.md', 'blog-details-3.md']) {
  const raw = fs.readFileSync(path.join(ASSETS, 'blog', file), 'utf8');
  const [, fm, body] = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)!;
  const meta: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  const md = body.replace(/\]\(\.\.\/\.\.\/assets\/images\/([^)]+)\)/g, (_, f) => {
    const m = imageMap[f];
    return m ? `](/media/${m.storage_key}/${m.variants[m.variants.length - 1].file})` : `](${f})`;
  });
  await page({
    path: `/${file.replace('.md', '.html')}`, title: meta.title, template: 'article', status: 'draft',
    excerpt: meta.excerpt, body: md.trim(), cover_media_id: coverMap[file].id, cover_alt: meta.coverAlt,
    seo_title: meta.seoTitle, seo_description: meta.description, seo_keywords: meta.keywords, og_title: meta.cardTitle,
    display_date: meta.pubDate, sort_order: Number(meta.order),
  });
}
console.log('✓ pages: home, neovista, properties, 3 articles');

/* Legal documents — editable starting templates (review with counsel before relying on them). */
const today = new Date().toISOString().slice(0, 10);
await page({
  path: '/privacy-policy', title: 'Privacy Policy', template: 'legal', status: 'draft', is_system: 1, display_date: today,
  seo_title: 'Privacy Policy | VVIP NeoVista', seo_description: 'How VVIP Properties and Odhav Developers collect, use and protect information submitted through vapisvip.com.',
  body: `This Privacy Policy explains how **VVIP Properties / Odhav Developers** (“we”, “us”) collects, uses and protects information when you visit **vapisvip.com** or contact us through it.

## Information we collect

**Information you give us.** When you submit an enquiry or “Schedule a visit” form we collect your name, email address, phone number, the service you are interested in and your message.

**Usage information.** We use our own first-party analytics to understand how the website is used: pages viewed, the referring website or campaign, device type, browser, approximate screen size and time zone region, and interactions such as clicking a phone number. A random identifier is stored in your browser so repeat visits can be counted. We do **not** store your IP address and we do not use advertising or third-party tracking cookies.

**Embedded content.** Our location map is provided by Google Maps. Loading it may allow Google to collect information under its own privacy policy.

## How we use information

- To respond to your enquiry, arrange site visits and share project information you asked for.
- To keep records of our communication with you.
- To understand, maintain and improve the website.
- To comply with legal obligations and protect against misuse.

We do not sell your personal information.

## Sharing

We share information only with service providers who help us operate the website and our communications (for example hosting and email delivery providers), under appropriate confidentiality obligations, or where required by law.

## Retention

Enquiries are kept for as long as needed to respond and to maintain our business records, then deleted or anonymised. Analytics data is retained for a limited period and deleted automatically after that period.

## Your choices and rights

You can ask us to access, correct or delete the personal information you have provided, or to stop contacting you, by writing to the email address below. Where applicable law (including India’s Digital Personal Data Protection Act, 2023) gives you further rights, we will honour them.

## Security

We use reasonable technical and organisational measures to protect information, including encrypted connections and restricted access to our systems. No method of transmission over the internet is completely secure.

## Children

This website is intended for business and adult audiences and is not directed at children.

## Changes

We may update this policy from time to time. The “Last updated” date above shows when it was last changed.

## Contact

**Odhav Developers — NeoVista**
NeoVista, Char Rasta, Near DCB Bank, Vapi, Gujarat – 396195
Email: [mail@vapisvip.com](mailto:mail@vapisvip.com) · Phone: [+91 968 766 4411](tel:+919687664411)`,
});
await page({
  path: '/terms-and-conditions', title: 'Terms & Conditions', template: 'legal', status: 'draft', is_system: 1, display_date: today,
  seo_title: 'Terms & Conditions | VVIP NeoVista', seo_description: 'Terms governing the use of vapisvip.com, operated by VVIP Properties / Odhav Developers.',
  body: `These Terms & Conditions govern your use of **vapisvip.com** (the “website”), operated by **VVIP Properties / Odhav Developers**. By using the website you agree to these terms.

## Information on this website

The website presents information about our projects, including NeoVista, for general information only. Images, renderings, layouts, specifications, amenities and figures are indicative and may change as projects are developed. They do not form part of any offer or contract. Please confirm all details, approvals and prices with our sales team before making any decision.

## No offer or advice

Nothing on this website is an offer to sell, a solicitation, or legal, financial or investment advice. Any booking or purchase is governed solely by the agreement executed between you and the developer and by applicable law, including RERA requirements.

## Enquiries

When you submit a form you confirm that the information is accurate and that you are authorised to provide it. You agree that we may contact you about your enquiry by phone, email or messaging.

## Intellectual property

All content on the website — including text, logos, the “Say Yes” campaign artwork, photographs and renderings — belongs to us or our licensors. You may not copy, reproduce or reuse it without our written permission, except for personal, non-commercial viewing.

## Acceptable use

You agree not to misuse the website, including attempting to gain unauthorised access, interfering with its operation, submitting false or malicious content, or using automated means to collect data.

## External links

The website may link to third-party websites and services (such as social media or maps). We are not responsible for their content or practices.

## Limitation of liability

To the extent permitted by law, we are not liable for any loss arising from reliance on information on this website or from its temporary unavailability.

## Privacy

Our [Privacy Policy](/privacy-policy) explains how we handle personal information.

## Changes and governing law

We may update these terms at any time; the “Last updated” date shows the latest version. These terms are governed by the laws of India, and the courts at Vapi/Valsad, Gujarat shall have jurisdiction.

## Contact

Email [mail@vapisvip.com](mailto:mail@vapisvip.com) or call [+91 968 766 4411](tel:+919687664411).`,
});
console.log('✓ legal pages');

/* ─────────────────────────────── navigation ─────────────────────────────── */
const nav: [string, string, string, number, string][] = [
  ['header', 'Home', '/#hero', 0, 'none'], ['header', 'About Us', '/#about-sec', 1, 'none'], ['header', 'Properties', '/properties.html', 2, 'properties'],
  ['header', 'Blogs', '/#blog-sec', 3, 'articles'], ['header', 'Contact Us', '/#contact-sec', 4, 'none'],
  ['footer', 'About Us', '/#about-sec', 0, 'none'], ['footer', 'Properties', '/properties.html', 1, 'none'], ['footer', 'Blogs', '/#blog-sec', 2, 'none'], ['footer', 'Contact Us', '/#contact-sec', 3, 'none'],
  ['legal', 'Privacy Policy', '/privacy-policy', 0, 'none'], ['legal', 'Terms & Conditions', '/terms-and-conditions', 1, 'none'],
];
for (const [loc, label, url, pos, dd] of nav) await run('INSERT INTO navigation_items (location, label, url, position, dropdown) VALUES (?,?,?,?,?)', [loc, label, url, pos, dd]);
console.log('✓ navigation');

await pool().end();
console.log('\nDone. Next: node scripts/create-admin.ts to create the Super Admin.');
