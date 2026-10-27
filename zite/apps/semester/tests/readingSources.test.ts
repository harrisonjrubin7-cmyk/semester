import { test, eq } from './harness';
import { blank, validate, bibKey, bibEscape, toBibtex, parseBibtex, cite, nameParts, type Source } from '../src/lib/sourceRules';

const s1: Source = { ...blank(), title: 'The Market for Lemons', authors: ['Akerlof, George A.'], year: '1970', container: 'Quarterly Journal of Economics', volume: '84', issue: '3', pages: '488-500', doi: '10.2307/1879431' };

test('validate: a good source passes; bad year, DOI, link and blank title fail (control)', () => {
  eq(validate(s1), []);
  eq(validate({ ...s1, title: ' ', year: '70', doi: 'doi:x', url: 'javascript:alert(1)' }).length, 4);
});
test('names: "Last, First" and "First Last" both split', () => {
  eq(nameParts('Akerlof, George A.'), { last: 'Akerlof', first: 'George A.' });
  eq(nameParts('Jean Tirole'), { last: 'Tirole', first: 'Jean' });
});
test('keys are unique and skip stop words', () => {
  const t = new Set<string>();
  eq(bibKey(s1, t), 'akerlof1970market');
  eq(bibKey(s1, t), 'akerlof1970marketb');
  eq(bibKey({ ...blank(), title: 'Ünïcode' }, t), 'anonndunicode');
});
test('LaTeX specials are escaped so a title cannot break the file', () => {
  eq(bibEscape('R&D 50% of $ #1 a_b {x}'), 'R\\&D 50\\% of \\$ \\#1 a\\_b \\{x\\}');
  const evil = parseBibtex(toBibtex([{ ...s1, title: 'Close} @misc{evil, title={x' }]));
  eq([evil.sources.length, evil.sources[0].title], [1, 'Close @miscevil, title=x']);
});
test('BibTeX round-trips through export and import', () => {
  const bib = toBibtex([s1, { ...blank(), kind: 'book', title: 'The Theory of Industrial Organization', authors: ['Jean Tirole'], year: '1988', publisher: 'MIT Press' }]);
  eq(bib.startsWith('@article{akerlof1970market,'), true);
  eq(bib.includes('pages = {488--500}'), true);
  const back = parseBibtex(bib);
  eq(back.sources.length, 2);
  eq([back.sources[0].title, back.sources[0].doi, back.sources[0].issue, back.sources[1].kind, back.sources[1].authors], ['The Market for Lemons', '10.2307/1879431', '3', 'book', ['Tirole, Jean']]);
});
test('import skips entries with no title and @comment blocks', () => {
  const r = parseBibtex('@comment{x}\n@misc{a, author = "X"}\n@article{b, title = {Kept {Case}}, year = 2001}');
  eq([r.sources.length, r.skipped, r.sources[0].title, r.sources[0].year], [1, 1, 'Kept Case', '2001']);
});
test('APA and MLA reference lines', () => {
  eq(cite(s1, 'apa'), 'Akerlof, G. A. (1970). The Market for Lemons. Quarterly Journal of Economics, 84(3), 488-500. https://doi.org/10.2307/1879431');
  eq(cite(s1, 'mla'), 'Akerlof, George A. “The Market for Lemons.” Quarterly Journal of Economics, vol. 84, no. 3, 1970, pp. 488-500. https://doi.org/10.2307/1879431.');
  eq(cite({ ...blank(), title: 'Untitled note' }, 'apa'), '(n.d.). Untitled note.');
});
