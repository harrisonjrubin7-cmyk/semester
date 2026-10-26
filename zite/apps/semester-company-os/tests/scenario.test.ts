import { test, eq } from './harness';
import { parseInputs, parseStack, nameBlocker } from '../src/lib/scenario';
import { emptyInputs } from '../src/lib/costModel';

test('round-trips saved inputs through JSON', () => {
  const i = emptyInputs('Multi-institution launch'); i.prices.perGbStorage = { amount: 0.02, currency: 'usd', period: 'month' };
  const r = parseInputs(JSON.stringify(i));
  eq(r.ok, true); if (r.ok) { eq(r.inputs.institutions, 5); eq(r.inputs.prices.perGbStorage, { amount: 0.02, currency: 'USD', period: 'month' }); eq(r.inputs.prices.supportHourly.amount, null); }
});
test('rejects bad JSON, negative counts and shares above 1', () => {
  eq(parseInputs('{oops').ok, false);
  eq(parseInputs({ ...emptyInputs(), staff: -1 }).ok, false);
  eq(parseInputs({ ...emptyInputs(), monthlyActiveShare: 1.5 }).ok, false);
});
test('rejects negative prices but keeps blanks blank', () => {
  const i = emptyInputs(); (i.prices.perGbEgress as { amount: number | null }).amount = -1;
  eq(parseInputs(i).ok, false);
});
test('stack keeps only known areas and options', () => eq(parseStack({ Files: 'External backend', Frontend: 'Mainframe', Nope: 'Zite-native' }), { Files: 'External backend' }));
test('scenario names need 2–80 characters', () => { eq(nameBlocker('A'), 'Give the scenario a name of 2–80 characters.'); eq(nameBlocker('Lean pilot v2'), null); });
