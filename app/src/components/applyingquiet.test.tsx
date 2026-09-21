// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { QUIET_DAYS, moveTo, newApplication, type Application } from '../lib/apply';
import { ApplyingSoon } from './Applying';

/**
 * The quietest thing in the tracker, on the screen it was missing from.
 *
 * `quiet` has been computed since the tracker was written and drawn in exactly
 * one place — inside a row on `screens/Applying.tsx` you had to expand. An
 * application sent five weeks ago has no deadline left and often no next
 * action, so it has nothing in `standing`, so for as long as this section was
 * only about dates it was the one thing Today never mentioned.
 *
 * Mounted rather than grepped: `lib/apply.test.ts` already holds what `quietOnes`
 * returns, and the failure this is for is a correct list drawn nowhere.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/**
 * Sent `days` ago, with nothing since and no date of its own.
 *
 * Half a day past the boundary, because `useNow` does not return this exact
 * millisecond and `daysInStage` floors — landing a fixture on the boundary
 * makes it a test of the clock's rounding rather than of the section.
 */
const sent = (org: string, days: number): Application =>
  moveTo(
    newApplication({ org, role: 'Analyst', stage: 'found' }, Date.now()),
    'sent',
    Date.now() - (days + 0.5) * 86_400_000,
  );

const mount = async (applications: Application[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, applications }));
  await act(async () => {
    root.render(
      <StoreProvider>
        <ApplyingSoon />
      </StoreProvider>,
    );
  });
};

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

beforeAll(async () => {
  await loadSeed();
});

beforeEach(async () => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  await act(async () => {
    root = createRoot(host);
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

describe('applications that have gone quiet, on Today', () => {
  it('appears for one with no date on it at all', async () => {
    await mount([sent('Brookings', QUIET_DAYS + 14)]);
    expect(text()).toContain('Analyst at Brookings');
    expect(text()).toContain(`${QUIET_DAYS + 14} days, no word`);
  });

  it('stays away until the silence is long enough to be one', async () => {
    await mount([sent('Brookings', QUIET_DAYS - 1)]);
    expect(host.textContent).toBe('');
  });

  it('is longest-silent first, in the section applications already have', async () => {
    await mount([sent('Five weeks', QUIET_DAYS + 14), sent('Three weeks', QUIET_DAYS + 1)]);
    const rows = [...host.querySelectorAll('button')].map((b) => b.textContent ?? '');
    expect(rows.findIndex((r) => r.includes('Five weeks'))).toBeLessThan(
      rows.findIndex((r) => r.includes('Three weeks')),
    );
    // One heading, because this is the applications section rather than a
    // second one next to it.
    expect(text().match(/Applications/g)).toHaveLength(1);
  });

  /*
   * The whole reason the tracker has no probability, no score and no "strength
   * of fit". A number of days is a fact; what to do about it is not one this
   * app can derive from a stage and a date.
   */
  it('counts the days and tells nobody what they mean', async () => {
    await mount([sent('Brookings', QUIET_DAYS + 14)]);
    expect(text()).toContain('The app counts the days and has no opinion about what they mean');
    expect(text()).not.toMatch(/follow up|chase|nudge them|you should/i);
  });

  it('is not raised on one still being written, however long it has sat', async () => {
    const writing = moveTo(
      newApplication({ org: 'Brookings', stage: 'found' }, Date.now()),
      'writing',
      Date.now() - 90 * 86_400_000,
    );
    await mount([writing]);
    expect(host.textContent).toBe('');
  });
});
