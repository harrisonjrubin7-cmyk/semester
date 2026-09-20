// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Standing } from '../lib/referral';

/**
 * What the invite section actually puts on the account screen.
 *
 * `lib/referral.test.ts` checks the reasoning and
 * `supabase/referrals.check.sql` checks what one account may learn about
 * another. Neither can see the screen, and the screen is where two of this
 * feature's decisions either hold or quietly do not:
 *
 *   * **A dead link is never drawn under a cheerful heading.** While the
 *     pilot's invite gate is on, a link handed to a stranger cannot make an
 *     account at all. The database knows and says so in `signup_open`; this is
 *     the test that the screen passes it on rather than dropping it.
 *   * **No row is created by looking.** The code is minted when somebody asks
 *     for a link, so opening the account screen must not call
 *     `make_referral_code`. Most accounts will never want this, and a row per
 *     account for a feature most accounts ignore is a table that has to be
 *     reasoned about in every deletion and export path.
 *
 * The module underneath is replaced: what is under test is what this component
 * does with an answer, not the answer.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let answer: Standing | null = { code: 'ABCD2345', joined: 3, active: 1, signupOpen: true };
let said = '';
const standing = vi.fn<() => Promise<Standing | null>>(async () => answer);
const makeCode = vi.fn<() => Promise<string>>(async () => 'ZZZZ2345');

vi.mock('../lib/referral', async () => {
  // The real sentence-writers, because what they say is half of what this
  // screen is for — a mocked `standingSaid` would leave the assertions below
  // testing a string this file wrote itself.
  const real = await vi.importActual<typeof import('../lib/referral')>('../lib/referral');
  return {
    ACTIVE_DAYS: real.ACTIVE_DAYS,
    standingSaid: real.standingSaid,
    linkFor: (code: string) => `https://semester.example/app/?r=${code}`,
    takeClaimSaid: () => said,
    standing: () => standing(),
    makeCode: () => makeCode(),
  };
});

const { ReferralLink } = await import('./ReferralLink');

let host: HTMLDivElement;
let root: Root;

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const buttons = () => [...host.querySelectorAll('button')];
const button = (label: string) =>
  buttons().find((b) => (b.textContent ?? '').trim().startsWith(label));

/** Mount, and let the standing settle — it is read in an effect. */
async function show() {
  await act(async () => {
    root.render(<ReferralLink />);
  });
}

beforeEach(() => {
  answer = { code: 'ABCD2345', joined: 3, active: 1, signupOpen: true };
  said = '';
  standing.mockClear();
  makeCode.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/*
 * Both halves, every time. `src/rootunmount.test.ts` is the guard and its
 * docstring is the argument: a root left mounted fails a *different* file, one
 * run in ten, and a seed does not bring it back.
 */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('an account that has asked for a link', () => {
  it('shows the link and what it has done', async () => {
    await show();
    expect(text()).toContain('https://semester.example/app/?r=ABCD2345');
    expect(text()).toContain('3 people have joined on your link');
    expect(button('Copy link')).toBeTruthy();
  });

  it('carries the caveat next to the number', async () => {
    // "Active" would overstate it: this app works signed out, so a classmate
    // using it daily on one device is counted as nought.
    await show();
    expect(text()).toMatch(/Counted from syncing, not from opening the app/);
  });
});

describe('an account that has not', () => {
  it('offers to make one, and has not made one by being looked at', async () => {
    answer = { code: '', joined: 0, active: 0, signupOpen: true };
    await show();
    expect(button('Make my invite link')).toBeTruthy();
    expect(makeCode).not.toHaveBeenCalled();
    expect(text()).not.toContain('?r=');
  });

  it('makes one when asked, and then shows it', async () => {
    answer = { code: '', joined: 0, active: 0, signupOpen: true };
    await show();
    await act(async () => {
      button('Make my invite link')!.click();
    });
    expect(makeCode).toHaveBeenCalledOnce();
    expect(text()).toContain('?r=ZZZZ2345');
    expect(text()).toContain('Nobody has joined on your link yet');
  });
});

describe('while the pilot gate is on', () => {
  it('says the link cannot make an account, instead of a count', async () => {
    answer = { code: 'ABCD2345', joined: 0, active: 0, signupOpen: false };
    await show();
    expect(text()).toContain('invite-only');
    // And not the cheerful version, which is the failure this exists to stop:
    // a working-looking link and a count that will never move.
    expect(text()).not.toContain('Nobody has joined on your link yet');
  });

  it('drops the sync caveat, which is not what is wrong', async () => {
    answer = { code: 'ABCD2345', joined: 0, active: 0, signupOpen: false };
    await show();
    expect(text()).not.toMatch(/Counted from syncing/);
  });
});

describe('somebody who arrived on a classmate’s link', () => {
  it('is told once that a row was written about them', async () => {
    said = 'You came in on a classmate’s invite link.';
    await show();
    expect(text()).toContain('You came in on a classmate’s invite link.');
  });

  it('and is told nothing when nothing was written', async () => {
    await show();
    expect(text()).not.toContain('You came in on');
  });
});

describe('when the account service cannot be reached', () => {
  it('draws nothing at all rather than an error under somebody’s email', async () => {
    standing.mockRejectedValueOnce(new Error('network'));
    await show();
    expect(text()).toBe('');
  });
});
