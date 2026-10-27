import { pg } from './fin';

// Company roles held on the server (Neon co_roles). No app code grants them: a grant is a permission change made with the
// founder's approval. Every check re-reads the table, so a revocation applies to the next request.
export const COMPANY = 'semester-company';
export const CO_ROLES = ['app_reviewer', 'incident_responder', 'incident_exec', 'privacy_officer', 'marketer', 'marketing_approver', 'impl_lead', 'support_agent', 'board_preparer', 'board_approver', 'board_reader', 'security_lead'] as const;
export type CoRole = (typeof CO_ROLES)[number];

const list = CO_ROLES.map((r) => `'${r}'`).join(', ');
export const CO_ROLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS co_roles (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role))`,
  // Widen the allowed-role check once (the first version allowed only app_reviewer).
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'co_roles_role_check' AND pg_get_constraintdef(oid) LIKE '%security_lead%') THEN
       ALTER TABLE co_roles DROP CONSTRAINT IF EXISTS co_roles_role_check;
       ALTER TABLE co_roles ADD CONSTRAINT co_roles_role_check CHECK (role IN (${list}));
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION co_has(p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM co_roles WHERE tenant_id = 'semester-company' AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
];

let ready: Promise<void> | null = null;
export function ensureCoRoles() {
  if (!ready) { const sql = pg(); ready = (async () => { for (const s of CO_ROLE_STATEMENTS) await sql.query(s); })().catch((e) => { ready = null; throw e; }); }
  return ready;
}

export async function rolesOf(userId: string): Promise<CoRole[]> {
  await ensureCoRoles();
  const rows = (await pg().query(`SELECT role FROM co_roles WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [COMPANY, userId])) as { role: CoRole }[];
  return rows.map((r) => r.role);
}
