import { run } from './db.ts';

export async function logActivity(userId: number | null, action: string, entityType: string, entityId: string | number | null, summary: string) {
  try {
    await run('INSERT INTO activity_logs (user_id, action, entity_type, entity_id, summary) VALUES (?,?,?,?,?)', [
      userId, action, entityType, entityId == null ? null : String(entityId), summary.slice(0, 255),
    ]);
  } catch (e) {
    console.error('[activity] failed to log', e);
  }
}
