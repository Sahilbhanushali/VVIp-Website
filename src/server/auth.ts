/**
 * Session authentication.
 * - Argon2id password hashes (@node-rs/argon2)
 * - random 256-bit session token in an HttpOnly, SameSite=Lax, Secure (prod) cookie;
 *   only its SHA-256 is stored, so a DB leak does not leak live sessions
 * - per-session CSRF token for state-changing requests
 * - rate limiting per IP and per account + temporary lockout
 */
import { hash, verify } from '@node-rs/argon2';
import { all, one, run } from './db.ts';
import { hmac, randomToken, sha256 } from './crypto.ts';
import { isProd } from './env.ts';
import type { PermissionSet } from './permissions.ts';

export const SESSION_COOKIE = 'vvip_admin';
const SESSION_TTL_H = 12;
const IDLE_TIMEOUT_MIN = 120;
const MAX_FAILS_PER_ACCOUNT = 5;
const LOCK_MINUTES = 15;
const MAX_ATTEMPTS_PER_IP_15M = 20;

export type AdminUser = {
  id: number;
  email: string;
  name: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  permissions: PermissionSet;
  sessionId: string;
  csrf: string;
};

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const; // OWASP 2023 baseline
export const hashPassword = (pw: string) => hash(pw, ARGON);
export const verifyPassword = (h: string, pw: string) => verify(h, pw).catch(() => false);

export function passwordProblems(pw: string): string | null {
  if (pw.length < 12) return 'Use at least 12 characters.';
  if (pw.length > 200) return 'Password is too long.';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Use upper- and lower-case letters and a number.';
  return null;
}

export const cookieOptions = (maxAgeSec: number) => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeSec,
});

export async function loadPermissions(roleId: number): Promise<PermissionSet> {
  const rows = await all<{ p: string }>(
    "SELECT CONCAT(p.module, ':', p.action) AS p FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?",
    [roleId],
  );
  return new Set(rows.map((r) => r.p));
}

let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword(randomToken(16)));

export type LoginResult = { ok: true; token: string; user: { id: number } } | { ok: false; error: string; status: number };

export async function login(emailRaw: string, password: string, ip: string, ua: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const ipHash = hmac(ip || 'unknown');
  const generic = { ok: false as const, error: 'Incorrect email or password.', status: 401 };

  const recent = await one<{ n: number }>(
    'SELECT COUNT(*) AS n FROM login_attempts WHERE ip_hash = ? AND success = 0 AND created_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE',
    [ipHash],
  );
  if ((recent?.n ?? 0) >= MAX_ATTEMPTS_PER_IP_15M)
    return { ok: false, error: 'Too many attempts from this network. Try again in 15 minutes.', status: 429 };

  const user = await one<{ id: number; password_hash: string; is_active: number; failed_attempts: number; locked_until: Date | null }>(
    'SELECT id, password_hash, is_active, failed_attempts, locked_until FROM admin_users WHERE email = ?',
    [email],
  );
  const record = (success: boolean) =>
    run('INSERT INTO login_attempts (email, ip_hash, success) VALUES (?,?,?)', [email.slice(0, 190), ipHash, success ? 1 : 0]);

  if (!user) {
    await verifyPassword(await dummyHash(), password); // equalise timing so unknown emails aren't detectable
    await record(false);
    return generic;
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await record(false);
    return { ok: false, error: `Account temporarily locked after repeated failures. Try again later.`, status: 423 };
  }
  const valid = await verifyPassword(user.password_hash, password);
  if (!valid || !user.is_active) {
    await record(false);
    const fails = user.failed_attempts + 1;
    await run(
      `UPDATE admin_users SET failed_attempts = ?, locked_until = IF(? >= ?, UTC_TIMESTAMP() + INTERVAL ${LOCK_MINUTES} MINUTE, locked_until) WHERE id = ?`,
      [fails >= MAX_FAILS_PER_ACCOUNT ? 0 : fails, fails, MAX_FAILS_PER_ACCOUNT, user.id],
    );
    return !user.is_active && valid ? { ok: false, error: 'This account is disabled.', status: 403 } : generic;
  }
  await record(true);
  await run('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?', [user.id]);
  const token = await createSession(user.id, ipHash, ua);
  return { ok: true, token, user: { id: user.id } };
}

export async function createSession(userId: number, ipHash: string | null, ua: string) {
  const token = randomToken(32);
  await run(
    `INSERT INTO admin_sessions (id, user_id, csrf_token, ip_hash, user_agent, expires_at) VALUES (?,?,?,?,?, UTC_TIMESTAMP() + INTERVAL ${SESSION_TTL_H} HOUR)`,
    [sha256(token), userId, randomToken(32), ipHash, ua.slice(0, 255)],
  );
  // opportunistic cleanup
  if (Math.random() < 0.05) await run('DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP()');
  return token;
}

export const SESSION_MAX_AGE = SESSION_TTL_H * 3600;

export async function getSessionUser(token: string | undefined): Promise<AdminUser | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const sid = sha256(token);
  const row = await one<any>(
    `SELECT s.id AS sid, s.csrf_token, s.last_seen_at, u.id, u.email, u.name, u.role_id, u.is_active, r.slug AS role_slug, r.name AS role_name
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id JOIN roles r ON r.id = u.role_id
      WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP()
        AND s.last_seen_at > UTC_TIMESTAMP() - INTERVAL ${IDLE_TIMEOUT_MIN} MINUTE`,
    [sid],
  );
  if (!row || !row.is_active) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > 60_000)
    await run('UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?', [sid]);
  return {
    id: row.id, email: row.email, name: row.name, role_id: row.role_id, role_slug: row.role_slug, role_name: row.role_name,
    permissions: await loadPermissions(row.role_id), sessionId: sid, csrf: row.csrf_token,
  };
}

export const destroySession = (sessionId: string) => run('DELETE FROM admin_sessions WHERE id = ?', [sessionId]);
export const destroyUserSessions = (userId: number, exceptSessionId?: string) =>
  run('DELETE FROM admin_sessions WHERE user_id = ? AND id <> ?', [userId, exceptSessionId ?? '']);

/* ───── Password reset ───── */
export async function createPasswordReset(emailRaw: string): Promise<{ token: string; user: { id: number; email: string; name: string } } | null> {
  const user = await one<{ id: number; email: string; name: string }>('SELECT id, email, name FROM admin_users WHERE email = ? AND is_active = 1', [emailRaw.trim().toLowerCase()]);
  if (!user) return null;
  const token = randomToken(32);
  await run('UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL', [user.id]);
  await run('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 30 MINUTE)', [user.id, sha256(token)]);
  return { token, user };
}
export async function consumePasswordReset(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, error: 'This reset link is invalid.' };
  const problem = passwordProblems(newPassword);
  if (problem) return { ok: false, error: problem };
  const row = await one<{ id: number; user_id: number }>(
    'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()',
    [sha256(token)],
  );
  if (!row) return { ok: false, error: 'This reset link has expired or was already used.' };
  await run('UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE id = ?', [row.id]);
  await run('UPDATE admin_users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP(), failed_attempts = 0, locked_until = NULL WHERE id = ?', [
    await hashPassword(newPassword), row.user_id,
  ]);
  await run('DELETE FROM admin_sessions WHERE user_id = ?', [row.user_id]);
  return { ok: true };
}
