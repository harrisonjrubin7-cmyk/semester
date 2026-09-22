// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { loadSeed } from '../data/seed';
import { DESTINATIONS } from '../lib/nav';
import { inFocus } from '../lib/focus';
import { offerable } from '../lib/unseen';
import { Directory } from './Directory';

/**
 * Focus, on the screen it is for.
 *
 * `lib/focus.test.ts` proves the filter against the registry and
 * `lib/focusapplied.test.ts` proves the directory imports it. Neither proves
 * the directory *draws* less with the switch on, which is the claim a person
 * reading Settings is being made — and `gateapplied.test.ts` records what
 * happens when that claim goes unmeasured: a switch that changed nothing, for
 * a week, with the suite green.
 *
 * Seeded with `showAll` so the reveal gate is out of the picture: on a fresh
 * account it holds back most of the app already, and a case that could not
 * tell which gate did the hiding would be no case.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(async () => {
  await loadSeed();
});

let host: HTMLDivElement;
let root: Root;

function seed(extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, courses: [], showAll: true, ...extra }),
  );
}

beforeEach(() => {
  window.location.hash = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

function show() {
  act(() => {
    root.render(
      <StoreProvider>
        <Directory />
      </StoreProvider>,
    );
  });
}

/** The registry list and nothing else — see `directoryreveal.test.tsx`. */
function rows(): string[] {
  return [...host.querySelectorAll('.deskdir-row, .deskdir-card')].map((el) =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

function suggested(): string {
  return [...host.querySelectorAll('button')]
    .filter((b) => !b.closest('.deskdir-fav, .deskdir-row, .deskdir-card, .deskdir-bar, .deskdir-focus'))
    .map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim())
    .join(' ');
}

/** Everything on the screen as one line — for a sentence that is not a button. */
function said(): string {
  return (host.textContent ?? '').replace(/\s+/g, ' ');
}

function type(text: string) {
  const box = host.querySelector('input');
  if (!box) throw new Error('no search box on the directory');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** A screen the spec names as social, and one it names as the term. */
const SOCIAL = 'Classmates';
const TERM = 'Calendar';

describe('the directory with focus on', () => {
  it('draws the whole registry with focus off — the control', () => {
    seed({ focus: 'off' });
    show();
    const all = rows().join(' ');
    expect(all).toContain(SOCIAL);
    expect(all).toContain(TERM);
    expect(host.querySelector('.deskdir-focus')).toBeNull();
  });

  it('sets the campus aside and keeps the term', () => {
    seed({ focus: 'on' });
    show();
    const drawn = rows();
    const all = drawn.join(' ');
    expect(all).not.toContain(SOCIAL);
    expect(all).toContain(TERM);
    // As many as the filter says, not merely fewer: a list cut short at the
    // wrong place would also be shorter.
    expect(drawn.length).toBe(DESTINATIONS.filter(inFocus).length);
  });

  it('says so on the screen, with the way back', () => {
    seed({ focus: 'on' });
    show();
    const line = host.querySelector('.deskdir-focus');
    expect(line?.textContent).toMatch(/Focus is on/);
    expect(line?.querySelector('button')?.textContent).toMatch(/Turn focus off/);
  });

  it('still finds a set-aside screen when you search for it', () => {
    seed({ focus: 'on' });
    show();
    expect(rows().join(' ')).not.toContain(SOCIAL);
    type('classmates');
    expect(rows().join(' ')).toContain(SOCIAL);
  });

  it('offers "Not opened yet" from the set-aside list, not the whole one', () => {
    /*
     * By the panel's own count rather than by which three it chose. The
     * three rotate by calendar day — `offer` in `lib/unseen.ts` — so a case
     * that named one would hold on some days and not others, which is the
     * fault #724 took out of `directoryreveal.test.tsx`. The sentence above
     * the three says "N of the M places in here", and M is the pool: the
     * term's screens with focus on, everything with it off. That is true on
     * every day of the year, and it is the thing being claimed.
     */
    const pool = (rows: typeof DESTINATIONS) => offerable(rows).length;
    seed({ focus: 'on', visited: { home: true } });
    show();
    expect(said()).toContain(`1 of the ${pool(DESTINATIONS.filter(inFocus))} places`);
    const three = suggested();
    for (const d of DESTINATIONS.filter((d) => !inFocus(d))) {
      expect(three).not.toContain(d.label);
    }
  });

  it('counts the whole registry once focus is off — the control for the case above', () => {
    seed({ focus: 'off', visited: { home: true } });
    show();
    expect(said()).toContain(`1 of the ${offerable(DESTINATIONS).length} places`);
    expect(offerable(DESTINATIONS).length).toBeGreaterThan(offerable(DESTINATIONS.filter(inFocus)).length);
  });
});
