// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { OWN_GROUP } from '../lib/linkgroups';
import type { CampusLink } from '../lib/types';
import { Links } from './Links';

/**
 * Adding a link under a heading of your own.
 *
 * `lib/linkgroups.test.ts` holds the fold and the order. What is here is the
 * screen doing it: the group box exists, what is typed into it reaches the
 * record, and the heading appears with the row beneath it — which is the half
 * that can be right in a library and wrong on a page.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const mount = async (extraLinks: CampusLink[] = []) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, extraLinks }));
  await act(async () => {
    root.render(
      <StoreProvider>
        <Links />
      </StoreProvider>,
    );
  });
};

/** Every heading on the screen, in the order it draws them. */
const headings = () => [...host.querySelectorAll('.section-label')].map((h) => h.textContent?.trim());

/** The link names under one heading. */
const under = (group: string) => {
  const head = [...host.querySelectorAll('.section-label')].find((h) => h.textContent?.trim() === group);
  expect(head, `no heading called ${group}`).toBeTruthy();
  // A row with an address wraps its name in an `<a>`, one without in a
  // `<span>`; both put the name in the first span of that wrapper.
  const rows = head!.parentElement?.querySelectorAll('a.bare > span:first-child, span > span:first-child');
  return [...(rows ?? [])].map((s) => s.textContent?.trim());
};

const type = async (label: string, value: string) => {
  const box = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(box, `no box called ${label}`).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, value);
    box!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

/** The EDIT / ADD control on one row, by the link's name. */
const openRow = async (name: string) => {
  const row = [...host.querySelectorAll('a.bare > span:first-child, span > span:first-child')]
    .find((s) => s.textContent?.trim() === name)
    ?.closest('div')?.parentElement;
  const button = [...(row?.querySelectorAll('button') ?? [])].find((b) =>
    /^(EDIT|ADD)$/i.test(b.textContent?.trim() ?? ''),
  );
  expect(button, `no EDIT on the row for ${name}`).toBeTruthy();
  await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const press = async (label: string) => {
  const button = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
  expect(button, `no button called ${label}`).toBeTruthy();
  await act(async () => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const link = (name: string, group?: string): CampusLink => ({
  id: name.toLowerCase(),
  name,
  url: `https://${name.toLowerCase()}.example.edu`,
  hint: '',
  note: '',
  ...(group === undefined ? {} : { group }),
});

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

describe('headings a student names', () => {
  it('draws no "Yours" until there is something of theirs to put under it', async () => {
    await mount();
    expect(headings()).not.toContain(OWN_GROUP);
  });

  it('draws a heading per name given, after the app’s own four', async () => {
    await mount([link('Landlord', 'Housing'), link('Gym'), link('Coach', 'Sport')]);
    const drawn = headings();
    expect(drawn.slice(0, 4)).toEqual(['Campus', 'Books', 'Tickets', 'Social']);
    expect(drawn.slice(4)).toEqual(['Housing', OWN_GROUP, 'Sport']);
    expect(under('Housing')).toEqual(['Landlord']);
    expect(under(OWN_GROUP)).toEqual(['Gym']);
  });

  it('puts a row under an existing heading when that is the name typed', async () => {
    await mount([link('Season pass', 'tickets')]);
    expect(headings()).toEqual(['Campus', 'Books', 'Tickets', 'Social']);
    expect(under('Tickets')).toContain('Season pass');
  });

  it('saves the group the add form was given, and defaults it to "Yours"', async () => {
    await mount();
    await press('Add a link of your own');
    await type('What the link is', 'Landlord');
    await type('Its address', 'portal.example.com');
    await type('Which group it goes under', 'Housing');
    await press('Add it');

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).extraLinks;
    expect(saved).toHaveLength(1);
    expect(saved[0].group).toBe('Housing');
    expect(under('Housing')).toEqual(['Landlord']);

    await press('Add a link of your own');
    await type('What the link is', 'Gym');
    await type('Its address', 'gym.example.com');
    await press('Add it');

    const both = JSON.parse(localStorage.getItem(STORAGE_KEY)!).extraLinks;
    // Left off the record rather than written in, so the default lives in one
    // place — see `groupName` in `lib/linkgroups.ts`.
    expect(both[1].group).toBeUndefined();
    expect(under(OWN_GROUP)).toEqual(['Gym']);
  });
});

describe('re-filing a link you already added', () => {
  it('moves it to the group typed, and leaves the address alone', async () => {
    await mount([link('Landlord', 'Housing'), link('Gym', 'Housing')]);
    expect(under('Housing')).toEqual(['Landlord', 'Gym']);

    await openRow('Landlord');
    await type('Landlord group', 'Rent');
    await press('Save');

    // A heading sits where its first link sits, so re-filing the first link
    // moves the heading with it — "Rent" is now what the topmost added row
    // names. Asserted rather than tolerated: it is the visible consequence of
    // ordering headings by their rows instead of by a list of their own.
    expect(headings().slice(4)).toEqual(['Rent', 'Housing']);
    expect(under('Housing')).toEqual(['Gym']);
    expect(under('Rent')).toEqual(['Landlord']);

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).extraLinks;
    expect(saved.find((l: CampusLink) => l.name === 'Landlord').group).toBe('Rent');
    expect(saved.find((l: CampusLink) => l.name === 'Landlord').url).toBe('https://landlord.example.edu');
  });

  /*
   * The box shows what is stored, not what is drawn. The screen files an
   * ungrouped row under "Yours" before rendering it, so reading the group off
   * the row would put "Yours" in a box the student left empty — and saving
   * would then write it into the record, which is the default leaking out of
   * `groupName` into the data.
   */
  it('opens empty on a link that was never given a group', async () => {
    await mount([link('Gym')]);
    await openRow('Gym');
    const box = host.querySelector<HTMLInputElement>('input[aria-label="Gym group"]');
    expect(box?.value).toBe('');
    await press('Save');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).extraLinks[0].group).toBeUndefined();
    expect(under(OWN_GROUP)).toEqual(['Gym']);
  });

  it('empties back to "Yours" by clearing the box, rather than by typing it', async () => {
    await mount([link('Gym', 'Sport')]);
    expect(headings()).toContain('Sport');

    await openRow('Gym');
    await type('Gym group', '   ');
    await press('Save');

    expect(headings()).not.toContain('Sport');
    expect(under(OWN_GROUP)).toEqual(['Gym']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).extraLinks[0].group).toBeUndefined();
  });

  /*
   * A bundled row's heading is the app's. There is no record to patch, so the
   * box is not offered rather than offered and quietly ignored.
   */
  it('offers no group box on a link the app shipped', async () => {
    await mount();
    await openRow('oneVU');
    expect(host.querySelector('input[aria-label="oneVU group"]')).toBeNull();
    expect(host.querySelector('input[aria-label="oneVU address"]')).toBeTruthy();
  });
});
