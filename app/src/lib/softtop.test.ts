import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';
import { softTop, type TopInput } from './softtop';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from '../state/shape';
import { buildCatalog } from '../data/catalog';
import type { Capabilities } from './school';

/**
 * The soft shell's top and bottom, for all fifty-five.
 *
 * The point of a registry is that it cannot quietly fall behind the thing it
 * describes, so these walk `DESTINATIONS` rather than a list written here — a
 * screen added to the app fails this file until somebody says what its
 * dominant fact is, which is the only way "unadorned" stays a decision.
 *
 * Two states are walked, not one. An empty account is where a hero invents a
 * number it does not have, and a full one is where a sentence written for the
 * empty case stops being true.
 */

const NOW = new Date(2026, 8, 7, 11, 30);

/** The floor a school with nothing declared gets. See `lib/school.ts`. */
const CAPS: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };

function input(over: Partial<State> = {}, courses: State['courses'] = []): TopInput {
  const state = { ...DEFAULT_PERSISTED, ...initialEphemeral(NOW), courses, ...over } as State;
  return {
    state,
    catalog: buildCatalog(state.courses),
    now: NOW,
    caps: CAPS,
  };
}

const SCREENS = DESTINATIONS.map((d) => d.screen);

/**
 * The screens the registry answers with nothing above them.
 *
 * A tool you type into and a page of prose have no dominant fact, so a hero
 * would have to invent one. That is a real answer rather than a hole, and it
 * is spelled out here so it stays a decision: a screen on this list must come
 * back empty, and every screen off it must carry a hero or a stat row.
 *
 * There is no bar on any of the fifty-five now — `lib/softtop.ts` has why —
 * so "covered" can no longer mean "has at least a bar", which is what it
 * quietly meant for the seven prose screens before.
 */
const UNADORNED = new Set<(typeof SCREENS)[number]>([
  'essay',
  'proof',
  'draw',
  'deck',
  'mail',
  'help',
  'privacy',
]);

describe('every screen in the registry', () => {
  it('is covered — none falls through to the unadorned default', () => {
    for (const screen of SCREENS) {
      if (UNADORNED.has(screen)) continue;
      const top = softTop(screen, input());
      expect(
        top.hero !== null || top.stats.length > 0,
        `${screen} has no soft top at all`,
      ).toBe(true);
    }
  });

  it('draws nothing above the screens that have no fact to show', () => {
    // The other half of the rule above, so an empty answer stays a decision
    // rather than a screen that quietly stopped having one.
    for (const screen of UNADORNED) {
      const top = softTop(screen, input());
      expect(top.hero, `${screen} grew a hero`).toBeNull();
      expect(top.stats, `${screen} grew a stat row`).toHaveLength(0);
    }
  });
});

describe('never an empty hero', () => {
  it('carries a figure or a sentence, on an empty account', () => {
    for (const screen of SCREENS) {
      const hero = softTop(screen, input()).hero;
      if (!hero) continue;
      const has = (hero.figure ?? '').trim() !== '' || (hero.said ?? '').trim() !== '';
      expect(has, `${screen} renders a hero with nothing in it`).toBe(true);
      expect(hero.figure ?? '', `${screen} shows a dash as its figure`).not.toBe('—');
      expect(hero.label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('never the blurb', () => {
  it('does not repeat in the biggest type what the description line just said', () => {
    for (const d of DESTINATIONS) {
      const hero = softTop(d.screen, input()).hero;
      if (!hero) continue;
      expect(hero.said ?? '', `${d.screen} heroes its own blurb`).not.toBe(d.blurb);
      expect(hero.foot ?? '', `${d.screen} foots its own blurb`).not.toBe(d.blurb);
    }
  });
});

describe('the stat row', () => {
  it('is two or three across, never one and never four', () => {
    // `StatRow` takes 2 or 3 columns. A single stat is a fact with no
    // comparison beside it, which is what the hero is already for.
    for (const screen of SCREENS) {
      const n = softTop(screen, input()).stats.length;
      expect(n === 0 || n === 2 || n === 3, `${screen} has ${n} stats`).toBe(true);
    }
  });

  it('keeps every fraction inside 0 and 1', () => {
    for (const screen of SCREENS) {
      for (const s of softTop(screen, input()).stats) {
        if (s.fraction === undefined) continue;
        expect(s.fraction, `${screen} · ${s.label}`).toBeGreaterThanOrEqual(0);
        expect(s.fraction, `${screen} · ${s.label}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('names every stat once, so the row has no two identical labels', () => {
    for (const screen of SCREENS) {
      const labels = softTop(screen, input()).stats.map((s) => s.label);
      expect(new Set(labels).size, `${screen} repeats a stat label`).toBe(labels.length);
    }
  });
});

describe('an account with something in it', () => {
  const full = () =>
    input({
      registrar: [
        { id: 'r1', label: 'Add/drop closes', iso: '2026-09-12', until: '', cost: '', kind: 'deadline' },
      ] as State['registrar'],
      grades: { a: '88' },
      visited: { home: true, study: true },
    });

  it('still obeys every rule', () => {
    for (const screen of SCREENS) {
      const top = softTop(screen, full());
      if (top.hero) {
        expect((top.hero.figure ?? '').trim() !== '' || (top.hero.said ?? '').trim() !== '').toBe(true);
      }
      expect(top.stats.length === 0 || top.stats.length === 2 || top.stats.length === 3).toBe(true);
    }
  });

  it('takes its numbers from the app’s own derivations, not a second copy', () => {
    // Progress counts the term's deadlines out of the catalogue rather than
    // carrying a number of its own — the same rule the Everything screen's
    // figure followed before that screen merged into this one's tabs.
    expect(softTop('me', input()).hero?.figure).toBe('0');
  });

  it('counts a finished deadline once, not once per list it appears in', () => {
    // The term report summed today's done items and then the whole term's, so
    // a thing ticked off this morning was counted twice.
    expect(softTop('brief', input({ report: 'term' })).hero?.figure).toBe('0');
  });

  it('reads the report’s grain, so the hero is about what is on screen', () => {
    // Three screens merged into one with a grain switch. A hero that ignored
    // the grain would put today's count above the term's report.
    const hero = (report: State['report']) => softTop('brief', input({ report })).hero?.label;
    expect(hero('day')).toBe('Your day');
    expect(hero('week')).toBe('This week');
    expect(hero('term')).toBe('What worked');
  });

  it('does not answer two different questions with the same hero', () => {
    // Connect accounts showed the feed count and What worked showed the
    // Weekly report's; a hero repeated across two screens is a hero that is
    // not about either of them.
    const said = (s: (typeof SCREENS)[number]) => {
      const h = softTop(s, input()).hero;
      return h ? [h.label, h.meta, h.figure, h.said, h.foot].join('|') : null;
    };
    expect(said('connect')).not.toBe(said('brief'));
  });

  it('tells Settings about its storage and its account, not about the term', () => {
    // It used to report courses, alerts and screens-used: three true numbers
    // about the semester, on the one screen that is not about the semester.
    const stats = softTop('settings', input()).stats.map((s) => s.label);
    expect(stats).toContain('On this device');
    expect(stats).toContain('Account');
    expect(stats).not.toContain('Courses');
  });

  /**
   * The one screen whose whole point is that it is not the syllabus.
   *
   * Settings' fix, one screen along. `Mine.tsx` opens by saying why Personal
   * is its own tab — a syllabus deadline is trustworthy because it came out
   * of a PDF with a citation attached, and a task you typed is a different
   * kind of thing — and the strip above it reported the term's three numbers
   * regardless. On a fresh account that read "Personal · 0 · No items yet"
   * beside "Overdue 6": six coursework deadlines, under a heading saying
   * Personal, on a screen holding nothing of your own.
   */
  it('counts your own things on Personal, not the term\u2019s', () => {
    const withBoth = () =>
      input({
        // Two of the student's own: one late, one for today and already done.
        tasks: [
          { id: 't1', title: 'Call the bank', date: '2026-09-01', time: '', note: '', done: false, created: 0, courseId: null },
          { id: 't2', title: 'Wash the kit', date: '2026-09-07', time: '', note: '', done: true, created: 0, courseId: null },
        ] as State['tasks'],
        appointments: [
          { id: 'a1', title: 'Dentist', date: '2026-09-07', at: 600, time: '10:00a', note: '', where: '', created: 0 },
        ],
      });

    const stats = softTop('mine', withBoth()).stats;
    const of = (label: string) => stats.find((s) => s.label === label)!;

    // The appointment today; the task today is ticked off, so it is not due.
    expect(of('Due today').value).toBe('1');
    // One task today and it is ticked, so the meter is full — the dentist is
    // still on the day and is not in the denominator, because an appointment
    // is not a thing you tick and a meter that could never fill is worse than
    // no meter.
    expect(of('Due today').fraction).toBe(1);
    // The task dated last week, still undone. The appointment in the past
    // would be here too if an appointment could be late, and it cannot.
    expect(of('Overdue').value).toBe('1');
    expect(of('This week').value).toBe('0');
  });

  it('reports nothing of its own on an empty Personal, whatever the term is doing', () => {
    // The failure this exists for: the term's numbers standing in for yours.
    // `full()` has a registrar deadline and a grade in it; none of that is
    // Personal's, so every one of these is a zero.
    expect(softTop('mine', full()).stats.map((s) => s.value)).toEqual(['0', '0', '0']);
  });

  it('says the size in a unit a person reads, and never an empty account', () => {
    const size = softTop('settings', input()).stats.find((s) => s.label === 'On this device')!;
    expect(size.value).toMatch(/^\d+(\.\d)? (KB|MB)$/);
  });

  it('shows the sync word it was given, and a dash when there is none', () => {
    const said = (over?: string) =>
      softTop('settings', { ...input(), sync: over }).stats.find((s) => s.label === 'Account')!.value;
    expect(said('Synced')).toBe('Synced');
    expect(said()).toBe('—');
  });

  it('counts what the screen holds rather than what it shows', () => {
    // Term deadlines holds a list of its own, so its figure is that list's
    // length — not the count of syllabus deadlines, which belongs to the term.
    expect(softTop('registrar', full()).hero?.figure).toBe('1');
    expect(softTop('registrar', input()).hero?.figure).toBe('0');
  });
});

describe('the Activities tile counts what the Activities screen counts', () => {
  /*
   * A commitment carries a Pause switch, and the screen's own header counts
   * `mine.filter((c) => c.active)`. The tile counted the lot, so pausing one
   * left the tile saying "3 commitments" above a screen saying "2" — and a
   * tile that disagrees with the screen behind it is worse than no tile.
   */
  const commitment = (id: string, active: boolean) =>
    ({
      id,
      name: `Thing ${id}`,
      kind: 'club',
      role: '',
      where: '',
      url: '',
      note: '',
      days: [1],
      at: 600,
      minutes: 60,
      hours: 2,
      active,
    }) as unknown as State['commitments'][number];

  const figure = (over: Partial<State>) => softTop('activities', input(over)).hero?.figure;

  it('leaves out the paused ones', () => {
    expect(figure({ commitments: [commitment('a', true), commitment('b', false)] })).toBe('1');
  });

  it('counts the running ones', () => {
    expect(figure({ commitments: [commitment('a', true), commitment('b', true)] })).toBe('2');
  });

  it('says none where every one of them is paused', () => {
    expect(figure({ commitments: [commitment('a', false)] })).toBe('0');
  });
});
