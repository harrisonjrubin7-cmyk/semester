import { test, eq } from './harness';
import { completionBlocker, archiveBlocker, closedTermMessage, termWritable } from '../src/lib/termRules';

test('completion needs an approved calendar, ended classes and an open term', () => {
  eq(completionBlocker({ hasApprovedCalendar: false, classesEnded: true, state: 'open' }), 'There is no approved calendar for this term.');
  eq(completionBlocker({ hasApprovedCalendar: true, classesEnded: false, state: 'open' }), 'Classes have not ended for this term yet.');
  eq(completionBlocker({ hasApprovedCalendar: true, classesEnded: true, state: 'completed' }), 'This term is already completed.');
  eq(completionBlocker({ hasApprovedCalendar: true, classesEnded: true, state: 'archived' }), 'This term is already archived.');
  eq(completionBlocker({ hasApprovedCalendar: true, classesEnded: true, state: 'open' }), null);
});
test('archiving needs completion first and happens once', () => {
  eq(archiveBlocker('open'), 'Complete the term before archiving it.');
  eq(archiveBlocker('archived'), 'This term is already archived.');
  eq(archiveBlocker('completed'), null);
});
test('only an open term takes registration writes', () => {
  eq(termWritable('open'), true);
  eq(termWritable('completed'), false);
  eq(termWritable('archived'), false);
  eq(closedTermMessage('open'), null);
  eq(closedTermMessage('completed'), 'This term is completed; registration changes are closed for it.');
  eq(closedTermMessage('archived'), 'This term is archived; registration changes are closed for it.');
});
