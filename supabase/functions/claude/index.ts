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
 *  3. **Streaming passes through.** The app renders Claude's answers as they
 *     arrive, and that should not stop being true because the call went through
 *     a function.
 *
 * Deploy:
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
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  const month = new Date().toISOString().slice(0, 7);
  const { data: row } = await admin
    .from('usage')
    .select('calls')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  const used = row?.calls ?? 0;
  if (used >= MONTHLY_CALLS) {
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

  // Count the call whether or not the model liked the request: a failed call
  // still costs, and an uncounted failure is a free retry loop.
  await admin.from('usage').upsert(
    { user_id: userId, month, calls: used + 1, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,month' },
  );

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...cors,
      'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      'X-Calls-Remaining': String(Math.max(0, MONTHLY_CALLS - used - 1)),
    },
  });
});
