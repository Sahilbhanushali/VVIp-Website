/** Small helpers shared by API routes. */
import type { APIContext } from 'astro';
import { env } from './env.ts';
import { can, type Action, type Module } from './permissions.ts';
import { hmac } from './crypto.ts';

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

/** Client IP. Only trusts X-Forwarded-For when TRUST_PROXY=true (i.e. behind Nginx). */
export function clientIp(ctx: APIContext): string {
  if (env('TRUST_PROXY', 'false') === 'true') {
    const xff = ctx.request.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    const real = ctx.request.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  try { return ctx.clientAddress; } catch { return 'unknown'; }
}

/** Fixed-window in-memory rate limiter (per process). */
type G = typeof globalThis & { __vvipRl?: Map<string, { n: number; reset: number }> };
const g = globalThis as G;
g.__vvipRl ??= new Map();
export function rateLimit(bucket: string, key: string, max: number, windowMs: number): boolean {
  const k = `${bucket}:${hmac(key)}`;
  const now = Date.now();
  const e = g.__vvipRl!.get(k);
  if (!e || e.reset < now) {
    g.__vvipRl!.set(k, { n: 1, reset: now + windowMs });
    if (g.__vvipRl!.size > 50_000) for (const [kk, v] of g.__vvipRl!) if (v.reset < now) g.__vvipRl!.delete(kk);
    return true;
  }
  e.n++;
  return e.n <= max;
}

/** Throws a 401/403 Response when the signed-in user lacks a permission. */
export function requirePerm(ctx: APIContext, m: Module, a: Action) {
  const u = ctx.locals.user;
  if (!u) throw json({ error: 'Not signed in' }, 401);
  if (!can(u.permissions, m, a)) throw json({ error: `You don’t have permission to ${a} ${m}.` }, 403);
  return u;
}

/** Wrap a handler so thrown Responses are returned and unexpected errors become a 500 JSON. */
export function handle(fn: (ctx: APIContext) => Promise<Response>) {
  return async (ctx: APIContext) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof Response) return e;
      if (e && typeof e === 'object' && 'issues' in e) {
        const issues = (e as { issues: { path: (string | number)[]; message: string }[] }).issues;
        return json({ error: 'Please correct the highlighted fields.', fields: Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message])) }, 422);
      }
      if ((e as { code?: string })?.code === 'ER_DUP_ENTRY') return json({ error: 'That value is already in use (must be unique).' }, 409);
      console.error('[api]', ctx.url.pathname, e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

export async function readBody(req: Request): Promise<Record<string, any>> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return (await req.json().catch(() => ({}))) as Record<string, any>;
  if (type.includes('form')) return Object.fromEntries((await req.formData()).entries()) as Record<string, any>;
  const text = await req.text();
  try { return JSON.parse(text); } catch { return {}; }
}

/** For endpoints without a session/CSRF token: reject cross-site requests. */
export function sameOrigin(ctx: APIContext) {
  const origin = ctx.request.headers.get('origin');
  const site = env('PUBLIC_SITE_URL', '');
  const allowed = new Set([ctx.url.origin, site.replace(/\/$/, '')].filter(Boolean));
  if (origin && !allowed.has(origin)) throw json({ error: 'Cross-site request blocked.' }, 403);
}

/** RFC 4180 CSV with a UTF-8 BOM (opens correctly in Excel). Neutralises spreadsheet formulas. */
export function csv(rows: Record<string, unknown>[], filename: string) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const cell = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 19) : v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
  return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}
