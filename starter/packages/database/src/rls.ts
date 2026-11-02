import type { PoolClient } from "pg";
import { getPool } from "./client";

export type RlsScope = { accountId: string; tenantId: string };

/**
 * Runs `work` in one transaction as the RLS-subject role with the tenant and
 * account bound. `set local` only lasts for the transaction, so the binding and
 * the queries must share a transaction; a separate statement would lose it.
 */
export async function withRlsTransaction<T>(
  scope: RlsScope,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    // Subject to RLS even when the connection role is privileged.
    await client.query("set local role semester_app");
    await client.query(
      "select set_config('app.current_account_id', $1, true), set_config('app.current_tenant_id', $2, true)",
      [scope.accountId, scope.tenantId],
    );
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
