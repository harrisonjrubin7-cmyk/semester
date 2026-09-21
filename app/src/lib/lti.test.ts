import { describe, expect, it } from 'vitest';
import {
  CLAIM,
  checkLaunch,
  startLogin,
  type Registration,
} from '../../../supabase/functions/_shared/lti';

/**
 * The launch rules, walked one refusal at a time.
 *
 * An LTI tool that gets this wrong does not fail. It succeeds, for the wrong
 * person, and neither end logs anything unusual — the platform sent a launch
 * and the tool answered it. There is no runtime signal, which is the same
 * shape as the CORS misconfiguration `functioncors.test.ts` exists for, and
 * the reason `_shared/lti.ts` takes its inputs as arguments and reads no
 * environment: it makes the decision table importable from here.
 *
 * Two habits from `CLAUDE.md` are deliberate in this file.
 *
 * **A control.** `accepted()` builds a launch that must pass, and every test
 * below breaks exactly one thing about it. Without that, a suite where every
 * case is refused is also what a validator that refuses everything looks like.
 *
 * **Tokens that break two rules at once.** A suite that only ever sends one
 * fault cannot see the order rules run in, and the order is load-bearing: the
 * nonce must be compared before the message type, or a deep-linking launch
 * carrying a stolen nonce reports the wrong problem and leaves the nonce
 * unspent.
 */

const REG: Registration = {
  issuer: 'https://brightspace.vanderbilt.edu',
  clientId: 'semester-client',
  deploymentId: 'deploy-1',
  authLoginUrl: 'https://brightspace.vanderbilt.edu/d2l/lti/authenticate',
  jwksUrl: 'https://brightspace.vanderbilt.edu/d2l/.well-known/jwks',
};

const REDIRECT = 'https://semester.example/functions/v1/lti/launch';
const NOW = 1_790_000_000;

/** A launch that must pass. Every test below breaks one thing about it. */
function claims(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: REG.issuer,
    aud: REG.clientId,
    sub: 'platform-user-88',
    exp: NOW + 300,
    iat: NOW - 5,
    nonce: 'nonce-we-issued',
    name: 'A Student',
    email: 'a.student@vanderbilt.edu',
    [CLAIM.version]: '1.3.0',
    [CLAIM.messageType]: 'LtiResourceLinkRequest',
    [CLAIM.deploymentId]: REG.deploymentId,
    [CLAIM.targetLinkUri]: REDIRECT,
    [CLAIM.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
    [CLAIM.context]: { id: 'econ-1020', title: 'ECON 1020' },
    ...over,
  };
}

const check = (over: Record<string, unknown> = {}) =>
  checkLaunch({
    claims: claims(over),
    reg: REG,
    expectedNonce: 'nonce-we-issued',
    redirectUri: REDIRECT,
    now: NOW,
  });

/**
 * The reason a verdict refused, or 'accepted' — so a pass cannot read as one.
 *
 * Generic over what the verdict carries because both halves of the flow are
 * checked here and they succeed with different things: a login start returns a
 * redirect, a launch returns a person. What is being asserted either way is
 * the word, and `toBe('accepted')` fails loudly where `toBe(true)` on `ok`
 * would tell you nothing about which rule answered.
 */
const why = <T,>(v: { ok: true; value: T } | { ok: false; reason: string }): string =>
  v.ok ? 'accepted' : v.reason;

describe('the control, which must pass', () => {
  it('accepts a launch with nothing wrong with it', () => {
    const v = check();
    expect(why(v)).toBe('accepted');
    if (!v.ok) return;
    expect(v.value.subject).toBe('platform-user-88');
    expect(v.value.contextTitle).toBe('ECON 1020');
    expect(v.value.teaches).toBe(false);
  });

  it('reads the roles it was sent, including ones it does not know', () => {
    const v = check({ [CLAIM.roles]: ['http://example.test/vocab#Registrar'] });
    expect(why(v)).toBe('accepted');
    if (!v.ok) return;
    // Kept rather than dropped: a platform naming a role this build has not
    // heard of should not have that fact quietly erased on the way in.
    expect(v.value.roles).toEqual(['http://example.test/vocab#Registrar']);
    expect(v.value.teaches).toBe(false);
  });

  it('an empty roles array is legal and is not the same as no claim', () => {
    expect(why(check({ [CLAIM.roles]: [] }))).toBe('accepted');
    expect(why(check({ [CLAIM.roles]: undefined }))).toBe('no-roles');
  });
});

describe('who sent it', () => {
  it('refuses another issuer', () => {
    expect(why(check({ iss: 'https://brightspace.elsewhere.edu' }))).toBe('wrong-iss');
  });

  it('refuses a token addressed to another client', () => {
    expect(why(check({ aud: 'someone-elses-client' }))).toBe('wrong-aud');
  });

  it('accepts an array audience that contains us, when azp says we are meant', () => {
    expect(why(check({ aud: [REG.clientId, 'another'], azp: REG.clientId }))).toBe('accepted');
  });

  /*
   * The array case is the one that bites, and it is why `aud.includes(us)` is
   * not the whole rule. A token addressed to several audiences is addressed to
   * whichever one `azp` names; merely appearing in the list is not the same as
   * being the tool the platform meant.
   */
  it('refuses an array audience with no azp to say which is meant', () => {
    expect(why(check({ aud: [REG.clientId, 'another'] }))).toBe('no-azp');
  });

  it('refuses an array audience whose azp names somebody else', () => {
    expect(why(check({ aud: [REG.clientId, 'another'], azp: 'another' }))).toBe('wrong-azp');
  });
});

describe('when it was sent', () => {
  it('refuses a token that has expired', () => {
    expect(why(check({ exp: NOW - 120 }))).toBe('expired');
  });

  it('forgives a little clock skew, because two servers never agree', () => {
    expect(why(check({ exp: NOW - 30 }))).toBe('accepted');
  });

  it('refuses a token issued in the future by more than the skew', () => {
    expect(why(check({ iat: NOW + 600 }))).toBe('future');
  });
});

describe('the nonce, which is what makes a launch single-use', () => {
  it('refuses a token carrying a nonce we did not issue', () => {
    expect(why(check({ nonce: 'nonce-from-somewhere-else' }))).toBe('wrong-nonce');
  });

  it('refuses a token carrying no nonce at all', () => {
    expect(why(check({ nonce: undefined }))).toBe('no-nonce');
  });

  /*
   * Order, not coverage. Both of these are broken; the nonce must answer,
   * because the caller spends the nonce only on an ok verdict and a refusal
   * naming the message type would leave a stolen nonce unspent and reusable.
   */
  it('answers about the nonce before the message type, when both are wrong', () => {
    expect(
      why(check({ nonce: 'stolen', [CLAIM.messageType]: 'LtiDeepLinkingRequest' })),
    ).toBe('wrong-nonce');
  });

  it('and answers about the issuer before the nonce, when both are wrong', () => {
    expect(why(check({ iss: 'https://elsewhere.edu', nonce: 'stolen' }))).toBe('wrong-iss');
  });
});

describe('which deployment, which is not decoration', () => {
  /*
   * One issuer can deploy one tool many times — a university with a separate
   * Brightspace org per school is the ordinary case — and the deployment id is
   * the only thing in the token that tells them apart.
   */
  it('refuses a launch from another deployment of the same platform', () => {
    expect(why(check({ [CLAIM.deploymentId]: 'deploy-2' }))).toBe('wrong-deployment');
  });

  it('refuses a launch with no deployment id', () => {
    expect(why(check({ [CLAIM.deploymentId]: undefined }))).toBe('no-deployment');
  });
});

describe('what kind of message', () => {
  it('refuses anything that is not LTI 1.3', () => {
    expect(why(check({ [CLAIM.version]: '1.1.0' }))).toBe('wrong-version');
  });

  it('refuses deep linking by name, because it is not built yet', () => {
    const v = check({ [CLAIM.messageType]: 'LtiDeepLinkingRequest' });
    expect(why(v)).toBe('wrong-message-type');
    // Named rather than generic, so the day it is built the thing that changes
    // is one line and not somebody's afternoon reading a JWT.
    if (!v.ok) expect(v.detail).toContain('LtiDeepLinkingRequest');
  });
});

describe('where it wants to land', () => {
  /*
   * `target_link_uri` is attacker-influenced in the general case. A tool that
   * sends a browser wherever this claim points is an open redirect wearing a
   * standard's name.
   */
  it('refuses a target on somebody else’s origin', () => {
    expect(why(check({ [CLAIM.targetLinkUri]: 'https://evil.test/launch' }))).toBe('foreign-target');
  });

  it('accepts a different path on our own origin', () => {
    expect(why(check({ [CLAIM.targetLinkUri]: 'https://semester.example/somewhere' }))).toBe('accepted');
  });

  it('refuses a target that is not a URL at all', () => {
    expect(why(check({ [CLAIM.targetLinkUri]: 'not-a-url' }))).toBe('foreign-target');
  });
});

describe('who this is', () => {
  it('refuses a token with no subject', () => {
    expect(why(check({ sub: undefined }))).toBe('no-sub');
  });

  it('reports an instructor as teaching', () => {
    const v = check({
      [CLAIM.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
    });
    expect(why(v)).toBe('accepted');
    if (v.ok) expect(v.value.teaches).toBe(true);
  });

  /*
   * The same role arrives in a short form and a longer context-scoped form,
   * and a tool that compares whole URIs treats one of them as a student — the
   * direction that fails open.
   */
  it('recognises the context-scoped spelling of the same role', () => {
    const v = check({
      [CLAIM.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant'],
    });
    expect(why(v)).toBe('accepted');
    if (v.ok) expect(v.value.teaches).toBe(true);
  });

  it('carries no name or email when the platform sent none', () => {
    const v = check({ name: undefined, email: undefined });
    expect(why(v)).toBe('accepted');
    if (v.ok) {
      expect(v.value.name).toBeNull();
      expect(v.value.email).toBeNull();
    }
  });
});

// ── The first half of the flow ────────────────────────────────────────────

const login = (over: Record<string, unknown> = {}) =>
  startLogin(
    {
      iss: REG.issuer,
      login_hint: 'hint-for-the-platform',
      target_link_uri: REDIRECT,
      client_id: REG.clientId,
      ...over,
    },
    REG,
    REDIRECT,
    'our-state',
    'our-nonce',
  );

describe('starting a login', () => {
  it('builds an authentication request the platform will accept', () => {
    const v = login();
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const q = new URL(v.value.redirectTo).searchParams;
    expect(q.get('scope')).toBe('openid');
    expect(q.get('response_type')).toBe('id_token');
    // form_post because the token comes back to a server, and prompt=none
    // because the student is already signed in to Brightspace — this exchange
    // must never draw a second sign-in.
    expect(q.get('response_mode')).toBe('form_post');
    expect(q.get('prompt')).toBe('none');
    expect(q.get('client_id')).toBe(REG.clientId);
    expect(q.get('redirect_uri')).toBe(REDIRECT);
    expect(q.get('state')).toBe('our-state');
    expect(q.get('nonce')).toBe('our-nonce');
  });

  it('keeps the platform’s message hint when there is one, and omits it when not', () => {
    const withHint = login({ lti_message_hint: 'hint-42' });
    expect(withHint.ok && new URL(withHint.value.redirectTo).searchParams.get('lti_message_hint')).toBe('hint-42');
    const without = login();
    expect(without.ok && new URL(without.value.redirectTo).searchParams.has('lti_message_hint')).toBe(false);
  });

  it('refuses an issuer we have no registration for', () => {
    expect(why(login({ iss: 'https://brightspace.elsewhere.edu' }))).toBe('unknown-iss');
  });

  /*
   * One issuer can host more than one tool. Taking the issuer's word for which
   * one this is, while ignoring the field that says so, is how a login meant
   * for another tool gets started by this one.
   */
  it('refuses a login naming a different client on an issuer we do know', () => {
    expect(why(login({ client_id: 'another-tool' }))).toBe('client-mismatch');
  });

  it('refuses a login naming a deployment we have no registration for', () => {
    expect(why(login({ lti_deployment_id: 'deploy-9' }))).toBe('deployment-mismatch');
  });

  it('accepts a login that omits the optional client and deployment', () => {
    expect(why(login({ client_id: undefined, lti_deployment_id: undefined }))).toBe('accepted');
  });

  it('refuses a login with no login_hint to hand back', () => {
    expect(why(login({ login_hint: undefined }))).toBe('no-login-hint');
  });

  it('refuses a target_link_uri on somebody else’s origin', () => {
    expect(why(login({ target_link_uri: 'https://evil.test/launch' }))).toBe('foreign-target');
  });
});
