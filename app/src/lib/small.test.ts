import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modeInfo, modesFor } from './modes';
import { flatten, hitKey, openHit } from './openhit';
import { arrivedByShare, forgetShare, SHARE_CACHE, SHARE_KEY, takeShared } from './shared';
import { onOtherTab, tellOtherTabs } from './tabs';
import { buildCatalog } from '../data/catalog';
import type { Action } from '../state/shape';
import type { Hit } from './find';
import type { CourseModule, Guide } from './types';

/**
 * Four small files that are each one idea.
 *
 * They are together because separately they would be four files of fixtures
 * and one assertion. What they have in common is that each is the last thing
 * between the app and something outside it — a browser API that may not exist,
 * a description shown before somebody spends a tap, a dispatch table two
 * screens share.
 */

// ── modes ─────────────────────────────────────────────────────────────────

const guide = (units: number, cardsEach = 2): Guide => ({
  code: 'ECON 1020',
  name: '',
  blurb: '',
  source: '',
  mastery: 0,
  audio: false,
  units: Array.from({ length: units }, (_, i) => ({
    name: `Unit ${i}`,
    mastery: 0,
    cards: Array.from({ length: cardsEach }, (_, c) => ({ q: `q${i}-${c}`, a: `a${i}-${c}` })),
  })),
  terms: [],
});

const module_ = (over: Partial<CourseModule> = {}): CourseModule => ({
  course: {
    id: 'econ',
    code: 'ECON 1020',
    name: '',
    prof: '',
    email: '',
    meets: '',
    room: '',
    credits: '',
    source: '',
    grading: [],
  },
  items: [],
  schedule: [],
  guide: guide(2),
  planMinutes: '45 min',
  frameLabel: 'Frames',
  ...over,
});

const source = (over: Partial<Parameters<typeof modesFor>[2]> = {}) => ({
  guide: guide(2),
  lessons: {},
  figures: {},
  extras: [],
  ...over,
});

describe('modesFor', () => {
  const cat = buildCatalog([module_()]);

  it('describes every mode, so none is a bare word on a chip', () => {
    // Ten of these used to be one-word chips in a row that scrolled sideways,
    // so about four were visible and none said what it was.
    for (const mode of modesFor(cat, 'econ', source())) {
      expect(mode.label).toBeTruthy();
      expect(mode.blurb.length).toBeGreaterThan(20);
      expect(mode.count).toBeTruthy();
    }
  });

  it('says what is behind a mode before a tap finds out', () => {
    const modes = modesFor(cat, 'econ', source());
    expect(modeInfo(modes, 'cards')?.count).toBe('4 cards');
    expect(modeInfo(modes, 'read')?.count).toBe('2 units');
  });

  it('marks a mode with nothing behind it as not ready, and says what would fill it', () => {
    // A mode with nothing looked identical to one with forty-four narrated
    // lessons behind it, and the only way to tell was to tap and be told no.
    const empty = modesFor(cat, 'econ', source({ guide: guide(0) }));
    for (const mode of empty) {
      if (!mode.ready) expect(mode.missing).toBeTruthy();
    }
    expect(modeInfo(empty, 'cards')?.ready).toBe(false);
    expect(modeInfo(empty, 'watch')?.ready).toBe(false);
  });

  it('counts figures from the guide and from what you added', () => {
    const modes = modesFor(cat, 'econ', source({ figures: { 0: {} }, extras: [{}, {}] }));
    expect(modeInfo(modes, 'figures')?.count).toBe('3 figures');
  });

  it('offers a quiz only when there are four different answers to offer', () => {
    /*
     * Not four cards — four answers. This gate is why the mode exists: a quiz
     * that can only field two options is a coin toss with a score attached,
     * and the whole point of describing a mode is that nobody has to spend a
     * tap discovering that. See `lib/quiz.ts`.
     */
    const thin: Guide = {
      ...guide(1),
      units: [
        {
          name: 'U',
          mastery: 0,
          cards: [
            { q: 'q1', a: 'Same' },
            { q: 'q2', a: 'Same' },
            { q: 'q3', a: 'Same' },
            { q: 'q4', a: 'Other' },
          ],
        },
      ],
    };
    const modes = modesFor(cat, 'econ', source({ guide: thin }));
    expect(modeInfo(modes, 'quiz')?.ready).toBe(false);
    expect(modeInfo(modes, 'quiz')?.count).toBe('Needs 4 answers');
    // Four cards, four answers: offered.
    expect(modeInfo(modesFor(cat, 'econ', source()), 'quiz')?.ready).toBe(true);
  });

  it('gives every mode a distinct id', () => {
    const ids = modesFor(cat, 'econ', source()).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('answers with nothing for a mode that does not exist', () => {
    expect(modeInfo(modesFor(cat, 'econ', source()), 'nonsense' as never)).toBeUndefined();
  });
});

// ── openhit ───────────────────────────────────────────────────────────────

describe('openHit', () => {
  /** Where a hit sends the app, as the actions it dispatches. */
  const sentBy = (hit: Hit): Action[] => {
    const out: Action[] = [];
    openHit(hit, (a) => out.push(a));
    return out;
  };
  const hit = (over: Partial<Hit>): Hit =>
    ({ kind: 'item', id: 'x', title: 't', sub: 's', tag: 'T', score: 1, ...over }) as Hit;

  it('opens each kind of result where that kind lives', () => {
    expect(sentBy(hit({ kind: 'item', id: 'econ-m1' }))).toEqual([
      { type: 'openItem', id: 'econ-m1' },
    ]);
    expect(sentBy(hit({ kind: 'course', id: 'econ' }))).toEqual([
      { type: 'openCourse', id: 'econ' },
    ]);
    expect(sentBy(hit({ kind: 'note', id: 'n1' }))).toEqual([{ type: 'openNote', id: 'n1' }]);
    expect(sentBy(hit({ kind: 'screen', screen: 'calendar' }))).toEqual([
      { type: 'go', screen: 'calendar' },
    ]);
  });

  // Unlike a task, each of these has a screen of its own, so the result opens
  // the thing rather than the list that holds it.
  it('opens a made thing on its own screen', () => {
    expect(sentBy(hit({ kind: 'document', id: 'd1' }))).toEqual([
      { type: 'openDocument', id: 'd1' },
    ]);
    expect(sentBy(hit({ kind: 'sheet', id: 's1' }))).toEqual([{ type: 'openSheet', id: 's1' }]);
    // `editDeck`, not `openDeck` — that name belongs to the study slideshow.
    expect(sentBy(hit({ kind: 'deck', id: 'k1' }))).toEqual([{ type: 'editDeck', id: 'k1' }]);
  });

  it('opens a study unit in the mode it was found in', () => {
    expect(
      sentBy(hit({ kind: 'unit', courseId: 'econ', unit: 3, mode: 'cards' })),
    ).toEqual([{ type: 'openGuide', id: 'econ', mode: 'cards', unit: 3 }]);
  });

  it('lands a task on the tab that holds tasks, since one has no screen', () => {
    expect(sentBy(hit({ kind: 'task', id: 't1' }))).toEqual([
      { type: 'setMineTab', tab: 'tasks' },
      { type: 'go', screen: 'mine' },
    ]);
  });

  it('lands an appointment on its own tab, not on the task one', () => {
    expect(sentBy(hit({ kind: 'appointment', id: 'a1' }))).toEqual([
      { type: 'setMineTab', tab: 'appointments' },
      { type: 'go', screen: 'mine' },
    ]);
  });

  /*
   * The failure this file's header names: findable in one place and dead in
   * the other. A kind added to `Hit` and not to the table falls through the
   * switch and the press does nothing at all — no navigation, no error.
   */
  it('has somewhere to send every kind of hit there is', () => {
    const kinds: Hit['kind'][] = ['item', 'course', 'unit', 'note', 'task', 'appointment', 'screen'];
    for (const kind of kinds) {
      expect(sentBy(hit({ kind, courseId: 'econ', unit: 0, mode: 'cards', screen: 'calendar' })), kind)
        .not.toHaveLength(0);
    }
  });
});

describe('flatten and hitKey', () => {
  const h = (title: string): Hit =>
    ({ kind: 'item', id: title, title, sub: 'sub', tag: 'T', score: 1 }) as Hit;

  it('reads the groups out in the order they are drawn', () => {
    expect(
      flatten([{ hits: [h('a'), h('b')] }, { hits: [] }, { hits: [h('c')] }]).map((x) => x.title),
    ).toEqual(['a', 'b', 'c']);
  });

  it('tells two results apart, and calls one result the same thing twice', () => {
    // The key has to be stable across renders or the arrow-key selection jumps
    // as somebody types.
    expect(hitKey(h('a'))).toBe(hitKey(h('a')));
    expect(hitKey(h('a'))).not.toBe(hitKey(h('b')));
  });
});

// ── tabs ──────────────────────────────────────────────────────────────────

/** A BroadcastChannel that delivers to every other channel on the same name. */
function fakeChannels() {
  const live = new Set<FakeChannel>();
  class FakeChannel {
    listeners: ((e: MessageEvent) => void)[] = [];
    closed = false;
    name: string;
    // Written out rather than as a parameter property: this project compiles
    // with `erasableSyntaxOnly`, which rules those out.
    constructor(name: string) {
      this.name = name;
      live.add(this);
    }
    addEventListener(_: string, fn: (e: MessageEvent) => void) {
      this.listeners.push(fn);
    }
    removeEventListener(_: string, fn: (e: MessageEvent) => void) {
      this.listeners = this.listeners.filter((l) => l !== fn);
    }
    postMessage(data: unknown) {
      // As the real one does: everybody on the channel except the sender.
      for (const c of live) {
        if (c === this || c.closed) continue;
        for (const fn of c.listeners) fn({ data } as MessageEvent);
      }
    }
    close() {
      this.closed = true;
      live.delete(this);
    }
  }
  return FakeChannel;
}

describe('telling the other tab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('nudges a tab that is listening', () => {
    const Channel = fakeChannels();
    vi.stubGlobal('BroadcastChannel', Channel);
    const heard = vi.fn();
    onOtherTab(heard);
    // Posted as another tab would post it. This module is one tab, and it
    // ignores its own name — see the test below.
    new Channel('semester').postMessage({ from: 'the-other-tab', at: Date.now() });
    expect(heard).toHaveBeenCalledOnce();
  });

  it('ignores its own echo rather than reacting to itself', () => {
    /*
     * `BroadcastChannel` does not deliver to the tab that posted, so the check
     * is belt and braces — but a page that reloads while another holds the
     * channel open is cheap to get wrong, and a tab reacting to its own write
     * would re-read, re-write and go round again.
     */
    const Channel = fakeChannels();
    vi.stubGlobal('BroadcastChannel', Channel);
    const heard = vi.fn();
    onOtherTab(heard);

    // Whatever `from` this module stamps on its own messages, back at itself.
    let mine: unknown;
    const spy = new Channel('semester');
    spy.addEventListener('message', (e: MessageEvent) => {
      mine = e.data;
    });
    tellOtherTabs();
    expect(heard).not.toHaveBeenCalled();

    new Channel('semester').postMessage(mine);
    expect(heard).not.toHaveBeenCalled();
  });

  it('sends the fact that something changed, and not the data', () => {
    /*
     * The receiving tab re-reads localStorage, which both tabs already agree
     * is the single authoritative copy. Sending the state would introduce a
     * second serialisation format, an ordering problem against the write, and
     * a way for two tabs to hold different objects.
     */
    const Channel = fakeChannels();
    vi.stubGlobal('BroadcastChannel', Channel);
    let seen: unknown;
    onOtherTab(() => {});
    const spy = new Channel('semester');
    spy.addEventListener('message', (e: MessageEvent) => {
      seen = e.data;
    });
    tellOtherTabs();
    expect(Object.keys(seen as object).sort()).toEqual(['at', 'from']);
  });

  it('stops listening when told to', () => {
    vi.stubGlobal('BroadcastChannel', fakeChannels());
    const heard = vi.fn();
    const stop = onOtherTab(heard);
    stop();
    tellOtherTabs();
    expect(heard).not.toHaveBeenCalled();
  });

  it('does nothing at all in a browser without the channel', () => {
    // Safari before 15.4, and some embedded browsers. The app then behaves
    // exactly as it did before this existed: correct, and stale until
    // reloaded.
    vi.stubGlobal('BroadcastChannel', undefined);
    const stop = onOtherTab(() => {});
    expect(() => stop()).not.toThrow();
    expect(() => tellOtherTabs()).not.toThrow();
  });

  it('survives a browser that has the channel and refuses to open one', () => {
    vi.stubGlobal(
      'BroadcastChannel',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );
    expect(() => onOtherTab(() => {})()).not.toThrow();
    expect(() => tellOtherTabs()).not.toThrow();
  });
});

// ── shared ────────────────────────────────────────────────────────────────

describe('a syllabus shared into the app', () => {
  const withUrl = (href: string) => {
    vi.stubGlobal('window', {
      location: { href, search: new URL(href).search },
      history: { replaceState: vi.fn() },
    });
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('knows a share by its marker, without touching the cache', () => {
    withUrl('https://example.test/?shared=1');
    expect(arrivedByShare()).toBe(true);
    withUrl('https://example.test/');
    expect(arrivedByShare()).toBe(false);
    withUrl('https://example.test/?shared=0');
    expect(arrivedByShare()).toBe(false);
  });

  it('takes the file the worker left, and deletes it as it reads', async () => {
    // A share is a one-time hand-off. A file left behind would arrive again on
    // the next launch as a mystery.
    const del = vi.fn(async () => true);
    vi.stubGlobal('caches', {
      open: async (name: string) => {
        expect(name).toBe(SHARE_CACHE);
        return {
          match: async (key: string) => {
            expect(key).toBe(SHARE_KEY);
            return {
              headers: new Headers({
                'x-shared-name': 'Econ1020.pdf',
                'x-shared-type': 'application/pdf',
              }),
              blob: async () => new Blob(['%PDF']),
            };
          },
          delete: del,
        };
      },
    });
    const [file] = await takeShared();
    expect(file.name).toBe('Econ1020.pdf');
    expect(file.type).toBe('application/pdf');
    expect(del).toHaveBeenCalledWith(SHARE_KEY);
  });

  it('names a file the worker could not name', async () => {
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async () => ({ headers: new Headers({}), blob: async () => new Blob(['x']) }),
        delete: async () => true,
      }),
    });
    expect((await takeShared())[0].name).toBe('shared');
  });

  it('brings back nothing for an empty hand-off', async () => {
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async () => ({ headers: new Headers({}), blob: async () => new Blob([]) }),
        delete: async () => true,
      }),
    });
    expect(await takeShared()).toEqual([]);
  });

  it('brings back nothing when there was no share at all', async () => {
    vi.stubGlobal('caches', {
      open: async () => ({ match: async () => undefined, delete: async () => true }),
    });
    expect(await takeShared()).toEqual([]);
  });

  it('brings back nothing in a browser with no cache, rather than failing', async () => {
    // A private window, or a browser without the Cache API. The importer's own
    // file picker still works, which is the whole fallback needed.
    vi.stubGlobal('caches', undefined);
    expect(await takeShared()).toEqual([]);
  });

  it('clears the marker so a reload does not re-run the share', async () => {
    // Without this, a reload finds an empty cache and lands somebody on the
    // importer for no reason.
    withUrl('https://example.test/?shared=1&keep=me');
    forgetShare();
    const replace = (window.history.replaceState as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(replace[2]).not.toContain('shared=1');
    expect(replace[2]).toContain('keep=me');
  });

  it('leaves an address that carries no marker alone', () => {
    withUrl('https://example.test/?keep=me');
    forgetShare();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });
});
