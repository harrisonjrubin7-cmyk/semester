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
    // Everything's figure is the registry's length. Typing 55 here would be a
    // number that goes stale the next time a screen is added.
    expect(softTop('everything', input()).hero?.figure).toBe(String(DESTINATIONS.length));
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
