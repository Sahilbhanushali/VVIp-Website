#!/usr/bin/env node
/** Deletes analytics older than the configured retention period. Schedule daily (cron/PM2). */
import { applyRetention } from '../src/server/analytics.ts';
import { pool } from '../src/server/db.ts';
await applyRetention();
console.log('✓ analytics retention applied');
await pool().end();
