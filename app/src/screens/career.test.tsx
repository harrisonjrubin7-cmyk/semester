// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import {
  EMPTY_CAREER,
  newOpportunity,
  type CareerContact,
  type CareerLibrary,
  type Opportunity,
} from '../lib/career';
import { EMPTY_PATHWAY } from '../lib/pathway';
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

/** The keys `Career` builds with no account signed in, on the default term. */
const KEY = 'semester.career.v1:device:2026FA';
const PATHWAY_KEY = 'semester.pathway.v1:device';

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

const mount = async (lib: Partial<CareerLibrary> = {}, education = '') => {
  localStorage.setItem(KEY, JSON.stringify({ ...EMPTY_CAREER, ...lib }));
  localStorage.setItem(
    PATHWAY_KEY,
    JSON.stringify({ ...EMPTY_PATHWAY, profile: { ...EMPTY_PATHWAY.profile, education } }),
  );
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

const person = (name: string, patch: Partial<CareerContact> = {}): CareerContact => ({
  id: name,
  name,
  organization: '',
  interests: '',
  permission: 'Not requested',
  next: '',
  nextDate: '',
  notes: '',
  ...patch,
});

/** The names on the contact cards, in the order they are drawn. */
const contacts = () =>
  [...host.querySelectorAll('section h2, section .section-label')].map((h) => h.textContent?.trim());

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

describe('filtering contacts by what you have in common', () => {
  const EDUCATION = 'Vanderbilt University, B.A. Economics';
  const saved = [
    person('Priya', { school: 'Vanderbilt University', major: 'Economics' }),
    person('Tom', { school: 'Vanderbilt University', major: 'Chemistry' }),
    person('Ada', { school: 'Duke University' }),
  ];

  it('offers no chips at all when nothing is shared', async () => {
    await mount({ contacts: saved });
    await press('Contacts');
    expect(text()).not.toContain('Same school');
    expect(contacts()).toEqual(['Priya', 'Tom', 'Ada']);
  });

  it('offers only the chips some saved contact answers to', async () => {
    await mount({ contacts: [person('Ada', { school: 'Vanderbilt University' })] }, EDUCATION);
    await press('Contacts');
    expect(text()).toContain('Same school');
    // Nobody has recorded a course that matches, so there is nothing to filter
    // to and the chip is not drawn.
    expect(text()).not.toContain('Same major');
  });

  it('narrows the list, and narrows it further with both on', async () => {
    await mount({ contacts: saved }, EDUCATION);
    await press('Contacts');
    expect(contacts()).toEqual(['Priya', 'Tom', 'Ada']);

    await press('Same school');
    expect(contacts()).toEqual(['Priya', 'Tom']);

    await press('Same major');
    expect(contacts()).toEqual(['Priya']);

    await press('Same school');
    expect(contacts()).toEqual(['Priya']);
  });

  it('says on the card that the tag is what two people typed, not a check', async () => {
    await mount({ contacts: [saved[0]] }, EDUCATION);
    await press('Contacts');
    const card = [...host.querySelectorAll('section')]
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' '))
      .find((t) => t.includes('Priya'));
    expect(card, 'no card for Priya').toBeTruthy();
    expect(card).toContain('Same school · Same major — as you and they wrote it down');
    // The screen's own preamble uses "verified alumni" to say it has none; the
    // card must not claim one, so this reads the card rather than the page.
    expect(card).not.toMatch(/verified|confirmed/i);
  });
});

describe('drafting a message to a contact', () => {
  it('opens a draft beside Prepare rather than instead of it, and sends nothing', async () => {
    await mount(
      { contacts: [person('Priya', { organization: 'Brookings', school: 'Vanderbilt University' })] },
      'Vanderbilt University, B.A. Economics',
    );
    await press('Contacts');
    expect(text()).toContain('Prepare');

    await press('Draft an outreach message');
    // The draft is a document in Write, the way "Prepare" and the cover letter
    // already are. Nothing about the contact changed, and nothing was sent.
    const written = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const titles = (written.documents ?? []).map((d: { title: string }) => d.title);
    expect(titles).toContain('Messages to Priya');
    expect(JSON.parse(localStorage.getItem(KEY)!).contacts).toHaveLength(1);
  });
});
