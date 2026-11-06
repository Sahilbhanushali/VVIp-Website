#!/usr/bin/env node
/**
 * Create (or reset) an admin account. No default credentials exist anywhere.
 *
 *   node scripts/create-admin.ts                      # interactive, hidden password prompt
 *   ADMIN_EMAIL=… ADMIN_NAME=… ADMIN_PASSWORD=… node scripts/create-admin.ts [--role super_admin]
 */
import readline from 'node:readline';
import { one, run, pool } from '../src/server/db.ts';
import { hashPassword, passwordProblems } from '../src/server/auth.ts';

function ask(q: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
      out._writeToOutput = (s: string) => out.output.write(s.includes(q) ? s : '*');
    }
    rl.question(q, (a) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(a.trim()); });
  });
}

const roleArg = process.argv.includes('--role') ? process.argv[process.argv.indexOf('--role') + 1] : 'super_admin';
const email = (process.env.ADMIN_EMAIL || (await ask('Admin email: '))).toLowerCase();
const name = process.env.ADMIN_NAME || (await ask('Full name: '));
let password = process.env.ADMIN_PASSWORD || '';
if (!password) {
  password = await ask('Password (min 12 chars, upper/lower/number): ', true);
  const again = await ask('Repeat password: ', true);
  if (again !== password) { console.error('Passwords do not match.'); process.exit(1); }
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error('Invalid email.'); process.exit(1); }
const problem = passwordProblems(password);
if (problem) { console.error(problem); process.exit(1); }
const role = await one<{ id: number }>('SELECT id FROM roles WHERE slug = ?', [roleArg]);
if (!role) { console.error(`Unknown role ${roleArg}. Run the seed first.`); process.exit(1); }

const hash = await hashPassword(password);
const existing = await one<{ id: number }>('SELECT id FROM admin_users WHERE email = ?', [email]);
if (existing) {
  await run('UPDATE admin_users SET name=?, password_hash=?, role_id=?, is_active=1, failed_attempts=0, locked_until=NULL, password_changed_at=UTC_TIMESTAMP() WHERE id=?', [name, hash, role.id, existing.id]);
  await run('DELETE FROM admin_sessions WHERE user_id = ?', [existing.id]);
  console.log(`✓ Updated ${email} (${roleArg}); existing sessions were signed out.`);
} else {
  await run('INSERT INTO admin_users (email, name, password_hash, role_id) VALUES (?,?,?,?)', [email, name, hash, role.id]);
  console.log(`✓ Created ${email} (${roleArg}).`);
}
await pool().end();
