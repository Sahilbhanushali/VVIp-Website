/**
 * Privacy-conscious first-party analytics.
 * - visitor id: random 128-bit value kept in the browser (localStorage); no IPs stored
 * - sessions end after 30 minutes of inactivity (decided by the browser)
 * - bots, prefetches and authenticated admins are excluded
 * - all reports are SQL aggregations over a date range (indexed by created_at)
 */
import { z } from 'astro/zod';
import { createHash } from 'node:crypto';
import { all, one, run } from './db.ts';

const ID = z.string().regex(/^[a-f0-9]{32}$/);
export const trackPayload = z.object({
  t: z.enum(['pv', 'ev', 'ping']),
  vid: ID,
  sid: ID,
  new_session: z.boolean().optional(),
  path: z.string().max(190).regex(/^\//),
  title: z.string().max(200).optional(),
  ref: z.string().max(500).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  sw: z.number().int().min(0).max(10000).optional(),
  tz: z.string().max(60).optional(),
  name: z.string().max(40).regex(/^[a-z_]+$/).optional(),
  label: z.string().max(160).optional(),
  ms: z.number().int().min(0).max(6 * 3600 * 1000).optional(),
});
export type TrackPayload = z.infer<typeof trackPayload>;

export const EVENT_NAMES = ['form_submit', 'phone_click', 'email_click', 'whatsapp_click', 'cta_click', 'visit_open', 'directions_click', 'property_view', 'gallery_open'] as const;

const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|preview|lighthouse|pagespeed|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|axios|go-http|java\/|monitor|uptime|pingdom|gtmetrix/i;
export const isBot = (ua: string) => !ua || BOT_RE.test(ua);

const SOCIAL = /(facebook|fb\.|instagram|linkedin|lnkd|twitter|t\.co|x\.com|youtube|youtu\.be|pinterest|reddit|whatsapp|telegram|threads)/i;
const SEARCH = /(google\.|bing\.|yahoo\.|duckduckgo|baidu|yandex|ecosia|search\.brave|startpage)/i;
const MAIL = /(mail\.|outlook|gmail)/i;

export function classify(refHost: string | null, utm: { source?: string; medium?: string }, selfHost: string) {
  if (utm.source || utm.medium) {
    const m = (utm.medium || '').toLowerCase();
    if (/email|newsletter/.test(m)) return 'email';
    if (/social/.test(m) || SOCIAL.test(utm.source || '')) return 'social';
    return 'campaign';
  }
  if (!refHost || refHost === selfHost || refHost.endsWith(`.${selfHost}`)) return 'direct';
  if (SEARCH.test(refHost)) return 'organic';
  if (SOCIAL.test(refHost)) return 'social';
  if (MAIL.test(refHost)) return 'email';
  return 'referral';
}

export function parseUA(ua: string) {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'tablet' : /Mobi|iPhone|iPod|Android.*Mobile|Opera Mini|IEMobile/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}
const screenBucket = (w?: number) => (!w ? null : w < 480 ? '< 480px' : w < 768 ? '480–767px' : w < 1024 ? '768–1023px' : w < 1440 ? '1024–1439px' : w < 1920 ? '1440–1919px' : '≥ 1920px');

function hostOf(ref?: string) {
  if (!ref) return null;
  try { return new URL(ref).hostname.replace(/^www\./, '').toLowerCase().slice(0, 190); } catch { return null; }
}

export async function ingest(p: TrackPayload, ua: string, selfHost: string) {
  const now = new Date();
  if (p.t === 'pv') {
    const refHost = hostOf(p.ref);
    const existingVisitor = await one<{ id: string }>('SELECT id FROM analytics_visitors WHERE id = ?', [p.vid]);
    if (!existingVisitor) await run('INSERT IGNORE INTO analytics_visitors (id, first_seen_at, last_seen_at) VALUES (?,?,?)', [p.vid, now, now]);
    const session = await one<{ id: string }>('SELECT id FROM analytics_sessions WHERE id = ?', [p.sid]);
    if (!session) {
      const { device, browser, os } = parseUA(ua);
      const source = classify(refHost === selfHost ? null : refHost, { source: p.utm_source, medium: p.utm_medium }, selfHost);
      await run(
        `INSERT IGNORE INTO analytics_sessions (id, visitor_id, is_returning, started_at, last_activity_at, landing_path, exit_path, pageviews, source_type, referrer_host,
          utm_source, utm_medium, utm_campaign, device_type, browser, os, screen_bucket, region)
         VALUES (?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?)`,
        [p.sid, p.vid, existingVisitor ? 1 : 0, now, now, p.path, p.path, source, refHost === selfHost ? null : refHost,
          p.utm_source ?? null, p.utm_medium ?? null, p.utm_campaign ?? null, device, browser, os, screenBucket(p.sw), p.tz?.split('/')[0] && p.tz ? p.tz : null],
      );
      if (existingVisitor) await run('UPDATE analytics_visitors SET session_count = session_count + 1, last_seen_at = ? WHERE id = ?', [now, p.vid]);
    } else {
      await run('UPDATE analytics_visitors SET last_seen_at = ? WHERE id = ?', [now, p.vid]);
    }
    await run('INSERT INTO analytics_pageviews (session_id, visitor_id, path, title, created_at) VALUES (?,?,?,?,?)', [p.sid, p.vid, p.path, p.title?.slice(0, 200) ?? null, now]);
    await run('UPDATE analytics_sessions SET pageviews = pageviews + 1, exit_path = ?, last_activity_at = ? WHERE id = ?', [p.path, now, p.sid]);
    if (Math.random() < 0.002) applyRetention().catch(() => {});
    return;
  }
  const session = await one<{ id: string }>('SELECT id FROM analytics_sessions WHERE id = ? AND visitor_id = ?', [p.sid, p.vid]);
  if (!session) return; // events only count for sessions that recorded a pageview
  if (p.t === 'ping') {
    const ms = Math.min(p.ms ?? 0, 30 * 60 * 1000);
    await run('UPDATE analytics_pageviews SET engaged_ms = GREATEST(engaged_ms, ?) WHERE session_id = ? AND path = ? ORDER BY id DESC LIMIT 1', [ms, p.sid, p.path]);
    await run(
      'UPDATE analytics_sessions s SET engaged_seconds = (SELECT COALESCE(SUM(engaged_ms),0) DIV 1000 FROM analytics_pageviews WHERE session_id = s.id), last_activity_at = ? WHERE s.id = ?',
      [now, p.sid],
    );
    return;
  }
  if (!p.name || !(EVENT_NAMES as readonly string[]).includes(p.name)) return;
  // Duplicate guard: the same event on the same page within 3 seconds counts once.
  const bucket = Math.floor(now.getTime() / 3000);
  const dedupe = createHash('sha1').update(`${p.sid}|${p.name}|${p.label ?? ''}|${p.path}|${bucket}`).digest('hex');
  await run('INSERT IGNORE INTO analytics_events (session_id, visitor_id, name, path, label, dedupe_key, created_at) VALUES (?,?,?,?,?,?,?)', [
    p.sid, p.vid, p.name, p.path, p.label?.slice(0, 160) ?? null, dedupe, now,
  ]);
}

export async function applyRetention(days?: number) {
  const d = days ?? Number((await one<{ v: string }>("SELECT JSON_EXTRACT(value, '$.retention_days') AS v FROM settings WHERE setting_key = 'analytics'"))?.v ?? 395);
  const cutoff = `UTC_TIMESTAMP() - INTERVAL ${Math.max(30, Math.min(1095, Math.floor(d)))} DAY`;
  await run(`DELETE FROM analytics_sessions WHERE started_at < ${cutoff}`);
  await run(`DELETE FROM analytics_visitors WHERE last_seen_at < ${cutoff}`);
  await run(`DELETE FROM login_attempts WHERE created_at < UTC_TIMESTAMP() - INTERVAL 90 DAY`);
}

/* ───────────────────────────── Reporting ───────────────────────────── */
export type Range = { from: Date; to: Date; days: number; label: string };

/** Analytics days follow the business time zone, e.g. APP_TZ_OFFSET=+05:30 (default). */
export function tzOffsetMinutes() {
  const m = (process.env.APP_TZ_OFFSET || '+05:30').match(/^([+-])(\d{2}):(\d{2})$/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 330;
}
const localMidnightUtc = (daysBack: number) => {
  const off = tzOffsetMinutes() * 60_000;
  const local = new Date(Date.now() + off);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysBack) - off);
};

export function parseRange(sp: URLSearchParams): Range {
  const preset = sp.get('range') ?? '30d';
  const off = tzOffsetMinutes() * 60_000;
  const end = new Date(localMidnightUtc(-1).getTime() - 1000);
  const startOf = (daysBack: number) => localMidnightUtc(daysBack);
  const fromQ = sp.get('from');
  const toQ = sp.get('to');
  if (preset === 'custom' && fromQ && toQ && /^\d{4}-\d{2}-\d{2}$/.test(fromQ) && /^\d{4}-\d{2}-\d{2}$/.test(toQ)) {
    const from = new Date(new Date(`${fromQ}T00:00:00Z`).getTime() - off);
    const to = new Date(new Date(`${toQ}T23:59:59Z`).getTime() - off);
    if (from <= to) return { from, to, days: Math.round((to.getTime() - from.getTime()) / 864e5) + 1, label: `${fromQ} → ${toQ}` };
  }
  const map: Record<string, [number, string]> = { today: [0, 'Today'], '7d': [6, 'Last 7 days'], '30d': [29, 'Last 30 days'], '90d': [89, 'Last 90 days'], '365d': [364, 'Last 12 months'] };
  const [back, label] = map[preset] ?? map['30d'];
  return { from: startOf(back), to: end, days: back + 1, label };
}
export const previousRange = (r: Range): Range => {
  const span = r.to.getTime() - r.from.getTime() + 1000;
  return { from: new Date(r.from.getTime() - span), to: new Date(r.from.getTime() - 1000), days: r.days, label: 'Previous period' };
};

export async function trafficTotals(r: Range) {
  const s = await one<any>(
    `SELECT COUNT(*) AS sessions, COUNT(DISTINCT visitor_id) AS visitors,
            COUNT(DISTINCT CASE WHEN is_returning = 1 THEN visitor_id END) AS returning_visitors,
            COALESCE(SUM(pageviews),0) AS pageviews,
            COALESCE(AVG(engaged_seconds),0) AS avg_engaged,
            COALESCE(SUM(pageviews = 1 AND engaged_seconds < 10),0) AS bounces
       FROM analytics_sessions WHERE started_at BETWEEN ? AND ?`,
    [r.from, r.to],
  );
  const nv = await one<{ n: number }>('SELECT COUNT(*) AS n FROM analytics_visitors WHERE first_seen_at BETWEEN ? AND ?', [r.from, r.to]);
  const sessions = Number(s.sessions);
  return {
    visitors: Number(s.visitors),
    new_visitors: Number(nv?.n ?? 0),
    returning_visitors: Number(s.returning_visitors),
    sessions,
    pageviews: Number(s.pageviews),
    avg_engaged: Math.round(Number(s.avg_engaged)),
    bounce_rate: sessions ? Number(s.bounces) / sessions : 0,
    pages_per_session: sessions ? Number(s.pageviews) / sessions : 0,
  };
}

export async function quickCounts() {
  const q = async (since: Date) =>
    Number((await one<{ n: number }>('SELECT COUNT(DISTINCT visitor_id) AS n FROM analytics_sessions WHERE started_at >= ?', [since]))?.n ?? 0);
  const off = tzOffsetMinutes() * 60_000;
  const local = new Date(Date.now() + off);
  const weekday = (local.getUTCDay() + 6) % 7; // Monday = 0
  return {
    today: await q(localMidnightUtc(0)),
    week: await q(localMidnightUtc(weekday)),
    month: await q(localMidnightUtc(local.getUTCDate() - 1)),
    all_time: Number((await one<{ n: number }>('SELECT COUNT(*) AS n FROM analytics_visitors'))?.n ?? 0),
  };
}

export async function dailySeries(r: Range) {
  const rows = await all<{ d: string; visitors: number; pageviews: number; sessions: number }>(
    `SELECT DATE_FORMAT(started_at + INTERVAL ? MINUTE, '%Y-%m-%d') AS d, COUNT(DISTINCT visitor_id) AS visitors, SUM(pageviews) AS pageviews, COUNT(*) AS sessions
       FROM analytics_sessions WHERE started_at BETWEEN ? AND ? GROUP BY d ORDER BY d`,
    [tzOffsetMinutes(), r.from, r.to],
  );
  const map = new Map(rows.map((x) => [String(x.d), x]));
  const out: { date: string; visitors: number; pageviews: number; sessions: number }[] = [];
  const off = tzOffsetMinutes() * 60_000;
  for (let t = r.from.getTime() + off; t <= r.to.getTime() + off; t += 864e5) {
    const k = new Date(t).toISOString().slice(0, 10);
    const v = map.get(k);
    out.push({ date: k, visitors: Number(v?.visitors ?? 0), pageviews: Number(v?.pageviews ?? 0), sessions: Number(v?.sessions ?? 0) });
  }
  return out;
}

const breakdown = (col: string, r: Range, limit = 10) =>
  all<{ k: string; n: number }>(
    `SELECT COALESCE(${col}, 'Unknown') AS k, COUNT(*) AS n FROM analytics_sessions WHERE started_at BETWEEN ? AND ? GROUP BY k ORDER BY n DESC LIMIT ${limit}`,
    [r.from, r.to],
  );
export const sources = (r: Range) => breakdown('source_type', r);
export const referrers = (r: Range) => breakdown('referrer_host', r, 15).then((x) => x.filter((y) => y.k !== 'Unknown'));
export const campaigns = (r: Range) =>
  all<{ k: string; n: number }>(
    `SELECT CONCAT_WS(' / ', utm_source, utm_medium, utm_campaign) AS k, COUNT(*) AS n FROM analytics_sessions
      WHERE started_at BETWEEN ? AND ? AND (utm_source IS NOT NULL OR utm_campaign IS NOT NULL) GROUP BY k ORDER BY n DESC LIMIT 15`,
    [r.from, r.to],
  );
export const devices = (r: Range) => breakdown('device_type', r);
export const browsers = (r: Range) => breakdown('browser', r);
export const systems = (r: Range) => breakdown('os', r);
export const screens = (r: Range) => breakdown('screen_bucket', r);
export const regions = (r: Range) => breakdown('region', r, 15);

export const topPages = (r: Range, limit = 15) =>
  all<{ path: string; views: number; visitors: number; avg_engaged: number }>(
    `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors, ROUND(AVG(engaged_ms)/1000) AS avg_engaged
       FROM analytics_pageviews WHERE created_at BETWEEN ? AND ? GROUP BY path ORDER BY views DESC LIMIT ${limit}`,
    [r.from, r.to],
  );
export const landingPages = (r: Range) =>
  all<{ path: string; n: number; bounces: number }>(
    `SELECT landing_path AS path, COUNT(*) AS n, SUM(pageviews = 1 AND engaged_seconds < 10) AS bounces FROM analytics_sessions
      WHERE started_at BETWEEN ? AND ? GROUP BY landing_path ORDER BY n DESC LIMIT 15`,
    [r.from, r.to],
  );
export const exitPages = (r: Range) =>
  all<{ path: string; n: number }>(
    `SELECT exit_path AS path, COUNT(*) AS n FROM analytics_sessions WHERE started_at BETWEEN ? AND ? GROUP BY exit_path ORDER BY n DESC LIMIT 15`,
    [r.from, r.to],
  );

export async function conversions(r: Range) {
  const ev = await all<{ name: string; n: number; sessions: number }>(
    `SELECT name, COUNT(*) AS n, COUNT(DISTINCT session_id) AS sessions FROM analytics_events WHERE created_at BETWEEN ? AND ? GROUP BY name ORDER BY n DESC`,
    [r.from, r.to],
  );
  const inq = await one<{ n: number }>('SELECT COUNT(*) AS n FROM inquiries WHERE created_at BETWEEN ? AND ? AND status <> "spam"', [r.from, r.to]);
  const convSessions = await one<{ n: number }>(
    "SELECT COUNT(DISTINCT session_id) AS n FROM analytics_events WHERE created_at BETWEEN ? AND ? AND name IN ('form_submit','phone_click','email_click','whatsapp_click')",
    [r.from, r.to],
  );
  const labels = await all<{ name: string; label: string; n: number }>(
    `SELECT name, COALESCE(label,'—') AS label, COUNT(*) AS n FROM analytics_events WHERE created_at BETWEEN ? AND ? GROUP BY name, label ORDER BY n DESC LIMIT 20`,
    [r.from, r.to],
  );
  return { events: ev, inquiries: Number(inq?.n ?? 0), converting_sessions: Number(convSessions?.n ?? 0), labels };
}

export async function recentActivity(limit = 10) {
  return all(
    `SELECT a.created_at, a.action, a.entity_type, a.summary, u.name AS user_name FROM activity_logs a LEFT JOIN admin_users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ${limit}`,
  );
}
