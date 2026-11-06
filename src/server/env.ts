/**
 * Server configuration. Reads process.env (populated from .env on first use),
 * so it works identically in Astro (dev/SSR) and in CLI scripts.
 */
import fs from 'node:fs';

let loaded = false;
function load() {
  if (loaded) return;
  loaded = true;
  const file = process.env.ENV_FILE || '.env';
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

export function env(name: string, fallback?: string): string {
  load();
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable ${name}`);
  }
  return v;
}

export const isProd = () => env('NODE_ENV', 'development') === 'production';
