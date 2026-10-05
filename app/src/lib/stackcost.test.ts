import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATUS_LABEL } from './ops/claims';
import { MODULES as CORE_MODULES } from '../site/modules';
import { HORIZON, INSTITUTION_TYPES, exampleRow, stackCalc, stackCsv, type StackInput, type StackRowInput } from './stackcost.mjs';

/**
 * The stack-consolidation calculator, held to hand-worked figures and to the
 * company site's copy of it.
 *
 * The rules that matter: a system is switched off only when its contract has
 * ended AND the replacement is available; Semester's price is the school's own
 * quote, so a row without one saves nothing; a switch-off after the five years
 * shown is not counted. Each is shown a case that would break it.
 */

const root = join(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const row = (over: Partial<StackRowInput> & { id: string }): StackRowInput => ({ name: over.id, annualCost: 0, semesterAnnual: 0, ...over });
const input = (rows: StackRowInput[], escalation = 0): StackInput => ({ escalation, rows });

/** A: 100k a year, contract to the end of year 2, replacement from year 1, Semester 60k, migration 30k. B: 50k, no contract, from year 2, Semester 20k. */
const TWO = input([
  row({ id: 'a', annualCost: 100000, contractEnds: 2, readyYear: 1, semesterAnnual: 60000, migrationOnce: 30000, adminHours: 200 }),
  row({ id: 'b', annualCost: 50000, contractEnds: '', readyYear: 2, semesterAnnual: 20000, adminHours: 100 }),
]);

describe('the five-year comparison', () => {
  it('works out year by year, by hand: B switches in year 2, A in year 3 after its contract', () => {
    const r = stackCalc(TWO);
    expect(r.rows.map((x) => x.switchYear)).toEqual([3, 2]);
    expect(r.years.map((y) => [y.current, y.withSemester, y.saving, y.cumulative, y.hours])).toEqual([
      [150000, 150000, 0, 0, 0],
      [150000, 120000, 30000, 30000, 100],
      [150000, 110000, 40000, 70000, 300],
      [150000, 80000, 70000, 140000, 300],
      [150000, 80000, 70000, 210000, 300],
    ]);
    expect(r.totalCurrent).toBe(750000);
    expect(r.totalWith).toBe(540000);
    expect(r.totalSaving).toBe(210000);
    expect(r.hoursTotal).toBe(1000);
    expect(r.switched).toBe(2);
  });

  it('puts the migration in the year of the switch, and still running systems into "with Semester"', () => {
    const y3 = stackCalc(TWO).years[2];
    expect(y3.migration).toBe(30000);
    expect(y3.remaining).toBe(0);
    expect(y3.semester).toBe(80000);
    expect(stackCalc(TWO).years[3].migration).toBe(0);
  });

  it('finds payback in month 13 when nothing is lost before the first switch, and 18 after a deficit', () => {
    expect(stackCalc(TWO).paybackMonth).toBe(13);
    // 100k a year, replaced at once at 40k with a 90k migration: -30k in year 1, +60k a year after it.
    const deficit = stackCalc(input([row({ id: 'x', annualCost: 100000, contractEnds: 0, readyYear: 1, semesterAnnual: 40000, migrationOnce: 90000 })]));
    expect(deficit.years.map((y) => y.saving)).toEqual([-30000, 60000, 60000, 60000, 60000]);
    expect(deficit.paybackMonth).toBe(18);
  });

  it('says there is no payback when the migration is never earned back', () => {
    const r = stackCalc(input([row({ id: 'x', annualCost: 100000, contractEnds: 0, readyYear: 4, semesterAnnual: 90000, migrationOnce: 400000 })]));
    expect(r.totalSaving).toBeLessThan(0);
    expect(r.paybackMonth).toBeNull();
  });

  it('grows the current systems by the yearly increase, and the increase alone changes nothing about a system that is never switched', () => {
    const r = stackCalc(input([row({ id: 'x', annualCost: 100000 })], 10));
    expect(r.years.map((y) => Math.round(y.current))).toEqual([100000, 110000, 121000, 133100, 146410]);
    expect(r.totalSaving).toBe(0);
  });
});

describe('when a system counts as switched off', () => {
  const one = (over: Partial<StackRowInput>) => stackCalc(input([row({ id: 'x', annualCost: 100000, contractEnds: 0, readyYear: 1, semesterAnnual: 60000, ...over })])).rows[0];

  it('is the later of the end of its contract and the replacement being available', () => {
    expect(one({ contractEnds: 4, readyYear: 1 }).switchYear).toBe(5); // waits for the contract
    expect(one({ contractEnds: 1, readyYear: 3 }).switchYear).toBe(3); // waits for the replacement
    expect(one({ contractEnds: 0, readyYear: 1 }).switchYear).toBe(1);
  });

  it('is never counted when no year is entered for the replacement', () => {
    const r = one({ readyYear: '' });
    expect(r.switchYear).toBeNull();
    expect(r.why).toContain('no year entered');
    expect(stackCalc(input([row({ id: 'x', annualCost: 100000, contractEnds: 0, readyYear: null, semesterAnnual: 60000 })])).totalSaving).toBe(0);
  });

  it('is never counted without a Semester price: the school brings the quote, and the calculator does not supply one', () => {
    const r = stackCalc(input([row({ id: 'x', annualCost: 100000, contractEnds: 0, readyYear: 1, semesterAnnual: 0 })]));
    expect(r.rows[0].switchYear).toBeNull();
    expect(r.rows[0].why).toBe('no Semester price entered');
    expect(r.totalSaving).toBe(0);
    // The control: had it counted the switch with a price of nothing, five years of a 100k system would be "saved".
    expect(100000 * HORIZON).toBe(500000);
  });

  it('is never counted with no current cost, or when it falls after the five years shown', () => {
    expect(one({ annualCost: 0 }).why).toBe('no current cost entered');
    const late = one({ contractEnds: 5, readyYear: 1 });
    expect(late.switchYear).toBeNull();
    expect(late.why).toContain('year 6');
    expect(stackCalc(input([row({ id: 'x', annualCost: 100000, contractEnds: 5, readyYear: 1, semesterAnnual: 60000 })])).totalSaving).toBe(0);
  });

  it('reads money and years the way people type them', () => {
    const r = stackCalc(input([row({ id: 'x', annualCost: '$100,000', contractEnds: '0', readyYear: '1', semesterAnnual: '60,000' })]));
    expect(r.rows[0].annual).toBe(100000);
    expect(r.rows[0].price).toBe(60000);
    expect(r.rows[0].switchYear).toBe(1);
    const junk = stackCalc(input([row({ id: 'x', annualCost: 'lots', contractEnds: -3, readyYear: 'soon', semesterAnnual: -5 })]));
    expect(junk.totalCurrent).toBe(0);
    expect(junk.switched).toBe(0);
  });

  it('shows nothing at all for an empty form', () => {
    const r = stackCalc(input(CORE_MODULES.map((m) => row({ id: m.id, name: m.name }))));
    expect(r.totalCurrent).toBe(0);
    expect(r.totalSaving).toBe(0);
    expect(r.paybackMonth).toBeNull();
    expect(r.switched).toBe(0);
  });
});

describe('the example', () => {
  it('is the same shape for every row, scaled by institution type, and complete enough to show a result', () => {
    expect(INSTITUTION_TYPES.map((t) => t.id)).toEqual(['community', 'public4', 'private4', 'k12']);
    const r = stackCalc(input(CORE_MODULES.slice(0, 3).map((m) => row({ id: m.id, name: m.name, ...exampleRow(1) }))));
    expect(r.switched).toBe(3);
    expect(exampleRow(0.5).annualCost).toBe(50000);
  });
});

describe('the download', () => {
  it('carries the inputs, the years and the caveat, and escapes what would break a row', () => {
    const r = stackCalc(TWO);
    const csv = stackCsv({ ...TWO, rows: [{ ...TWO.rows[0], name: 'Canvas, "the LMS"' }, TWO.rows[1]] }, stackCalc({ ...TWO, rows: [{ ...TWO.rows[0], name: 'Canvas, "the LMS"' }, TWO.rows[1]] }), { a: 'Planned' });
    expect(csv).toContain('planning estimate');
    expect(csv).toContain('Semester has no published institutional price');
    expect(csv).toContain('"Canvas, ""the LMS"""');
    expect(csv).toContain('Planned');
    expect(csv).toContain('Payback month,13');
    expect(csv.split('\n').filter((l) => l.startsWith('1,') || l.startsWith('5,')).length).toBe(2);
    expect(r.totalSaving).toBe(210000);
  });
});

// ── the company site's copy ─────────────────────────────────────────────────

const SITE = 'company-site/site.js';
const region = () => {
  const s = read('app/src/lib/stackcost.mjs');
  return s.slice(s.indexOf('// >>> embed') + '// >>> embed'.length, s.indexOf('// <<< embed')).trim();
};
const CALC_START = '/*stack-calc:start*/';
const CALC_END = '/*stack-calc:end*/';
const MOD_START = '/*stack-modules:start*/';
const MOD_END = '/*stack-modules:end*/';
const calcBlock = () => `${CALC_START}\n${region()}\n${CALC_END}`;
const modules = () =>
  CORE_MODULES.map((m) => ({ id: m.id, name: m.name, replaces: m.replaces, status: STATUS_LABEL[m.status] }));
const modBlock = () => `${MOD_START}const STACK_MODULES=${JSON.stringify(modules())};${MOD_END}`;
const cut = (html: string, a: string, b: string) => html.slice(html.indexOf(a), html.indexOf(b) + b.length);

describe('the company site’s copy', () => {
  it('can tell a stale copy from a current one', () => {
    expect(calcBlock().replace('HORIZON = 5', 'HORIZON = 6')).not.toBe(cut(read(SITE), CALC_START, CALC_END));
    expect(modBlock().replace('Planned', 'Available now')).not.toBe(cut(read(SITE), MOD_START, MOD_END));
  });

  it('carries the calculator and the module list exactly as they are here', () => {
    let html = read(SITE);
    if (process.env.REGISTERS === 'write') {
      for (const [a, b, want] of [[CALC_START, CALC_END, calcBlock()], [MOD_START, MOD_END, modBlock()]] as const) {
        if (html.includes(a) && cut(html, a, b) !== want) html = html.replace(cut(html, a, b), () => want);
      }
      writeFileSync(join(root, SITE), html);
    }
    expect(cut(html, CALC_START, CALC_END)).toBe(calcBlock());
    expect(cut(html, MOD_START, MOD_END)).toBe(modBlock());
  });

  it('runs, and gives the answers the module gives', () => {
    const body = cut(read(SITE), CALC_START, CALC_END);
    const embedded = new Function(`${body}\nreturn { stackCalc, stackCsv, HORIZON };`)() as { stackCalc: typeof stackCalc; stackCsv: typeof stackCsv; HORIZON: number };
    expect(embedded.HORIZON).toBe(HORIZON);
    expect(embedded.stackCalc(TWO)).toEqual(stackCalc(TWO));
    expect(embedded.stackCsv(TWO, embedded.stackCalc(TWO), { a: 'Planned' })).toBe(stackCsv(TWO, stackCalc(TWO), { a: 'Planned' }));
  });
});
