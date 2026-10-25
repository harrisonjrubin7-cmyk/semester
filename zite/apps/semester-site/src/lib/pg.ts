import { neon } from '@neondatabase/serverless';

// Server-only: the connection string never reaches the browser.
export function pg() {
  return neon(process.env.ZITE_POSTGRES_URL as string);
}

const MIGRATION = [
  `CREATE TABLE IF NOT EXISTS site_inbound_requests (
    id BIGSERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('Pilot request','Pricing request','Security document request','Accessibility feedback','Contact')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    institution TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    consent_to_contact BOOLEAN NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    zite_record_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS site_inbound_requests_email_created ON site_inbound_requests (lower(email), created_at DESC)`,
];

let ready: Promise<void> | null = null;
export function ensureSchema() {
  if (!ready) {
    const sql = pg();
    ready = (async () => { for (const s of MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
