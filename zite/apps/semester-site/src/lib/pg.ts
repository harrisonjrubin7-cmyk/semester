import { neon } from '@neondatabase/serverless';

// Server-only: the connection string never reaches the browser.
export function pg() {
  return neon(process.env.ZITE_POSTGRES_URL as string);
}

export const SITE_MIGRATION = [
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
  // S-94 §6 (28 Oct): a request key makes retries safe; a reference is returned only after the row is saved; routing records
  // whether the Company OS inbox copy succeeded ('routed') or is still owed ('pending'). The saved request is never lost.
  `ALTER TABLE site_inbound_requests ADD COLUMN IF NOT EXISTS request_key text`,
  `ALTER TABLE site_inbound_requests ADD COLUMN IF NOT EXISTS reference text`,
  `ALTER TABLE site_inbound_requests ADD COLUMN IF NOT EXISTS payload_sha text`,
  `ALTER TABLE site_inbound_requests ADD COLUMN IF NOT EXISTS routing text NOT NULL DEFAULT 'pending'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS site_inbound_requests_key ON site_inbound_requests (request_key) WHERE request_key IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS site_inbound_requests_ref ON site_inbound_requests (reference) WHERE reference IS NOT NULL`,
  // Demo requests (S-94 §3, 28 Oct). The kind list is widened, never narrowed: existing rows all remain valid.
  `DO $$ BEGIN
     ALTER TABLE site_inbound_requests DROP CONSTRAINT IF EXISTS site_inbound_requests_kind_check;
     ALTER TABLE site_inbound_requests ADD CONSTRAINT site_inbound_requests_kind_check
       CHECK (kind IN ('Pilot request','Pricing request','Security document request','Accessibility feedback','Contact','Demo request'));
   END $$`,
  // Attribution (mka-001, 29 Oct): the utm_* tags of the link the visitor arrived with, sanitised by submitRequest. Not personal data.
  `ALTER TABLE site_inbound_requests ADD COLUMN IF NOT EXISTS utm_source text`,
  `ALTER TABLE site_inbound_requests ADD COLUMN IF NOT EXISTS utm_medium text`,
  `ALTER TABLE site_inbound_requests ADD COLUMN IF NOT EXISTS utm_campaign text`,
];

let ready: Promise<void> | null = null;
export function ensureSchema() {
  if (!ready) {
    const sql = pg();
    ready = (async () => { for (const s of SITE_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}
