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

export async function finishJob(id: string, status: "done" | "failed"): Promise<void> {
  await getPool().query(
    "update public.jobs set status = $2, leased_at = null where id = $1",
    [id, status],
  );
}

/** Leases and runs one job. Returns false when the queue is empty. */
export async function runOnce(): Promise<boolean> {
  const job = await leaseNextJob();
  if (!job) return false;
  const handler = handlers[job.kind];
  if (!handler) {
    await finishJob(job.id, "failed");
    return true;
  }
  try {
    await handler(job);
    await finishJob(job.id, "done");
  } catch {
    await finishJob(job.id, "failed");
  }
  return true;
}
