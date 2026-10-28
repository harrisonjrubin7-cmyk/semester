import { pg } from './pg';
import { REL_MIGRATION } from './relMigration';
let ready: Promise<void> | null = null;
export const ensureRel = () => { if (!ready) ready = (async () => { for (const q of REL_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
export const logRel = (kind: 'readiness' | 'assurance', ref: string, actor: string, action: string) =>
  pg().query(`INSERT INTO rel_events (kind, ref, actor_id, action) VALUES ($1,$2,$3,$4)`, [kind, ref, actor, action]);
