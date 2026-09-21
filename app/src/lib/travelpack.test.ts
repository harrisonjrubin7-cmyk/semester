import { describe, expect, it, vi } from 'vitest';
import { coursesInDays, fetchPack, packFor, showBytes, type PackFile } from './travelpack';
import type { Catalog } from '../data/catalog';
import type { CourseModule, Item } from './types';

const NOW = new Date(2026, 8, 3); // Thu 3 Sep 2026

const item = (id: string, c: string, month: number, day: number): Item =>
  ({
    id,
    c,
    title: id,
    kind: 'Paper',
    month,
    day,
    dueTime: '11:59p',
    weight: '',
    where: '',
    detail: '',
    quote: '',
    source: '',
  }) as Item;

/**
 * A course module as `packFor` reads one: lessons, editions, and the id that
 * decides whether a deck and a handout were built for it.
 */
const mod = (id: string, over: Partial<CourseModule> = {}): CourseModule =>
  ({
    course: { id, code: id.toUpperCase(), term: 'Fall 2026' },
    items: [],
    schedule: [],
    guide: {},
    planMinutes: '',
    frameLabel: '',
    ...over,
  }) as unknown as CourseModule;

const catalog = (modules: CourseModule[], items: Item[] = []): Catalog =>
  ({
    items,
    modules,
    courses: modules.map((m) => m.course),
    byId: Object.fromEntries(modules.map((m) => [m.course.id, m.course])),
    short: {},
    shortCodes: [],
    empty: modules.length === 0,
    lessons: {},
    figures: {},
    extraFigures: {},
    blocks: {},
  }) as unknown as Catalog;

describe('which courses a trip runs over', () => {
  it('takes the courses with a deadline inside the days', () => {
    const cat = catalog([mod('econ'), mod('psci')], [item('paper', 'econ', 8, 5)]);
    expect(coursesInDays(cat, ['2026-09-05'], NOW)).toEqual(['econ']);
  });

  it('is empty for days nothing falls on, rather than every course enrolled', () => {
    const cat = catalog([mod('econ'), mod('psci')], [item('paper', 'econ', 8, 5)]);
    expect(coursesInDays(cat, ['2026-09-09'], NOW)).toEqual([]);
  });

  it('names a course once however many days of the trip it lands in', () => {
    const cat = catalog(
      [mod('econ')],
      [item('a', 'econ', 8, 5), item('b', 'econ', 8, 6)],
    );
    expect(coursesInDays(cat, ['2026-09-05', '2026-09-06'], NOW)).toEqual(['econ']);
  });
});

describe('what goes in a pack', () => {
  const econ = mod('econ', {
    lessons: {
      1: { unit: 1, title: 'Elasticity', file: '/audio/lessons/econ/unit-1.mp3', seconds: 0, len: '', cues: [] },
      0: { unit: 0, title: 'Scarcity', file: '/audio/lessons/econ/unit-0.mp3', seconds: 0, len: '', cues: [] },
    },
    podcast: {
      blurb: '',
      editions: [
        { id: 'econ-podcast', label: 'Podcast', file: '/audio/econ-podcast.mp3', len: '30:00', seconds: 0, ready: true, blurb: '', chapters: [] },
        { id: 'econ-full', label: 'Full', file: '/audio/econ-full.mp3', len: '90:00', seconds: 0, ready: false, blurb: '', chapters: [] },
      ],
    },
  } as unknown as Partial<CourseModule>);

  it('offers the units in order, then the recordings, then the built files', () => {
    const out = packFor(catalog([econ]), ['econ']);
    expect(out.map((f) => f.path)).toEqual([
      '/audio/lessons/econ/unit-0.mp3',
      '/audio/lessons/econ/unit-1.mp3',
      '/audio/econ-podcast.mp3',
      '/decks/econ.pptx',
      '/handouts/econ.pdf',
    ]);
  });

  /*
   * The control this file exists for. The cheap version of `packFor` builds
   * every path by convention off the course id — and it looks perfect against
   * the four sample courses, because all four have every file. It is only a
   * course somebody imported from their own syllabus that it downloads four
   * 404s for, which is the student this feature is for and the case no run
   * against the sample data can see.
   */
  it('offers nothing built for a course imported from a syllabus', () => {
    expect(packFor(catalog([mod('hist1120')]), ['hist1120'])).toEqual([]);
  });

  it('leaves out a recording the course says is not ready', () => {
    const out = packFor(catalog([econ]), ['econ']);
    expect(out.map((f) => f.path)).not.toContain('/audio/econ-full.mp3');
  });

  it('skips a course that is not in the catalog rather than inventing paths', () => {
    expect(packFor(catalog([econ]), ['nope'])).toEqual([]);
  });
});

describe('fetching a pack', () => {
  const file = (path: string): PackFile => ({ path, label: path, kind: 'lesson', course: 'econ' });

  const ok = (bytes: number) =>
    ({ ok: true, status: 200, blob: async () => ({ size: bytes }) }) as unknown as Response;

  it('reports what landed and how much of the device it took', async () => {
    const fetcher = vi.fn(async () => ok(1024));
    const out = await fetchPack([file('/a.mp3'), file('/b.mp3')], {
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(out.got).toHaveLength(2);
    expect(out.bytes).toBe(2048);
    expect(out.missed).toEqual([]);
  });

  /*
   * The one that matters. A pack that quietly drops a file is worse than one
   * that fails outright: the student finds out on the bus.
   */
  it('names every file that did not land, and still keeps the ones that did', async () => {
    const fetcher = vi.fn(async (url: string) =>
      String(url).includes('b') ? ({ ok: false, status: 404 } as unknown as Response) : ok(10),
    );
    const out = await fetchPack([file('/a.mp3'), file('/b.mp3')], {
      fetcher: fetcher as unknown as typeof fetch,
    });
    expect(out.got.map((f) => f.path)).toEqual(['/a.mp3']);
    expect(out.missed).toHaveLength(1);
    expect(out.missed[0].why).toContain('404');
  });

  it('turns a thrown request into a named miss rather than losing the run', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('Failed to fetch');
    });
    const out = await fetchPack([file('/a.mp3')], { fetcher: fetcher as unknown as typeof fetch });
    expect(out.got).toEqual([]);
    expect(out.missed[0].why).toBe('Failed to fetch');
  });

  it('counts up as it goes, one file at a time', async () => {
    const seen: number[] = [];
    await fetchPack([file('/a.mp3'), file('/b.mp3'), file('/c.mp3')], {
      fetcher: (async () => ok(1)) as unknown as typeof fetch,
      onDone: (n) => seen.push(n),
    });
    expect(seen).toEqual([1, 2, 3]);
  });

  it('stops where it was told to, and says which ones it never reached', async () => {
    const stop = new AbortController();
    const fetcher = vi.fn(async () => {
      stop.abort();
      return ok(1);
    });
    const out = await fetchPack([file('/a.mp3'), file('/b.mp3')], {
      fetcher: fetcher as unknown as typeof fetch,
      signal: stop.signal,
    });
    expect(out.got.map((f) => f.path)).toEqual(['/a.mp3']);
    expect(out.missed[0].why).toBe('Stopped before this one.');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('showBytes', () => {
  it('says a size the way a person does', () => {
    expect(showBytes(512)).toBe('512 B');
    expect(showBytes(2048)).toBe('2 KB');
    expect(showBytes(24 * 1024 * 1024)).toBe('24 MB');
  });
});
