import { test, eq } from './harness';
import { replayDecision, decideRegistration, DecideInput } from '../src/lib/registrarRules';

// Synthetic people. Institution A: Alice (student), Alex (student), Rachel (registrar), Sam (staff who is also a student).
// Institution B: Bob (student), Ben (registrar).
const A = 'inst-A', B = 'inst-B';
const rachel = { id: 'rachel', institutionId: A }, ben = { id: 'ben', institutionId: B }, sam = { id: 'sam', institutionId: A };
const base: DecideInput = {
  decider: rachel,
  request: { studentId: 'alice', institutionId: A, state: 'Submitted', sectionInTenant: true },
  section: { version: 3, state: 'Open', capacity: 2, enrolled: 1 },
  expectedVersion: 3, decision: 'commit',
};
const kind = (i: DecideInput) => decideRegistration(i).kind;

test('Rachel (A registrar) commits Alice into an open seat', () => eq(kind(base), 'commit'));
test('Ben (B registrar) cannot decide Alice’s A request', () => eq(kind({ ...base, decider: ben }), 'deny'));
test('Rachel cannot decide Bob’s B request', () => eq(kind({ ...base, request: { ...base.request, studentId: 'bob', institutionId: B } }), 'deny'));
test('a request pointing at another institution’s section is denied', () => eq(kind({ ...base, request: { ...base.request, sectionInTenant: false } }), 'deny'));
test('Sam cannot decide his own request', () => eq(kind({ ...base, decider: sam, request: { ...base.request, studentId: 'sam' } }), 'deny'));
test('a full section is rejected, not overbooked', () => eq(decideRegistration({ ...base, section: { ...base.section, enrolled: 2 } }), { kind: 'reject', code: 'CAPACITY_UNAVAILABLE', message: 'No seats remain in this section.' }));
test('a closed section is rejected', () => eq(kind({ ...base, section: { ...base.section, state: 'Closed' } }), 'reject'));
test('a stale section version asks the registrar to reload', () => eq(kind({ ...base, expectedVersion: 2 }), 'stale'));
test('an already-decided request is not decided twice', () => eq(kind({ ...base, request: { ...base.request, state: 'Committed' } }), 'noop'));
test('reject works even when the section is full', () => eq(kind({ ...base, decision: 'reject', section: { ...base.section, enrolled: 2 } }), 'reject'));

const prior = [{ studentIds: ['alex'], sectionId: 's1' }, { studentIds: ['alex'], sectionId: 's2' }];
test('first submit with a new key is new', () => eq(replayDecision([], 'alex', ['s1']), 'new'));
test('Alex retries with the same key and sections → replay, no duplicate', () => eq(replayDecision(prior, 'alex', ['s2', 's1']), 'replay'));
test('Alex reuses the key for different sections → conflict', () => eq(replayDecision(prior, 'alex', ['s1', 's3']), 'conflict'));
test('Alice cannot replay Alex’s key', () => eq(replayDecision(prior, 'alice', ['s1', 's2']), 'forbidden'));
