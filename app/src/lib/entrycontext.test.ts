// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { reducer } from '../state/reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import { ONB_STEPS } from '../data/misc';
import {
  ENTRY_KEY,
  ENTRY_MS,
  captureEntry,
  forgetEntry,
  parseEntry,
  recallEntry,
  rememberEntry,
} from './entrycontext';

/**
 * What a link from outside may say, and what it may not.
 *
 * The rule the tests hold: a link is typed by whoever wrote it, so it can
 * suggest where to go and which welcome to show, and it can grant nothing.
 * See `lib/entrycontext.ts`.
 */

afterEach(() => sessionStorage.clear());

describe('parseEntry', () => {
  it('reads every field it knows', () => {
    expect(
      parseEntry('?src=youtube&cid=fall-26&content=reg-guide&ref=ab12&role=student&continue=calendar'),
    ).toEqual({
      source: 'youtube',
      campaignId: 'fall-26',
      contentId: 'reg-guide',
      referralCode: 'ab12',
      roleHint: 'student',
      continueTo: 'calendar',
    });
  });

  it('is nothing for an address that says nothing it reads', () => {
    expect(parseEntry('')).toBeNull();
    expect(parseEntry('?utm_source=x&foo=bar')).toBeNull();
  });

  it('leaves an installed app shortcut to the existing ?screen= path', () => {
    expect(parseEntry('?screen=study')).toBeNull();
  });

  it('calls a link with a campaign and no source direct', () => {
    expect(parseEntry('?cid=spring')?.source).toBe('direct');
  });

  it('drops a source or role outside the fixed lists and keeps the rest', () => {
    expect(parseEntry('?src=carrier-pigeon&role=root&cid=ok')).toEqual({ source: 'direct', campaignId: 'ok' });
  });

  it('drops a destination that is not a screen the deep link rule allows', () => {
    // A URL, a path, a script, a retired screen and a leaf that would strand a cold load.
    for (const bad of [
      'https://evil.example/',
      '//evil.example',
      '/app/admin',
      'javascript:alert(1)',
      '../console',
      'import',
      'not-a-screen',
    ]) {
      expect(parseEntry(`?src=email&continue=${encodeURIComponent(bad)}`)?.continueTo, bad).toBeUndefined();
    }
  });

  it('drops a credential-shaped value rather than storing it', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig';
    const out = parseEntry(`?src=email&cid=${jwt}&ref=${encodeURIComponent('https://x.test/?t=1')}`);
    expect(out).toEqual({ source: 'email' });
  });

  it('caps an id at 64 characters', () => {
    expect(parseEntry(`?cid=${'a'.repeat(64)}`)?.campaignId).toHaveLength(64);
    expect(parseEntry(`?cid=${'a'.repeat(65)}&src=email`)?.campaignId).toBeUndefined();
  });

  it('never carries anything that reads as a grant', () => {
    const out = parseEntry('?src=email&role=institution_admin&tenant=acme&admin=1&entitlement=pro&continue=console');
    expect(Object.keys(out ?? {}).sort()).toEqual(['roleHint', 'source']);
  });
});

describe('remembering for the tab', () => {
  const entry = { source: 'email', campaignId: 'c1', continueTo: 'calendar' } as const;

  it('keeps it across a refresh in the same tab', () => {
    rememberEntry(entry, 1_000);
    expect(recallEntry(2_000)).toEqual(entry);
  });

  it('lets it go stale', () => {
    rememberEntry(entry, 1_000);
    expect(recallEntry(1_000 + ENTRY_MS)).toEqual(entry);
    expect(recallEntry(1_000 + ENTRY_MS + 1)).toBeNull();
  });

  it('refuses a clock that went backwards', () => {
    rememberEntry(entry, 5_000);
    expect(recallEntry(4_000)).toBeNull();
  });

  it('re-validates what it reads, so a hand-edited store cannot name a URL', () => {
    sessionStorage.setItem(
      ENTRY_KEY,
      JSON.stringify({ at: 1_000, entry: { source: 'email', continueTo: 'https://evil.example/', roleHint: 'root' } }),
    );
    expect(recallEntry(2_000)).toEqual({ source: 'email' });
  });

  it('survives garbage and forgets on request', () => {
    sessionStorage.setItem(ENTRY_KEY, '{nope');
    expect(recallEntry()).toBeNull();
    rememberEntry(entry);
    forgetEntry();
    expect(recallEntry()).toBeNull();
  });

  it('captureEntry prefers the address and falls back to the tab', () => {
    expect(captureEntry('?src=social&cid=a', 1_000)?.campaignId).toBe('a');
    expect(captureEntry('', 2_000)?.campaignId).toBe('a');
    expect(captureEntry('?src=email&cid=b', 3_000)?.campaignId).toBe('b');
  });
});

describe('setup keeps the link’s destination', () => {
  const fresh = (over: Partial<State> = {}): State =>
    ({ ...DEFAULT_PERSISTED, ...initialEphemeral(), ...over }) as State;

  it('ends the run on the named screen, ahead of the import door', () => {
    const after = reducer(fresh({ onb: ONB_STEPS - 1, courses: [], afterSetup: 'calendar' }), { type: 'onbNext' });
    expect(after.screen).toBe('calendar');
    expect(after.afterSetup).toBeNull();
    expect(after.seenOnboarding).toBe(true);
  });

  it('honours it on Skip too, because the link asked for it, not the tour', () => {
    const after = reducer(fresh({ onb: 1, afterSetup: 'study' }), { type: 'finishOnboarding' });
    expect(after.screen).toBe('study');
    expect(after.afterSetup).toBeNull();
  });

  it('changes nothing when no link named a destination', () => {
    const after = reducer(fresh({ onb: ONB_STEPS - 1, courses: [] }), { type: 'onbNext' });
    expect(after.screen).toBe('import');
  });
});
