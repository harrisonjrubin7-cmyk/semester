/**
 * Claude, served to signed-in accounts.
 *
 * The point of this function is that a new user can upload a syllabus and get a
 * course without first going to console.anthropic.com for a key. The key lives
 * here, as a function secret, and never reaches a browser.
 *
 * Three things it insists on:
 *
 *  1. **A real account.** The caller's JWT is verified against the project, so
 *     the endpoint is not an open relay to someone else's API bill.
 *  2. **A monthly cap.** Metered per account in the `usage` table, so one
 *     person cannot spend the whole budget. Generating a course costs a few
 *     cents; the default cap is generous for a student and cheap for the owner.
 *     The counting is one atomic statement in the database, because the cap is
 *     worth exactly as much as the arithmetic behind it is — see below.
 *  3. **Streaming passes through.** The app renders Claude's answers as they
 *     arrive, and that should not stop being true because the call went through
 *     a function.
 *
 * Deploy:
 *     psql "$DATABASE_URL" -f supabase/migrations/20260901000900_usage_atomic.sql
 *     supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
 *     supabase functions deploy claude
 *
 * A student who would rather use their own key still can: the app prefers a key
 * set on the device, and only falls back to this.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';

/** Calls per account per calendar month. Raise it in the dashboard, not here. */
const MONTHLY_CALLS = Number(Deno.env.get('MONTHLY_CALL_LIMIT') ?? '60');

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  // Every header the app actually sends. A browser refuses the whole request
  // when a preflight omits one — anthropic-version is on every call, and
  // leaving it out here fails before the function ever runs.
  'Access-Control-Allow-Headers':
    'authorization, content-type, anthropic-version, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: { message: 'POST only.' } }, 405);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) {
    return json(
      { error: { message: 'This deployment has no shared key. Add your own under Ask Claude → Settings.' } },
      501,
    );
  }

  // ── who is asking ───────────────────────────────────────────────────────
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: { message: 'Sign in to use the shared key.' } }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data: user, error: authError } = await admin.auth.getUser(token);
  if (authError || !user?.user) {
    return json({ error: { message: 'That session is not valid. Sign in again.' } }, 401);
  }
  const userId = user.user.id;

  // ── how much they have used ─────────────────────────────────────────────
  //
  // Counted before the call is forwarded rather than after, and counted by the
  // database rather than here. Both halves of that matter.
  //
  // *By the database*, because `select calls` … `upsert(used + 1)` is a lost
  // update: two requests that read the same 59 both write 60, and the app
  // fires several generations at once when a syllabus is imported, so the
  // ordinary path through the app was the one that dropped counts. The cap was
  // therefore not a cap. `count_call` does the arithmetic inside one statement
  // that holds the row lock — see
  // `supabase/migrations/20260901000900_usage_atomic.sql`.
  //
  // *Before*, because the alternative is that the count lands after a network
  // call that can be abandoned. A client that disconnects mid-stream would be
  // a generation nobody paid for, repeatable as fast as connections can be
  // opened. Counting first means a call reserves its place and then happens;
  // the cost of that is a refused upstream still costing a call, which the
  // previous arrangement deliberately chose as well.
  const month = new Date().toISOString().slice(0, 7);
  const { data: used, error: meterError } = await admin.rpc('count_call', {
    p_user: userId,
    p_month: month,
  });

  if (meterError || typeof used !== 'number') {
    // Refusing rather than forwarding. A meter that cannot count is a key with
    // no cap on it, and that is the one failure not to be generous about.
    return json({ error: { message: 'Usage could not be checked just now. Try again in a moment.' } }, 503);
  }

  if (used > MONTHLY_CALLS) {
    return json(
      {
        error: {
          message:
            `That is ${MONTHLY_CALLS} generations this month on the shared key. ` +
            `Add your own key under Ask Claude → Settings to carry on — it bypasses this limit.`,
        },
      },
      429,
    );
  }

  // ── forward it ──────────────────────────────────────────────────────────
  const body = await req.text();
  const upstream = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...cors,
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      'X-Calls-Remaining': String(Math.max(0, MONTHLY_CALLS - used)),
    },
  });
});
