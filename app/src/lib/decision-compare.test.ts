import { describe, expect, it } from 'vitest';
import type { Clash, Fit, Impact, Requisites } from './course-detail';
import { DECISION_KINDS, DEFAULT_OFFICIAL, NOT_KNOWN, ROWS, cellText, compareOptions, type OptionFacts } from './decision-compare';

const NOW = new Date('2026-10-01T12:00:00Z');

const fit: Fit = {
  requirement: { id: 'r', programme: 'Economics major', name: 'Core theory', need: 'courses', count: 3, accepts: ['ECON 201'], taken: [] } as unknown as Fit['requirement'],
  left: 2,
  unit: 'courses',
  elective: false,
};
const clash: Clash = { with: 'Choir', day: 1, from: 600, to: 660, source: 'student_entered' };
const impact: Impact = { inCart: false, sameCourse: null, before: 12, after: 15, target: 15, says: 'Your cart goes from 12 to 15 credits. That matches your target of 15.' };
const reqs: Requisites = { text: 'ECON 101', items: [{ code: 'ECON 101', kind: 'prerequisite', state: 'recorded', says: 'You recorded ECON 101 (Fall 2025).' }], unread: false };

const full: OptionFacts = {
  id: 'a',
  label: 'ECON 201',
  requirementFit: [fit],
  clashes: [clash],
  creditLoad: impact,
  prerequisites: reqs,
  cost: { money: '$0 beyond tuition', hoursPerWeek: 9 },
  source: { label: 'imported', asOf: '2026-09-20T00:00:00Z' },
  uncertainty: ['Section may close'],
  questions: ['Is the lab required?'],
  official: { who: 'Registrar', action: 'confirm the add deadline' },
};
const bare: OptionFacts = { id: 'b', label: 'Spanish minor' };

const keysOf = (v: unknown, out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); keysOf(x, out); }
  return out;
};

describe('the table', () => {
  const t = compareOptions('course', [full, bare], NOW);

  it('has the nine rows in order and one cell per option in each', () => {
    expect(t.rows.map((r) => r.id)).toEqual(ROWS.map((r) => r.id));
    expect(t.rows.map((r) => r.id)).toEqual(['requirementFit', 'scheduleImpact', 'creditLoadImpact', 'prerequisiteState', 'costTime', 'sourceAndFreshness', 'knownUncertainty', 'questionsToAsk', 'officialNextStep']);
    for (const r of t.rows) expect(r.cells).toHaveLength(2);
  });

  it('has no winner, score, rank, recommendation or verdict anywhere in it', () => {
    const banned = /winner|best|score|rank|verdict|recommend|suggest|preferred|better|top\b/i;
    const keys = keysOf(t);
    expect(keys.filter((k) => banned.test(k))).toEqual([]);
    expect('verdict' in t).toBe(false);
    expect('winner' in t).toBe(false);
  });

  it('keeps the options in the order given and does not sort them by what is known', () => {
    expect(compareOptions('course', [bare, full], NOW).options.map((o) => o.id)).toEqual(['b', 'a']);
    expect(t.options.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('is the same for the same facts', () => {
    expect(compareOptions('course', [full, bare], NOW)).toEqual(t);
  });

  it('lays out what was supplied, using the facts as given', () => {
    const cell = (id: string, i: number) => t.rows.find((r) => r.id === id)!.cells[i]!;
    expect(cellText(cell('requirementFit', 0))).toContain('Economics major: Core theory');
    expect(cellText(cell('scheduleImpact', 0))).toContain('Mon');
    expect(cellText(cell('scheduleImpact', 0))).toContain('Choir');
    expect(cellText(cell('creditLoadImpact', 0))).toBe(impact.says);
    expect(cellText(cell('prerequisiteState', 0))).toContain('You recorded ECON 101');
    expect(cellText(cell('costTime', 0))).toContain('about 9 hours a week');
    expect(cellText(cell('sourceAndFreshness', 0))).toMatch(/Imported, as of .*2026/);
    expect(cellText(cell('knownUncertainty', 0))).toBe('Section may close');
    expect(cellText(cell('questionsToAsk', 0))).toBe('Is the lab required?');
    expect(cellText(cell('officialNextStep', 0))).toBe('Registrar: confirm the add deadline');
  });
});

describe('unknown cells', () => {
  const t = compareOptions('minor', [bare], NOW);
  const cell = (id: string) => t.rows.find((r) => r.id === id)!.cells[0]!;

  it('say Not known rather than being blank, for every fact nobody supplied', () => {
    for (const id of ['requirementFit', 'scheduleImpact', 'creditLoadImpact', 'prerequisiteState', 'costTime', 'sourceAndFreshness', 'knownUncertainty']) {
      expect(cell(id)).toEqual({ known: false, lines: [NOT_KNOWN] });
    }
    for (const r of t.rows) for (const c of r.cells) expect(cellText(c).trim()).not.toBe('');
  });

  it('says Not known for the missing half of cost and time', () => {
    const only = compareOptions('tutoring', [{ id: 'x', label: 'x', cost: { hoursPerWeek: 2 } }], NOW);
    expect(cellText(only.rows.find((r) => r.id === 'costTime')!.cells[0]!)).toBe(`Money: ${NOT_KNOWN} Time: about 2 hours a week`);
  });

  it('treats an empty list of clashes as a fact, not as unknown', () => {
    const c = compareOptions('course', [{ id: 'x', label: 'x', clashes: [], requirementFit: [] }], NOW);
    expect(c.rows.find((r) => r.id === 'scheduleImpact')!.cells[0]!.known).toBe(true);
    expect(c.rows.find((r) => r.id === 'requirementFit')!.cells[0]!.known).toBe(true);
  });

  it('says the source is stale when it is, and undated when it has no date', () => {
    const old = compareOptions('course', [{ id: 'x', label: 'x', source: { label: 'imported', asOf: '2026-01-01T00:00:00Z' } }, { id: 'y', label: 'y', source: { label: 'estimated', asOf: null } }], NOW);
    const row = old.rows.find((r) => r.id === 'sourceAndFreshness')!;
    expect(cellText(row.cells[0]!)).toContain('more than 60 days old');
    expect(cellText(row.cells[1]!)).toBe('Estimated, date not known.');
  });
});

describe('the official next step', () => {
  it('is populated for every kind, with or without a named office', () => {
    for (const kind of DECISION_KINDS) {
      const t = compareOptions(kind, [bare, full], NOW);
      const row = t.rows.find((r) => r.id === 'officialNextStep')!;
      for (const c of row.cells) expect(c.lines.join('').trim().length).toBeGreaterThan(10);
      expect(row.cells[0]!.lines[0]).toBe(DEFAULT_OFFICIAL[kind]);
      expect(row.cells[0]!.known).toBe(false);
      expect(row.cells[0]!.lines[1]).toMatch(/no contact recorded/);
    }
  });

  it('falls back when the named office is half-filled', () => {
    const t = compareOptions('drop', [{ id: 'x', label: 'x', official: { who: 'Registrar', action: ' ' } }], NOW);
    expect(t.rows.at(-1)!.cells[0]!.lines[0]).toBe(DEFAULT_OFFICIAL.drop);
  });

  it('is the last row and the note says the comparison does not decide', () => {
    expect(compareOptions('course', [], NOW).rows.at(-1)!.id).toBe('officialNextStep');
    expect(compareOptions('course', [full], NOW).note).toMatch(/does not say which option is better/);
  });
});
