// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { EMPTY_CAREER, newOpportunity, type CareerLibrary, type Opportunity } from '../lib/career';
import { Career } from './Career';

/**
 * The career screen, driven the way somebody uses it.
 *
 * The library functions are covered in `lib/career.test.ts`. What is here is
 * the wiring, which is the half that has failed before elsewhere in this app:
 * a readout built from the right facts and drawn above the wrong tab, a filter
 * that exists and is never offered. Each of these mounts the screen, presses
 * what a student would press, and reads what is on it.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The key `Career` builds with no account signed in, on the default term. */
const KEY = 'semester.career.v1:device:2026FA';

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

const mount = async (lib: Partial<CareerLibrary> = {}) => {
  localStorage.setItem(KEY, JSON.stringify({ ...EMPTY_CAREER, ...lib }));
  await act(async () => {
    root.render(
      <StoreProvider>
        <Career />
      </StoreProvider>,
    );
  });
};

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');

/** The labels on the cards in the one `CardGrid` a tab draws, in order. */
const cards = () =>
  [...host.querySelectorAll('[style*="auto-fit"] > button > span:first-child')].map((s) =>
    s.textContent?.trim(),
  );

const listing = (patch: Partial<Opportunity>): Opportunity => ({ ...newOpportunity(), ...patch });

const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
  expect(button, `no button called ${label}`).toBeTruthy();
  await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

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

describe('what the résumé tab says is filled in', () => {
  it('is four facts above the fields, and no meter', async () => {
    await mount({
      headline: 'Economics and national security',
      experiences: [
        { id: 'a', category: 'Experience', title: 'Research assistant', organization: '', dates: '', details: '' },
      ],
    });
    await press('Résumé');
    expect(text()).toContain(
      'Headline: set · 1 experience entry · 0 contacts saved · no résumé draft built in Write yet',
    );
    expect(text()).not.toMatch(/%|All.?Star|profile strength/i);
  });

  it('says a headline is not set when it is not', async () => {
    await mount();
    await press('Résumé');
    expect(text()).toContain('Headline: not set · 0 experience entries · 0 contacts saved');
  });

  /*
   * The one fact that is about something outside this library. It has to come
   * from the documents the app actually holds, or the line is a guess.
   */
  it('changes the moment a draft is built in Write', async () => {
    await mount({ name: 'Harrison' });
    await press('Résumé');
    expect(text()).toContain('no résumé draft built in Write yet');
    await press('Build it in Write');
    expect(text()).toContain('résumé draft built in Write');
    expect(text()).not.toContain('no résumé draft built in Write yet');
  });
});

describe('ordering Discover by what you said you want', () => {
  const three = [
    listing({ id: 'porter', title: 'Kitchen porter', deadline: '2026-10-01' }),
    listing({ id: 'analyst', title: 'Policy analyst', location: 'Washington', deadline: '2026-11-01' }),
    listing({ id: 'assistant', title: 'Research assistant', skills: 'economics', deadline: '2026-12-01' }),
  ];

  it('opens soonest first, and puts the closest to the targets first when asked', async () => {
    await mount({ opportunities: three, targetRoles: 'analyst, economics', targetLocations: 'washington' });
    expect(cards()).toEqual(['Kitchen porter', 'Policy analyst', 'Research assistant']);

    await press('Closest to my targets');
    // Two target terms for the analyst, one for the assistant, none for the
    // porter — and the deadline order survives as the tie-break beneath it.
    expect(cards()).toEqual(['Policy analyst', 'Research assistant', 'Kitchen porter']);

    await press('Closest to my targets');
    expect(cards()).toEqual(['Kitchen porter', 'Policy analyst', 'Research assistant']);
  });

  it('shows no number beside a listing, only the order', async () => {
    await mount({ opportunities: three, targetRoles: 'analyst, economics' });
    await press('Closest to my targets');
    expect(text()).not.toMatch(/%|\bmatch(?:es|ed)?\b/i);
  });

  it('says where to set targets rather than reordering nothing in silence', async () => {
    await mount({ opportunities: three });
    await press('Closest to my targets');
    expect(text()).toContain('Nothing to sort by yet');
    expect(cards()).toEqual(['Kitchen porter', 'Policy analyst', 'Research assistant']);
  });
});
