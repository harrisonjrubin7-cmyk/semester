import { test, eq } from './harness';
import { parseGuide } from '../src/lib/guideRules';
import { buildPaper, score, keywordHint, maxMarks, remaining, clock } from '../src/lib/paperRules';

const src = '# Markets\nWhat is adverse selection? :: Hidden quality drives good products out of the market\nWhat is moral hazard? :: Behaviour changes after insurance is bought\nWhat is a public good? :: Non-rival and non-excludable\n# Prices\nWhat is a price ceiling? :: A legal maximum price\nWhat is elasticity? :: Responsiveness of quantity to price\nWhat is a tariff? :: A tax on imports';
const g = parseGuide('Econ', src);

test('same seed gives the same paper; a different seed changes it', () => {
  eq(JSON.stringify(buildPaper(g, 7, { objective: 4, written: 2 })), JSON.stringify(buildPaper(g, 7, { objective: 4, written: 2 })));
  eq(JSON.stringify(buildPaper(g, 7)) === JSON.stringify(buildPaper(g, 8)), false);
});
test('written questions avoid cards already used in Section A when possible', () => {
  const p = buildPaper(g, 3, { objective: 2, written: 2 }); // two cards in Section A leaves four unused
  const inA = new Set(p.objective.flatMap((q) => (q.kind === 'match' ? q.pairs.map((x) => x.q) : [q.prompt])));
  eq(p.written.length, 2); eq(p.written.every((w) => !inA.has(w.prompt)), true);
  eq(maxMarks(p), p.objective.length + 4);
  const tight = buildPaper(g, 3, { objective: 6, written: 3 }); eq(tight.written.length, 3); // falls back to used cards
});
test('scoring: correct keys count, blanks are wrong, total waits for self-marking', () => {
  const p = buildPaper(g, 5, { objective: 3, written: 1 });
  const right = p.objective.map((q) => (q.kind === 'choice' ? q.answer : q.kind === 'truefalse' ? q.answer : q.pairs.map((_, k) => q.order.indexOf(k))));
  eq(score(p, { objective: right, written: [''] }, [null]), { objective: 3, written: null, total: null, max: 5, unmarked: 1, wrong: [] });
  eq(score(p, { objective: [null, null, null], written: ['x'] }, [2]), { objective: 0, written: 2, total: 2, max: 5, unmarked: 0, wrong: [0, 1, 2] });
});
test('keyword hint lists model-answer words used and missing (control: empty answer uses none)', () => {
  eq(keywordHint('', 'Non-rival and non-excludable').used, []);
  eq(keywordHint('it is non rival', 'Non-rival and non-excludable'), { used: ['non', 'rival'], missing: ['excludable'] });
});
test('timer counts down and stops at zero', () => {
  eq([remaining(0, 10, 0), remaining(0, 10, 61000), remaining(0, 10, 10 * 60000 + 5)], [600, 539, 0]);
  eq([clock(600), clock(59)], ['10:00', '0:59']);
});
