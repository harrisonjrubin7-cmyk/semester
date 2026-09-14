import { describe as group, expect, it } from 'vitest';
import {
  clearCourse,
  clearDownloads,
  describe,
  readDownloads,
  shelfLine,
  shelves,
  totalBytes,
  type Download,
} from './downloads';

/**
 * A fake Cache Storage, because the real one is not in the test environment
 * and the interesting cases are the ones a real browser will not produce on
 * demand: a cache that will not open, a response with no `content-length`, a
 * shell cache sitting next to the media one waiting to be deleted by mistake.
 */
function fakeCaches(
  contents: Record<string, { url: string; bytes?: number; blob?: number }[]>,
  opts: { refuse?: string } = {},
): CacheStorage {
  const stores = new Map(Object.entries(contents).map(([k, v]) => [k, [...v]]));
  const cacheFor = (name: string) => {
    const held = stores.get(name) ?? [];
    return {
      keys: () => Promise.resolve(held.map((e) => ({ url: e.url }) as Request)),
      match: (req: Request) => {
        const hit = held.find((e) => e.url === req.url);
        if (!hit) return Promise.resolve(undefined);
        return Promise.resolve({
          headers: {
            get: () => (hit.bytes === undefined ? null : String(hit.bytes)),
          },
          blob: () => Promise.resolve({ size: hit.blob ?? 0 }),
        } as unknown as Response);
      },
      delete: (req: Request) => {
        const at = held.findIndex((e) => e.url === req.url);
        if (at >= 0) held.splice(at, 1);
        return Promise.resolve(at >= 0);
      },
    };
  };
  return {
    keys: () => Promise.resolve([...stores.keys()]),
    open: (name: string) => {
      if (name === opts.refuse) return Promise.reject(new Error('no'));
      return Promise.resolve(cacheFor(name) as unknown as Cache);
    },
    delete: (name: string) => Promise.resolve(stores.delete(name)),
  } as unknown as CacheStorage;
}

const at = (path: string) => `https://example.test${path}`;

group('which course a cached file belongs to', () => {
  it('reads the four shapes the worker caches', () => {
    expect(describe('/semester/audio/lessons/psci/unit-3.mp3')).toEqual({
      kind: 'lesson',
      course: 'psci',
    });
    expect(describe('/semester/audio/psci-podcast.mp3')).toEqual({
      kind: 'edition',
      course: 'psci',
    });
    expect(describe('/semester/decks/econ.pptx')).toEqual({ kind: 'deck', course: 'econ' });
    expect(describe('/semester/handouts/bus.pdf')).toEqual({ kind: 'handout', course: 'bus' });
    expect(describe('/semester/handouts/bus.docx')).toEqual({ kind: 'handout', course: 'bus' });
  });

  it('works at the root as well as under /semester/', () => {
    // Served from `/` in development and `/semester/` on Pages, so nothing
    // here may be anchored on the start of the path.
    expect(describe('/audio/lessons/core/unit-0.mp3')).toEqual({ kind: 'lesson', course: 'core' });
    expect(describe('/decks/core.pptx')).toEqual({ kind: 'deck', course: 'core' });
  });

  it('keeps the lesson index with its course without calling it a lesson', () => {
    // It is cached — it is under /audio/ — and it is a few kilobytes of cues.
    // Counting it as a thirteenth lesson would be a lie in the line; leaving
    // it uncoursed would file a course's own file under Other.
    expect(describe('/semester/audio/lessons/bus/lessons.json')).toEqual({
      kind: 'other',
      course: 'bus',
    });
  });

  it('does not guess at something it does not recognise', () => {
    expect(describe('/semester/handouts/a-syllabus-somebody-added.txt')).toEqual({
      kind: 'other',
      course: '',
    });
    expect(describe('/semester/assets/index-a1b2c3.js')).toEqual({ kind: 'other', course: '' });
  });
});

group('what a shelf says it holds', () => {
  const some = (kinds: Download['kind'][]): Download[] =>
    kinds.map((kind, i) => ({ url: `u${i}`, path: `p${i}`, kind, course: 'psci', bytes: 0 }));

  it('names each kind, and counts it', () => {
    expect(shelfLine(some(['lesson', 'lesson', 'edition', 'deck', 'handout']))).toBe(
      '2 lessons · a podcast edition · a deck · a handout',
    );
  });

  it('leaves out what is not there rather than saying none', () => {
    expect(shelfLine(some(['lesson']))).toBe('a lesson');
    expect(shelfLine([])).toBe('');
  });
});

group('the shelves', () => {
  const made = (course: string, kind: Download['kind'], bytes: number, n = 0): Download => ({
    url: at(`/${course}-${kind}-${n}`),
    path: `/${course}-${kind}-${n}`,
    kind,
    course,
    bytes,
  });

  it('puts the largest first, because the question is what is taking the room', () => {
    const list = [
      made('econ', 'lesson', 1_000_000),
      made('psci', 'lesson', 9_000_000),
      made('bus', 'lesson', 4_000_000),
    ];
    expect(shelves(list).map((s) => s.course)).toEqual(['psci', 'bus', 'econ']);
  });

  it('sums a course across the kinds', () => {
    const list = [
      made('psci', 'lesson', 1_000, 1),
      made('psci', 'lesson', 2_000, 2),
      made('psci', 'deck', 500),
    ];
    const [shelf] = shelves(list);
    expect(shelf).toMatchObject({ course: 'psci', bytes: 3_500, count: 3 });
    expect(shelf.line).toBe('2 lessons · a deck');
    expect(totalBytes(list)).toBe(3_500);
  });

  it('keeps anything uncoursed last, however big it is', () => {
    // Last rather than absent: it is taking room and it is clearable, and a
    // screen that adds up to less than the device reports is a screen nobody
    // can act on.
    const list = [made('', 'other', 50_000_000), made('psci', 'lesson', 1_000)];
    const out = shelves(list);
    expect(out.map((s) => s.course)).toEqual(['psci', '']);
    expect(out[1].line).toBe('a file');
  });
});

group('reading what is downloaded', () => {
  it('reads the media cache and leaves the shell and the handover alone', async () => {
    const store = fakeCaches({
      'semester-v1-shell': [{ url: at('/semester/index.html'), bytes: 4_000 }],
      'semester-shared': [{ url: at('/semester/__shared'), bytes: 900_000 }],
      'semester-v1-media': [
        { url: at('/semester/audio/lessons/psci/unit-0.mp3'), bytes: 2_000_000 },
        { url: at('/semester/decks/psci.pptx'), bytes: 240_000 },
      ],
    });

    const got = await readDownloads(store);
    expect(got.map((d) => d.path)).toEqual([
      '/semester/audio/lessons/psci/unit-0.mp3',
      '/semester/decks/psci.pptx',
    ]);
    expect(totalBytes(got)).toBe(2_240_000);
  });

  it('takes an older worker’s media cache too, before activate has swept it', async () => {
    const store = fakeCaches({
      'semester-v1-media': [{ url: at('/audio/lessons/econ/unit-1.mp3'), bytes: 1_000 }],
      'semester-v2-media': [{ url: at('/audio/lessons/econ/unit-2.mp3'), bytes: 2_000 }],
    });
    expect(totalBytes(await readDownloads(store))).toBe(3_000);
  });

  it('falls back to the blob when the response carries no length', async () => {
    const store = fakeCaches({
      'semester-v1-media': [{ url: at('/audio/psci-full.mp3'), blob: 7_654_321 }],
    });
    expect(totalBytes(await readDownloads(store))).toBe(7_654_321);
  });

  it('answers with nothing at all where there is no cache storage', async () => {
    // A browser without it, or a window where it is not allowed. The screen
    // above draws nothing for an empty list, which is the right answer.
    expect(await readDownloads(undefined as unknown as CacheStorage)).toEqual([]);
  });

  it('keeps what it read when a later cache will not open', async () => {
    const store = fakeCaches(
      {
        'semester-v1-media': [{ url: at('/audio/lessons/bus/unit-0.mp3'), bytes: 5_000 }],
        'semester-v2-media': [{ url: at('/audio/lessons/bus/unit-1.mp3'), bytes: 5_000 }],
      },
      { refuse: 'semester-v2-media' },
    );
    expect(totalBytes(await readDownloads(store))).toBe(5_000);
  });
});

group('clearing', () => {
  it('deletes every media cache and no others', async () => {
    const store = fakeCaches({
      'semester-v1-shell': [{ url: at('/semester/index.html'), bytes: 4_000 }],
      'semester-shared': [{ url: at('/semester/__shared'), bytes: 900_000 }],
      'semester-v1-media': [{ url: at('/semester/audio/psci-podcast.mp3'), bytes: 9_000_000 }],
    });

    expect(await clearDownloads(store)).toBe(true);
    expect(await readDownloads(store)).toEqual([]);
    // The two that must survive: one is what makes the app open with no
    // signal, the other is a file in mid-handover from the share target.
    expect(await store.keys()).toEqual(['semester-v1-shell', 'semester-shared']);
  });

  it('clears one course and leaves the rest playable', async () => {
    const store = fakeCaches({
      'semester-v1-media': [
        { url: at('/semester/audio/lessons/psci/unit-0.mp3'), bytes: 1_000 },
        { url: at('/semester/audio/lessons/psci/lessons.json'), bytes: 10 },
        { url: at('/semester/decks/psci.pptx'), bytes: 100 },
        { url: at('/semester/audio/lessons/econ/unit-0.mp3'), bytes: 2_000 },
      ],
    });

    expect(await clearCourse('psci', store)).toBe(true);
    const left = await readDownloads(store);
    expect(left.map((d) => d.path)).toEqual(['/semester/audio/lessons/econ/unit-0.mp3']);
  });

  it('says so rather than claiming a clear it could not do', async () => {
    // A button that reports success it did not have is worse than one that
    // reports the failure.
    expect(await clearDownloads(undefined as unknown as CacheStorage)).toBe(false);
    expect(await clearCourse('psci', undefined as unknown as CacheStorage)).toBe(false);

    const refusing = fakeCaches({ 'semester-v1-media': [] }, { refuse: 'semester-v1-media' });
    expect(await clearCourse('psci', refusing)).toBe(false);
  });
});
