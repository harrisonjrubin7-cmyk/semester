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
 * ## Which account a launch opens
 *
 * `20260921160100_lti_identity.sql` is the decision this function now carries
 * out, and it is two rules rather than one.
 *
 * **A first launch makes an account.** A professor switches the tool on and
 * two hundred students click it that week; every one asked to go and sign up
 * first is one who does not come back. So a launch that finds no identity
 * provisions one, keyed on the issuer and the platform's subject.
 *
 * **Attaching an account somebody already had is never automatic.** Nothing
 * here reads the token's email claim to find an existing account, because an
 * email claim is a string a registered platform sends us and matching on it
 * hands an account to whoever can get one registration row wrong. Instead the
 * launch issues a *ticket*, and `adopt_lti_identity` spends it only alongside
 * a session the student proved — two proofs, held by no single party.
 *
 * `_shared/ltiaccount.ts` makes that structural rather than careful: a
 * provisioned account's address is synthesised on a domain that cannot receive
 * mail, so there is no account for an email match to find even if somebody
 * later writes one.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createRemoteJWKSet, importJWK, jwtVerify, SignJWT, type JWK } from 'npm:jose@5';
import { checkLaunch, startLogin, type Launch, type Registration } from '../_shared/lti.ts';
import { landingPath, provisionedEmail, provisionedMetadata } from '../_shared/ltiaccount.ts';
import { autoPostForm, mayPlace, readSettings, resourceLinkItem, responseClaims } from '../_shared/ltideeplink.ts';
import { SCOPE, clientAssertion, jwks, keyId, publicJwk, tokenRequest } from '../_shared/ltikey.ts';
import {
  SCORE_MEDIA,
  matchLineItem,
  readEndpoint,
  scoreBody,
  scoresUrl,
  tokenResponse,
  type LineItemRow,
} from '../_shared/ltiags.ts';
import { corsHeaders } from '../_shared/cors.ts';

/** How long a launch has between the redirect out and the POST back. */
const FLIGHT_SECONDS = 300;

/**
 * How long a student has to say "I already have an account" after landing.
 *
 * One screen's worth. The ticket is the proof that a launch happened, and a
 * proof that lives for an hour is a proof somebody can come back to from a
 * different browser.
 */
const TICKET_SECONDS = 900;

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
): Promise<(Registration & { tokenUrl: string | null }) | null> {
  let q = client
    .from('lti_platform')
    .select('issuer, client_id, deployment_id, auth_login_url, jwks_url, token_url')
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
    tokenUrl: r.token_url ?? null,
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

/**
 * The account this launch opens, made if it is not there yet.
 *
 * Returns the address to mint a session for, and a link ticket when — and
 * only when — this call is what created the account. An existing identity
 * gets no ticket: there is nothing to adopt, and handing one out anyway would
 * let a student who launches every week keep a live proof in their history.
 */
async function accountFor(
  client: ReturnType<typeof db>,
  who: Launch,
): Promise<{ ok: true; email: string; ticket: string | null } | { ok: false; reason: string; detail: string }> {
  const { data: known, error: lookupError } = await client
    .from('lti_identity')
    .select('user_id')
    .eq('issuer', who.issuer)
    .eq('subject', who.subject)
    .maybeSingle();
  if (lookupError) return { ok: false, reason: 'identity-lookup', detail: lookupError.message };

  const email = await provisionedEmail(who.issuer, who.subject);

  if (known) {
    /*
     * Already bound. The address is read back from the account rather than
     * recomputed, because an adopted identity points at an account the student
     * made themselves and that account's address is their real one — the
     * synthesised address belongs to the account that was retired.
     */
    const { data: user, error } = await client.auth.admin.getUserById(known.user_id);
    if (error || !user?.user?.email) {
      return { ok: false, reason: 'account-gone', detail: error?.message ?? 'bound account has no address' };
    }
    return { ok: true, email: user.user.email, ticket: null };
  }

  /*
   * The invite gate, and the reason this is three lines rather than a flag.
   *
   * `only_invited()` is a before-insert trigger on `auth.users` that refuses
   * any address not on `public.invites` while the pilot gate is on. Creating
   * an account here would hit it and the launch would die with an opaque
   * `check_violation`.
   *
   * The gate is not weakened to get past it. Instead the address is put on the
   * list first, which is the honest reading of what happened: **a school's
   * administrator installing this tool is an invitation**, issued by exactly
   * the person the gate exists to let issue them. It leaves a row saying so,
   * which a flag on the trigger would not.
   */
  const { error: inviteError } = await client
    .from('invites')
    .upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  if (inviteError) return { ok: false, reason: 'invite-failed', detail: inviteError.message };

  const { data: made, error: createError } = await client.auth.admin.createUser({
    email,
    // Confirmed, because there is nothing to confirm: the address is on a
    // domain that cannot receive mail and the platform has already
    // authenticated this person. An unconfirmed account cannot sign in.
    email_confirm: true,
    user_metadata: provisionedMetadata(who),
  });
  if (createError || !made?.user) {
    return { ok: false, reason: 'create-failed', detail: createError?.message ?? 'no user returned' };
  }

  const { error: bindError } = await client
    .from('lti_identity')
    .insert({ issuer: who.issuer, subject: who.subject, user_id: made.user.id, origin: 'provisioned' });
  if (bindError) {
    /*
     * Two launches by the same person at the same moment — a double click on a
     * slow link — race here, and the loser must not leave an orphan account
     * behind that nothing points at. Removing it is safe precisely because it
     * is one statement old and the winner's row is the right answer for both.
     */
    await client.auth.admin.deleteUser(made.user.id).catch(() => {});
    return { ok: false, reason: 'bind-failed', detail: bindError.message };
  }

  const ticket = crypto.randomUUID();
  const { error: ticketError } = await client.from('lti_link_ticket').insert({
    ticket,
    issuer: who.issuer,
    subject: who.subject,
    provisioned_user_id: made.user.id,
    expires_at: new Date(Date.now() + TICKET_SECONDS * 1000).toISOString(),
  });
  // A ticket that could not be written costs the student the "I already have
  // an account" path on this launch and nothing else, so it is logged rather
  // than made fatal: the account is real and the session is about to work.
  if (ticketError) console.error(`lti ticket not issued: ${ticketError.message}`);

  return { ok: true, email, ticket: ticketError ? null : ticket };
}

/**
 * This tool's own signing key.
 *
 * Read here and published as its public half below. **Nothing signs with it
 * yet** — grade passback and deep linking are the callers and neither is
 * built — and that is not a reason to hold the endpoint back, because a JWKS
 * URL is a *registration-time* artifact: Brightspace asks a school's
 * administrator for it while they install the tool, long before anything is
 * signed. Publishing it is what lets them finish.
 *
 * `_shared/ltikey.ts` carries the rest of the exchange — the assertion claims
 * and the token request — specified and tested, and deliberately not wired to
 * anything. The migration for this feature refused to hold key material
 * "before anything signs with it"; the same reasoning applies to a live
 * signing path with no caller.
 *
 * A JWK in a function secret, which is where `VAPID_PRIVATE_KEY` lives and for
 * the same reason: a private key used only by an Edge Function, whose public
 * half is published on purpose. `_shared/ltikey.ts` argues it at length,
 * including why not the Vault and why not a table.
 *
 * Absent is a working state, not a broken one. A launch needs no key at all —
 * only calling *back* into Brightspace does — so a project that has not set
 * one serves no JWKS and says so, and every student can still launch.
 */
function privateJwk(): Record<string, unknown> | null {
  const raw = Deno.env.get('LTI_PRIVATE_KEY');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    /*
     * Logged as the shape of the fault rather than the value, obviously. A
     * malformed key is the one configuration error here that cannot be
     * inferred from the outside: the endpoint would 500 and the platform would
     * report only that our JWKS could not be read.
     */
    console.error('lti: LTI_PRIVATE_KEY is set but is not JSON');
    return null;
  }
}

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const client = db();

  /*
   * ── A score, going the other way ──────────────────────────────────────
   *
   * The one route here a browser reaches with `fetch` rather than by being
   * sent, so the one that needs CORS and the one that verifies a Semester
   * session rather than a platform token. The app calls it when a quiz ends,
   * with a course code and a score; the answer is whether that went anywhere.
   *
   * Every refusal below the session check answers 200 with `reported: false`
   * and a reason word. They are not errors from the student's side — "this
   * course is not graded in Brightspace" is the ordinary state of nearly
   * every course in the app — and a 4xx would put a red line in a console
   * for a quiz that went perfectly well.
   */
  if (path.endsWith('/score')) {
    const cors = corsHeaders(Deno.env.get('ALLOWED_ORIGIN'), req.headers.get('Origin'));
    const answer = (body: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, 'content-type': 'application/json' },
      });
    const not = (reason: string, detail: string, status = 200) => {
      console.log(`lti score not reported: ${reason} — ${detail}`);
      return answer({ reported: false, reason }, status);
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return answer({ error: 'POST only' }, 405);

    // ── who is asking ──────────────────────────────────────────────────
    const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!bearer) return answer({ error: 'Sign in first.' }, 401);
    const { data: session, error: authError } = await client.auth.getUser(bearer);
    if (authError || !session?.user) return answer({ error: 'That session is not valid.' }, 401);
    const userId = session.user.id;

    let body: { code?: unknown; given?: unknown; max?: unknown };
    try {
      body = await req.json();
    } catch {
      return answer({ error: 'The body is not JSON.' }, 400);
    }
    const code = typeof body.code === 'string' ? body.code : '';
    const given = typeof body.given === 'number' ? body.given : Number.NaN;
    const max = typeof body.max === 'number' ? body.max : Number.NaN;

    // ── the identities this account holds, and the columns they know ───
    const { data: identities, error: idError } = await client
      .from('lti_identity')
      .select('issuer, subject')
      .eq('user_id', userId);
    if (idError) return not('identity-lookup-failed', idError.message, 500);
    if (!identities || identities.length === 0) return not('no-identity', 'This account has never been launched from a platform.');

    const rows: LineItemRow[] = [];
    for (const id of identities) {
      const { data: items, error: liError } = await client
        .from('lti_line_item')
        .select('issuer, subject, client_id, context_id, context_title, lineitem_url, scopes')
        .eq('issuer', id.issuer)
        .eq('subject', id.subject);
      if (liError) return not('line-item-lookup-failed', liError.message, 500);
      for (const it of items ?? []) rows.push(it as LineItemRow);
    }

    const match = matchLineItem(rows, code);
    if (!match.ok) return not(match.reason, match.detail);
    const item = match.value;

    const score = scoreBody({ userId: item.subject, given, max, at: Date.now() });
    if (!score.ok) return not(score.reason, score.detail, 400);

    // ── a token of our own ─────────────────────────────────────────────
    const reg = await registration(client, item.issuer, item.client_id);
    if (!reg) return not('registration-gone', `Registration for ${item.issuer} is no longer there.`, 500);
    const key = privateJwk();
    if (!key) return not('no-key', 'LTI_PRIVATE_KEY is not set, so nothing can be signed.', 503);

    const assertion = clientAssertion(reg, crypto.randomUUID(), Math.floor(Date.now() / 1000));
    if (!assertion.ok) return not(assertion.reason, assertion.detail, 500);

    let signed: string;
    try {
      const kid = await keyId(key);
      signed = await new SignJWT(assertion.value)
        .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
        .sign(await importJWK(key as JWK, 'RS256'));
    } catch (e) {
      return not('sign-failed', `The client assertion could not be signed: ${e}`, 500);
    }

    const form = tokenRequest(signed, [SCOPE.score]);
    if (!form.ok) return not(form.reason, form.detail, 500);

    let token: string;
    try {
      const res = await fetch(reg.tokenUrl!, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.value,
      });
      if (!res.ok) return not('token-refused', `${reg.tokenUrl} answered ${res.status}.`, 502);
      const parsed = tokenResponse(await res.json());
      if (!parsed.ok) return not(parsed.reason, parsed.detail, 502);
      token = parsed.value;
    } catch (e) {
      return not('token-unreachable', `${reg.tokenUrl}: ${e}`, 502);
    }

    // ── and the number, to the column the instructor made ──────────────
    try {
      const res = await fetch(scoresUrl(item.lineitem_url), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': SCORE_MEDIA },
        body: JSON.stringify(score.value),
      });
      if (!res.ok) return not('platform-refused', `${item.lineitem_url} answered ${res.status}.`, 502);
    } catch (e) {
      return not('platform-unreachable', `${item.lineitem_url}: ${e}`, 502);
    }

    console.log(
      `lti score ok: iss=${item.issuer} sub=${item.subject} context=${item.context_id} ${given}/${max}`,
    );
    return answer({ reported: true, course: item.context_title ?? item.context_id });
  }

  /*
   * ── The public half of this tool's key ────────────────────────────────
   *
   * A school's administrator gives this address to Brightspace when they
   * register the tool, and Brightspace fetches it to verify anything this tool
   * signs. It is public by design: that is what a JWKS is.
   *
   * `publicJwk` is the one function in this repository whose failure mode is
   * publishing the *private* key at a public URL, so it names what may be
   * served rather than deleting what may not — an allowlist cannot fail open
   * on a field nobody thought of. `ltikey.test.ts` proves it by handing over a
   * key with every secret field set and reading the answer back by name.
   */
  if (path.endsWith('/jwks')) {
    const jwk = privateJwk();
    if (!jwk) return refuse('no-key', 'LTI_PRIVATE_KEY is not set on this project.', 503);

    const pub = publicJwk(jwk, await keyId(jwk));
    if (!pub.ok) return refuse(pub.reason, pub.detail, 500);

    return new Response(JSON.stringify(jwks([pub.value])), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // A platform may cache this. An hour is short enough that a rotation
        // is picked up the same morning and long enough that a launch is not
        // waiting on a fetch.
        'cache-control': 'public, max-age=3600',
      },
    });
  }

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
     * ── The launch that asks a question ───────────────────────────────────
     *
     * An instructor inside Brightspace's "add an activity" flow. Everything
     * below this block is about a student arriving at something already
     * placed — an account, a session, a redirect — and none of it applies:
     * nobody is arriving, and provisioning an account for an instructor who
     * is choosing a link would leave a user behind on every cancelled dialog.
     *
     * So this returns before any of that, and it is the only path in this
     * repository that signs something.
     */
    if (who.messageType === 'LtiDeepLinkingRequest') {
      const allowed = mayPlace(who);
      if (!allowed.ok) return refuse(allowed.reason, allowed.detail, 403);

      const settings = readSettings(claims);
      if (!settings.ok) return refuse(settings.reason, settings.detail, 400);

      const key = privateJwk();
      if (!key) {
        /*
         * A launch needs no key and still works; this cannot work without
         * one, and the administrator who must fix it is the same person
         * standing in the dialog. 503 with the setting named, rather than a
         * 500 that sends them to a log they cannot read.
         */
        return refuse('no-key', 'LTI_PRIVATE_KEY is not set, so nothing can be signed.', 503);
      }

      const item = resourceLinkItem(
        who.targetLinkUri,
        who.contextTitle ? `Semester — ${who.contextTitle}` : 'Semester',
      );
      if (!item.ok) return refuse(item.reason, item.detail, 500);

      const body = responseClaims({
        reg,
        settings: settings.value,
        items: [item.value],
        nonce: crypto.randomUUID(),
        now: Math.floor(Date.now() / 1000),
        msg: 'Semester is ready in this course.',
      });
      if (!body.ok) return refuse(body.reason, body.detail, 500);

      let signed: string;
      try {
        const kid = await keyId(key);
        signed = await new SignJWT(body.value)
          .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
          .sign(await importJWK(key as JWK, 'RS256'));
      } catch (e) {
        return refuse('sign-failed', `The deep linking response could not be signed: ${e}`, 500);
      }

      console.log(
        `lti deep link ok: iss=${who.issuer} deployment=${who.deploymentId} sub=${who.subject} ` +
          `context=${who.contextId ?? '-'} return=${settings.value.returnUrl}`,
      );

      return new Response(autoPostForm(settings.value.returnUrl, signed), {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    /*
     * Where the app lives. Read rather than guessed: this is the address a
     * student's browser is about to be sent to carrying a session token, so
     * a wrong default is not a broken link, it is a token handed to whatever
     * is at the address we assumed. No default, therefore, and a refusal that
     * names the missing setting.
     */
    const appUrl = Deno.env.get('SEMESTER_APP_URL');
    if (!appUrl) return refuse('no-app-url', 'SEMESTER_APP_URL is not set on this project.', 500);

    const bound = await accountFor(client, who);
    if (!bound.ok) return refuse(bound.reason, bound.detail, 500);

    /*
     * ── Where this course's grades go, if anywhere ────────────────────────
     *
     * After `accountFor`, because the row points at the identity it just made
     * or found, and before the redirect, because this is the only moment the
     * claim is in hand. Nothing here can fail the launch: a student standing
     * in an LMS is not the person to show a gradebook error to, and a launch
     * that works without a grade column is the ordinary launch.
     *
     * `not-graded` is logged at the same level as success, deliberately. It is
     * not a fault; it is the instructor having placed an ordinary link, which
     * is most links.
     */
    const grades = readEndpoint(claims);
    if (grades.ok) {
      const { error: liError } = await client
        .from('lti_line_item')
        .upsert(
          {
            issuer: who.issuer,
            subject: who.subject,
            context_id: who.contextId ?? '',
            client_id: who.clientId,
            context_title: who.contextTitle,
            resource_link_id: who.resourceLinkId,
            lineitem_url: grades.value.lineitem,
            lineitems_url: grades.value.lineitems,
            scopes: grades.value.scopes,
            seen_at: new Date().toISOString(),
          },
          { onConflict: 'issuer,subject,context_id' },
        );
      if (liError) console.error(`lti line item not recorded: ${liError.message}`);
      else console.log(`lti line item: context=${who.contextId ?? '-'} lineitem=${grades.value.lineitem}`);
    } else {
      console.log(`lti line item: ${grades.reason} — ${grades.detail}`);
    }

    /*
     * The session, minted server-side. Nothing else in this project does this
     * — `cloud.ts` only ever signs in from a browser — because nothing else
     * has a caller who authenticated somewhere else entirely.
     */
    const { data: link, error: linkError } = await client.auth.admin.generateLink({
      type: 'magiclink',
      email: bound.email,
    });
    if (linkError || !link?.properties?.hashed_token) {
      return refuse('no-session', `Could not mint a session: ${linkError?.message ?? 'no token'}`, 500);
    }

    const to = new URL(appUrl);
    /*
     * In the query rather than the fragment, because the app has to read it
     * before its router runs and a fragment is where this app keeps its own
     * routes. `lib/ltilanding.ts` strips both parameters from the address bar
     * as its first act — a one-use token in somebody's history is a token in
     * their history.
     */
    to.searchParams.set('lti_token', link.properties.hashed_token);
    to.searchParams.set('lti_email', bound.email);
    if (bound.ticket) to.searchParams.set('lti_ticket', bound.ticket);
    to.hash = landingPath(who);

    console.log(
      `lti launch ok: iss=${who.issuer} deployment=${who.deploymentId} sub=${who.subject} ` +
        `context=${who.contextId ?? '-'} teaches=${who.teaches} provisioned=${Boolean(bound.ticket)}`,
    );

    return Response.redirect(to.toString(), 302);
  }

  return refuse('no-such-endpoint', `Nothing is served at ${path}.`, 404);
});
