import { describe, expect, it } from 'vitest';
import { asMentors, readOffer, readRequest, split } from './mentors';
import { matchMentors } from './launchpad';

describe('mentor rosters, client side', () => {
  it('shows no offer without a chosen name — an account id is not a name', () => {
    expect(readOffer('alumni', { user_id: 'u', display_name: '  ', topics: ['x'] })).toBeNull();
    expect(readOffer('peer', { user_id: 'u', cohort_scope: 's/c', display_name: 'Sam', topics: ['Research'] })).toEqual({
      kind: 'peer', userId: 'u', cohort: 's/c', name: 'Sam', topics: ['Research'],
    });
  });

  it('matches on the topics a mentor listed and the interests a student ticked, nothing else', () => {
    const offers = [
      readOffer('peer', { user_id: 'a', cohort_scope: 'c', display_name: 'Ana', topics: ['Research'] })!,
      readOffer('peer', { user_id: 'b', cohort_scope: 'c', display_name: 'Ben', topics: ['Campus jobs'] })!,
    ];
    const m = matchMentors(['Research'], ['first-year'], asMentors(offers));
    expect(m.map((x) => x.mentor.name)).toEqual(['Ana']);
    expect(matchMentors([], ['first-year'], asMentors(offers))).toEqual([]);
  });

  it('splits requests into sent, waiting and mentoring', () => {
    const r = (id: string, requester: string, recipient: string, status: string) =>
      readRequest({ id, kind: 'peer', requester, recipient, requester_name: 'X', status, topics: [], note: '' })!;
    const s = split([r('1', 'me', 'a', 'pending'), r('2', 'b', 'me', 'pending'), r('3', 'c', 'me', 'accepted'), r('4', 'd', 'me', 'declined')], 'me');
    expect([s.sent.length, s.waiting.length, s.mentoring.length]).toEqual([1, 1, 1]);
  });

  it('drops a request with an unknown status or kind', () => {
    expect(readRequest({ id: '1', kind: 'peer', status: 'maybe' })).toBeNull();
    expect(readRequest({ id: '1', kind: 'coach', status: 'pending' })).toBeNull();
  });
});
