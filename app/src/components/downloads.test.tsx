// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * The screen that says what playing offline has cost.
 *
 * `lib/downloads.test.ts` covers the reading, the grouping and the two
 * clears. What only exists here is the part a person meets: that a browser
 * with nothing downloaded is shown nothing rather than an empty heading, that
 * a course is named the way the rest of the app names it, that pressing Clear
 * actually empties the cache and the screen agrees afterwards, and that a
 * refusal is reported rather than dressed up as a success.
 *
 * That last one is why this file exists. `caches.delete` resolving `false`,
 * or the whole API being unavailable in a private window, is invisible from
 * inside the component — the list would simply redraw unchanged, which reads
 * as a button that does nothing.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const at = (path: string) => `https://example.test${path}`;

/** The cache storage a browser would have, with whatever the test put in it. */
function give(
  contents: Record<string, { url: string; bytes: number; body?: unknown }[]>,
  refuse = false,
) {
  const stores = new Map(Object.entries(contents).map(([k, v]) => [k, [...v]]));
  vi.stubGlobal('caches', {
    keys: () => Promise.resolve([...stores.keys()]),
    open: (name: string) => {
      const held = stores.get(name) ?? [];
      return Promise.resolve({
        keys: () => Promise.resolve(held.map((e) => ({ url: e.url }))),
        match: (req: { url: string }) => {
          const hit = held.find((e) => e.url === req.url);
          return Promise.resolve(
            hit
              ? {
                  headers: { get: () => String(hit.bytes) },
                  blob: () => Promise.resolve({ size: 0 }),
                  json: () =>
                    hit.body === undefined
                      ? Promise.reject(new Error('not json'))
                      : Promise.resolve(hit.body),
                }
              : undefined,
          );
        },
        delete: (req: { url: string }) => {
          const i = held.findIndex((e) => e.url === req.url);
          if (i >= 0) held.splice(i, 1);
          return Promise.resolve(i >= 0);
        },
      });
    },
    delete: (name: string) => {
      if (refuse) return Promise.reject(new Error('not allowed here'));
      return Promise.resolve(stores.delete(name));
    },
  });
  return stores;
}

vi.mock('../state/store', () => ({
  useStore: () => ({ catalog: { byId: { psci: { code: 'PSCI 2600' } } } }),
}));

const { Downloads } = await import('./Downloads');

let host: HTMLDivElement;
let root: Root;

async function mount() {
  await act(async () => {
    root.render(<Downloads />);
  });
  // The first read is a promise chain; one more turn settles it.
  await act(async () => {
    await Promise.resolve();
  });
}

const press = async (label: string) => {
  // By accessible name, because the per-shelf buttons say "Clear" and carry
  // the course in `aria-label` — see the note in the component.
  const button = [...host.querySelectorAll('button')].find((b) =>
    (b.getAttribute('aria-label') ?? b.textContent ?? '').includes(label),
  );
  if (!button) throw new Error(`Missing button ${label}. Had: ${[...host.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('what has been downloaded', () => {
  it('draws nothing at all when nothing has been played', async () => {
    // Not an empty section under a heading: that is a question the screen has
    // raised and then declined to answer.
    give({ 'semester-v1-shell': [{ url: at('/semester/index.html'), bytes: 4_000 }] });
    await mount();
    expect(host.textContent).toBe('');
  });

  it('draws nothing on a browser with no cache storage', async () => {
    vi.stubGlobal('caches', undefined);
    await mount();
    expect(host.textContent).toBe('');
  });

  it('names a course the way the rest of the app names it, and sizes it', async () => {
    give({
      'semester-v1-media': [
        { url: at('/semester/audio/lessons/psci/unit-0.mp3'), bytes: 2 * 1024 * 1024 },
        { url: at('/semester/audio/lessons/psci/unit-1.mp3'), bytes: 2 * 1024 * 1024 },
        { url: at('/semester/decks/psci.pptx'), bytes: 1024 * 1024 },
      ],
    });
    await mount();

    expect(host.textContent).toContain('PSCI 2600');
    expect(host.textContent).toContain('2 lessons · a deck');
    expect(host.textContent).toContain('5.0 MB');
  });

  it('falls back to the id for a course the catalogue has never heard of', async () => {
    // The sample can be switched off while its recordings are still cached,
    // and then nothing in the catalogue can name them.
    give({
      'semester-v1-media': [{ url: at('/semester/audio/lessons/bus/unit-0.mp3'), bytes: 1_000 }],
    });
    await mount();
    expect(host.textContent).toContain('BUS');
  });

  it('names the ceiling it is held under', async () => {
    give({ 'semester-v1-media': [{ url: at('/semester/decks/psci.pptx'), bytes: 1_000 }] });
    await mount();
    expect(host.textContent).toContain('150 MB');
    expect(host.textContent).toContain('played least recently makes way');
  });

  it('says what the cap took, rather than leaving it to be discovered', async () => {
    const shedAt = new Date('2026-12-03T10:00:00Z').getTime();
    /*
     * `lib/keep.ts` makes this argument about shedding a full store and it is
     * the same here: a cache that quietly threw away last month's lessons is
     * the same betrayal in a smaller coat.
     */
    give({
      'semester-v1-media': [
        { url: at('/semester/decks/psci.pptx'), bytes: 1_000 },
        {
          url: at('/semester/__media-ledger'),
          bytes: 200,
          body: {
            played: {},
            shed: {
              at: shedAt,
              bytes: 40 * 1024 * 1024,
              paths: [
                '/semester/audio/lessons/econ/unit-0.mp3',
                '/semester/audio/lessons/econ/unit-1.mp3',
              ],
            },
          },
        },
      ],
    });
    await mount();

    expect(host.textContent).toContain('2 lessons from ECON');
    expect(host.textContent).toContain('40.0 MB');
    expect(host.textContent).toContain('downloads it again');
    /*
     * Dated, because "room was made" with no when is a fact nobody can place —
     * and dated in the reader's own zone, which is what the assertion has to
     * allow for. Written as `/3 December/` first, which passes here and fails
     * under `npm run test:zones`: 10:00 UTC on the 3rd is the 4th in
     * Pacific/Kiritimati, and the component is right to say so.
     */
    const shown = new Date(shedAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
    });
    expect(host.textContent).toContain(`Room was made on ${shown}`);
  });

  it('says nothing about shedding when nothing has been shed', async () => {
    give({
      'semester-v1-media': [
        { url: at('/semester/decks/psci.pptx'), bytes: 1_000 },
        { url: at('/semester/__media-ledger'), bytes: 200, body: { played: {}, shed: null } },
      ],
    });
    await mount();
    expect(host.textContent).not.toContain('Room was made');
  });

  it('says what is not in here, which is everything of yours', async () => {
    give({ 'semester-v1-media': [{ url: at('/semester/decks/psci.pptx'), bytes: 1_000 }] });
    await mount();
    expect(host.textContent).toContain('Nothing of yours is in here');
    // And the one case where clearing is not free, said before the press.
    expect(host.textContent).toContain('needs a connection');
  });
});

describe('clearing it', () => {
  it('empties the cache, and the screen agrees afterwards', async () => {
    const stores = give({
      'semester-v1-shell': [{ url: at('/semester/index.html'), bytes: 4_000 }],
      'semester-v1-media': [{ url: at('/semester/audio/psci-podcast.mp3'), bytes: 9 * 1024 * 1024 }],
    });

    await mount();
    expect(host.textContent).toContain('Clear all 9.0 MB');

    await press('Clear all');

    expect(stores.has('semester-v1-media')).toBe(false);
    // The shell is what makes the app open with no signal. It stays.
    expect(stores.has('semester-v1-shell')).toBe(true);
    expect(host.textContent).toBe('');
  });

  it('clears one course and leaves the other playable', async () => {
    give({
      'semester-v1-media': [
        { url: at('/semester/audio/lessons/psci/unit-0.mp3'), bytes: 3 * 1024 * 1024 },
        { url: at('/semester/audio/lessons/econ/unit-0.mp3'), bytes: 1024 * 1024 },
      ],
    });

    await mount();
    await press('Clear PSCI 2600');

    expect(host.textContent).not.toContain('PSCI 2600');
    expect(host.textContent).toContain('ECON');
    expect(host.textContent).toContain('Clear all 1.0 MB');
  });

  it('offers a clear rather than claiming to be running one, before any press', async () => {
    /*
     * The bug this pins, which no assertion above could see: "which clear is
     * running" was held as a string with `''` for none, and `''` is a real
     * shelf — everything whose path names no course is grouped under it. That
     * row's button therefore read *Clearing…*, disabled, from the moment the
     * screen drew, and only on a device that had something uncoursed cached.
     * Found by opening the screen in a browser.
     */
    give({
      'semester-v1-media': [
        { url: at('/semester/audio/lessons/psci/unit-0.mp3'), bytes: 2_000 },
        { url: at('/semester/handouts/somebody-elses-notes.txt'), bytes: 9_000 },
      ],
    });
    await mount();

    expect(host.textContent).toContain('Everything else');
    expect(host.textContent).not.toContain('Clearing…');
    for (const b of host.querySelectorAll('button')) expect(b.disabled).toBe(false);
  });

  it('reports a refusal rather than redrawing as though it worked', async () => {
    give({ 'semester-v1-media': [{ url: at('/semester/decks/psci.pptx'), bytes: 1_000 }] }, true);

    await mount();
    await press('Clear all');

    expect(host.textContent).toContain('would not let the app empty its cache');
    // And the files are still listed, because they are still there.
    expect(host.textContent).toContain('PSCI 2600');
  });
});
