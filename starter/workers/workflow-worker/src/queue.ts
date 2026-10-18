import { getPool } from "@semester/database/client";

export type LeasedJob = { id: string; kind: string; payload: unknown; attempts: number };
export type JobHandler = (job: LeasedJob) => Promise<void>;

// Job kinds are registered here. An unregistered kind fails closed.
export const handlers: Record<string, JobHandler> = {};

// A job whose lease is older than this is reclaimed after a worker crash.
export const LEASE_TIMEOUT = "5 minutes";

export async function leaseNextJob(): Promise<LeasedJob | null> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `update public.jobs
          set status = 'leased', leased_at = now(), attempts = attempts + 1
        where id = (
          select id from public.jobs
           where status = 'ready'
              or (status = 'leased' and leased_at < now() - $1::interval)
           order by created_at asc
           for update skip locked
           limit 1
        )
        returning id, kind, payload, attempts`,
      [LEASE_TIMEOUT],
    );
    await client.query("commit");
    const row = rows[0];
    return row ? { id: row.id, kind: row.kind, payload: row.payload, attempts: row.attempts } : null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Records the outcome only if this worker still holds the lease. A worker whose
 * handler outlived LEASE_TIMEOUT has a stale attempt number, so its write matches
 * no row and cannot overwrite the reprocessed job.
 */
export async function finishJob(
  id: string,
  attempts: number,
  status: "done" | "failed",
): Promise<boolean> {
  const result = await getPool().query(
    "update public.jobs set status = $3, leased_at = null where id = $1 and attempts = $2 and status = 'leased'",
    [id, attempts, status],
  );
  return result.rowCount === 1;
}

/** Leases and runs one job. Returns false when the queue is empty. */
export async function runOnce(): Promise<boolean> {
  const job = await leaseNextJob();
  if (!job) return false;
  const handler = handlers[job.kind];
  if (!handler) {
    await finishJob(job.id, job.attempts, "failed");
    return true;
  }
  try {
    await handler(job);
    await finishJob(job.id, job.attempts, "done");
  } catch {
    await finishJob(job.id, job.attempts, "failed");
  }
  return true;
}
