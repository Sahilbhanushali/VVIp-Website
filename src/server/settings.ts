/** Typed global settings. Each key has a Zod schema + defaults; values live in the `settings` table. */
import { z } from 'astro/zod';
import { all, one, run, json } from './db.ts';
import { decrypt, encrypt } from './crypto.ts';
import { setCacheVersion, purgeLocal, versionCheckDue, markVersionChecked } from './cache.ts';

const link = z.object({ label: z.string().trim().min(1).max(80), href: z.string().trim().min(1).max(255) });

export const SETTINGS_SCHEMAS = {
  site: z.object({
    name: z.string().trim().min(1).max(80).default('VVIP Properties'),
    tagline: z.string().trim().max(120).default('The Key To Vapi’s VIP Era.'),
    developer: z.string().trim().max(120).default('Odhav Developers'),
    logo_media_id: z.number().int().positive().nullable().default(null),
    favicon_media_id: z.number().int().positive().nullable().default(null),
    menu_about: z.string().max(800).default(''),
  }),
  contact: z.object({
    address: z.string().trim().max(255).default(''),
    phones: z.array(link).max(6).default([]),
    emails: z.array(link).max(6).default([]),
    whatsapp: z.string().trim().max(20).default(''),
    maps_url: z.string().trim().max(500).default(''),
    map_embed: z.string().trim().max(1200).default(''),
    hours: z.array(z.object({ days: z.string().max(60), time: z.string().max(60) })).max(7).default([]),
  }),
  social: z.array(z.object({ name: z.string().max(40), href: z.string().url().max(255), icon: z.enum(['facebook', 'instagram', 'linkedin', 'youtube', 'x']) })).max(8).default([]),
  header: z.object({
    show_phone: z.boolean().default(true),
    cta_label: z.string().trim().max(40).default('Schedule a visit'),
    cta_enabled: z.boolean().default(true),
  }),
  footer: z.object({
    statement: z.string().max(300).default(''),
    statement_highlight: z.string().max(120).default(''),
    about: z.string().max(500).default(''),
    credit: z.string().max(120).default(''),
    copyright_name: z.string().max(80).default('VapisVIP'),
  }),
  seo: z.object({
    site_title: z.string().max(120).default('VVIP NeoVista'),
    default_description: z.string().max(320).default(''),
    default_og_image_id: z.number().int().positive().nullable().default(null),
    canonical_domain: z.string().url().default('https://vapisvip.com'),
    allow_indexing: z.boolean().default(true),
    sitemap_enabled: z.boolean().default(true),
    organization_name: z.string().max(120).default('VVIP Commercial Properties | NeoVista Business Towers'),
    organization_description: z.string().max(500).default(''),
    rating_value: z.number().min(0).max(5).nullable().default(null),
    rating_count: z.number().int().min(0).nullable().default(null),
    gsc_site_url: z.string().max(255).default(''),
  }),
  analytics: z.object({
    enabled: z.boolean().default(true),
    retention_days: z.number().int().min(30).max(1095).default(395),
    require_consent: z.boolean().default(false),
  }),
  cookie_consent: z.object({
    enabled: z.boolean().default(false),
    message: z.string().max(400).default('We use privacy-friendly, first-party analytics to understand how visitors use this site. No advertising cookies.'),
  }),
  maintenance: z.object({
    enabled: z.boolean().default(false),
    message: z.string().max(400).default('We are updating the website and will be back shortly.'),
  }),
  mail: z.object({
    enabled: z.boolean().default(true),
    notify_to: z.string().max(400).default(''),     // comma separated
    from: z.string().max(200).default(''),
    smtp_host: z.string().max(190).default(''),
    smtp_port: z.number().int().min(1).max(65535).default(587),
    smtp_secure: z.boolean().default(false),
    smtp_user: z.string().max(190).default(''),
    smtp_password_enc: z.string().max(600).default(''),   // AES-GCM, never sent to the browser
  }),
  enquiry_types: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
} as const;

export type SettingKey = keyof typeof SETTINGS_SCHEMAS;
export type Settings = { [K in SettingKey]: z.infer<(typeof SETTINGS_SCHEMAS)[K]> };

type G = typeof globalThis & { __vvipSettings?: { at: number; data: Settings } };
const g = globalThis as G;

export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && g.__vvipSettings && Date.now() - g.__vvipSettings.at < 30_000) return g.__vvipSettings.data;
  const rows = await all<{ setting_key: string; value: unknown }>('SELECT setting_key, value FROM settings');
  const map = new Map(rows.map((r) => [r.setting_key, json<unknown>(r.value, null)]));
  const data = {} as Settings;
  for (const k of Object.keys(SETTINGS_SCHEMAS) as SettingKey[]) {
    const parsed = (SETTINGS_SCHEMAS[k] as z.ZodTypeAny).safeParse(map.get(k) ?? undefined);
    (data as any)[k] = parsed.success ? parsed.data : (SETTINGS_SCHEMAS[k] as z.ZodTypeAny).parse(undefined);
  }
  g.__vvipSettings = { at: Date.now(), data };
  return data;
}

export async function saveSetting<K extends SettingKey>(key: K, value: unknown, userId: number | null) {
  const parsed = (SETTINGS_SCHEMAS[key] as z.ZodTypeAny).parse(value);
  await run(
    'INSERT INTO settings (setting_key, value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)',
    [key, JSON.stringify(parsed), userId],
  );
  g.__vvipSettings = undefined;
  await purgePublicCache();
  return parsed as Settings[K];
}

/** SMTP password helpers — the stored value is encrypted with APP_SECRET. */
export const encryptSecret = (plain: string) => (plain ? encrypt(plain) : '');
export function readSecret(enc: string): string {
  if (!enc) return '';
  try { return decrypt(enc); } catch { return ''; }
}

/* ───── public cache invalidation shared across processes ───── */
export async function purgePublicCache() {
  await run(
    "INSERT INTO settings (setting_key, value) VALUES ('cache_version', '1') ON DUPLICATE KEY UPDATE value = CAST(JSON_EXTRACT(value, '$') + 1 AS CHAR)",
  );
  g.__vvipSettings = undefined;
  purgeLocal();
  await syncCacheVersion(true);
}
export async function syncCacheVersion(force = false) {
  if (!force && !versionCheckDue()) return;
  markVersionChecked();
  const row = await one<{ v: unknown }>("SELECT value AS v FROM settings WHERE setting_key = 'cache_version'");
  const v = Number(json(row?.v, 0));
  setCacheVersion(v);
}
