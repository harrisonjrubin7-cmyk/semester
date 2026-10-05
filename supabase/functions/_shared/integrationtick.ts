/**
 * The `integration-tick` function's request handling, with no `Deno.env` and
 * no database of its own, so `app/src/lib/integrationtick.test.ts` can walk
 * every answer it gives.
 *
 * The caller is the `integration-sync` pg_cron job in `supabase/scheduler.sql`,
 * sending `Authorization: Bearer <integration_cron_secret>`. The secret lives
 * only in Vault: `authorized` asks the database to compare it
 * (`public.integration_tick_authorized`), so no copy of it is set on the
 * function and nothing has to be kept in step when it is rotated.
 *
 * Fails closed at every step. Without the service credentials it answers 503
 * and touches nothing; if the database cannot say whether a token is right it
 * answers 503, never "yes"; and the body it returns is the tick's counts,
 * which name no school, connection or person.
 */

export interface TickDeps {
  /** Whether this bearer token is the scheduler's. Throws if that cannot be known. */
  authorized(token: string): Promise<boolean>;
  /** Run one tick and return its summary. */
  run(): Promise<unknown>;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** `deps` is null when the function has no service credentials. */
export async function serveTick(req: Request, deps: TickDeps | null): Promise<Response> {
  if (!deps) return json(503, { error: 'The integration scheduler is not configured.' });
  if (req.method !== 'POST') return json(405, { error: 'POST only.' });

  const token = /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1] ?? '';
  if (!token) return json(401, { error: 'Unauthorized.' });

  let ok: boolean;
  try {
    ok = await deps.authorized(token);
  } catch {
    return json(503, { error: 'The integration scheduler is not configured.' });
  }
  if (!ok) return json(401, { error: 'Unauthorized.' });

  try {
    return json(200, await deps.run());
  } catch {
    return json(500, { error: 'The tick failed.' });
  }
}
