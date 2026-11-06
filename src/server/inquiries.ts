/** Inquiry capture (public) and lead management (admin). */
import { z } from 'astro/zod';
import { all, one, run, tx } from './db.ts';
import { sendMail, escapeHtml } from './mailer.ts';
import { env } from './env.ts';

export const INQUIRY_STATUSES = ['new', 'contacted', 'qualified', 'follow_up', 'converted', 'closed', 'spam'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', follow_up: 'Follow-up', converted: 'Converted', closed: 'Closed', spam: 'Spam',
};

/** Same rules as the original mail.php, so behaviour and messages are unchanged. */
export const inquiryInput = z.object({
  name: z.string().trim().min(1, 'Please enter your name').min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().min(1, 'Please enter your email address').email('Please enter a valid email address').max(190),
  phone: z.string().trim().min(1, 'Please enter your phone number').regex(/^\+?[0-9\s\-]{7,15}$/, 'Please enter a valid phone number'),
  subject: z.string().trim().max(120).optional().default(''),
  message: z.string().trim().min(1, 'Please enter your message').min(10, 'Message must be at least 10 characters').max(5000),
  property_id: z.coerce.number().int().positive().optional().nullable(),
  source_path: z.string().max(190).optional().default(''),
  website: z.string().max(0).optional().default(''), // honeypot
});

export type InquiryContext = { visitorId?: string | null; landing?: string | null; referrerHost?: string | null; utm?: { source?: string; medium?: string; campaign?: string } };

export async function createInquiry(input: z.infer<typeof inquiryInput>, ctx: InquiryContext) {
  const propertyId = input.property_id ? (await one<{ id: number }>("SELECT id FROM properties WHERE id = ?", [input.property_id]))?.id ?? null : null;
  const res = await run(
    `INSERT INTO inquiries (name, email, phone, subject, message, property_id, source_path, landing_path, referrer_host, utm_source, utm_medium, utm_campaign, visitor_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      input.name, input.email.toLowerCase(), input.phone, input.subject || null, input.message, propertyId,
      input.source_path?.slice(0, 190) || null, ctx.landing?.slice(0, 190) || null, ctx.referrerHost?.slice(0, 190) || null,
      ctx.utm?.source?.slice(0, 100) || null, ctx.utm?.medium?.slice(0, 100) || null, ctx.utm?.campaign?.slice(0, 100) || null,
      ctx.visitorId && /^[a-f0-9]{32}$/.test(ctx.visitorId) ? ctx.visitorId : null,
    ],
  );
  const id = res.insertId;
  // Notification is sent after the lead is safely stored.
  notify(id).catch((e) => console.error('[inquiry] notify failed', e));
  return id;
}

async function notify(id: number) {
  const q = await one<any>('SELECT i.*, p.title AS property_title FROM inquiries i LEFT JOIN properties p ON p.id = i.property_id WHERE i.id = ?', [id]);
  if (!q) return;
  const site = env('PUBLIC_SITE_URL', 'https://vapisvip.com');
  const rows: [string, string][] = [
    ['Name', q.name], ['Email', q.email], ['Phone', q.phone], ['Interested in', q.subject || '—'],
    ['Property', q.property_title || '—'], ['Page', q.source_path || '—'],
    ['Source', [q.utm_source, q.utm_medium, q.utm_campaign].filter(Boolean).join(' / ') || q.referrer_host || 'Direct'],
  ];
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:auto">
    <h2 style="font-weight:400">New enquiry from the website</h2>
    <table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#6e7070">${k}</td><td><strong>${escapeHtml(String(v))}</strong></td></tr>`).join('')}</table>
    <p style="white-space:pre-wrap;border-left:2px solid #bf7840;padding-left:12px">${escapeHtml(q.message)}</p>
    <p><a href="${site}/admin/inquiries/${q.id}" style="color:#8a4f24">Open in the dashboard →</a></p>
  </body></html>`;
  const text = `New enquiry from the website\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nMessage:\n${q.message}\n\n${site}/admin/inquiries/${q.id}`;
  const r = await sendMail({ subject: `New enquiry: ${q.subject || 'Website'} – ${q.name}`, text, html, replyTo: q.email });
  await run('UPDATE inquiries SET email_status = ? WHERE id = ?', [r.ok ? 'sent' : 'skipped' in r && r.skipped ? 'disabled' : 'failed', id]);
}

export const resendNotification = notify;

/* ───────────── Admin ───────────── */
export type InquiryFilters = { q?: string; status?: string; property?: number; from?: string; to?: string; page?: number; perPage?: number; sort?: string };

function where(f: InquiryFilters) {
  const w: string[] = [];
  const p: unknown[] = [];
  if (f.status && (INQUIRY_STATUSES as readonly string[]).includes(f.status)) { w.push('i.status = ?'); p.push(f.status); }
  else if (!f.status) { w.push("i.status <> 'spam'"); }
  if (f.property) { w.push('i.property_id = ?'); p.push(f.property); }
  if (f.from) { w.push('i.created_at >= ?'); p.push(`${f.from} 00:00:00`); }
  if (f.to) { w.push('i.created_at <= ?'); p.push(`${f.to} 23:59:59`); }
  if (f.q) { w.push('(i.name LIKE ? OR i.email LIKE ? OR i.phone LIKE ? OR i.message LIKE ?)'); const like = `%${f.q.replace(/[%_]/g, '\\$&')}%`; p.push(like, like, like, like); }
  return { sql: w.length ? `WHERE ${w.join(' AND ')}` : '', params: p };
}
const SORTS: Record<string, string> = { newest: 'i.created_at DESC', oldest: 'i.created_at ASC', name: 'i.name ASC', status: 'i.status ASC, i.created_at DESC', follow_up: 'i.follow_up_at IS NULL, i.follow_up_at ASC' };

export async function listInquiries(f: InquiryFilters) {
  const { sql, params } = where(f);
  const perPage = Math.min(100, Math.max(5, f.perPage ?? 20));
  const page = Math.max(1, f.page ?? 1);
  const total = (await one<{ n: number }>(`SELECT COUNT(*) AS n FROM inquiries i ${sql}`, params))?.n ?? 0;
  const rows = await all(
    `SELECT i.id, i.name, i.email, i.phone, i.subject, i.status, i.follow_up_at, i.created_at, i.email_status, i.source_path, p.title AS property_title
       FROM inquiries i LEFT JOIN properties p ON p.id = i.property_id ${sql}
      ORDER BY ${SORTS[f.sort ?? 'newest'] ?? SORTS.newest} LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );
  return { rows, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function exportInquiries(f: InquiryFilters) {
  const { sql, params } = where(f);
  return all(
    `SELECT i.id, i.created_at, i.name, i.email, i.phone, i.subject, i.status, i.follow_up_at, p.title AS property, i.source_path, i.landing_path,
            i.referrer_host, i.utm_source, i.utm_medium, i.utm_campaign, i.message
       FROM inquiries i LEFT JOIN properties p ON p.id = i.property_id ${sql} ORDER BY i.created_at DESC LIMIT 20000`,
    params,
  );
}

export const inquiryUpdate = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  phone: z.string().trim().min(5).max(30),
  subject: z.string().trim().max(120).nullable().optional(),
  status: z.enum(INQUIRY_STATUSES),
  follow_up_at: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).nullable().or(z.literal('')).optional(),
  property_id: z.coerce.number().int().positive().nullable().optional(),
});

export async function updateInquiry(id: number, data: z.infer<typeof inquiryUpdate>, userId: number) {
  return tx(async (c) => {
    const before = await one<any>('SELECT * FROM inquiries WHERE id = ? FOR UPDATE', [id], c);
    if (!before) return false;
    const follow = data.follow_up_at ? data.follow_up_at.replace('T', ' ') + (data.follow_up_at.length === 10 ? ' 09:00:00' : ':00') : null;
    const next: Record<string, unknown> = { name: data.name, email: data.email, phone: data.phone, subject: data.subject ?? null, status: data.status, follow_up_at: follow, property_id: data.property_id ?? null };
    for (const [k, v] of Object.entries(next)) {
      const old = before[k] instanceof Date ? before[k].toISOString().slice(0, 16).replace('T', ' ') : before[k];
      const nv = typeof v === 'string' && k === 'follow_up_at' ? v.slice(0, 16) : v;
      if (String(old ?? '') !== String(nv ?? ''))
        await run('INSERT INTO inquiry_history (inquiry_id, user_id, field, old_value, new_value) VALUES (?,?,?,?,?)', [id, userId, k, old == null ? null : String(old).slice(0, 255), nv == null ? null : String(nv).slice(0, 255)], c);
    }
    await run('UPDATE inquiries SET name=?, email=?, phone=?, subject=?, status=?, follow_up_at=?, property_id=? WHERE id=?', [...Object.values(next), id], c);
    return true;
  });
}
