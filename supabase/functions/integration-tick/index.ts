/**
 * The integration sync tick, called every fifteen minutes by the
 * `integration-sync` pg_cron job in `supabase/scheduler.sql`.
 *
 * It runs `tick()` from `app/server/integration/tick.ts` — through the copy
 * `app/scripts/edge-integration.ts` generates into `_shared/integration/` —
 * with the service role, which the platform injects. The scheduler's token is
 * checked by the database against Vault (`_shared/integrationtick.ts` has the
 * request rules and why), so this function needs no secret of its own.
 *
 * `verify_jwt` is off, as for `push`: the caller is the scheduler, not a
 * signed-in person, and it authenticates with the Vault token instead.
 *
 * Nothing syncs until an adapter is registered in
 * `app/server/integration/registry.ts`, which is empty; until then each tick
 * reports every connection as unregistered. No credential services are passed
 * to `tick`, so an adapter that declares a credential is refused (and
 * dead-lettered as `authentication`) rather than calling its provider
 * anonymously; see `provider-client.ts`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { ADAPTERS } from '../_shared/integration/registry.ts';
import { providerRuntime } from '../_shared/integration/provider-client.ts';
import { tick } from '../_shared/integration/tick.ts';
import { serveTick } from '../_shared/integrationtick.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve((req: Request) => {
  if (!SUPABASE_URL || !SERVICE_KEY) return serveTick(req, null);
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return serveTick(req, {
    async authorized(token) {
      const { data, error } = await db.rpc('integration_tick_authorized', { presented: token });
      if (error) throw new Error('token check unavailable');
      return data === true;
    },
    // No credential services: an adapter that declares a credential is refused,
    // not called anonymously. A deployment that has a secret store, a token store
    // and an audit sink passes them here.
    run: () => tick(db, { adapters: ADAPTERS, runtime: providerRuntime() }),
  });
});
