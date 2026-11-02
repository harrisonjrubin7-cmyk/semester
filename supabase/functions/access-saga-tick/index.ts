/**
 * The access saga worker's tick, called every five minutes by the
 * `access-saga-worker` pg_cron job in `supabase/scheduler.sql`.
 *
 * It runs `runScheduledAccessSagaTick()` from
 * `app/server/institution/access-saga-tick.ts` — through the copy
 * `app/scripts/edge-access-saga.ts` generates into `_shared/access-saga/` —
 * with the service role, which the platform injects. The scheduler's token is
 * checked by the database against Vault (`public.access_saga_tick_authorized`,
 * the same arrangement as `integration-tick`'s), so this function needs no
 * secret of its own. `_shared/integrationtick.ts` has the request rules and
 * why; they are the same for both ticks.
 *
 * `verify_jwt` is off, as for `integration-tick`: the caller is the scheduler,
 * not a signed-in person, and it authenticates with the Vault token instead.
 *
 * Nothing moves until participants are registered in
 * `app/server/institution/access-saga-registry.ts`, which holds null; until
 * then each tick answers `outcome: unregistered` with the count of sagas that
 * are due, and claims none of them.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SERVICES } from '../_shared/access-saga/access-saga-registry.ts';
import { runScheduledAccessSagaTick } from '../_shared/access-saga/access-saga-tick.ts';
import { serveTick } from '../_shared/integrationtick.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve((req: Request) => {
  if (!SUPABASE_URL || !SERVICE_KEY) return serveTick(req, null);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return serveTick(req, {
    async authorized(token) {
      const { data, error } = await db.rpc('access_saga_tick_authorized', { presented: token });
      if (error) throw new Error('token check unavailable');
      return data === true;
    },
    run: () => runScheduledAccessSagaTick(db, SERVICES),
  });
});
