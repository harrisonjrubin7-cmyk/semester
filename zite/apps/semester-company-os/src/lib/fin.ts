import { neon } from '@neondatabase/serverless';
import { FIN_MIGRATION } from './finMigration';

// Server-only. Company finance authority is its own tenant, separate from any institution or student account.
export const COMPANY_TENANT = 'semester-company';
let ready: Promise<void> | null = null;

export const pg = () => neon(process.env.ZITE_POSTGRES_URL as string);

export function ensureFinSchema() {
  if (!ready) {
    const sql = pg();
    ready = (async () => { for (const s of FIN_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
