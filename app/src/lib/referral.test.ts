// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_DAYS,
  CODE_SHAPE,
  NEW_DAYS,
  PENDING_KEY,
  SAID_KEY,
  claimPending,
  linkFor,
  pendingCode,
  readCode,
  sayClaim,
  standing,
  standingSaid,
  takeClaimSaid,
  takeFromUrl,
} from './referral';

/**
 * The browser's half of the referral link.
 *
 * The database half is checked in `supabase/referrals.check.sql`, which is
 * where nearly all of the reasoning lives, and there is no overlap between the
 * two on purpose: that suite asks what one account may learn about another,
 * and this one asks whether a code survives the trip from a group chat to an
 * account being made — which is three redirects, an email in another tab and a
 * URL this app did not compose.
 *
 * The first two tests are the ones that would otherwise never fail. Both sides
 * of this feature state the same constants, in two languages, in two
 * deployments that cannot import from each other, and the failure mode is not
 * a crash: it is the app telling a student "synced in the last 14 days" under a
 * figure the database computed over thirty. `lib/allowance.test.ts` says more
 * about why a test that reads the other side as text is the right instrument
 * for that, and it is the same instrument here.
 */

const repo = join(process.cwd(), '..');
const migration = readFileSync(
  join(repo, 'supabase/migrations/20260901001400_referrals.sql'),
  'utf8',
);

const rpc = vi.fn();

vi.mock('./cloud', () => ({
  appUrl: () => 'https://semester.example/app/',
  cloudConfigured: true,
  cloud: () => Promise.resolve({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

beforeEach(() => {
  window.localStorage.clear();
  rpc.mockReset();
  window.history.replaceState(null, '', '/app/');
});

describe('the figures that live on both sides of the wire', () => {
  /*
   * Written out in full, and asserted to have matched, for the reason
   * `allowance.test.ts` gives: a regex that stops matching because somebody
   * renamed or moved the function returns null, and a test that only compares
   * when it finds something would pass silently for the rest of this
   * repository's life. A probe that cannot see its subject has to go red.
   */
  const bodyOf = (fn: string): RegExpMatchArray | null =>
    migration.match(
      new RegExp(`create or replace function public\\.${fn}\\(\\)[\\s\\S]*?as \\$\\$ select (\\d+) \\$\\$`),
    );

  it('counts an account active over the same window the database does', () => {
    const line = bodyOf('referral_active_days');
    expect(line, 'could not find referral_active_days in the migration — has it moved?').toBeTruthy();
    expect(Number(line![1])).toBe(ACTIVE_DAYS);
  });

  it('calls an account new for the same number of days', () => {
    const line = bodyOf('referral_new_days');
    expect(line, 'could not find referral_new_days in the migration — has it moved?').toBeTruthy();
    expect(Number(line![1])).toBe(NEW_DAYS);
  });

  it('accepts exactly the codes the column will hold', () => {
    /*
     * The third figure, and the one that would fail most quietly. If this side
     * were the stricter, a perfectly good code would be refused before it was
     * ever sent and the student would be told their classmate's link was not a
     * link. If it were the looser, the round trip would be spent to be told
     * 'unknown', which reads the same as a typo.
     */
    const check = migration.match(/check \(code ~ '(\^\[[^']+\]\{8\}\$)'\)/);
    expect(check, "could not find the code column's check — has it moved?").toBeTruthy();
    expect(CODE_SHAPE.source).toBe(check![1]);
  });
});

describe('taking a code out of a link', () => {
  it('reads one before the hash, which is how the app writes them', () => {
    expect(readCode('?r=ABCD2345')).toBe('ABCD2345');
  });

  it('reads one inside the hash, which is how a person writes them', () => {
    // This app routes on the hash, so an address copied mid-session and
    // edited by hand ends up looking like this. Reading only the first form
    // would drop it, and the failure looks exactly like not being counted.
    expect(readCode('', '#/account?r=ABCD2345')).toBe('ABCD2345');
  });

  it('does not mind case or the spaces a chat app adds', () => {
    expect(readCode('?r=%20abcd2345%20')).toBe('ABCD2345');
  });

  it('refuses anything that is not a code', () => {
    // O and L are not in the alphabet, so these are typos rather than codes —
    // and sending them would spend a round trip to be told 'unknown'.
    expect(readCode('?r=ABCDEFGO')).toBe('');
    expect(readCode('?r=ABCDEFGL')).toBe('');
    expect(readCode('?r=SHORT')).toBe('');
    expect(readCode('?r=')).toBe('');
    expect(readCode('')).toBe('');
  });
});

describe('the link an ambassador copies', () => {
  it('hangs the code off the app address', () => {
    expect(linkFor('ABCD2345')).toBe('https://semester.example/app/?r=ABCD2345');
  });

  it('round-trips through the reader', () => {
    const url = new URL(linkFor('ABCD2345'));
    expect(readCode(url.search)).toBe('ABCD2345');
  });
});

describe('keeping it until there is an account', () => {
  it('remembers the code and takes it out of the address bar', () => {
    window.history.replaceState(null, '', '/app/?r=ABCD2345');
    expect(takeFromUrl()).toBe('ABCD2345');
    expect(pendingCode()).toBe('ABCD2345');
    /*
     * The removal is the half that is easy to leave out and the half that
     * matters afterwards: a code left in the address bar is copied with the
     * address — into a screenshot, a bookmark, a "look at this page" message —
     * and every one of those is somebody credited to an ambassador they have
     * never met.
     */
    expect(window.location.search).toBe('');
  });

  it('leaves everything else in the address alone', () => {
    // The sign-in redirect's own parameters come back on this same URL, and
    // `main.tsx` reads them immediately after this runs.
    window.history.replaceState(null, '', '/app/?code=xyz&r=ABCD2345&state=9');
    takeFromUrl();
    expect(window.location.search).toBe('?code=xyz&state=9');
  });

  it('keeps the first link, not the most recent', () => {
    // Somebody who opened one classmate's link on Tuesday and another's on
    // Thursday was brought here by the first. "Last one wins" hands the credit
    // to whoever messaged most recently.
    window.history.replaceState(null, '', '/app/?r=ABCD2345');
    takeFromUrl();
    window.history.replaceState(null, '', '/app/?r=ZZZZ2345');
    expect(takeFromUrl()).toBe('ABCD2345');
    expect(pendingCode()).toBe('ABCD2345');
  });

  it('ignores a stored value that is not a code', () => {
    // Storage is shared with every other version of this app that has ever run
    // in this browser, and a half-written value is not worth a round trip.
    window.localStorage.setItem(PENDING_KEY, 'not-a-code');
    expect(pendingCode()).toBe('');
  });
});

describe('claiming it', () => {
  it('does not ask when there is nothing waiting', async () => {
    expect(await claimPending()).toBe('');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sends the waiting code and forgets it once answered', async () => {
    window.localStorage.setItem(PENDING_KEY, 'ABCD2345');
    rpc.mockResolvedValue({ data: 'ok', error: null });
    expect(await claimPending()).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('claim_referral', { given: 'ABCD2345' });
    expect(pendingCode()).toBe('');
  });

  it('forgets it on a refusal too', async () => {
    /*
     * 'late' and 'already' will not become 'ok' by being asked twice, so a
     * device that kept retrying them would send a request on every sign-in for
     * the life of the account.
     */
    window.localStorage.setItem(PENDING_KEY, 'ABCD2345');
    rpc.mockResolvedValue({ data: 'late', error: null });
    expect(await claimPending()).toBe('late');
    expect(pendingCode()).toBe('');
  });

  it('keeps it when the request itself failed', async () => {
    // Offline, or a connection that dropped. Both are answered by trying again
    // at the next sign-in, and there will be one.
    window.localStorage.setItem(PENDING_KEY, 'ABCD2345');
    rpc.mockResolvedValue({ data: null, error: { message: 'network' } });
    await expect(claimPending()).rejects.toThrow('network');
    expect(pendingCode()).toBe('ABCD2345');
  });
});

describe('what the person who followed the link is told', () => {
  it('says so, once, when a row was written about them', async () => {
    window.localStorage.setItem(PENDING_KEY, 'ABCD2345');
    rpc.mockResolvedValue({ data: 'ok', error: null });
    await claimPending();

    const said = takeClaimSaid();
    expect(said).toMatch(/counted/i);
    // Never the ambassador: this side cannot know who owns a code, because
    // `claim_referral` deliberately does not answer with it.
    expect(said).not.toMatch(/@/);
    // Once. It is a disclosure, not a banner.
    expect(takeClaimSaid()).toBe('');
    expect(window.localStorage.getItem(SAID_KEY)).toBeFalsy();
  });

  it('says nothing about the answers that wrote nothing', () => {
    for (const word of ['self', 'already', 'late', 'unknown', 'signed-out', '']) {
      expect(sayClaim(word)).toBe('');
    }
  });
});

describe('the standing, and the sentence under it', () => {
  it('reads the row the function returns', async () => {
    rpc.mockResolvedValue({
      data: [{ code: 'ABCD2345', joined: 3, active: 1, signup_open: true }],
      error: null,
    });
    expect(await standing()).toEqual({
      code: 'ABCD2345',
      joined: 3,
      active: 1,
      signupOpen: true,
    });
  });

  it('reads an account that has never asked for a code', async () => {
    // A standing with no code, rather than no standing: a screen that got
    // nothing back could not tell that apart from a request that failed.
    rpc.mockResolvedValue({
      data: [{ code: null, joined: 0, active: 0, signup_open: true }],
      error: null,
    });
    expect(await standing()).toEqual({ code: '', joined: 0, active: 0, signupOpen: true });
  });

  it('leads with the gate when the gate is what matters', () => {
    /*
     * The pilot's invite list is a trigger on `auth.users`, so while it is on
     * a link handed to a stranger cannot make an account at all. A screen that
     * did not say so would print a dead link under a cheerful heading and let
     * somebody spend a week wondering why the count stayed at nought.
     */
    const said = standingSaid({ code: 'ABCD2345', joined: 0, active: 0, signupOpen: false });
    expect(said).toMatch(/invite-only/i);
  });

  it('tells nought-of-nought apart from nought-of-nine', () => {
    const nobody = standingSaid({ code: 'A', joined: 0, active: 0, signupOpen: true });
    const nine = standingSaid({ code: 'A', joined: 9, active: 0, signupOpen: true });
    expect(nobody).toMatch(/Nobody has joined/);
    expect(nine).toMatch(/9 people have joined/);
    expect(nine).toMatch(new RegExp(`none has synced in the last ${ACTIVE_DAYS} days`));
    expect(nine).not.toBe(nobody);
  });

  it('counts one person in the singular', () => {
    const one = standingSaid({ code: 'A', joined: 1, active: 1, signupOpen: true });
    expect(one).toMatch(/1 person has joined/);
    expect(one).not.toMatch(/people/);
  });

  it('says how many of the many, when it is some of them', () => {
    expect(standingSaid({ code: 'A', joined: 9, active: 4, signupOpen: true })).toMatch(
      new RegExp(`4 of them synced in the last ${ACTIVE_DAYS} days`),
    );
  });
});
