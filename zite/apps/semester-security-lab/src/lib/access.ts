import { neon } from '@neondatabase/serverless';
import { ZiteError } from 'zitejs/backend';

// Server-only. Security Lab changes (findings, gates, policies, capability evidence, runs) need the security_lead company role,
// held in co_roles and granted with the founder's approval in Company OS; no app code grants it. Re-read on every request, so a
// revocation applies to the next call. If the role table is unreachable the answer is no.
async function holds(userId: string, roles: string[]) {
  try {
    const rows = (await neon(process.env.ZITE_POSTGRES_URL as string).query(
      `SELECT EXISTS (SELECT 1 FROM co_roles WHERE tenant_id = 'semester-company' AND user_id = $1 AND role = ANY($2) AND revoked_at IS NULL) AS ok`, [userId, roles])) as { ok: boolean }[];
    return !!rows[0]?.ok;
  } catch { return false; }
}

/** Reading Security Lab (findings, gates, capability evidence) needs security_reader or security_lead (decision 27 Oct). */
export async function requireSecurityReader(userId: string) {
  if (!(await holds(userId, ['security_lead', 'security_reader']))) throw new ZiteError({ code: 'FORBIDDEN', message: 'security_reader required', userFacingMessage: 'Security Lab needs the Security reader or Security lead role (granted in Company OS).' });
}

export async function requireSecurityLead(userId: string) {
  let ok = false;
  try {
    const rows = (await neon(process.env.ZITE_POSTGRES_URL as string).query(
      `SELECT EXISTS (SELECT 1 FROM co_roles WHERE tenant_id = 'semester-company' AND user_id = $1 AND role = 'security_lead' AND revoked_at IS NULL) AS ok`, [userId])) as { ok: boolean }[];
    ok = !!rows[0]?.ok;
  } catch { ok = false; }
  if (!ok) throw new ZiteError({ code: 'FORBIDDEN', message: 'security_lead required', userFacingMessage: 'Changing Security Lab records needs the Security lead role (granted in Company OS).' });
}
