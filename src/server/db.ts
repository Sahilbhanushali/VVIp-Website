/** MySQL/MariaDB connection pool and small typed query helpers. */
import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { env } from './env.ts';

type G = typeof globalThis & { __vvipPool?: Pool };
const g = globalThis as G;

export function pool(): Pool {
  if (!g.__vvipPool) {
    g.__vvipPool = mysql.createPool({
      host: env('DATABASE_HOST', '127.0.0.1'),
      port: Number(env('DATABASE_PORT', '3306')),
      user: env('DATABASE_USER'),
      password: env('DATABASE_PASSWORD', ''),
      database: env('DATABASE_NAME'),
      connectionLimit: Number(env('DATABASE_POOL', '10')),
      timezone: 'Z',
      charset: 'utf8mb4',
      dateStrings: false,
      decimalNumbers: true,
    });
    // All DATETIME columns are UTC: make CURRENT_TIMESTAMP defaults agree with UTC_TIMESTAMP().
    (g.__vvipPool as unknown as { pool: { on: (e: string, cb: (c: { query: (s: string) => void }) => void) => void } }).pool.on('connection', (c) => {
      c.query("SET time_zone = '+00:00'");
    });
  }
  return g.__vvipPool;
}

type Conn = Pool | PoolConnection;
export type Row = RowDataPacket & Record<string, any>;

export async function all<T = Row>(sql: string, params: unknown[] = [], conn: Conn = pool()): Promise<T[]> {
  const [rows] = await conn.query<RowDataPacket[]>(sql, params);
  return rows as T[];
}
export async function one<T = Row>(sql: string, params: unknown[] = [], conn: Conn = pool()): Promise<T | null> {
  const rows = await all<T>(sql, params, conn);
  return rows[0] ?? null;
}
export async function run(sql: string, params: unknown[] = [], conn: Conn = pool()): Promise<ResultSetHeader> {
  const [res] = await conn.query<ResultSetHeader>(sql, params);
  return res;
}
export async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await pool().getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
/** Parse a JSON column whether the driver returned a string or an object. */
export function json<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}
