import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_REDIRECTS, followSafely, type AddressRule } from '../../../supabase/functions/_shared/safefetch';
import { publicCalendarUrl } from './publichost';

/**
 * `fetchcal` checked the address it was asked for, let `fetch` follow every
 * redirect, and then checked where the chain landed. By then the request to the
 * redirect target had already gone out. These hold the rule that the request
 * for a hop is made only after that hop's address passed, then hold the
 * function to using it.
 *
 * The address rule under test is `publicCalendarUrl`, the same rule `fetchcal`
 * carries a copy of (`publichost.ts` says why it is written twice). The
 * function itself cannot be imported here: it is Deno code.
 */

const root = join(import.meta.dirname, '../../..');

/** A fake network: each URL answers with the response given for it, and every request is recorded. */
function network(routes: Record<string, { status: number; location?: string }>) {
  const requested: string[] = [];
  let cancelled = 0;
  const doFetch = async (url: URL): Promise<Response> => {
    requested.push(url.toString());
    const route = routes[url.toString()];
    if (!route) throw new Error(`unexpected request: ${url}`);
    const headers = new Headers();
    if (route.location) headers.set('location', route.location);
    const response = new Response('BEGIN:VCALENDAR', { status: route.status, headers });
    const cancel = response.body!.cancel.bind(response.body);
    response.body!.cancel = (...args) => {
      cancelled++;
      return cancel(...args);
    };
    return response;
  };
  return { doFetch, requested, cancelled: () => cancelled };
}

const START = new URL('https://feeds.example.edu/cal.ics');

describe('followSafely', () => {
  it('returns a plain answer without following anything', async () => {
    const net = network({ [START.toString()]: { status: 200 } });
    const out = await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(out.ok).toBe(true);
    expect(net.requested).toEqual([START.toString()]);
  });

  it('never requests a redirect target that is a cloud metadata address', async () => {
    const net = network({
      [START.toString()]: { status: 302, location: 'https://169.254.169.254/latest/meta-data/' },
    });
    const out = await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(out).toMatchObject({ ok: false, kind: 'refused' });
    // The whole point: one request, to the public host. The second was never made.
    expect(net.requested).toEqual([START.toString()]);
  });

  it.each([
    ['loopback', 'https://127.0.0.1:8443/x'],
    ['a private range', 'https://10.0.0.5/x'],
    ['a local name', 'https://printer.local/x'],
    ['an internal name', 'https://db.internal/x'],
    ['IPv6 loopback', 'https://[::1]/x'],
    ['IPv4 written inside IPv6', 'https://[::ffff:127.0.0.1]/x'],
    ['a scheme downgrade', 'http://feeds.example.edu/x'],
  ])('refuses a redirect to %s before requesting it', async (_name, target) => {
    const net = network({ [START.toString()]: { status: 301, location: target } });
    const out = await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(out.ok).toBe(false);
    expect(net.requested).toEqual([START.toString()]);
  });

  it('refuses on the second hop too, and has requested only the first two', async () => {
    const mid = 'https://cdn.example.edu/cal.ics';
    const net = network({
      [START.toString()]: { status: 302, location: mid },
      [mid]: { status: 307, location: 'https://192.168.1.1/admin' },
    });
    const out = await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(out.ok).toBe(false);
    expect(net.requested).toEqual([START.toString(), mid]);
  });

  it('follows a chain of public hops, resolving a relative Location against the hop it came from', async () => {
    const net = network({
      [START.toString()]: { status: 302, location: '/moved/cal.ics' },
      'https://feeds.example.edu/moved/cal.ics': { status: 308, location: 'https://cdn.example.edu/final.ics' },
      'https://cdn.example.edu/final.ics': { status: 200 },
    });
    const out = await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.url.toString()).toBe('https://cdn.example.edu/final.ics');
    expect(net.requested).toHaveLength(3);
  });

  it('stops the transfer of each redirect body it does not use', async () => {
    const net = network({
      [START.toString()]: { status: 302, location: 'https://cdn.example.edu/final.ics' },
      'https://cdn.example.edu/final.ics': { status: 200 },
    });
    await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(net.cancelled()).toBe(1);
  });

  it('gives up after MAX_REDIRECTS hops rather than looping', async () => {
    const hop = (n: number) => `https://feeds.example.edu/${n}`;
    const routes: Record<string, { status: number; location?: string }> = {};
    for (let n = 0; n < 50; n++) routes[hop(n)] = { status: 302, location: hop(n + 1) };
    const net = network(routes);
    const out = await followSafely(new URL(hop(0)), publicCalendarUrl, net.doFetch);
    expect(out).toMatchObject({ ok: false, kind: 'too-many' });
    expect(net.requested).toHaveLength(MAX_REDIRECTS + 1);
  });

  it('refuses a Location it cannot parse', async () => {
    const net = network({ [START.toString()]: { status: 302, location: 'https://[' } });
    const out = await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(out).toMatchObject({ ok: false, kind: 'refused' });
    expect(net.requested).toEqual([START.toString()]);
  });

  it('hands back a redirect with no Location as it is, so the caller can report the status', async () => {
    const net = network({ [START.toString()]: { status: 302 } });
    const out = await followSafely(START, publicCalendarUrl, net.doFetch);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.response.status).toBe(302);
  });

  it('refuses a start address that is itself private, without any request', async () => {
    const net = network({});
    const out = await followSafely(new URL('https://169.254.169.254/'), publicCalendarUrl, net.doFetch);
    expect(out.ok).toBe(false);
    expect(net.requested).toEqual([]);
  });

  /**
   * The control. A probe that cannot fail reads clean whatever it is asked, so
   * this runs the same redirect with a rule that allows everything and requires
   * the metadata address to be requested. If the tests above could not tell the
   * difference, this would not either.
   */
  it('control: with a permissive rule the metadata address IS requested', async () => {
    const permissive: AddressRule = (raw) => ({ ok: true, url: new URL(raw) });
    const net = network({
      [START.toString()]: { status: 302, location: 'https://169.254.169.254/latest/meta-data/' },
      'https://169.254.169.254/latest/meta-data/': { status: 200 },
    });
    const out = await followSafely(START, permissive, net.doFetch);
    expect(out.ok).toBe(true);
    expect(net.requested).toEqual([START.toString(), 'https://169.254.169.254/latest/meta-data/']);
  });
});

describe('the function uses it', () => {
  const source = readFileSync(join(root, 'supabase/functions/fetchcal/index.ts'), 'utf8');
  // Comments say `redirect: 'follow'` while explaining the old flaw; the code is what is held.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('does not let fetch follow redirects on its own', () => {
    expect(code).not.toMatch(/redirect:\s*['"]follow['"]/);
  });

  it('fetches with redirect: manual and walks the chain with followSafely', () => {
    expect(code).toMatch(/redirect:\s*['"]manual['"]/);
    expect(code).toMatch(/followSafely\(/);
    expect(code).toMatch(/from '\.\.\/_shared\/safefetch\.ts'/);
  });

  it('keeps the landed-address check as a second line behind the hop check', () => {
    expect(code).toMatch(/allowed\(upstream\.url/);
  });
});
