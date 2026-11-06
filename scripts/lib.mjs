// Shared helpers for CLI scripts (migrate, seed, create-admin, retention).
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

/** Minimal .env loader (no dependency); real environment variables win. */
export function loadEnv(file = '.env') {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

export async function connect(extra = {}) {
  loadEnv();
  const { DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME } = process.env;
  if (!DATABASE_USER || !DATABASE_NAME) throw new Error('DATABASE_* environment variables are not set (see .env.example)');
  const conn = await mysql.createConnection({
    host: DATABASE_HOST || '127.0.0.1',
    port: Number(DATABASE_PORT || 3306),
    user: DATABASE_USER,
    password: DATABASE_PASSWORD,
    database: DATABASE_NAME,
    timezone: 'Z',
    charset: 'utf8mb4',
    ...extra,
  });
  await conn.query("SET time_zone = '+00:00'");
  return conn;
}

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
