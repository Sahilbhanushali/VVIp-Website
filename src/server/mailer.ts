/**
 * Nodemailer transport. Credentials come from the server environment
 * (SMTP_* in .env) or, if set in Settings, from the encrypted DB value.
 * Environment variables take precedence so secrets can stay out of the DB.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env.ts';
import { getSettings, readSecret } from './settings.ts';

export type MailConfig = { host: string; port: number; secure: boolean; user: string; pass: string; from: string; to: string[]; enabled: boolean; source: 'env' | 'settings' | 'none' };

export async function mailConfig(): Promise<MailConfig> {
  const s = (await getSettings()).mail;
  const envHost = env('SMTP_HOST', '');
  const to = (env('MAIL_TO', '') || s.notify_to).split(',').map((x) => x.trim()).filter(Boolean);
  if (envHost) {
    return {
      host: envHost, port: Number(env('SMTP_PORT', '587')), secure: env('SMTP_SECURE', 'false') === 'true',
      user: env('SMTP_USER', ''), pass: env('SMTP_PASSWORD', ''), from: env('MAIL_FROM', '') || s.from, to, enabled: s.enabled, source: 'env',
    };
  }
  if (s.smtp_host) {
    return { host: s.smtp_host, port: s.smtp_port, secure: s.smtp_secure, user: s.smtp_user, pass: readSecret(s.smtp_password_enc), from: s.from, to: s.notify_to.split(',').map((x) => x.trim()).filter(Boolean), enabled: s.enabled, source: 'settings' };
  }
  return { host: '', port: 587, secure: false, user: '', pass: '', from: '', to, enabled: false, source: 'none' };
}

let cached: { key: string; t: Transporter } | null = null;
async function transporter(cfg: MailConfig) {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.secure}`;
  if (cached?.key === key) return cached.t;
  const t = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  cached = { key, t };
  return t;
}

export async function sendMail(msg: { to?: string[]; subject: string; text: string; html: string; replyTo?: string }) {
  const cfg = await mailConfig();
  if (!cfg.enabled || !cfg.host) return { ok: false as const, skipped: true, error: 'Email is not configured' };
  const to = msg.to ?? cfg.to;
  if (!to.length) return { ok: false as const, skipped: true, error: 'No recipient configured' };
  try {
    const t = await transporter(cfg);
    const info = await t.sendMail({ from: cfg.from || cfg.user, to, subject: msg.subject, text: msg.text, html: msg.html, replyTo: msg.replyTo });
    return { ok: true as const, id: info.messageId };
  } catch (e: any) {
    console.error('[mail] send failed:', e?.message);
    return { ok: false as const, skipped: false, error: String(e?.message ?? e) };
  }
}

export async function verifyMail() {
  const cfg = await mailConfig();
  if (!cfg.host) return { ok: false, error: 'SMTP host is not configured.' };
  try {
    await (await transporter(cfg)).verify();
    return { ok: true, error: null };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
