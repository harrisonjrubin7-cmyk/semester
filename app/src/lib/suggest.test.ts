import { describe, expect, it } from 'vitest';
import {
  NOTHING_WANTED,
  NO_DATES,
  SOON_MONTHS,
  emptyLine,
  intoApplication,
  monthsUntil,
  nearness,
  suggest,
  whenLine,
} from './suggest';
import { FIELDS, PROGRAMMES, YEARS, type Programme } from '../data/fellowships';

const september = new Date(2026, 8, 5);

const one = (over: Partial<Programme> = {}): Programme => ({
  id: 'x',
  org: 'Somebody',
  role: 'A thing',
  kind: 'fellowship',
  what: 'A line about it.',
  months: [8],
  years: ['third'],
  fields: ['economics'],
  url: 'https://example.org',
  ...over,
});

describe('the list itself', () => {
  it('holds no deadline anywhere in it', () => {
    // The one assertion this feature refuses to make. A confident wrong date
    // is what costs somebody a fellowship.
    const raw = JSON.stringify(PROGRAMMES);
    expect(raw).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    for (const p of PROGRAMMES) {
      expect(Object.keys(p), p.id).not.toContain('due');
      expect(Object.keys(p), p.id).not.toContain('deadline');
    }
  });

  it('sends everybody to an official page over https', () => {
    for (const p of PROGRAMMES) {
      expect(p.url, p.id).toMatch(/^https:\/\//);
    }
  });

  it('tags every entry with fields that exist and years that exist', () => {
    const fields = new Set(FIELDS);
    const years = new Set(YEARS.map((y) => y.id));
    for (const p of PROGRAMMES) {
      expect(p.fields.length, p.id).toBeGreaterThan(0);
      for (const f of p.fields) expect(fields.has(f), `${p.id}: ${f}`).toBe(true);
      expect(p.years.length, p.id).toBeGreaterThan(0);
      for (const y of p.years) expect(years.has(y), `${p.id}: ${y}`).toBe(true);
    }
  });

  it('gives every entry a real month, zero-indexed', () => {
    for (const p of PROGRAMMES) {
      expect(p.months.length, p.id).toBeGreaterThan(0);
      for (const m of p.months) expect(m >= 0 && m <= 11, `${p.id}: ${m}`).toBe(true);
    }
  });

  it('has no two entries with the same id', () => {
    expect(new Set(PROGRAMMES.map((p) => p.id)).size).toBe(PROGRAMMES.length);
  });
});

describe('what gets shown, and when', () => {
  it('counts the months round the year', () => {
    expect(monthsUntil(8, september)).toBe(0);
    expect(monthsUntil(9, september)).toBe(1);
    // January from September is four months, not minus eight.
    expect(monthsUntil(0, september)).toBe(4);
  });

  it('takes the nearest of a programme’s months', () => {
    expect(nearness(one({ months: [0, 9] }), september)).toBe(1);
  });

  it('drops anything more than a season away', () => {
    // A list somebody scrolls past eleven irrelevant things to reach is a list
    // they stop opening.
    const far = one({ months: [(september.getMonth() + SOON_MONTHS + 2) % 12] });
    expect(suggest(NOTHING_WANTED, september, [far])).toEqual([]);
  });

  it('puts the nearest window first', () => {
    const now = one({ id: 'now', months: [8] });
    const soon = one({ id: 'soon', months: [10] });
    expect(suggest(NOTHING_WANTED, september, [soon, now]).map((p) => p.id)).toEqual(['now', 'soon']);
  });

  it('filters to the year somebody is in', () => {
    const third = one({ id: 'third', years: ['third'] });
    const final = one({ id: 'final', years: ['fourth'] });
    const got = suggest({ ...NOTHING_WANTED, year: 'third' }, september, [third, final]);
    expect(got.map((p) => p.id)).toEqual(['third']);
  });

  it('shows everything when they have not said their year', () => {
    const two = [one({ id: 'a', years: ['first'] }), one({ id: 'b', years: ['graduate'] })];
    expect(suggest(NOTHING_WANTED, september, two)).toHaveLength(2);
  });

  it('filters to the fields they picked, matching any of them', () => {
    const econ = one({ id: 'econ', fields: ['economics'] });
    const lang = one({ id: 'lang', fields: ['languages'] });
    const got = suggest({ ...NOTHING_WANTED, fields: ['languages'] }, september, [econ, lang]);
    expect(got.map((p) => p.id)).toEqual(['lang']);
  });

  it('keeps a dismissed one dismissed', () => {
    const got = suggest({ ...NOTHING_WANTED, dismissed: ['x'] }, september, [one()]);
    expect(got).toEqual([]);
  });

  it('finds something real in the autumn, which is when most of these open', () => {
    expect(suggest(NOTHING_WANTED, september).length).toBeGreaterThan(5);
  });
});

describe('what it says about the months', () => {
  it('calls them a guess, on the row, every time', () => {
    // Not once at the top of the screen where it scrolls away — next to the
    // months, because the months are the thing somebody would take for fact.
    const said = whenLine(one({ months: [8, 9] }), september);
    expect(said).toContain('rough guide');
    expect(said).toContain('has not checked');
    expect(said).toContain('September');
  });

  it('leads with what it will not do', () => {
    expect(NO_DATES).toContain('no deadlines');
    expect(NO_DATES).toContain('campus');
    expect(NO_DATES).toMatch(/official page/);
  });

  it('says something useful when the filters empty it', () => {
    expect(emptyLine({ ...NOTHING_WANTED, fields: ['economics'] })).toContain('Widen the fields');
    expect(emptyLine({ ...NOTHING_WANTED, year: 'first' })).toContain('your year');
    expect(emptyLine(NOTHING_WANTED)).toContain('autumn');
  });
});

describe('tracking one', () => {
  it('creates an application with no date at all', () => {
    // The whole point. An app that filled in a guessed deadline would be
    // putting a wrong date in somebody's calendar.
    const a = intoApplication(one(), 1000);
    expect(a.due).toBe('');
    expect(a.rolling).toBe(false);
  });

  it('makes finding the real deadline the next thing to do', () => {
    const a = intoApplication(one(), 1000);
    expect(a.next).toMatch(/deadline/i);
    expect(a.next).toMatch(/campus/i);
  });

  it('carries the org, the role and the official page across', () => {
    const a = intoApplication(one({ org: 'The Trust', role: 'A Scholarship' }), 1000);
    expect(a.org).toBe('The Trust');
    expect(a.role).toBe('A Scholarship');
    expect(a.url).toBe('https://example.org');
  });

  it('starts where every application starts', () => {
    expect(intoApplication(one(), 1000).stage).toBe('found');
  });
});
