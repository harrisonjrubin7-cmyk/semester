/**
 * The LTI 1.3 launch, deployed — the I/O half of `_shared/lti.ts`.
 *
 * `GRADESCOPE-TURNITIN.md` is where this comes from and it is worth restating
 * in one line, because the direction is the thing people get backwards:
 * **Semester cannot submit into Gradescope, and Brightspace can launch
 * Semester.** The first needs a partner program that does not want a one-
 * person company; the second needs a 1EdTech standard, a school administrator
 * and this file.
 *
 * Deploy:
 *     supabase functions deploy lti --no-verify-jwt
 *
 * ## Why `--no-verify-jwt` is not a weakening here
 *
 * Every other function in this directory is called by this app's own front end
 * carrying a Supabase session, and each verifies that token itself — the flag
 * is off only because a CORS preflight carries no `Authorization` header.
 *
 * **This one has no Supabase caller at all.** Brightspace redirects a
 * student's browser here, and a browser arriving from an LMS has no Supabase
 * session and never will. What authenticates a launch is the platform's own
 * `id_token`, signed with the platform's private key, checked against the
 * public keys it publishes — and then checked again, claim by claim, against
 * the registration a school administrator installed. That is a stronger check
 * than the one being skipped, not a substitute for it, and it is the whole
 * subject of `_shared/lti.ts`.
 *
 * ## Two endpoints, and the order matters
 *
 *   POST|GET  …/lti/login    Brightspace asks us to start a login. We answer
 *                            with a redirect into Brightspace's own
 *                            authentication endpoint, having first written
 *                            down the `state` and `nonce` we put in it.
 *   POST      …/lti/launch   Brightspace posts the `id_token` back. We spend
 *                            the state, verify the signature, and put the
 *                            claims through every rule in `_shared/lti.ts`.
 *
 * ## Where this deliberately stops
 *
 * A validated launch tells us the platform's own id for a person, unique only
 * within that issuer. **Turning that into a Semester account is not done here
 * and is not done anywhere yet.** Whether a launch may create an account, and
 * what happens when the same human already made one themselves, is a real
 * decision with a real blast radius, and `20260921160000_lti.sql` says why it
 * is not being answered by accident in a foreign key.
 *
 * So the last thing this function does on success is render a checkpoint that
 * says what it validated. That is a deliberate stop and it is labelled as one,
 * for the reason `app/server/institution/sandbox.ts` gives about its own
 * strings: nothing here is ever a placeholder success state presented as real.
 * A page that said "welcome back" over no session would be exactly that.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5';
import { checkLaunch, startLogin, type Registration } from '../_shared/lti.ts';

/** How long a launch has between the redirect out and the POST back. */
const FLIGHT_SECONDS = 300;

/*
 * One JWKS fetcher per platform, kept between invocations so a warm instance
 * is not re-fetching a key document on every launch. `jose` handles the
 * caching and the re-fetch on an unknown `kid` — which is the case that
 * matters, because it is what happens when a platform rotates its keys and is
 * the difference between a rotation being invisible and being an outage.
 */
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function keysFor(jwksUrl: string) {
  let set = keySets.get(jwksUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(jwksUrl));
    keySets.set(jwksUrl, set);
  }
  return set;
}

const db = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

/**
 * A refusal a person can read, and a log line that says which rule refused.
 *
 * Two audiences and they want opposite things. The student sees a sentence
 * that does not blame them and does not leak which check failed; the log gets
 * the reason word, because "the launch was refused" with no reason is the
 * thing that makes an LTI integration take a week to install.
 */
function refuse(reason: string, detail: string, status = 400): Response {
  console.error(`lti refused: ${reason} — ${detail}`);
  return page(
    status,
    'This link could not be opened',
    `Semester could not verify this launch came from your school's Brightspace. Nothing was changed. If this keeps happening, the reference is <code>${escape(reason)}</code>.`,
  );
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/*
 * Plain HTML, inline, and no link to the app's stylesheet. This renders inside
 * an iframe on the LMS's page, where the app's own shell is not loaded and a
 * stylesheet fetch is one more thing that can fail in front of somebody who is
 * already looking at an error.
 */
function page(status: number, title: string, body: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escape(title)}</title>` +
      `<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:2rem;color:#111;background:#fff}` +
      `main{max-width:34rem;margin:0 auto}h1{font-size:1.25rem}code{font-size:.9em;background:#f2f2f2;padding:.1em .3em;border-radius:3px}` +
      `@media(prefers-color-scheme:dark){body{color:#eee;background:#111}code{background:#222}}</style>` +
      `<main><h1>${escape(title)}</h1><p>${body}</p></main>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

/** The registration a school administrator installed, or null. */
async function registration(
  client: ReturnType<typeof db>,
  issuer: string,
  clientId?: string,
): Promise<Registration | null> {
  let q = client
    .from('lti_platform')
    .select('issuer, client_id, deployment_id, auth_login_url, jwks_url')
    .eq('issuer', issuer);
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q.limit(2);
  if (error) {
    console.error(`lti registration lookup failed: ${error.message}`);
    return null;
  }
  /*
   * Exactly one, or none. More than one row means the login did not say enough
   * to identify a deployment and guessing would pick a school at random — so
   * this refuses rather than taking the first, which is the failure mode that
   * only shows up at the second institution to install the tool.
   */
  if (!data || data.length !== 1) return null;
  const r = data[0];
  return {
    issuer: r.issuer,
    clientId: r.client_id,
    deploymentId: r.deployment_id,
    authLoginUrl: r.auth_login_url,
    jwksUrl: r.jwks_url,
  };
}

/** Both a GET and a POST arrive here in the wild, so read both the same way. */
async function params(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) out[k] = v;
  if (req.method === 'POST') {
    const body = await req.formData().catch(() => null);
    if (body) for (const [k, v] of body) if (typeof v === 'string') out[k] = v;
  }
  return out;
}

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const client = db();

  // ── Step one: start a login ─────────────────────────────────────────────
  if (path.endsWith('/login')) {
    const p = await params(req);
    const iss = (p.iss ?? '').trim();
    if (!iss) return refuse('no-iss', 'The login request carried no issuer.');

    const reg = await registration(client, iss, (p.client_id ?? '').trim() || undefined);
    if (!reg) return refuse('unknown-iss', `No single registration for issuer ${iss}.`);

    const redirectUri = `${new URL(req.url).origin}${new URL(req.url).pathname.replace(/\/login$/, '/launch')}`;
    /*
     * The one thing in this flow that must not be predictable, and the one
     * thing `_shared/lti.ts` cannot make — which is why it takes both as
     * arguments and stays testable.
     */
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    const verdict = startLogin(p, reg, redirectUri, state, nonce);
    if (!verdict.ok) return refuse(verdict.reason, verdict.detail);

    const { error } = await client.from('lti_nonce').insert({
      state,
      nonce,
      issuer: reg.issuer,
      client_id: reg.clientId,
      expires_at: new Date(Date.now() + FLIGHT_SECONDS * 1000).toISOString(),
    });
    if (error) {
      // Written before the redirect, not after, and a failure stops here: a
      // redirect whose state was never stored sends the student to Brightspace
      // to come back to a launch that cannot be checked.
      return refuse('no-store', `Could not record the launch state: ${error.message}`, 500);
    }

    return Response.redirect(verdict.value.redirectTo, 302);
  }

  // ── Step two: the platform posts the token back ─────────────────────────
  if (path.endsWith('/launch')) {
    if (req.method !== 'POST') return refuse('not-post', `Launch arrived as ${req.method}.`, 405);
    const p = await params(req);

    const state = (p.state ?? '').trim();
    const token = (p.id_token ?? '').trim();
    if (!state) return refuse('no-state', 'The launch carried no state.');
    if (!token) return refuse('no-token', 'The launch carried no id_token.');

    /*
     * Spent first, and atomically, before anything is fetched or verified.
     * Two POSTs carrying the same state race otherwise, and the loser of that
     * race is a replayed launch that both halves believe. The function does
     * the check and the write in one statement for exactly that reason —
     * `lti.check.sql` removes the guard and watches this go through.
     */
    const { data: spent, error: spendError } = await client
      .rpc('spend_lti_nonce', { want_state: state })
      .maybeSingle();
    if (spendError) return refuse('spend-failed', spendError.message, 500);
    if (!spent) return refuse('stale-state', 'The launch state is unknown, expired or already spent.');

    /*
     * The registration comes from the flight we recorded, never from the token
     * in hand. A token that got to choose which registration it is checked
     * against is a token that passes every check in `_shared/lti.ts`.
     */
    const reg = await registration(client, spent.issuer, spent.client_id);
    if (!reg) return refuse('registration-gone', `Registration for ${spent.issuer} is no longer there.`, 500);

    let claims: Record<string, unknown>;
    try {
      // Signature only. Every claim rule is in `_shared/lti.ts`, where it is
      // tested; duplicating two of them here would mean two places to be
      // wrong and one of them with no test on it.
      const { payload } = await jwtVerify(token, keysFor(reg.jwksUrl));
      claims = payload as Record<string, unknown>;
    } catch (e) {
      return refuse('bad-signature', `The token did not verify against ${reg.jwksUrl}: ${e}`, 401);
    }

    const verdict = checkLaunch({
      claims,
      reg,
      expectedNonce: spent.nonce,
      redirectUri: `${new URL(req.url).origin}${new URL(req.url).pathname}`,
      now: Math.floor(Date.now() / 1000),
    });
    if (!verdict.ok) return refuse(verdict.reason, verdict.detail, 401);

    const who = verdict.value;
    console.log(
      `lti launch ok: iss=${who.issuer} deployment=${who.deploymentId} sub=${who.subject} context=${who.contextId ?? '-'} teaches=${who.teaches}`,
    );

    /*
     * The deliberate stop. Everything above this line is the LTI handshake and
     * it is complete and checked; everything below it would be the identity
     * decision, which is not made yet. Saying so beats a welcome page over a
     * session that does not exist.
     */
    return page(
      200,
      'Launch verified',
      `Semester verified this launch from <strong>${escape(who.issuer)}</strong>` +
        (who.contextTitle ? ` for <strong>${escape(who.contextTitle)}</strong>` : '') +
        `. Signing in from Brightspace is not switched on yet, so there is nothing further to open here — ` +
        `this page confirms the connection your administrator installed is working.`,
    );
  }

  return refuse('no-such-endpoint', `Nothing is served at ${path}.`, 404);
});
