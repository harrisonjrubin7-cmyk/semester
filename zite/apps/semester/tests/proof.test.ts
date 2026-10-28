import { test, eq } from './harness';
import { check, grade, quotes, findQuote, citedInSources, checkQuotes, sentences } from '../src/lib/proofRules';

const kinds = (t: string) => check(t).map((i) => [i.kind, i.text, i.suggestion ?? '']);

test('clean academic sentence has no issues (control)', () => {
  eq(check('Adverse selection drives good cars out of the market. Buyers cannot observe quality, so prices fall.'), []);
});
test('spelling, repeated words and could-of', () => {
  eq(kinds('We definately recieve the the data. They could of known.'), [['spelling', 'definately', 'definitely'], ['spelling', 'recieve', 'receive'], ['grammar', 'the the', 'the'], ['grammar', 'could of', 'could have']]);
});
test('a/an keeps "a university" and flags "a example"', () => {
  eq(kinds('This is a example. It is a university.').filter((k) => k[1] === 'a'), [['grammar', 'a', 'an']]);
});
test('wordy phrases, passive voice and long sentences', () => {
  const long = 'Prices ' + Array.from({ length: 39 }, (_, i) => ['data', 'shows', 'that', 'buyers', 'rarely', 'trust'][i % 6]).join(' ') + '.';
  const r = check('In order to test it, the survey was conducted by the team. ' + long);
  eq(r.map((i) => i.message.split(' ')[0]), ['Wordy', 'Possible', 'Long']);
});
test('punctuation: spaces, unmatched brackets, lower-case start', () => {
  eq(kinds('this is it .Then  more,and (open').map((k) => k[0] + ':' + k[1]), ['grammar:t', 'punctuation: .', 'punctuation:  ', 'punctuation:,', 'punctuation:(']);
});
test('sentences and grade level', () => {
  eq(sentences('One. Two? Three!').map((s) => s.text), ['One.', 'Two?', 'Three!']);
  eq(grade('Too short.'), null);
  const g = grade('The cat sat on the mat. '.repeat(8))!; eq(g < 3, true);
});
test('quotes: 4+ words, with following citation', () => {
  const q = quotes('He wrote “the cost of dishonesty lies not only” (Akerlof, 1970, p. 495). Then "too short".');
  eq(q.map((x) => [x.text, x.citation]), [['the cost of dishonesty lies not only', 'Akerlof, 1970, p. 495']]);
});
test('findQuote: exact, with ellipsis, close and missing', () => {
  const src = 'The cost of dishonesty, therefore, lies not only in the amount by which the purchaser is cheated.';
  eq(findQuote('the cost of dishonesty, therefore, lies not only', src).found, 'exact');
  eq(findQuote('the cost of dishonesty ... lies not only', src).found, 'exact');
  eq(findQuote('the cost of honesty therefore lies not only', src).found, 'close');
  eq(findQuote('markets always clear efficiently every time', src).found, 'missing');
});
test('citations are matched against saved Sources by surname and year', () => {
  const lib = [{ authors: ['Akerlof, George A.'], year: '1970' }, { authors: ['Smith, Jane', 'Jones, Ann'], year: '2019' }];
  eq([citedInSources('Akerlof, 1970', lib), citedInSources('Akerlof, 1971', lib), citedInSources('Smith & Jones 2019, p. 4', lib), citedInSources('Tirole, 1988', lib)], [true, false, true, false]);
  eq(checkQuotes('“lies not only in the amount” (Tirole, 1988)', '', lib).map((r) => [r.found, r.cited]), [['no-source', 'not-in-sources']]);
});
