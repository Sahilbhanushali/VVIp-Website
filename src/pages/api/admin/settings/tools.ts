/** POST {action: 'mail-test', to?} | {action: 'retention'} */
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { handle, json, readBody, requirePerm } from '../../../../server/http.ts';
import { sendMail, verifyMail, mailConfig } from '../../../../server/mailer.ts';
import { applyRetention } from '../../../../server/analytics.ts';
import { logActivity } from '../../../../server/activity.ts';

export const prerender = false;
export const POST: APIRoute = handle(async (ctx) => {
  const u = requirePerm(ctx, 'settings', 'manage');
  const b = z.object({ action: z.enum(['mail-test', 'retention']), to: z.string().email().optional().or(z.literal('')) }).parse(await readBody(ctx.request));
  if (b.action === 'retention') {
    await applyRetention();
    await logActivity(u.id, 'delete', 'analytics', null, 'Applied analytics retention');
    return json({ ok: true, message: 'Old analytics data was removed according to the retention period.' });
  }
  const cfg = await mailConfig();
  const v = await verifyMail();
  if (!v.ok) return json({ error: `SMTP connection failed: ${v.error}` }, 502);
  const to = b.to ? [b.to] : [u.email];
  const r = await sendMail({ to, subject: 'CMS test email', text: `This is a test email from the website CMS (configuration source: ${cfg.source}).`, html: `<p>This is a test email from the website CMS.</p><p><small>Configuration source: ${cfg.source}</small></p>` });
  return r.ok ? json({ ok: true, message: `Test email sent to ${to.join(', ')}.` }) : json({ error: r.error }, 502);
});
