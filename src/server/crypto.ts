import crypto from 'node:crypto';
import { env } from './env.ts';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** Keyed hash for IPs etc. — never store the raw value. */
export const hmac = (s: string) => crypto.createHmac('sha256', key()).update(s).digest('hex');

function key(): Buffer {
  const k = env('APP_SECRET');
  if (!/^[0-9a-f]{64}$/i.test(k)) throw new Error('APP_SECRET must be 64 hex characters (openssl rand -hex 32)');
  return Buffer.from(k, 'hex');
}

/** AES-256-GCM for secrets stored in the settings table. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}
export function decrypt(payload: string): string {
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1') throw new Error('Unknown secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}
export const safeEqual = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
