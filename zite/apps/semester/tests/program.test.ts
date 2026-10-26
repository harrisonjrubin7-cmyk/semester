import { test, eq } from './harness';
import { next, pathwayBlocker } from '../src/lib/programRules';

const C = { ECON1010: { credits: 3, prereqs: [] }, ECON2010: { credits: 3, prereqs: ['ECON 1010'] }, MATH1100: { credits: 4, prereqs: [] } };
const O = [{ text: 'Analyse markets with formal models.', courses: ['ECON 2010'] }];
const P = { terms: [['ECON 1010', 'MATH 1100'], ['ECON 2010']], totalCredits: 10, termCap: 18, outcomes: O };

test('governance path (control)', () => {
  eq(next('submitted', 'approve', 'committee'), 'committee_approved');
  eq(next('committee_approved', 'publish', 'registrar'), 'published');
});
test('order and roles', () => {
  eq(next('submitted', 'publish', 'registrar'), null);
  eq(next('submitted', 'approve', 'registrar'), null);
  eq(next('published', 'withdraw', 'author'), null);
});
test('valid pathway (control)', () => { eq(pathwayBlocker(P, C), null); });
test('prerequisite must come in an earlier term', () => {
  eq(pathwayBlocker({ ...P, terms: [['ECON 2010', 'ECON 1010', 'MATH 1100']] }, C), 'ECON2010 needs ECON1010 in an earlier term.');
});
test('catalog, duplicates, cap and total', () => {
  eq(pathwayBlocker({ ...P, terms: [['ECON 9999']] }, C)?.startsWith('Not in the published'), true);
  eq(pathwayBlocker({ ...P, terms: [['ECON 1010'], ['ECON 1010']] }, C)?.includes('more than one term'), true);
  eq(pathwayBlocker({ ...P, termCap: 5 }, C)?.startsWith('Term 1 has 7 credits'), true);
  eq(pathwayBlocker({ ...P, totalCredits: 120 }, C)?.startsWith('The pathway reaches 10'), true);
});
test('outcomes must map to pathway courses', () => {
  eq(pathwayBlocker({ ...P, outcomes: [] }, C) !== null, true);
  eq(pathwayBlocker({ ...P, outcomes: [{ text: 'Analyse markets with models.', courses: [] }] }, C)?.startsWith('Map '), true);
  eq(pathwayBlocker({ ...P, outcomes: [{ text: 'Analyse markets with models.', courses: ['HIST 1000'] }] }, C)?.includes('not in the pathway'), true);
});
