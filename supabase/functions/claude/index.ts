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
 *     psql "$DATABASE_URL" -f supabase/migrations/20260921142822_usage_atomic.sql
 *     supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
 *     # or, to route through Vercel AI Gateway instead (it wins when both are set):
 *     supabase secrets set AI_GATEWAY_API_KEY=vck_…
 *     supabase functions deploy claude
 *
 * and it still serves nobody until the owner's decisions in
 * `../_shared/provideractivation.ts` are recorded with evidence and
 * `SHARED_AI_PROVIDER=on` is set. `docs/trust/SHARED-PROVIDER-ACTIVATION.md`
 * is the checklist.
 *
 * A student who would rather use their own key still can: the app prefers a key
 * set on the device, and only falls back to this.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { clampRequest, modelsForPlan, type SharedPlan } from '../_shared/clamp.ts';
import { planFromSubscriptions } from '../_shared/sharedplan.ts';
import {
  ALLOWANCE_EXHAUSTED,
  ALLOWANCE_MESSAGE,
  UsageScanner,
  type Usage,
  allowanceFor,
  costMicros,
  countInputTokens,
  describeRequest,
  reserveMicros,
  usageFromJson,
} from '../_shared/aispend.ts';
import { KILLED_MESSAGE, aiGenerationKilled } from '../_shared/killswitch.ts';
import {
  MEMBERSHIP_UNREADABLE_MESSAGE,
  TENANT_BUDGET_MESSAGE,
  TENANT_MANAGED_MESSAGE,
  loadSchoolAi,
  schoolAiDecision,
  schoolOf,
  sharedKeyAudience,
  tenantMeter,
} from '../_shared/tenantai.ts';
import { KEY_UNUSABLE_MESSAGE, describeThrow, keyShape, sharedKey } from '../_shared/sharedkey.ts';
import { NOT_ACTIVATED, NOT_ACTIVATED_MESSAGE, SHARED_PROVIDER, SWITCH, activation } from '../_shared/provideractivation.ts';

import { chooseUpstream } from '../_shared/upstream.ts';

/** Calls per account per calendar month. Raise it in the dashboard, not here. */
const MONTHLY_CALLS = Number(Deno.env.get('MONTHLY_CALL_LIMIT') ?? '60');


Deno.serve(async (req) => {
  /*
   * Per request, because the answer depends on who asked. `ALLOWED_ORIGIN` is
   * a comma-separated allowlist now and the header echoes back whichever entry
   * the request came from — see `../_shared/cors.ts`, which carries the
   * incident this shape exists because of.
   */
  const cors = corsHeaders(Deno.env.get('ALLOWED_ORIGIN'), req.headers.get('Origin'), Deno.env.get('CORS_ALLOW_DEV'));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: { message: 'POST only.' } }, 405);

  // ── whether the shared key may serve anybody ────────────────────────────
  //
  // First, before the key is read: a secret is a credential, not an
  // agreement. The owner's five decisions have to be recorded with evidence
  // and the deployment switch set, and until both are true nobody is served,
  // however the secret is set. See `../_shared/provideractivation.ts`. The
  // log names what is owed and nothing else.
  const gate = activation(SHARED_PROVIDER, Deno.env.get(SWITCH));
  if (!gate.active) {
    console.warn('claude: the shared key is not activated', { owed: gate.blockers });
    return json({ error: { message: NOT_ACTIVATED_MESSAGE, code: NOT_ACTIVATED } }, 501);
  }

  // The gateway when `AI_GATEWAY_API_KEY` is set, Anthropic directly otherwise.
  // See `../_shared/upstream.ts`.
  const gatewayKey = sharedKey(Deno.env.get('AI_GATEWAY_API_KEY'));
  const key = gatewayKey ?? sharedKey(Deno.env.get('ANTHROPIC_API_KEY'));
  const upstreamTo = chooseUpstream({ gateway: gatewayKey, anthropic: key });
  if (!key || !upstreamTo) {
    return json(
      { error: { message: 'This deployment has no shared key. Add your own under Ask Claude → Settings.' } },
      501,
    );
  }

  // A key that cannot travel as a header makes the `fetch` below throw
  // before anything is sent, which reads as "Claude could not be reached"
  // and, because the call is counted first, costs a student one of their
  // sixty for nothing. Refused here instead, before anybody is authenticated
  // or counted, with its shape in the log and none of its characters. See
  // `../_shared/sharedkey.ts` for the day this was found.
  const shape = keyShape(key);
  if (!shape.sendable) {
    console.error('claude: the shared key is set but cannot be sent', { ...shape, gateway: upstreamTo.gateway });
    return json({ error: { message: KEY_UNUSABLE_MESSAGE } }, 503);
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

  // ── whether generation is switched off ──────────────────────────────────
  //
  // Before the body is read and long before the call is counted: an engaged
  // switch costs nobody one of their sixty. The shared key serves individual
  // accounts with no school, so only the global row can stop it — see
  // `../_shared/killswitch.ts` for the two rules, including that a switch
  // which cannot be read is treated as thrown.
  if (await aiGenerationKilled(admin, null)) {
    return json({ error: { message: KILLED_MESSAGE } }, 503);
  }

  // ── whether this account is the shared key's to serve ───────────────────
  //
  // An account with no school is served as before. An account that belongs to
  // a school is served only if its school has turned AI on for it: the
  // feature is in production, the account is in the release cohort and holds a
  // permitted role, the school allows this provider and has budget left, and
  // its own kill switch is not engaged. Anything that cannot be read is
  // refused, not served — the plan lookup below falls back to `free` because
  // being wrong there costs a paying student some models; being wrong here
  // serves a school's student against their school. All of it is asked before
  // the plan is read and long before anything is counted, so a refusal costs
  // nobody one of their sixty. See `../_shared/tenantai.ts` and ADR-0005.
  const audience = sharedKeyAudience(await schoolOf(admin, userId));
  if (!audience.serve) {
    console.error('claude: the account\'s school could not be read; refusing');
    return json({ error: { message: MEMBERSHIP_UNREADABLE_MESSAGE } }, 503);
  }
  if (audience.school !== null) {
    if (await aiGenerationKilled(admin, audience.school)) {
      return json({ error: { message: KILLED_MESSAGE } }, 503);
    }
    const facts = await loadSchoolAi(admin, audience.school, userId);
    if (!facts) {
      console.error('claude: the school\'s AI policy could not be read; refusing');
      return json({ error: { message: MEMBERSHIP_UNREADABLE_MESSAGE } }, 503);
    }
    const school = schoolAiDecision(facts);
    if (!school.serve) {
      return school.reason === 'budget'
        ? json({ error: { message: TENANT_BUDGET_MESSAGE, code: 'tenant_budget' } }, 403)
        : json({ error: { message: TENANT_MANAGED_MESSAGE, code: 'tenant_managed_account' } }, 403);
    }
  }

  // ── which models their plan covers ──────────────────────────────────────
  //
  // Read the way `my_entitlements()` reads it — a subscription that is in
  // date, in a paying status and still holds entitlements — and before the
  // body is clamped, so the clamp can name the models this account may use.
  // The calls are counted, not the dollars, and the models cost very
  // different amounts: see `PLAN_MODELS` in `../_shared/clamp.ts`.
  //
  // A lookup that fails is `free`, never an error and never a wider list: the
  // student is served on what every account gets, and the log says why. The
  // cost of that direction is a paying student briefly offered fewer models,
  // which the refusal's own wording explains; the cost of the other is a
  // wider list for anyone who can make a query fail.
  let plan: SharedPlan = 'free';
  try {
    const { data, error } = await admin
      .from('billing_accounts')
      .select('subscriptions(plan_code, status, current_period_end, subscription_entitlements(entitlement_key))')
      .eq('user_id', userId);
    if (error) throw error;
    plan = planFromSubscriptions(
      (data ?? []).flatMap((a: { subscriptions?: unknown[] }) => a.subscriptions ?? []),
    );
  } catch (e) {
    console.error('claude: the plan could not be read; serving this account as free', describeThrow(e));
  }

  // ── what they asked for ─────────────────────────────────────────────────
  //
  // Read and rebuilt before the call is counted, so a request the shared key
  // will not pay for is refused without costing one of the caller's sixty. The
  // rules, and why each exists, are in `../_shared/clamp.ts`: a model the
  // account's plan covers, `max_tokens` held under a ceiling, the app's own
  // tools and a five-use web search, and nothing else. A body that cannot be
  // read at all is the caller's request falling over, and is answered as that.
  const raw = await req.text();
  const clamped = clampRequest(raw, new TextEncoder().encode(raw).length, { models: modelsForPlan(plan) });
  if (!clamped.ok) {
    // A request that held something above the data-class ceiling is recorded
    // by the fields that did and the highest class among them, from the clamp's
    // own result: no part of the body is in this line, and the shared key has
    // no school to write a tenant audit row for. It is refused here, before the
    // spend is reserved and before the call is counted. See `../_shared/clamp.ts`.
    if (clamped.audit) {
      console.warn('claude: refused above the data-class ceiling', { user: userId, ...clamped.audit });
    }
    return json(
      {
        error: {
          message: clamped.message,
          ...(clamped.code ? { code: clamped.code } : {}),
          ...(clamped.allowed ? { allowed_models: clamped.allowed } : {}),
        },
      },
      clamped.status,
    );
  }
  const body = clamped.body;

  // ── how much they may spend ─────────────────────────────────────────────
  //
  // The sixty calls below count requests; the bill counts tokens, and the
  // models differ tenfold in price. So the worst case this request could cost
  // is *reserved* against the account's dollar allowance first — counted input
  // plus the whole `max_tokens` plus every search it may run — and the
  // difference is given back when the call finishes. Reserved by the database
  // in one statement that holds the row lock (`add_spend`, see
  // `supabase/migrations/20261004170000_ai_spend_meter.sql`), for the reason
  // `count_call` is: read-then-write loses updates under the parallel
  // generations a syllabus import fires. See `../_shared/aispend.ts`.
  //
  // Before the call is forwarded, so a disconnect mid-stream still costs the
  // reservation. A meter that cannot answer refuses, as the call counter does.
  const month = new Date().toISOString().slice(0, 7);
  const priced = describeRequest(body, new TextEncoder().encode(body).length);
  // The count is Anthropic's endpoint, which the gateway key must not be sent to.
  const inputTokens = upstreamTo.gateway
    ? priced.estimateTokens
    : await countInputTokens(body, priced.estimateTokens, fetch, key);
  const reserve = reserveMicros({ ...priced, inputTokens });
  const allowance = allowanceFor(plan, (n) => Deno.env.get(n));
  const spend = (delta: number, cap: number | null) =>
    admin.rpc('add_spend', { p_user: userId, p_month: month, p_delta: delta, p_cap: cap });
  // Giving a reservation back is best-effort: a failure leaves it standing,
  // which errs towards the owner, and is logged so it can be found.
  //
  // A school's account draws down its school's monthly budget in step with its
  // own allowance: the school's meter (`reserve_ai_budget`, in whole cents) is
  // reserved right after the account's, released wherever the account's is,
  // and settled wherever the account's is settled or left standing. See
  // `../_shared/tenantai.ts`.
  const tenant = audience.school === null ? null : tenantMeter(admin, audience.school, reserve);
  const release = async (micros: number, why: string) => {
    const { error } = await spend(-micros, null);
    if (error) console.error('claude: a spend reservation could not be released', { why, micros });
    await tenant?.release(why);
  };

  const { data: held, error: spendError } = await spend(reserve, allowance);
  if (spendError || typeof held !== 'number') {
    return json({ error: { message: 'Usage could not be checked just now. Try again in a moment.' } }, 503);
  }
  if (held < 0) {
    return json({ error: { message: ALLOWANCE_MESSAGE, code: ALLOWANCE_EXHAUSTED } }, 429);
  }
  if (tenant) {
    const room = await tenant.reserve();
    if (room !== 'held') {
      await release(reserve, 'school budget');
      return room === 'full'
        ? json({ error: { message: TENANT_BUDGET_MESSAGE, code: 'tenant_budget' } }, 403)
        : json({ error: { message: MEMBERSHIP_UNREADABLE_MESSAGE } }, 503);
    }
  }

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
  // `supabase/migrations/20260921142822_usage_atomic.sql`.
  //
  // *Before*, because the alternative is that the count lands after a network
  // call that can be abandoned. A client that disconnects mid-stream would be
  // a generation nobody paid for, repeatable as fast as connections can be
  // opened. Counting first means a call reserves its place and then happens;
  // the cost of that is a refused upstream still costing a call, which the
  // previous arrangement deliberately chose as well.
  const { data: used, error: meterError } = await admin.rpc('count_call', {
    p_user: userId,
    p_month: month,
  });

  if (meterError || typeof used !== 'number') {
    // Refusing rather than forwarding. A meter that cannot count is a key with
    // no cap on it, and that is the one failure not to be generous about.
    await release(reserve, 'meter');
    return json({ error: { message: 'Usage could not be checked just now. Try again in a moment.' } }, 503);
  }

  if (used > MONTHLY_CALLS) {
    await release(reserve, 'call cap');
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
  //
  // Wrapped, because an unwrapped `fetch` here throws out of the handler and
  // the student gets whichever opaque 500 the runtime decides to write. That
  // was survivable when the call was counted afterwards. It is not now: the
  // count moved in front of this fetch so that a disconnect could not buy a
  // free generation, which means a DNS blip on the way to Anthropic already
  // costs somebody one of their sixty, and the only thing on screen to explain
  // it is a blank error.
  //
  // The count is not given back, and that is deliberate rather than mean. A
  // `fetch` that throws does not say whether the request was sent: a reset
  // mid-flight may well have reached Anthropic and been billed, and a refund
  // on every throw is a free retry loop for anybody who can induce one. So the
  // charge stands and the message says so, which is the honest half of the
  // trade — a student who is told they were charged can decide what to do, and
  // one who is not told simply loses a generation to a blank box.
  // The body was read and clamped above, outside this `try`, so the catch
  // below covers reaching Anthropic and only that.

  let upstream: Response;
  try {
    upstream = await fetch(upstreamTo.url, {
      method: 'POST',
      headers: upstreamTo.headers,
      body: upstreamTo.body(body),
    });
  } catch (e) {
    // Deliberately not the thrown message: it carries the upstream host and,
    // depending on the runtime, the request that was being sent. The log gets
    // its kind (a header the runtime refused, the network, or neither) and
    // the key's shape, which is enough to tell a bad paste from an outage.
    console.error('claude: the call to Anthropic threw', { ...describeThrow(e), key: shape });
    // The account's reservation stands (the request may have been billed), so the school's does too.
    await tenant?.settle(null);
    return json(
      {
        error: {
          message:
            'Claude could not be reached just now, and this attempt still counted against ' +
            'your monthly total — there is no way to tell from a dropped connection whether ' +
            'the request arrived. Try again in a moment.',
        },
      },
      502,
    );
  }

  const headers = {
    ...cors,
    'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    'X-Calls-Remaining': String(Math.max(0, MONTHLY_CALLS - used)),
  };

  // ── settle the reservation ──────────────────────────────────────────────
  //
  // A refused upstream (4xx/5xx) produced no tokens, so the reservation is
  // given back. A success is settled to what it actually used, read from the
  // usage blocks as the bytes pass — never held, never altered, so streaming
  // is as it was. A response whose usage could not be read stands at its
  // reservation, and so does a stream the client abandons before it ends
  // (`flush` never runs): both err towards the owner.
  if (!upstream.ok) {
    await release(reserve, `upstream ${upstream.status}`);
    return new Response(upstream.body, { status: upstream.status, headers });
  }
  const settle = async (actual: number | null, usage?: Usage) => {
    await tenant?.settle(actual, usage);
    if (actual === null) return;
    const { error } = await spend(actual - reserve, null);
    if (error) console.error('claude: a spend reservation could not be settled', { reserve, actual });
  };

  if ((upstream.headers.get('Content-Type') ?? '').includes('text/event-stream') && upstream.body) {
    const scanner = new UsageScanner();
    const pass = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        scanner.push(chunk);
      },
      async flush() {
        scanner.end();
        await settle(scanner.seen ? costMicros(scanner.usage, priced.model) : null, scanner.seen ? scanner.usage : undefined);
      },
    });
    return new Response(upstream.body.pipeThrough(pass), { status: upstream.status, headers });
  }

  const text = await upstream.text();
  const usage = usageFromJson(text);
  await settle(usage ? costMicros(usage, priced.model) : null, usage ?? undefined);
  return new Response(text, { status: upstream.status, headers });
});
