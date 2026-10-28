import { test, eq } from './harness';
import { parseFlow, parseTimeline, parseMatrix, layers, toSvg, describe, wrap, esc, STARTERS, LIMITS, type Flow } from '../src/lib/diagramRules';

test('flow: arrows make steps and labelled connections; a bare line is a step on its own', () => {
  const { diagram, problems } = parseFlow('A -> B: yes\nB → C\nLonely');
  eq(problems, []);
  eq(diagram, { kind: 'flow', nodes: ['A', 'B', 'C', 'Lonely'], edges: [{ from: 0, to: 1, label: 'yes' }, { from: 1, to: 2, label: '' }] });
});
test('flow layers: each step sits right of what leads into it; a loop is a back-arrow, not an endless climb', () => {
  const f = parseFlow(STARTERS.flow).diagram as Flow;
  const { layer, back } = layers(f);
  eq(layer, [0, 1, 2, 3, 4, 5]);
  eq([...back].map((i) => `${f.nodes[f.edges[i].from]}->${f.nodes[f.edges[i].to]}`), ['Analysis->Hypothesis']);
});
test('flow: a half arrow is reported, and the step cap holds', () => {
  eq(parseFlow('A ->').problems, ['Line 1: an arrow needs a step on both sides.']);
  const many = Array.from({ length: LIMITS.nodes + 3 }, (_, i) => `s${i}`).join('\n');
  const p = parseFlow(many); eq((p.diagram as Flow).nodes.length, LIMITS.nodes); eq(p.problems.length, 3);
});
test('timeline keeps the written order; a line without "when:" is reported', () => {
  const p = parseTimeline('1918: Armistice\n1914: War begins\nno colon');
  eq(p.diagram, { kind: 'timeline', events: [{ when: '1918', what: 'Armistice' }, { when: '1914', what: 'War begins' }] });
  eq(p.problems, ['Line 3: use "when: what happened".']);
});
test('matrix: cells must name a listed row and column', () => {
  const p = parseMatrix('rows: A, B\ncols: X\nA / X: yes\nC / X: no');
  eq(p.diagram, { kind: 'matrix', rows: ['A', 'B'], cols: ['X'], cells: { 'A\u0000X': 'yes' } });
  eq(p.problems, ['Line 4: "C / X" is not a listed row and column.']);
});
test('svg escapes text, names itself, and is the same for the same input', () => {
  const d = parseFlow('<script> -> "B" & C').diagram;
  const a = toSvg(d, 'Mine <1>'); const b = toSvg(d, 'Mine <1>');
  eq(a === b, true);
  eq(a.includes('<script>'), false); eq(a.includes('&lt;script&gt;'), true); eq(a.includes('aria-label="Mine &lt;1&gt;"'), true);
  eq(esc('a"b'), 'a&quot;b');
});
test('every starter draws without problems and reads back in words', () => {
  for (const k of ['flow', 'timeline', 'matrix'] as const) {
    const p = k === 'flow' ? parseFlow(STARTERS[k]) : k === 'timeline' ? parseTimeline(STARTERS[k]) : parseMatrix(STARTERS[k]);
    eq([k, p.problems], [k, []]); eq(toSvg(p.diagram, k).startsWith('<svg'), true); eq(describe(p.diagram).length > 20, true);
  }
});
test('wrap fits words to the width and marks what it cut', () => {
  eq(wrap('one two three four', 9), ['one two', 'three', 'four']);
  eq(wrap('one two three four five six seven', 9, 2), ['one two', 'thre…']);
});
