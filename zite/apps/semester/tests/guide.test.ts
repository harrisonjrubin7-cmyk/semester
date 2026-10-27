import { test, eq } from './harness';
import { parseGuide, availableModes, slides, script, cram, buildQuiz, mark, review, docHtml } from '../src/lib/guideRules';

const TEXT = `Supply and demand basics.
# Demand
Demand slopes down.
Q: What shifts demand? :: Income, tastes, related prices
Elasticity :: Responsiveness of quantity to price
Figure: Demand curve | Price falls, quantity rises | P10=2, P8=4, P6=7
# Supply
Supply slopes up.
Equilibrium :: Where supply meets demand
Case: Rent control | 1970s | Caps help renters | Compare vacancy | Shortages | Ceilings cause shortages
## Terms
Surplus — quantity supplied exceeds demanded
Shortage - quantity demanded exceeds supplied`;

test('parses units, points, cards, figures, cases, terms and blurb', () => {
  const g = parseGuide('Econ 101', TEXT);
  eq(g.blurb, 'Supply and demand basics.');
  eq(g.units.map((u) => u.name), ['Demand', 'Supply']);
  eq(g.units[0].points, ['Demand slopes down.']);
  eq(g.units[0].cards.length, 2);
  eq(g.units[0].figures[0].rows, [{ l: 'P10', v: 2 }, { l: 'P8', v: 4 }, { l: 'P6', v: 7 }]);
  eq(g.cases[0].verdict, 'Shortages');
  eq(g.terms.map((t) => t.t), ['Surplus', 'Shortage']);
});
test('cards before any unit go into General; terms only under ## Terms', () => {
  const g = parseGuide('x', 'A :: B\nNot a term - just a point');
  eq(g.units[0].name, 'General');
  eq(g.terms.length, 0);
  eq(g.units[0].points, ['Not a term - just a point']);
});
test('modes appear only with the material they need (control: empty guide offers none)', () => {
  eq(availableModes(parseGuide('x', '')), []);
  eq(availableModes(parseGuide('Econ', TEXT)).length, 11);
  eq(availableModes(parseGuide('x', '# U\nOne point')).includes('quiz'), false);
});
test('slides, script and cram cover every point', () => {
  const g = parseGuide('Econ', TEXT);
  eq(slides(g).length, 1 + 2 + 2);
  eq(script(g)[0].chapter, 'Demand');
  eq(cram(g).at(-1)!.unit, 'Terms');
});
test('quiz is deterministic per seed and marks correctly', () => {
  const g = parseGuide('Econ', TEXT);
  const a = buildQuiz(g, 7), b = buildQuiz(g, 7);
  eq(JSON.stringify(a), JSON.stringify(b));
  for (const q of a) {
    if (q.kind === 'choice') { eq(mark(q, q.answer), true); eq(mark(q, (q.answer + 1) % q.options.length), false); }
    if (q.kind === 'truefalse') { eq(mark(q, q.answer), true); eq(mark(q, !q.answer), false); }
    if (q.kind === 'match') { const right = q.pairs.map((_, k) => q.order.indexOf(k)); eq(mark(q, right), true); eq(mark(q, right.slice().reverse()), right.length === 1 || JSON.stringify(right) === JSON.stringify(right.slice().reverse())); }
  }
  eq(buildQuiz(parseGuide('x', 'A :: B'), 1), []);
});
test('choice options always contain the answer once', () => {
  const g = parseGuide('Econ', TEXT);
  for (let s = 1; s < 30; s++) for (const q of buildQuiz(g, s)) if (q.kind === 'choice') eq(q.options.filter((o) => o === q.options[q.answer]).length, 1);
});
test('Leitner review', () => {
  eq(review(1, true), { box: 2, inDays: 2 });
  eq(review(5, true), { box: 5, inDays: 14 });
  eq(review(4, false), { box: 1, inDays: 1 });
});
test('doc export escapes text', () => {
  eq(docHtml(parseGuide('<b>x</b>', '# U\n<script>')).includes('<script>'), false);
});
