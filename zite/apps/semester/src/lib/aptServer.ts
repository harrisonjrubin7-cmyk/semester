import { pg } from './pg';
import { APT_MIGRATION } from './aptMigration';

let ready: Promise<void> | null = null;
/** Runs migration apt-001 once per worker (idempotent). */
export const ensureApt = () => { if (!ready) ready = (async () => { for (const q of APT_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
