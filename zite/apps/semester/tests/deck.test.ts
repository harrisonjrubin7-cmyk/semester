import { test, eq } from './harness';
import { parseOutline, paginate, fromGuide, toOutline, toPptx, MAX_BULLETS } from '../src/lib/deckRules';
import { parseGuide } from '../src/lib/guideRules';

test('outline: headings start slides, bullets and notes attach', () => {
  const s = parseOutline('# One\n- a\n  - b\n> say this\n\n## Two\nplain line\n1. numbered');
  eq(s, [{ title: 'One', bullets: ['a', 'b'], notes: 'say this' }, { title: 'Two', bullets: ['plain line', 'numbered'], notes: '' }]);
});
test('long slides continue; short ones are untouched (control)', () => {
  const s = paginate([{ title: 'T', bullets: Array.from({ length: 13 }, (_, i) => `b${i}`), notes: 'n' }, { title: 'U', bullets: ['x'], notes: '' }]);
  eq(s.map((x) => [x.title, x.bullets.length, x.notes]), [['T', MAX_BULLETS, 'n'], ['T (cont.)', MAX_BULLETS, ''], ['T (cont.)', 1, ''], ['U', 1, '']]);
});
test('a study guide becomes slides and round-trips through the outline', () => {
  const g = parseGuide('Econ', '# Market failure\nWhat is adverse selection? :: Hidden quality drives good goods out');
  const s = fromGuide(g);
  eq(s.length >= 1 && s[0].title === 'Market failure', true);
  eq(parseOutline(toOutline(s)), s);
});
test('pptx package: title slide plus one per slide, notes only when present, text escaped', () => {
  const t = new TextDecoder().decode(toPptx('Deck <1>', [{ title: 'A & B', bullets: ['x < y'], notes: 'n' }, { title: 'C', bullets: [], notes: '' }]));
  eq(t.startsWith('PK'), true);
  eq(['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml', 'ppt/slides/slide3.xml', 'ppt/notesSlides/notesSlide2.xml', 'ppt/theme/theme1.xml'].every((n) => t.includes(n)), true);
  eq(t.includes('ppt/slides/slide4.xml') || t.includes('notesSlide3.xml'), false);
  eq(t.includes('A &amp; B') && t.includes('x &lt; y') && t.includes('Deck &lt;1&gt;'), true);
  const plain = new TextDecoder().decode(toPptx('P', [{ title: 'Only', bullets: ['a'], notes: '' }]));
  eq(plain.includes('notesMaster'), false);
});
