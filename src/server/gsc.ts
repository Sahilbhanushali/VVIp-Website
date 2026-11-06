/**
 * Optional Google Search Console integration (real impressions/clicks/CTR/position).
 * Configure on the server: GSC_SERVICE_ACCOUNT_FILE=/path/to/service-account.json
 * and add that service account's email as a user on the Search Console property.
 * No data is ever estimated: without credentials the dashboard says so.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { env } from './env.ts';

type Creds = { client_email: string; private_key: string };
let token: { value: string; exp: number } | null = null;

export function gscConfigured(): boolean {
  const f = env('GSC_SERVICE_ACCOUNT_FILE', '');
  return !!f && fs.existsSync(f);
}

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const creds = JSON.parse(fs.readFileSync(env('GSC_SERVICE_ACCOUNT_FILE'), 'utf8')) as Creds;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(creds.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  if (!res.ok) throw new Error(`Google auth failed (${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
export async function gscQuery(siteUrl: string, start: string, end: string, dimension: 'query' | 'page' | 'date', rowLimit = 25): Promise<GscRow[]> {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: start, endDate: end, dimensions: [dimension], rowLimit }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Search Console API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { rows?: GscRow[] }).rows ?? [];
}
