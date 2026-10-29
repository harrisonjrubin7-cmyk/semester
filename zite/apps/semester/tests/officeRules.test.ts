import { test, eq } from './harness';
import { osvSteps, searchArticles, OsvReq } from '../src/lib/officeRules';

const now = Date.parse('2026-10-29T12:00:00Z');
const req = (o: Partial<OsvReq> = {}): OsvReq => ({ state: 'sent', requesterId: 'stu', assigneeId: null, reopenCount: 0, resolvedAt: null, ...o });
const stu = { me: 'stu', staff: false, lead: false }, s1 = { me: 's1', staff: true, lead: false }, lead = { me: 'L', staff: true, lead: true };

test('student sees reply and withdraw on an open request', () => eq(osvSteps(req(), stu, now), ['reply', 'withdraw']));
test('staff can take a sent request', () => eq(osvSteps(req(), s1, now), ['claim', 'note']));
test('staff who sent it get no staff steps on it', () => eq(osvSteps(req({ requesterId: 's1' }), s1, now), ['reply', 'withdraw']));
test('handler can ask, resolve and refer', () => eq(osvSteps(req({ state: 'claimed', assigneeId: 's1' }), s1, now), ['ask', 'resolve', 'refer', 'note']));
test('other staff cannot resolve someone else’s', () => eq(osvSteps(req({ state: 'claimed', assigneeId: 's2' }), s1, now), ['note']));
test('lead can assign and refer', () => eq(osvSteps(req({ state: 'claimed', assigneeId: 's2' }), lead, now), ['assign', 'refer', 'note']));
test('resolved within 14 days: confirm or reopen', () => eq(osvSteps(req({ state: 'resolved', resolvedAt: '2026-10-20T12:00:00Z' }), stu, now), ['confirm', 'reopen']));
test('no reopen after 14 days', () => eq(osvSteps(req({ state: 'resolved', resolvedAt: '2026-10-01T12:00:00Z' }), stu, now), ['confirm']));
test('no second reopen', () => eq(osvSteps(req({ state: 'resolved', reopenCount: 1, resolvedAt: '2026-10-28T12:00:00Z' }), stu, now), ['confirm']));
test('closed requests offer nothing', () => eq(osvSteps(req({ state: 'closed' }), lead, now), []));
test('a non-staff stranger sees nothing', () => eq(osvSteps(req(), { me: 'x', staff: false, lead: false }, now), []));
const arts = [{ title: 'Enrollment letter', body: 'Ask the registrar.' }, { title: 'Parking permits', body: 'An enrollment letter is not needed.' }];
test('search needs every word and ranks title hits first', () => eq(searchArticles(arts, 'enrollment letter').map((a) => a.title), ['Enrollment letter', 'Parking permits']));
test('search with no match returns nothing', () => eq(searchArticles(arts, 'housing'), []));
