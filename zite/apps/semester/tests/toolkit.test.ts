import { test, eq } from './harness';
import { TOOLS, INTENTS, SUBJECTS, TEMPLATES, emptyDoc, completeness, rubricChecklist, parseCsv, describe } from '../src/lib/toolkitRules';

test('every intent and subject points only at real tools; 9 intents, 32 subjects', () => {
  const keys = new Set(TOOLS.map((t) => t.key));
  eq(INTENTS.length, 9);
  eq(SUBJECTS.length, 32);
  eq([...INTENTS, ...SUBJECTS].every((x) => x.tools.every((k) => keys.has(k))), true);
});
test('empty template is 0 complete; filling a section counts (control)', () => {
  const d = emptyDoc('case');
  eq(completeness('case', d), { done: 0, total: TEMPLATES.case.length });
  d.framework = 'Porter five forces';
  eq(completeness('case', d).done, 1);
});
test('rubric criterion becomes questions, never a grade', () => {
  const qs = rubricChecklist('Presents a clear thesis; supports claims with cited evidence. Addresses counterarguments.');
  eq(qs.length, 3);
  eq(qs[0], 'Does my work presents a clear thesis?');
  eq(qs.some((q) => /grade|score|%|points/i.test(q)), false);
});
test('CSV parser handles quotes, commas and blank lines', () => {
  const p = parseCsv('name,score\n"Smith, J",90\n\n"O""Neil",80\n');
  eq(p.header, ['name', 'score']);
  eq(p.rows, [['Smith, J', '90'], ['O"Neil', '80']]);
});
test('describe computes numeric stats and categorical counts', () => {
  const s = describe('x,g\n1,a\n2,b\n3,a\n,a\n10,b');
  eq(s[0], { column: 'x', numeric: true, n: 4, missing: 1, mean: 4, median: 2.5, sd: 4.082, min: 1, max: 10 });
  eq(s[1].numeric, false);
  eq(s[1].top, [{ value: 'a', count: 3 }, { value: 'b', count: 2 }]);
});
