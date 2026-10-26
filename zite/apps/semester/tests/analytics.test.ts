import { test, eq } from './harness';
import { suppress, toCsv, METRICS } from '../src/lib/analytics';

test('cells at or above the threshold are shown (control)', () => {
  const r = suppress([{ label: 'A', value: 40 }, { label: 'B', value: 12 }]);
  eq(r.suppressedCount, 0); eq(r.totalDisplay, '52');
});
test('a small cell is hidden and a second cell too, so subtraction cannot recover it', () => {
  const r = suppress([{ label: 'A', value: 40 }, { label: 'B', value: 25 }, { label: 'C', value: 3 }]);
  eq(r.cells.find((c) => c.label === 'C')!.display, '<10');
  eq(r.cells.find((c) => c.label === 'B')!.suppressed, true);
  eq(r.cells.find((c) => c.label === 'A')!.value, 40);
  const shownSum = r.cells.filter((c) => !c.suppressed).reduce((s, c) => s + (c.value ?? 0), 0);
  eq((r.total ?? 0) - shownSum >= 10 || r.cells.filter((c) => c.suppressed).length >= 2, true);
});
test('two small cells need no extra suppression', () => {
  const r = suppress([{ label: 'A', value: 40 }, { label: 'B', value: 4 }, { label: 'C', value: 2 }]);
  eq(r.suppressedCount, 2); eq(r.cells.find((c) => c.label === 'A')!.suppressed, false);
});
test('when everything is small the total is not exact either', () => {
  const r = suppress([{ label: 'A', value: 4 }, { label: 'B', value: 3 }]);
  eq(r.total, null); eq(r.totalDisplay, '<10');
  eq(suppress([{ label: 'A', value: 6 }, { label: 'B', value: 7 }]).totalDisplay, '10+');
});
test('a single small category alone is hidden', () => {
  const r = suppress([{ label: 'Only', value: 3 }]);
  eq(r.cells[0].value, null); eq(r.totalDisplay, '<10');
});
test('csv never contains a suppressed number', () => {
  const r = suppress([{ label: 'A', value: 40 }, { label: 'B', value: 25 }, { label: 'C', value: 3 }]);
  const csv = toCsv([{ metric: 'm', cells: r.cells, totalDisplay: r.totalDisplay }], 'Inst', '2026-10-24');
  eq(csv.includes(',3\n') || csv.endsWith(',3') || csv.includes(',25'), false);
  eq(csv.includes('m,A,40'), true);
});
test('every metric has a definition, source, owner and caveat', () => {
  eq(METRICS.every((m) => m.counts && m.population && m.source && m.owner && m.caveat), true);
});
