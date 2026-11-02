import type { Pool, PoolClient } from "pg";

export class ForbiddenError extends Error {}

export type IdentityContext = { userId: string; tenantId: string };

export async function withTenant<T>(
  pool: Pool,
  context: IdentityContext,
  operation: (db: PoolClient) => Promise<T>
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("begin");
    // CHANGED: the runtime login is NOINHERIT in the verification database, so it assumes the
    // restricted role explicitly. With an INHERIT login this line is harmless.
    await db.query("set local role semester_api");
    await db.query(
      `select set_config('semester.user_id', $1, true),
              set_config('semester.tenant_id', $2, true),
              set_config('statement_timeout', '5000', true),
              set_config('lock_timeout', '1000', true)`,
      [context.userId, context.tenantId]
    );
    const result = await db.query<{ allowed: boolean }>(
      `select iam.is_active_member($1::uuid) as allowed`,
      [context.tenantId]
    );
    if (!result.rows[0]?.allowed) throw new ForbiddenError("TENANT_ACCESS_DENIED");
    const value = await operation(db);
    await db.query("commit");
    return value;
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    db.release();
  }
}

export async function requireCapability(
  db: PoolClient,
  tenantId: string,
  workspaceId: string | null,
  capability: string
): Promise<void> {
  const result = await db.query<{ allowed: boolean }>(
    `select iam.has_capability($1::uuid, $2::uuid, $3::text) as allowed`,
    [tenantId, workspaceId, capability]
  );
  if (!result.rows[0]?.allowed) throw new ForbiddenError("CAPABILITY_REQUIRED");
}
