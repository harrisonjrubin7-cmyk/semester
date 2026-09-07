import { describe, expect, it } from 'vitest';
import { PROVIDERS, providerFor } from './providers';
import { ROOM, render } from './shape';
import { buildCatalog } from '../data/catalog';
import { DEFAULT_PERSISTED, type State } from '../state/shape';
import { DESTINATIONS } from '../lib/nav';
import BUS from '../data/courses/bus';
import ECON from '../data/courses/econ';
import type { Look } from './shape';

/**
 * What a screen tells the assistant about what is on it.
 *
 * The properties worth pinning are not the wording. They are: it describes
 * what is *visible* rather than everything; it stays inside its budget; it is
 * pure, so the same state twice gives the same context; and it can only name
 * screens the registry has.
 */

const catalog = buildCatalog([ECON, BUS]);
const NOW = new Date(2026, 8, 15);

const look = (over: Partial<State> = {}): Look => ({
  state: {
    ...DEFAULT_PERSISTED,
    courses: [ECON, BUS],
    term: '2026FA',
    grades: { 'econ:0': '91', 'bus:0': '88', 'bus:1': '74' },
    ...over,
  } as State,
  catalog,
  now: NOW,
});

describe('the map itself', () => {
  it('only ever keys screens the registry has', () => {
    // The same rule the generated guide is held to. A provider for a screen
    // that does not exist would put the assistant on a page nobody can reach.
    const real = new Set(DESTINATIONS.map((d) => d.screen));
    for (const screen of Object.keys(PROVIDERS)) {
      expect(real.has(screen as never), screen).toBe(true);
    }
  });

  it('says plainly that a screen has no provider, rather than inventing one', () => {
    expect(providerFor('grades')).not.toBeNull();
    expect(providerFor('privacy')).toBeNull();
  });
});

describe('grades', () => {
  const ctx = () => providerFor('grades')!(look())!;

  it('carries every component, its weight and whether it is back', () => {
    /*
     * The worked example from the brief: "what do I need on the BUS final"
     * has to answer without the course being named, which is only possible if
     * the weights and the outstanding rows travel.
     */
    const text = render('grades', 'Grades', ctx()).text;
    expect(text).toContain('BUS 1600');
    expect(text).toContain('Final exam');
    expect(text).toContain('not back');
    expect(text).toContain('still to play for');
  });

  it('rounds a weight rather than printing the arithmetic', () => {
    // A syllabus stating "ten points each" normalises to 34.78260869565217%,
    // which reads as a precision the syllabus never had.
    const text = render('grades', 'Grades', ctx()).text;
    expect(text).not.toMatch(/\d\.\d{4}/);
  });

  it('is not filtered by Today’s chip, which is not this screen’s', () => {
    /*
     * `state.filter` is the feed chip — its values are `All`, `Due`,
     * `Classes` and short codes, not course ids. Filtering Grades by it meant
     * that on a fresh account, whose filter is the string `All`, this matched
     * no course and returned nothing at all: the sheet said Grades had
     * nothing to say with four courses of grades on the screen behind it.
     */
    const all = providerFor('grades')!(look({ filter: 'All' }));
    expect(all?.visible).toHaveLength(2);
    expect(providerFor('grades')!(look({ filter: 'ECON' }))?.visible).toHaveLength(2);
  });

  it('suggests a question that could only be asked here', () => {
    expect(ctx().suggestions.join(' ')).toMatch(/final/i);
  });
});

describe('the calendar', () => {
  it('describes the window that is open, not the whole term', () => {
    // "What is my heaviest day this week" is a different question on a month
    // view and a day view, and the screen knows which is open.
    const week = providerFor('calendar')!(look({ calView: 'week' }))!;
    const term = providerFor('calendar')!(look({ calView: 'semester' }))!;
    expect(week.summary).toContain('7 days');
    expect(term.visible.length).toBeGreaterThanOrEqual(week.visible.length);
  });

  it('respects the chip, in the app’s own vocabulary', () => {
    // `ECON`, not `econ` — the chips are the first word of each course code.
    const one = providerFor('calendar')!(look({ filter: 'ECON', calView: 'semester' }))!;
    const both = providerFor('calendar')!(look({ filter: 'All', calView: 'semester' }))!;
    expect(one.visible.length).toBeLessThan(both.visible.length);
    expect(one.summary).toContain('filtered to ECON 1020');
  });
});

describe('what every provider has to hold', () => {
  const each = Object.entries(PROVIDERS);

  it('is pure, so the same state twice gives the same context', () => {
    for (const [screen, provide] of each) {
      const once = JSON.stringify(provide(look()));
      const twice = JSON.stringify(provide(look()));
      expect(once, screen).toBe(twice);
    }
  });

  it('stays inside the budget, and says so when it had to cut', () => {
    for (const [screen, provide] of each) {
      const ctx = provide(look());
      if (!ctx) continue;
      const out = render(screen as never, screen, ctx);
      expect(out.text.length, screen).toBeLessThanOrEqual(ROOM + 200);
      if (out.dropped > 0) expect(out.text).toContain('do not count from this list');
    }
  });

  it('offers something to ask, or nothing at all — never a placeholder', () => {
    for (const [screen, provide] of each) {
      const ctx = provide(look());
      if (!ctx) continue;
      expect(ctx.summary.length, screen).toBeGreaterThan(10);
      for (const s of ctx.suggestions) expect(s.trim().length, screen).toBeGreaterThan(8);
    }
  });

  it('says nothing rather than something empty on a fresh account', () => {
    const fresh: Look = { state: DEFAULT_PERSISTED as State, catalog: buildCatalog([]), now: NOW };
    for (const [screen, provide] of each) {
      const ctx = provide(fresh);
      // A provider may still describe an empty screen — `worked` does, and
      // that is a real thing to say. What it may not do is claim rows.
      if (ctx) expect(ctx.visible.length, screen).toBe(0);
    }
  });
});

describe('what a rendered context looks like', () => {
  it('names the screen, then the summary, then the rows', () => {
    const out = render('grades', 'Grades', providerFor('grades')!(look())!);
    const lines = out.text.split('\n');
    expect(lines[0]).toBe('On screen: Grades (grades).');
    expect(lines[1]).toContain('Grades for 2 courses');
  });

  it('warns in the payload itself when a list was cut', () => {
    // An answer that counts the rows it was given has to know they were not
    // all of them.
    const many = { summary: 'A long list.', visible: Array.from({ length: 4000 }, (_, i) => `row ${i} ${'x'.repeat(40)}`), actions: [], suggestions: [] };
    const out = render('mine', 'Personal', many);
    expect(out.dropped).toBeGreaterThan(0);
    expect(out.text).toContain('do not count from this list');
    expect(out.text.length).toBeLessThanOrEqual(ROOM + 200);
  });
});
