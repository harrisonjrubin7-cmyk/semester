// Server-side helpers for family delegation (lib/famMigration.ts). Never imported by browser code.
import { pg } from './pg';
import { FAM_MIGRATION } from './famMigration';

let famReady: Promise<void> | null = null;
export const ensureFam = () => { if (!famReady) famReady = (async () => { for (const q of FAM_MIGRATION) await pg().query(q); })().catch((e) => { famReady = null; throw e; }); return famReady; };
