import { neon } from '@neondatabase/serverless';
import { ZiteError } from 'zitejs/backend';

// The developer platform lives in Semester's controlled Postgres (schema: apps/semester/src/lib/devMigration.ts).
export const pg = () => neon(process.env.ZITE_POSTGRES_URL as string);
export const COMPANY = 'semester-company';
export const SANDBOX_TENANT = 'semester-sandbox';

export const fail = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** True once the Semester app has applied the developer-platform migration. */
export async function schemaReady() {
  const r = (await pg().query(`SELECT to_regprocedure('dev_install(text,text,text,text[],text,integer,text)') IS NOT NULL AS ok`)) as { ok: boolean }[];
  return !!r[0]?.ok;
}

/** Platform-wide actions need the founder-granted app_reviewer role (co_roles); no app code grants it. */
export async function isReviewer(userId: string) {
  const sql = pg();
  await sql.query(`CREATE TABLE IF NOT EXISTS co_roles (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('app_reviewer')), granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role))`);
  const g = (await sql.query(`SELECT 1 FROM co_roles WHERE tenant_id = $1 AND user_id = $2 AND role = 'app_reviewer' AND revoked_at IS NULL`, [COMPANY, userId])) as unknown[];
  return g.length > 0;
}

// Mirror of apps/semester/src/lib/devAuth.ts — keep in sync. Only synthetic, non-record scopes exist.
export const SCOPES: Record<string, string> = {
  'catalog:read': 'Read published course catalog (synthetic in sandbox)',
  'sections:read': 'Read section times and capacity (synthetic in sandbox)',
  'events:read': 'Read public campus events (synthetic in sandbox)',
};
export const FORBIDDEN_SCOPES = ['grades:read', 'enrollments:write', 'records:read', 'payments:write'];
