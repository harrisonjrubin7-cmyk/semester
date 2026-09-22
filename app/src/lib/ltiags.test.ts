/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AGS_CLAIM,
  SCORE_MEDIA,
  matchLineItem,
  normalise,
  readEndpoint,
  scoreBody,
  scoresUrl,
  tokenResponse,
  type LineItemRow,
} from '../../../supabase/functions/_shared/ltiags';

/**
 * Grade passback, which is the one LTI direction that starts on this side and
 * the one whose failure is a number in somebody else's gradebook.
 *
 * Three rules carry the weight and each has a test that fails against the
 * plausible wrong version rather than one that passes against the right one:
 *
 *   * **nothing is sent unless the instructor made a column** — `readEndpoint`
 *     refuses a launch with no line item, and that refusal is the feature;
 *   * **`/scores` goes before the query string**, because the URLs Brightspace
 *     hands out carry one and appending to the string yields a 404 with no
 *     hint about why;
 *   * **several matching courses is a refusal, not a pick** — the wrong column
 *     is worse than no column, and the first version of anything like this
 *     takes `[0]`.
 */

const SCORE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';
const LINEITEM = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem';

const endpoint = (over: Record<string, unknown> = {}) => ({
  [AGS_CLAIM.endpoint]: {
    scope: [SCORE, LINEITEM],
    lineitems: 'https://brightspace.vanderbilt.edu/d2l/api/lti/ags/12/lineitems',
    lineitem: 'https://brightspace.vanderbilt.edu/d2l/api/lti/ags/12/lineitems/7',
    ...over,
  },
});

const row = (over: Partial<LineItemRow> = {}): LineItemRow => ({
  issuer: 'https://brightspace.vanderbilt.edu',
  subject: 'u-1',
  client_id: 'semester-client',
  context_id: 'ctx-psci',
  context_title: 'PSCI 2100 - International Security',
  lineitem_url: 'https://brightspace.vanderbilt.edu/d2l/api/lti/ags/12/lineitems/7',
  scopes: [SCORE],
  ...over,
});

describe('readEndpoint', () => {
  it('reads a graded launch', () => {
    const v = readEndpoint(endpoint());
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.lineitem).toContain('/lineitems/7');
    expect(v.value.lineitems).toContain('/lineitems');
    expect(v.value.scopes).toEqual([SCORE, LINEITEM]);
  });

  it('refuses a launch with no grade services claim at all', () => {
    expect(readEndpoint({})).toMatchObject({ ok: false, reason: 'no-endpoint' });
  });

  /*
   * The rule that makes this a feature. A link placed without a grade has an
   * endpoint claim — the container — and no line item, and the right answer
   * is to store nothing, not to store the container and invent a column.
   */
  it('refuses a link that is placed but not graded', () => {
    const claim = endpoint();
    delete (claim[AGS_CLAIM.endpoint] as Record<string, unknown>).lineitem;
    expect(readEndpoint(claim)).toMatchObject({ ok: false, reason: 'not-graded' });
  });

  it('refuses a blank line item the same way', () => {
    expect(readEndpoint(endpoint({ lineitem: '   ' }))).toMatchObject({ ok: false, reason: 'not-graded' });
  });

  it('refuses an http line item', () => {
    const v = readEndpoint(endpoint({ lineitem: 'http://brightspace.vanderbilt.edu/li/7' }));
    expect(v).toMatchObject({ ok: false, reason: 'insecure-lineitem' });
  });

  it('refuses an http container even when the line item is fine', () => {
    const v = readEndpoint(endpoint({ lineitems: 'http://brightspace.vanderbilt.edu/lis' }));
    expect(v).toMatchObject({ ok: false, reason: 'insecure-lineitems' });
  });

  it('allows an absent container, because a platform may send none', () => {
    const claim = endpoint();
    delete (claim[AGS_CLAIM.endpoint] as Record<string, unknown>).lineitems;
    const v = readEndpoint(claim);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.lineitems).toBeNull();
  });

  /*
   * A token without `score` can read the column and not write it. Finding
   * that out is a 403 at post time, far from the launch that could have said.
   */
  it('refuses a launch whose scopes cannot write a score', () => {
    const v = readEndpoint(endpoint({ scope: [LINEITEM] }));
    expect(v).toMatchObject({ ok: false, reason: 'no-score-scope' });
  });

  it('treats a missing scope list as no scopes', () => {
    const claim = endpoint();
    delete (claim[AGS_CLAIM.endpoint] as Record<string, unknown>).scope;
    expect(readEndpoint(claim)).toMatchObject({ ok: false, reason: 'no-score-scope' });
  });

  it('ignores non-string entries in the scope list rather than crashing', () => {
    const v = readEndpoint(endpoint({ scope: [42, null, SCORE] }));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.scopes).toEqual([SCORE]);
  });
});

describe('scoresUrl', () => {
  it('appends /scores to a plain line item', () => {
    expect(scoresUrl('https://b.test/d2l/api/lti/ags/12/lineitems/7')).toBe(
      'https://b.test/d2l/api/lti/ags/12/lineitems/7/scores',
    );
  });

  /*
   * The one people get wrong. Brightspace's line item URLs carry a query
   * string, and `url + '/scores'` puts the segment after it.
   */
  it('puts /scores before the query string, not after it', () => {
    expect(scoresUrl('https://b.test/d2l/api/lti/ags/12/lineitems/7?type_id=3')).toBe(
      'https://b.test/d2l/api/lti/ags/12/lineitems/7/scores?type_id=3',
    );
  });

  it('does not double a trailing slash', () => {
    expect(scoresUrl('https://b.test/lineitems/7/')).toBe('https://b.test/lineitems/7/scores');
  });
});

describe('scoreBody', () => {
  const ok = () => {
    const v = scoreBody({ userId: 'u-1', given: 8, max: 10, at: 1_700_000_000_000 });
    if (!v.ok) throw new Error(v.reason);
    return v.value;
  };

  it('builds a completed, fully graded score', () => {
    expect(ok()).toEqual({
      userId: 'u-1',
      scoreGiven: 8,
      scoreMaximum: 10,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: '2023-11-14T22:13:20.000Z',
    });
  });

  /*
   * Both progress fields are asserted by name, because they are the two a
   * score document can carry at their defaults and be *accepted* — and then
   * show nothing in the gradebook.
   */
  it('says the activity is complete and the grade final', () => {
    const body = ok();
    expect(body.activityProgress).toBe('Completed');
    expect(body.gradingProgress).toBe('FullyGraded');
  });

  it('refuses a score with no student', () => {
    expect(scoreBody({ userId: ' ', given: 1, max: 1, at: 1 })).toMatchObject({ ok: false, reason: 'no-user' });
  });

  it('refuses more given than there was to give', () => {
    expect(scoreBody({ userId: 'u', given: 11, max: 10, at: 1 })).toMatchObject({ ok: false, reason: 'bad-score' });
  });

  it('refuses a negative score', () => {
    expect(scoreBody({ userId: 'u', given: -1, max: 10, at: 1 })).toMatchObject({ ok: false, reason: 'bad-score' });
  });

  it('refuses a maximum of zero', () => {
    expect(scoreBody({ userId: 'u', given: 0, max: 0, at: 1 })).toMatchObject({ ok: false, reason: 'bad-score' });
  });

  it('refuses NaN', () => {
    expect(scoreBody({ userId: 'u', given: Number.NaN, max: 10, at: 1 })).toMatchObject({ ok: false, reason: 'bad-score' });
  });

  it('allows zero of ten, which is a real result', () => {
    expect(scoreBody({ userId: 'u', given: 0, max: 10, at: 1 }).ok).toBe(true);
  });

  it('allows full marks', () => {
    expect(scoreBody({ userId: 'u', given: 10, max: 10, at: 1 }).ok).toBe(true);
  });
});

describe('matchLineItem', () => {
  it('finds the one course whose title carries the code', () => {
    const v = matchLineItem([row(), row({ context_id: 'ctx-econ', context_title: 'ECON 1020 Micro' })], 'PSCI 2100');
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.value.context_id).toBe('ctx-psci');
  });

  it('matches regardless of punctuation and case', () => {
    expect(matchLineItem([row()], 'psci-2100').ok).toBe(true);
    expect(matchLineItem([row({ context_title: 'psci2100: intl security' })], 'PSCI 2100').ok).toBe(true);
  });

  it('refuses when nothing matches', () => {
    expect(matchLineItem([row()], 'ECON 1020')).toMatchObject({ ok: false, reason: 'no-match' });
  });

  it('refuses when there are no rows at all', () => {
    expect(matchLineItem([], 'PSCI 2100')).toMatchObject({ ok: false, reason: 'no-match' });
  });

  /*
   * The point of the function. Cross-listed courses do this, and the wrong
   * column is worse than no column.
   */
  it('refuses rather than picks when two courses match', () => {
    const v = matchLineItem(
      [row(), row({ context_id: 'ctx-x', context_title: 'PSCI 2100 (cross-listed with HIST 2100)' })],
      'PSCI 2100',
    );
    expect(v).toMatchObject({ ok: false, reason: 'ambiguous' });
    if (!v.ok) expect(v.detail).toContain('cross-listed');
  });

  /*
   * "PS" is in every political science title a school has. A rule that
   * matched on it would report every quiz to whichever column sorted first.
   */
  it('refuses a code too short to match safely', () => {
    expect(matchLineItem([row()], 'PS')).toMatchObject({ ok: false, reason: 'code-too-short' });
    expect(matchLineItem([row()], 'P-S-')).toMatchObject({ ok: false, reason: 'code-too-short' });
  });

  it('treats a row with no title as matching nothing', () => {
    expect(matchLineItem([row({ context_title: null })], 'PSCI 2100')).toMatchObject({ ok: false, reason: 'no-match' });
  });

  it('normalises the way the matcher does', () => {
    expect(normalise('PSCI-2100 (Fall)')).toBe('PSCI2100FALL');
  });
});

describe('tokenResponse', () => {
  it('reads a bearer token', () => {
    const v = tokenResponse({ access_token: 'abc', token_type: 'Bearer', expires_in: 3600 });
    expect(v).toEqual({ ok: true, value: 'abc' });
  });

  it('refuses a reply with no token', () => {
    expect(tokenResponse({ token_type: 'Bearer' })).toMatchObject({ ok: false, reason: 'no-token' });
  });

  it('refuses a reply that is not an object', () => {
    expect(tokenResponse('abc')).toMatchObject({ ok: false, reason: 'no-token' });
    expect(tokenResponse(null)).toMatchObject({ ok: false, reason: 'no-token' });
  });

  /*
   * A platform answering with something other than bearer is telling us the
   * exchange did not go the way we think it did.
   */
  it('refuses a token that is not a bearer token', () => {
    expect(tokenResponse({ access_token: 'abc', token_type: 'MAC' })).toMatchObject({ ok: false, reason: 'not-bearer' });
    expect(tokenResponse({ access_token: 'abc' })).toMatchObject({ ok: false, reason: 'not-bearer' });
  });
});

/**
 * The route, read as text — for the same reason `ltideeplink.test.ts` reads
 * it: `lti/index.ts` is Deno, no test imports it, and only a deploy compiles
 * it. Two things here are worth a structural assertion.
 */
describe('the route, read as text', () => {
  const source = readFileSync(
    new URL('../../../supabase/functions/lti/index.ts', import.meta.url),
    'utf8',
  );

  /*
   * The line item row has a foreign key to the identity, so it can only be
   * written after `accountFor` has made or found one. Recorded before, the
   * insert fails on every first launch — and that failure is caught and
   * logged, so nothing is red and no score ever arrives.
   */
  it('records the line item only after the identity exists', () => {
    const provision = source.indexOf('accountFor(client, who)');
    const record = source.indexOf('readEndpoint(claims)');
    expect(provision).toBeGreaterThan(-1);
    expect(record, 'the launch no longer records where grades go').toBeGreaterThan(-1);
    expect(record).toBeGreaterThan(provision);
  });

  /*
   * The score endpoint is the one route in this function a browser calls
   * with `fetch` rather than arrives at by navigation, so it is the one that
   * needs CORS — and the guard in `functioncors.test.ts` only walks the
   * functions it names. This is the same assertion, aimed here.
   */
  it('answers the score route with per-request CORS and a preflight', () => {
    expect(source).toContain("_shared/cors.ts");
    expect(source).toMatch(
      /const cors = corsHeaders\(Deno\.env\.get\('ALLOWED_ORIGIN'\), req\.headers\.get\('Origin'\)\)/,
    );
    expect(source).toContain("req.method === 'OPTIONS'");
    // By name, not by value: the route must post as the media type the shared
    // module owns, and a literal copy of the string here would drift from it.
    expect(source).toContain("'content-type': SCORE_MEDIA");
    expect(SCORE_MEDIA).toBe('application/vnd.ims.lis.v1.score+json');
  });

  it('control: the file is still the launch route', () => {
    expect(source).toContain('checkLaunch(');
    expect(source).toContain('generateLink');
  });
});
