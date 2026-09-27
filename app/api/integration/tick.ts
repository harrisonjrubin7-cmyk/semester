/**
 * The scheduled sync tick, called by the `integration-sync` pg_cron job in
 * `supabase/scheduler.sql` with a bearer token that must equal
 * `INTEGRATION_CRON_SECRET`.
 *
 * Answers 503 to everything until that secret and the service credentials are
 * set, so a deploy that has not been configured cannot be made to run anything
 * — and the job stays parked until it has been. The response is counts only:
 * no connection, school or person is named.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ADAPTERS } from '../../server/integration/registry.ts';
import { tick, type TickSummary } from '../../server/integration/tick.ts';

type Env = Record<string, string | undefined>;

/** Constant-time, and length-blind: both sides are hashed first. */
export function bearerMatches(header: string | undefined, secret: string): boolean {
  const presented = /^Bearer (.+)$/.exec(header ?? '')?.[1];
  if (!presented || !secret) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(presented), digest(secret));
}

export async function serveTick(
  method: string | undefined,
  authorization: string | undefined,
  env: Env,
  run: (db: SupabaseClient) => Promise<TickSummary>,
): Promise<{ status: number; body: unknown }> {
  const secret = env.INTEGRATION_CRON_SECRET ?? '';
  const url = env.SEMESTER_AUTH_URL ?? '';
  const key = env.SEMESTER_AUTH_SERVICE_KEY ?? '';
  if (!secret || !url || !key) return { status: 503, body: { error: 'The integration scheduler is not configured.' } };
  if (method !== 'POST') return { status: 405, body: { error: 'POST only.' } };
  if (!bearerMatches(authorization, secret)) return { status: 401, body: { error: 'Unauthorized.' } };
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return { status: 200, body: await run(db) };
}

export default async function integrationTick(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let out: { status: number; body: unknown };
  try {
    const auth = req.headers.authorization;
    out = await serveTick(req.method, Array.isArray(auth) ? auth[0] : auth, process.env,
      (db) => tick(db, { adapters: ADAPTERS }));
  } catch {
    out = { status: 500, body: { error: 'The tick failed.' } };
  }
  res.writeHead(out.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(out.body));
}
