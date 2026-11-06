/**
 * Public enquiry endpoint (replaces mail.php). Same JSON contract:
 * { success, message, errors }. Every valid submission is stored first,
 * then a notification email is sent via Nodemailer.
 */
import type { APIRoute } from 'astro';
import { inquiryInput, createInquiry } from '../../server/inquiries.ts';
import { clientIp, json, rateLimit, readBody } from '../../server/http.ts';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const body = await readBody(ctx.request);
  const ip = clientIp(ctx);
  if (!rateLimit('inquiry', ip, 5, 10 * 60 * 1000))
    return json({ success: false, message: 'Too many submissions. Please try again in a few minutes.', errors: {} }, 429);

  const parsed = inquiryInput.safeParse(body);
  if (!parsed.success) {
    const errors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    if (errors.website) return json({ success: true, message: 'Thank you! Your message has been sent successfully.' }); // honeypot: pretend success
    return json({ success: false, message: 'Please correct the errors below', errors }, 422);
  }
  const referer = ctx.request.headers.get('referer');
  const vid = ctx.request.headers.get('x-visitor-id');
  const attribution = (() => {
    try { return JSON.parse(ctx.request.headers.get('x-attribution') ?? '{}') as Record<string, string>; } catch { return {}; }
  })();
  let refHost: string | null = null;
  try { refHost = attribution.ref ? new URL(attribution.ref).hostname : null; } catch {}
  await createInquiry(parsed.data, {
    visitorId: vid,
    landing: attribution.landing ?? null,
    referrerHost: refHost,
    utm: { source: attribution.utm_source, medium: attribution.utm_medium, campaign: attribution.utm_campaign },
  });
  // Plain form POST without JS: send the visitor back to the page with a confirmation.
  if (!(ctx.request.headers.get('accept') ?? '').includes('application/json') && referer) {
    return ctx.redirect(`${new URL(referer).pathname}?sent=1#contact-sec`, 303);
  }
  return json({ success: true, message: 'Thank you! Your message has been sent successfully.' });
};
