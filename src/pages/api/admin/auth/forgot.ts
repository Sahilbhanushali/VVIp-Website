import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { createPasswordReset } from '../../../../server/auth.ts';
import { sendMail, escapeHtml } from '../../../../server/mailer.ts';
import { env } from '../../../../server/env.ts';
import { clientIp, handle, json, rateLimit, readBody, sameOrigin } from '../../../../server/http.ts';

export const prerender = false;
const GENERIC = { ok: true, message: 'If that account exists, a reset link has been emailed.' };

export const POST: APIRoute = handle(async (ctx) => {
  sameOrigin(ctx);
  if (!rateLimit('forgot', clientIp(ctx), 5, 15 * 60_000)) return json({ error: 'Too many requests. Try again later.' }, 429);
  const parsed = z.object({ email: z.string().trim().max(190) }).safeParse(await readBody(ctx.request));
  if (!parsed.success) return json(GENERIC);
  const r = await createPasswordReset(parsed.data.email);
  if (r) {
    const base = env('PUBLIC_SITE_URL', ctx.url.origin).replace(/\/$/, '');
    const link = `${base}/admin/reset-password?token=${r.token}`;
    const sent = await sendMail({
      to: [r.user.email],
      subject: 'Reset your CMS password',
      text: `Hi ${r.user.name},\n\nUse this link to choose a new password (valid for 30 minutes):\n${link}\n\nIf you didn’t request this, you can ignore this email.`,
      html: `<p>Hi ${escapeHtml(r.user.name)},</p><p>Use this link to choose a new password (valid for 30 minutes):</p><p><a href="${link}">${link}</a></p><p>If you didn’t request this, you can ignore this email.</p>`,
    });
    if (!sent.ok) console.warn('[auth] reset email not sent:', sent.error, '— run `npm run admin:create` on the server to reset manually.');
  }
  return json(GENERIC);
});
