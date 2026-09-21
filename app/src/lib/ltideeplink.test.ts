/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DL_CLAIM,
  autoPostForm,
  mayPlace,
  readSettings,
  resourceLinkItem,
  responseClaims,
  type DeepLinkSettings,
} from '../../../supabase/functions/_shared/ltideeplink';
import type { Launch, Registration } from '../../../supabase/functions/_shared/lti';

/**
 * Deep linking, which is the first thing in this repository that signs
 * something and the first that answers a launch instead of serving one.
 *
 * Three blocks here are load-bearing and the rest is shape:
 *
 *   * **the direction of `iss` and `aud`**, which reverse between the token
 *     coming in and the token going out, and which are the field people get
 *     backwards because every other token in an LTI flow points the other way;
 *   * **the return URL's scheme**, because that address receives a JWT this
 *     tool signed about what an instructor chose;
 *   * **`data`**, which is the platform's own bookkeeping and is fatal to drop
 *     while being invisible in any test that only checks the answer is valid.
 *
 * Each of those has a test that fails against the plausible wrong version, not
 * just one that passes against the right one.
 */

const REG: Registration = {
  issuer: 'https://brightspace.vanderbilt.edu',
  clientId: 'semester-client',
  deploymentId: 'dep-17',
  authLoginUrl: 'https://brightspace.vanderbilt.edu/d2l/lti/authenticate',
  jwksUrl: 'https://brightspace.vanderbilt.edu/d2l/.well-known/jwks',
};

const SETTINGS: DeepLinkSettings = {
  returnUrl: 'https://brightspace.vanderbilt.edu/d2l/lti/dl/return',
  data: 'module-42',
  multiple: false,
};

const ITEM = { type: 'ltiResourceLink', url: 'https://fn.semester.app/lti/launch', title: 'Semester' };

const settingsClaim = (over: Record<string, unknown> = {}) => ({
  [DL_CLAIM.settings]: {
    deep_link_return_url: 'https://brightspace.vanderbilt.edu/d2l/lti/dl/return',
    accept_types: ['ltiResourceLink', 'link'],
    data: 'module-42',
    ...over,
  },
});

const teacher = (over: Partial<Launch> = {}): Launch => ({
  messageType: 'LtiDeepLinkingRequest',
  subject: 'u-1',
  issuer: REG.issuer,
  clientId: REG.clientId,
  deploymentId: REG.deploymentId,
  roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'],
  teaches: true,
  contextId: 'PSCI-2100',
  contextTitle: 'International Security',
  targetLinkUri: 'https://fn.semester.app/lti/launch',
  name: null,
  email: null,
  ...over,
});

describe('readSettings', () => {
  it('reads a well-formed settings claim', () => {
    const v = readSettings(settingsClaim());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.returnUrl).toBe('https://brightspace.vanderbilt.edu/d2l/lti/dl/return');
    expect(v.value.data).toBe('module-42');
  });

  it('refuses a token with no settings claim at all', () => {
    const v = readSettings({});
    expect(v).toMatchObject({ ok: false, reason: 'no-settings' });
  });

  it('refuses a settings claim that is an array rather than an object', () => {
    const v = readSettings({ [DL_CLAIM.settings]: ['deep_link_return_url'] });
    expect(v).toMatchObject({ ok: false, reason: 'no-settings' });
  });

  it('refuses settings with no return URL, because there is nowhere to answer', () => {
    const v = readSettings(settingsClaim({ deep_link_return_url: '' }));
    expect(v).toMatchObject({ ok: false, reason: 'no-return-url' });
  });

  /*
   * The sharp one. This address receives a signed assertion about what an
   * instructor chose to put in a course; over http it is readable and
   * alterable in flight.
   */
  it('refuses an http return URL', () => {
    const v = readSettings(settingsClaim({ deep_link_return_url: 'http://brightspace.vanderbilt.edu/dl' }));
    expect(v).toMatchObject({ ok: false, reason: 'insecure-return-url' });
  });

  it('refuses a return URL that only mentions https elsewhere in the string', () => {
    const v = readSettings(settingsClaim({ deep_link_return_url: 'http://evil.test/?to=https://x' }));
    expect(v).toMatchObject({ ok: false, reason: 'insecure-return-url' });
  });

  it('refuses a platform that will not accept the one type this tool offers', () => {
    const v = readSettings(settingsClaim({ accept_types: ['link', 'file'] }));
    expect(v).toMatchObject({ ok: false, reason: 'unaccepted-type' });
    if (v.ok) return;
    expect(v.detail).toContain('link, file');
  });

  it('accepts when the list includes ltiResourceLink among others', () => {
    expect(readSettings(settingsClaim({ accept_types: ['file', 'ltiResourceLink'] })).ok).toBe(true);
  });

  /*
   * An absent list is the standard's "anything"; a present list that omits us
   * is a statement. Treating the two the same in either direction is the bug.
   */
  it('accepts an absent accept_types as no restriction', () => {
    const claim = settingsClaim();
    delete (claim[DL_CLAIM.settings] as Record<string, unknown>).accept_types;
    expect(readSettings(claim).ok).toBe(true);
  });

  it('reports no data when the platform sent none', () => {
    const claim = settingsClaim();
    delete (claim[DL_CLAIM.settings] as Record<string, unknown>).data;
    const v = readSettings(claim);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.data).toBeNull();
  });

  it('reads accept_multiple only when it is actually true', () => {
    const on = readSettings(settingsClaim({ accept_multiple: true }));
    expect(on.ok && on.value.multiple).toBe(true);
    const off = readSettings(settingsClaim({ accept_multiple: false }));
    expect(off.ok && off.value.multiple).toBe(false);
  });

  /*
   * A string is what a platform sending form-encoded settings produces, and
   * `Boolean('false')` is true. Strict equality is the only reading that does
   * not silently promise the platform more items than it asked for.
   */
  it('does not read the string "true" as permission for multiple items', () => {
    const v = readSettings(settingsClaim({ accept_multiple: 'true' }));
    expect(v.ok && v.value.multiple).toBe(false);
  });
});

describe('resourceLinkItem', () => {
  it('builds a resource link item', () => {
    const v = resourceLinkItem('https://fn.semester.app/lti/launch', 'Semester — Intl Security');
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value).toEqual({
      type: 'ltiResourceLink',
      url: 'https://fn.semester.app/lti/launch',
      title: 'Semester — Intl Security',
    });
  });

  it('refuses to place a link with no URL', () => {
    expect(resourceLinkItem('   ', 'Semester')).toMatchObject({ ok: false, reason: 'no-launch-url' });
  });

  it('refuses to place a link nobody could find again', () => {
    expect(resourceLinkItem('https://fn.semester.app/lti/launch', '  ')).toMatchObject({
      ok: false,
      reason: 'no-title',
    });
  });

  it('carries text when given and omits the key when blank', () => {
    const withText = resourceLinkItem('https://fn.semester.app/lti/launch', 'Semester', 'Study tools');
    expect(withText.ok && withText.value.text).toBe('Study tools');
    const without = resourceLinkItem('https://fn.semester.app/lti/launch', 'Semester', '   ');
    expect(without.ok && 'text' in without.value).toBe(false);
  });
});

describe('responseClaims', () => {
  const claims = () => {
    const v = responseClaims({ reg: REG, settings: SETTINGS, items: [ITEM], nonce: 'n-1', now: 1_700_000_000 });
    if (!v.ok) throw new Error(`expected ok, got ${v.reason}`);
    return v.value;
  };

  /*
   * ── The reversal ──────────────────────────────────────────────────────
   *
   * On the way in the platform is `iss` and this tool is `aud`. On the way out
   * it is the other way round. Both assertions matter: a version that copied
   * the inbound direction would put the issuer in `iss`, and a version that
   * set them to the same value would pass either one alone.
   */
  it('issues as the tool and audiences at the platform', () => {
    const c = claims();
    expect(c.iss).toBe('semester-client');
    expect(c.aud).toBe('https://brightspace.vanderbilt.edu');
    expect(c.iss).not.toBe(c.aud);
  });

  it('repeats the client id in azp, for platforms that require it', () => {
    expect(claims().azp).toBe('semester-client');
  });

  it('declares itself a deep linking response at version 1.3.0', () => {
    const c = claims();
    expect(c['https://purl.imsglobal.org/spec/lti/claim/message_type']).toBe('LtiDeepLinkingResponse');
    expect(c['https://purl.imsglobal.org/spec/lti/claim/version']).toBe('1.3.0');
  });

  it('names the deployment, which is what separates two installs of one tool', () => {
    expect(claims()['https://purl.imsglobal.org/spec/lti/claim/deployment_id']).toBe('dep-17');
  });

  it('carries the content items', () => {
    expect(claims()[DL_CLAIM.contentItems]).toEqual([ITEM]);
  });

  /*
   * `data` is the platform's own bookkeeping — which course, which module,
   * where in it. A response that drops it is a correct answer to a question
   * the platform can no longer place, and it is valid in every other respect.
   */
  it('echoes the platform data back untouched', () => {
    expect(claims()[DL_CLAIM.data]).toBe('module-42');
  });

  it('omits the data claim entirely when none arrived', () => {
    const v = responseClaims({
      reg: REG,
      settings: { ...SETTINGS, data: null },
      items: [ITEM],
      nonce: 'n-1',
      now: 1_700_000_000,
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(DL_CLAIM.data in v.value).toBe(false);
  });

  it('expires five minutes after it is issued', () => {
    const c = claims();
    expect(c.iat).toBe(1_700_000_000);
    expect(c.exp).toBe(1_700_000_300);
  });

  it('refuses to build a response with no nonce', () => {
    const v = responseClaims({ reg: REG, settings: SETTINGS, items: [ITEM], nonce: '', now: 1 });
    expect(v).toMatchObject({ ok: false, reason: 'no-nonce' });
  });

  it('refuses a response that places nothing', () => {
    const v = responseClaims({ reg: REG, settings: SETTINGS, items: [], nonce: 'n-1', now: 1 });
    expect(v).toMatchObject({ ok: false, reason: 'no-items' });
  });

  /*
   * The platform said it takes one. Sending two is not a richer answer — it is
   * an answer whose surplus is discarded by a rule that is not visible here.
   */
  it('refuses several items when the platform accepts one', () => {
    const v = responseClaims({ reg: REG, settings: SETTINGS, items: [ITEM, ITEM], nonce: 'n-1', now: 1 });
    expect(v).toMatchObject({ ok: false, reason: 'multiple-refused' });
  });

  it('allows several items when the platform said it accepts them', () => {
    const v = responseClaims({
      reg: REG,
      settings: { ...SETTINGS, multiple: true },
      items: [ITEM, ITEM],
      nonce: 'n-1',
      now: 1,
    });
    expect(v.ok).toBe(true);
  });

  it('carries a message when given one and omits the claim when not', () => {
    const withMsg = responseClaims({
      reg: REG,
      settings: SETTINGS,
      items: [ITEM],
      nonce: 'n-1',
      now: 1,
      msg: 'Ready.',
    });
    expect(withMsg.ok && withMsg.value[DL_CLAIM.msg]).toBe('Ready.');
    expect(DL_CLAIM.msg in claims()).toBe(false);
  });

  /*
   * A control. Every assertion above names one field, so all of them would
   * still pass against a function that returned only the fields they name.
   * This one says the result is a usable token body rather than a bag of
   * claims that happens to satisfy the list.
   */
  it('control: the result has everything a platform needs to verify it', () => {
    const c = claims();
    for (const field of ['iss', 'aud', 'iat', 'exp', 'nonce']) {
      expect(c[field], `missing ${field}`).toBeTruthy();
    }
    expect(Array.isArray(c[DL_CLAIM.contentItems])).toBe(true);
  });
});

describe('autoPostForm', () => {
  const html = () => autoPostForm('https://brightspace.vanderbilt.edu/d2l/lti/dl/return', 'signed.jwt.here');

  it('posts the JWT to the return URL', () => {
    const page = html();
    expect(page).toContain('action="https://brightspace.vanderbilt.edu/d2l/lti/dl/return"');
    expect(page).toContain('name="JWT"');
    expect(page).toContain('value="signed.jwt.here"');
  });

  /*
   * A POST, not a redirect, and the assertion is worth spelling out: a GET
   * would put a signed assertion in the instructor's history, in the
   * platform's access log, and in any referrer that follows.
   */
  it('uses POST, so the assertion never reaches a query string', () => {
    expect(html()).toContain('method="post"');
    expect(html()).not.toContain('method="get"');
  });

  /*
   * An LMS page inside an iframe is a place where script does not always run.
   * Without the button the instructor sits looking at a blank frame with
   * nothing to report.
   */
  it('still offers a button when the automatic submit does not fire', () => {
    expect(html()).toContain('<button type="submit">');
  });

  it('escapes a quote in the return URL rather than ending the attribute', () => {
    const page = autoPostForm('https://x.test/"><script>alert(1)</script>', 'j');
    expect(page).not.toContain('<script>alert(1)</script>');
    expect(page).toContain('&quot;&gt;&lt;script&gt;');
  });

  it('escapes a quote in the token rather than ending the attribute', () => {
    const page = autoPostForm('https://x.test/', 'a"><img src=x onerror=1>');
    expect(page).not.toContain('<img src=x');
    expect(page).toContain('&quot;&gt;&lt;img');
  });

  /*
   * A control for the two above: every escaping assertion passes against a
   * function that escapes far too much, or returns nothing at all.
   */
  it('control: an ordinary URL survives unchanged', () => {
    expect(html()).toContain('action="https://brightspace.vanderbilt.edu/d2l/lti/dl/return"');
  });
});

/**
 * A structural check, because nothing else here can see this file.
 *
 * `supabase/functions/lti/index.ts` is Deno and is imported by no test, so
 * `tsc -b` never reaches it and the only thing that compiles it is a deploy.
 * That is precisely where a check that reads the source as text earns its
 * keep — it cannot be fooled by a path a test did not take, because it is not
 * taking paths at all.
 *
 * The ordering it asserts is not cosmetic. Everything after the deep-linking
 * branch provisions an account and mints a session for a student who has
 * arrived. An instructor opening the "add an activity" dialog has not arrived
 * and may well cancel; if the branch ever sinks below `accountFor`, every
 * cancelled dialog leaves a real user behind in `auth.users` and nothing
 * fails, logs, or looks wrong.
 */
describe('the route, read as text', () => {
  const source = readFileSync(
    new URL('../../../supabase/functions/lti/index.ts', import.meta.url),
    'utf8',
  );

  it('answers a deep linking request before it provisions anybody', () => {
    const branch = source.indexOf("who.messageType === 'LtiDeepLinkingRequest'");
    const provision = source.indexOf('accountFor(client, who)');
    expect(branch, 'the deep linking branch is gone').toBeGreaterThan(-1);
    expect(provision, 'accountFor is gone').toBeGreaterThan(-1);
    expect(branch).toBeLessThan(provision);
  });

  it('the branch ends in a response rather than falling through', () => {
    const branch = source.indexOf("who.messageType === 'LtiDeepLinkingRequest'");
    const provision = source.indexOf('accountFor(client, who)');
    const between = source.slice(branch, provision);
    expect(between).toContain('autoPostForm(');
    expect(between).toContain('mayPlace(');
  });

  /*
   * A control. Both assertions above are about where one string sits relative
   * to another, and both would pass against a file that had been emptied of
   * everything else.
   */
  it('control: the file is still the launch route', () => {
    expect(source).toContain('checkLaunch(');
    expect(source).toContain('generateLink');
    expect(source.length).toBeGreaterThan(5_000);
  });
});

describe('mayPlace', () => {
  it('lets an instructor place content', () => {
    expect(mayPlace(teacher()).ok).toBe(true);
  });

  /*
   * The authority rule. A deep-linking response is an instruction to put
   * something in a course; a platform asking a student for one is confused or
   * being driven, and either way the answer is no.
   */
  it('refuses a student, whatever the platform asked for', () => {
    const v = mayPlace(teacher({ teaches: false, roles: [] }));
    expect(v).toMatchObject({ ok: false, reason: 'not-a-teacher' });
  });
});
