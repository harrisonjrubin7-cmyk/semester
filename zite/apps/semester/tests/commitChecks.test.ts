import { test, eq } from './harness';
import { commitBlocker, submitOutcome } from '../src/lib/registrarRules';

const base = { holds: [], missingPrereqs: [], overrideApproved: false, enrolledCredits: 12, sectionCredits: 3, maxCredits: 18, clashesWith: [] };
test('nothing changed since submit: commit allowed (control)', () => eq(commitBlocker(base), null));
test('a hold placed after submit blocks', () => eq(typeof commitBlocker({ ...base, holds: ['Bursar hold'] }), 'string'));
test('missing prerequisite blocks unless an override is approved', () => {
  eq(typeof commitBlocker({ ...base, missingPrereqs: ['MATH 101'] }), 'string');
  eq(commitBlocker({ ...base, missingPrereqs: ['MATH 101'], overrideApproved: true }), null);
});
test('clash with a confirmed section blocks', () => eq(typeof commitBlocker({ ...base, clashesWith: ['ECON 200'] }), 'string'));
test('credit limit is inclusive', () => {
  eq(commitBlocker({ ...base, enrolledCredits: 15 }), null);
  eq(typeof commitBlocker({ ...base, enrolledCredits: 16 }), 'string');
  eq(commitBlocker({ ...base, enrolledCredits: 40, maxCredits: null }), null);
});
test('submit keys: new, resume, replay, conflict', () => {
  eq(submitOutcome(null, ['A', 'B']), 'new');
  eq(submitOutcome({ sections: ['A', 'B'], state: 'reserved' }, ['B']), 'resume');      // A already written, B left
  eq(submitOutcome({ sections: ['A', 'B'], state: 'reserved' }, []), 'resume');
  eq(submitOutcome({ sections: ['A', 'B'], state: 'done' }, []), 'replay');
  eq(submitOutcome({ sections: ['A', 'B'], state: 'done' }, ['C']), 'conflict');         // key reused for a new draft
  eq(submitOutcome({ sections: ['A'], state: 'reserved' }, ['A', 'C']), 'conflict');
});
