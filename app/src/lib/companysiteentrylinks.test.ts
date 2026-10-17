import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEntry } from './entrycontext';

/**
 * What the company site puts on a link into the app is what the app accepts.
 *
 * `company-site/site.js` is a hand-written script, so the part that builds the
 * address is kept between two marker comments and run here as it is, with the
 * app's own parser on the other end. If the site starts sending something the
 * app would refuse, or the app narrows what it takes, this fails on the pair.
 */

const SITE = readFileSync(join(__dirname, '..', '..', '..', 'company-site', 'site.js'), 'utf8');
const BLOCK = SITE.slice(SITE.indexOf('// <entry-links>'), SITE.indexOf('// </entry-links>'));
// The address the site's own status probes already use; the block builds on it.
const declared = SITE.match(/const LEGACY_APP_BASE="([^"]+)";/);
const make = new Function('APP_BASE', `${BLOCK}; return { entryParams, withEntry, entryId };`) as (base: string) => {
  entryParams: (a: Record<string, string>, place?: string) => Record<string, string>;
  withEntry: (href: string, a: Record<string, string>, place?: string) => string;
  entryId: (v: string) => string;
};
if (!declared) throw new Error('company-site/site.js no longer declares LEGACY_APP_BASE');
const APP_BASE = declared[1];
const { entryParams, withEntry, entryId } = make(APP_BASE);

const open = (attr: Record<string, string>, place?: string) =>
  parseEntry(new URL(withEntry(`${APP_BASE}#/signup`, attr, place)).search);

describe('the links the site builds into the app', () => {
  it('say who the page is for and which part of it was clicked, with nothing else known', () => {
    expect(open({}, 'pricing')).toEqual({ source: 'direct', contentId: 'pricing', roleHint: 'student' });
  });

  it('keep the hash, so the app still opens its sign-up screen', () => {
    const url = new URL(withEntry(`${APP_BASE}#/signup`, {}, 'home'));
    expect(url.hash).toBe('#/signup');
    expect(url.pathname).toBe('/semester/');
  });

  it('carry a campaign and where the click came from', () => {
    expect(open({ utm_source: 'youtube', utm_campaign: 'Fall 26 Launch!' }, 'home')).toEqual({
      source: 'youtube',
      campaignId: 'Fall-26-Launch',
      contentId: 'home',
      roleHint: 'student',
    });
  });

  it.each([
    [{ utm_source: 'google', utm_medium: 'cpc' }, 'paid_campaign'],
    [{ utm_source: 'newsletter' }, 'email'],
    [{ utm_source: 'tiktok' }, 'social'],
    [{ utm_source: 'google', utm_medium: 'organic' }, 'organic_search'],
    [{ referrer: 'www.google.com/search' }, 'organic_search'],
    [{ referrer: 'www.youtube.com/watch' }, 'youtube'],
    [{ referrer: 'l.instagram.com/' }, 'social'],
    [{ utm_medium: 'referral' }, 'referral'],
    [{ utm_source: 'partner' }, 'partner'],
    [{}, 'direct'],
    [{ utm_source: 'something-else' }, 'direct'],
  ])('maps %j to %s, and the app accepts it', (attr, want) => {
    expect(open(attr as Record<string, string>)?.source).toBe(want);
  });

  it('never sends a value the app would drop', () => {
    const hostile = { utm_source: 'x', utm_campaign: 'a@b.edu ' + 'z'.repeat(200), referrer: 'https://evil.example/?t=1' };
    const p = entryParams(hostile, 'a/b c');
    for (const [k, v] of Object.entries(p)) {
      if (k === 'cid' || k === 'content') expect(v, k).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    }
    const got = open(hostile, 'a/b c');
    expect(got?.campaignId).toBeDefined();
    expect(got?.contentId).toBe('a-b-c');
  });

  it('sends a role hint and no more: nothing here names a tenant, a capability or a screen', () => {
    const keys = Object.keys(entryParams({ utm_source: 'email', utm_campaign: 'c' }, 'home')).sort();
    expect(keys).toEqual(['cid', 'content', 'role', 'src']);
    expect(keys).not.toContain('continue');
  });

  it('does not overwrite what a link already says', () => {
    const u = new URL(withEntry(`${APP_BASE}?role=faculty#/login`, {}, 'home'));
    expect(u.searchParams.get('role')).toBe('faculty');
  });

  it('turns an unusable place into a name rather than nothing', () => {
    expect(entryId('')).toBe('');
    expect(entryParams({}, '')['content']).toBe('site');
  });
});

describe('where the site points', () => {
  it('has links into the app to decorate, and only to one host', () => {
    const html = readFileSync(join(__dirname, '..', '..', '..', 'company-site', 'index.html'), 'utf8');
    const hrefs = [...html.matchAll(/href="(https:\/\/[^"]*github\.io\/semester\/[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const h of hrefs) expect(h.startsWith(APP_BASE), h).toBe(true);
  });
});
