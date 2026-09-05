import { describe, expect, it } from 'vitest';
import {
  FEED_NOTE,
  REPLACED_LINE,
  SHARE_WARNING,
  TOKEN_BYTES,
  feedUrl,
  freshness,
  looksLikeToken,
  newToken,
  readPublished,
  webcalUrl,
} from './subscribe';

const now = new Date(2026, 8, 5, 12, 0, 0);
const hoursAgo = (n: number) => now.getTime() - n * 3_600_000;

describe('the token', () => {
  it('is long enough that guessing is not a strategy', () => {
    expect(newToken()).toHaveLength(TOKEN_BYTES * 2);
    expect(TOKEN_BYTES * 8).toBeGreaterThanOrEqual(128);
  });

  it('is different every time', () => {
    const seen = new Set(Array.from({ length: 50 }, () => newToken()));
    expect(seen.size).toBe(50);
  });

  it('recognises its own and refuses anything else', () => {
    expect(looksLikeToken(newToken())).toBe(true);
    expect(looksLikeToken('')).toBe(false);
    expect(looksLikeToken('abc')).toBe(false);
    // Upper case, a query string, a path — the shapes a paste goes wrong in.
    expect(looksLikeToken(newToken().toUpperCase())).toBe(false);
    expect(looksLikeToken(`${newToken()}?x=1`)).toBe(false);
    expect(looksLikeToken(`/${newToken()}`)).toBe(false);
  });
});

describe('the link', () => {
  const token = 'a'.repeat(TOKEN_BYTES * 2);

  it('puts the token in the path, not the query', () => {
    // Some clients drop the query string when they store a subscription, and
    // the student ends up with a feed that worked exactly once.
    const url = feedUrl('https://example.functions.supabase.co', token);
    expect(url).toBe(`https://example.functions.supabase.co/calendar/${token}`);
    expect(url).not.toContain('?');
  });

  it('does not double a slash on a base that has one', () => {
    expect(feedUrl('https://example.co/', token)).toBe(`https://example.co/calendar/${token}`);
  });

  it('offers webcal, which is what opens the subscribe sheet', () => {
    // Handing over the https link is how somebody downloads a stale copy
    // while believing they subscribed.
    expect(webcalUrl(feedUrl('https://example.co', token))).toBe(
      `webcal://example.co/calendar/${token}`,
    );
  });
});

describe('how current it is', () => {
  it('says nothing is up yet rather than implying something is', () => {
    expect(freshness(undefined, now)).toContain('Nothing published yet');
  });

  it('reports the last upload, which is the only thing the app knows', () => {
    expect(freshness(hoursAgo(0.5), now)).toContain('last hour');
    expect(freshness(hoursAgo(5), now)).toBe('Published 5 hours ago.');
    expect(freshness(hoursAgo(1), now)).toContain('1 hour ago');
  });

  it('says why an old one is old', () => {
    const said = freshness(hoursAgo(72), now);
    expect(said).toContain('3 days ago');
    expect(said).toContain('only moves when a signed-in device syncs');
  });
});

describe('what it says about the risk', () => {
  it('says the link is the whole of the authentication', () => {
    expect(SHARE_WARNING).toContain('like a password');
    expect(SHARE_WARNING).toContain('cannot sign in');
    expect(SHARE_WARNING).toContain('read all of them');
  });

  it('says what replacing the link breaks', () => {
    expect(REPLACED_LINE).toContain('old link is dead');
    expect(REPLACED_LINE).toContain('re-subscribe');
  });

  it('carries the same caveat inside the calendar itself', () => {
    // Somebody may only ever see this in Apple Calendar, not in the app.
    expect(FEED_NOTE).toContain('not continuously');
  });
});

describe('reading a published feed back', () => {
  const token = newToken();

  it('takes a good record', () => {
    expect(readPublished({ token, updatedAt: 5, events: 12 })).toEqual({
      token,
      updatedAt: 5,
      events: 12,
    });
  });

  it('refuses anything without a real token, rather than building a broken link', () => {
    expect(readPublished(null)).toBeNull();
    expect(readPublished('nope')).toBeNull();
    expect(readPublished({})).toBeNull();
    expect(readPublished({ token: 'short' })).toBeNull();
  });

  it('drops fields that are not what they claim', () => {
    expect(readPublished({ token, updatedAt: 'yesterday', events: null })).toEqual({
      token,
      updatedAt: undefined,
      events: undefined,
    });
  });
});
