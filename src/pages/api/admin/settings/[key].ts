import type { APIRoute } from 'astro';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { SETTINGS_SCHEMAS, getSettings, saveSetting, encryptSecret, type SettingKey } from '../../../../server/settings.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
const EDITABLE: SettingKey[] = ['site', 'contact', 'social', 'header', 'footer', 'seo', 'analytics', 'cookie_consent', 'maintenance', 'mail', 'enquiry_types'];

export const PUT: APIRoute = handle(async (ctx) => {
  const key = ctx.params.key as SettingKey;
  if (!EDITABLE.includes(key) || !(key in SETTINGS_SCHEMAS)) return json({ error: 'Unknown setting' }, 404);
  const u = key === 'seo' ? requirePerm(ctx, 'seo', 'update') : requirePerm(ctx, 'settings', 'manage');
  let body: any = await readBody(ctx.request);
  if (key === 'social' || key === 'enquiry_types') body = body.items ?? body;
  if (key === 'mail') {
    // Write-only secret: empty keeps the stored password, "__clear__" removes it.
    const current = (await getSettings(true)).mail;
    const pw = typeof body.smtp_password === 'string' ? body.smtp_password : '';
    body = { ...body, smtp_password_enc: pw === '__clear__' ? '' : pw ? encryptSecret(pw) : current.smtp_password_enc };
    delete body.smtp_password;
  }
  await saveSetting(key, body, u.id);
  await logActivity(u.id, 'update', 'settings', key, `Updated ${key.replace('_', ' ')} settings`);
  return json({ ok: true });
});
