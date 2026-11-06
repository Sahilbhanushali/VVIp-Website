#!/usr/bin/env node
// Applies pending SQL migrations from db/migrations in order. Safe to re-run.
import fs from 'node:fs';
import path from 'node:path';
import { connect, root } from './lib.mjs';

const dir = path.join(root, 'db', 'migrations');
const db = await connect({ multipleStatements: true });
await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(190) NOT NULL PRIMARY KEY,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB`);
const [rows] = await db.query('SELECT name FROM schema_migrations');
const done = new Set(rows.map((r) => r.name));
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let applied = 0;
for (const file of files) {
  if (done.has(file)) continue;
  process.stdout.write(`→ ${file} … `);
  // DDL auto-commits in MySQL, so each file must be written to be re-runnable or atomic in itself.
  await db.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  await db.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
  console.log('ok');
  applied++;
}
console.log(applied ? `Applied ${applied} migration(s).` : 'Database is up to date.');
await db.end();
