import { test, eq } from './harness';
import { computeReadiness, firstBlocker, DraftRow } from '../src/lib/readiness';

const row = (o: Partial<DraftRow> = {}): DraftRow => ({ code: 'CS 101', credits: 3, missing: [], approved: false, pending: false, conflicts: [], ...o });

test('clean draft with no holds is ready', () => {
  const r = computeReadiness([row(), row({ code: 'MATH 120', credits: 4 })], []);
  eq(r.ready, true); eq(r.credits, 7); eq(firstBlocker(r), null);
});
test('an open hold blocks and points to Help', () => {
  const r = computeReadiness([row()], ['Bursar balance hold']);
  eq(r.ready, false); eq(r.checks[0].state, 'blocked'); eq(r.checks[0].fixPath, '/help');
});
test('empty draft blocks', () => eq(computeReadiness([], []).ready, false));
test('missing prerequisite blocks', () => eq(computeReadiness([row({ missing: ['CS 101'] })], []).ready, false));
test('an approved override clears the prerequisite block', () => eq(computeReadiness([row({ missing: ['CS 101'], approved: true })], []).ready, true));
test('a pending override still blocks, and says it is waiting', () => {
  const r = computeReadiness([row({ code: 'CS 201', missing: ['CS 101'], pending: true })], []);
  eq(r.ready, false); eq(firstBlocker(r)!.startsWith('Waiting on override'), true);
});
test('a time conflict blocks', () => eq(computeReadiness([row({ conflicts: ['HIST 214'] })], []).ready, false));
test('credit load is information, never a blocker', () => {
  const r = computeReadiness([row({ credits: 30 })], []);
  eq(r.ready, true); eq(r.checks.find((c) => c.key === 'credits')!.state, 'info');
});
test('the hold is reported before other blockers', () => {
  const r = computeReadiness([row({ conflicts: ['X'] })], ['Advising hold']);
  eq(firstBlocker(r)!.includes('Advising hold'), true);
});
