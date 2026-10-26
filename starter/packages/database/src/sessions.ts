import { createHash } from "node:crypto";
import { getPool } from "./client";

export type SessionRecord = {
  id: string;
  accountId: string;
  tenantId: string | null;
  membershipId: string | null;
  activeWorkspace: string | null;
  roleKey: string | null;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Resolution goes through a SECURITY DEFINER function so the app role never
// reads public.sessions directly.
export async function getSessionByToken(token: string): Promise<SessionRecord | null> {
  const { rows } = await getPool().query(
    `select session_id, account_id, tenant_id, membership_id, active_workspace, role_key
       from public.resolve_session($1)`,
    [hashSessionToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.session_id,
    accountId: row.account_id,
    tenantId: row.tenant_id,
    membershipId: row.membership_id,
    activeWorkspace: row.active_workspace,
    roleKey: row.role_key,
  };
}
