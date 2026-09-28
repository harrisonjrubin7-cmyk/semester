import { describe, expect, it } from 'vitest';
import { MIN_COHORT } from '../lib/institution-ops';
import {
  FIRST_MEETING_AGENDA, FORBIDDEN_MATCH_INPUTS, MENTOR_BOUNDARY, OUT_OF_SCOPE, PAIRING_MOVES, PAIRING_NOTICE, PAIRING_STATES, PROGRAMS,
  RENEWAL_DAYS, TRAINING_MODULES, UNACCEPTED_DAYS, assertMatchInputs, checkIns, coordinatorSummary, eligibilityProblems, explainMatch,
  lengthProblem, move, type MenteeRequest, type MentorProfile, type Pairing,
} from './mentorship';

const TODAY = '2026-09-28';
const trained = { listening: '2026-08-01', humility: '2026-08-01', escalation: '2026-08-01', privacy: '2026-08-01' };

const mentor = (over: Partial<MentorProfile> = {}): MentorProfile => ({
  id: 'm1', name: 'Jordan', programs: ['transfer_transition'], topics: ['Study habits', 'Campus jobs'], availability: ['Tue evening', 'Thu evening'],
  languages: ['English'], format: 'either', training: trained, conductAcknowledgedOn: '2026-08-02', livedExperience: ['Transferred in from a community college'], capacity: 2, ...over,
});

const request = (over: Partial<MenteeRequest> = {}): MenteeRequest => ({
  id: 'r1', program: 'transfer_transition', goal: 'Get my credits mapped and find a study rhythm', topics: ['Study habits'], availability: ['Thu evening'],
  format: 'online', languages: ['English'], ...over,
});

describe('programmes and mentors', () => {
  it('seven programmes, each bounded in weeks and scoped, and none for what a mentor is not', () => {
    expect(PROGRAMS).toHaveLength(7);
    for (const p of PROGRAMS) {
      expect(p.weeks[0]).toBeLessThan(p.weeks[1]);
      expect(p.weeks[1]).toBeLessThanOrEqual(16);
      for (const out of OUT_OF_SCOPE) expect(p.scope.toLowerCase(), p.id).not.toContain(out);
    }
    expect(MENTOR_BOUNDARY).toMatch(/cannot make official academic, legal, medical/);
  });

  it('a mentor is offered only trained, acknowledged, in a programme, with capacity — and training expires', () => {
    expect(eligibilityProblems(mentor(), TODAY)).toEqual([]);
    expect(eligibilityProblems(mentor({ training: { ...trained, escalation: undefined } }), TODAY)).toEqual(['training not complete: Escalation and referral']);
    expect(eligibilityProblems(mentor({ conductAcknowledgedOn: null, programs: [], capacity: 0 }), TODAY)).toHaveLength(3);
    const stale = mentor({ training: { ...trained, privacy: '2025-06-01' } });
    expect(eligibilityProblems(stale, TODAY)).toEqual(['training due for renewal: Confidentiality and privacy']);
    expect(RENEWAL_DAYS).toBe(365);
    expect(TRAINING_MODULES).toHaveLength(4);
  });
});

describe('matching', () => {
  it('explains every match from what both chose, and offers nothing without a reason', () => {
    const [m] = explainMatch(request(), [mentor()], TODAY);
    expect(m.why).toEqual(['You both chose: Study habits', 'Both free: Thu evening', 'Meeting format works for both of you', 'Shared language: English']);
    expect(explainMatch(request({ topics: ['Research'], availability: ['Mon'], languages: ['Spanish'], format: 'in_person' }), [mentor({ format: 'online' })], TODAY)).toEqual([]);
  });

  it('offers lived experience only when the mentee asked for it', () => {
    expect(explainMatch(request(), [mentor()], TODAY)[0].why.join(' ')).not.toMatch(/lived experience/);
    const asked = explainMatch(request({ wantsLivedExperience: ['Transferred in from a community college'] }), [mentor()], TODAY);
    expect(asked[0].why).toContain('Offers lived experience you asked for: Transferred in from a community college');
  });

  it('shows only mentors in the programme who are eligible, at most three, and never as a score', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map((n) => mentor({ id: n, name: n }));
    const out = explainMatch(request(), [...many, mentor({ id: 'x', programs: ['first_term'] }), mentor({ id: 'y', conductAcknowledgedOn: null })], TODAY);
    expect(out).toHaveLength(3);
    expect(out.map((m) => m.mentor.id)).toEqual(['a', 'b', 'c']);
    for (const m of out) expect(Object.keys(m)).toEqual(['mentor', 'why']);
  });

  it('refuses a request that carries anything on the forbidden list', () => {
    expect(FORBIDDEN_MATCH_INPUTS.length).toBeGreaterThan(20);
    for (const f of FORBIDDEN_MATCH_INPUTS) expect(() => assertMatchInputs({ [f]: 1 }), f).toThrow(/may not read/);
    expect(() => explainMatch({ ...request(), gpa: 3.2 } as MenteeRequest, [mentor()], TODAY)).toThrow(/gpa/);
    expect(() => explainMatch({ ...request(), riskScore: 0.4 } as MenteeRequest, [mentor()], TODAY)).toThrow(/risk/);
  });
});

describe('a pairing', () => {
  const pairing = (over: Partial<Pairing> = {}): Pairing => ({ id: 'p', program: 'transfer_transition', mentorId: 'm1', menteeId: 'r1', state: 'proposed', startsOn: '2026-09-01', endsOn: '2026-10-27', goal: 'x', actionItems: [], ...over });

  it('only the mentor accepts; either side ends, pauses or rematches; a closed pairing stays closed', () => {
    expect(move(pairing(), 'accepted', 'mentee').ok).toBe(false);
    expect(move(pairing(), 'accepted', 'mentor').ok).toBe(true);
    for (const by of ['mentor', 'mentee'] as const) {
      expect(move(pairing({ state: 'active' }), 'paused', by).ok).toBe(true);
      expect(move(pairing({ state: 'active' }), 'closed', by).ok).toBe(true);
      expect(move(pairing({ state: 'active' }), 'rematched', by).ok).toBe(true);
    }
    expect(PAIRING_MOVES.closed).toEqual([]);
    expect(PAIRING_MOVES.rematched).toEqual([]);
    expect(move(pairing({ state: 'closed' }), 'active', 'coordinator').ok).toBe(false);
    expect(PAIRING_STATES).toHaveLength(6);
  });

  it('is held to its programme\'s weeks', () => {
    expect(lengthProblem(pairing())).toBeNull();
    expect(lengthProblem(pairing({ endsOn: '2026-09-15' }))).toBe('Transfer transition runs 6 to 10 weeks');
    expect(lengthProblem(pairing({ endsOn: '2027-01-01' }))).toBe('Transfer transition runs 6 to 10 weeks');
  });

  it('has four check-ins dated from its start and end, and says nothing is held against a rematch', () => {
    const c = checkIns(pairing());
    expect(c.map((x) => x.id)).toEqual(['welcome', 'first_meeting', 'midpoint', 'end']);
    expect(c.map((x) => x.on)).toEqual(['2026-09-01', '2026-09-08', '2026-09-29', '2026-10-27']);
    expect(c[2].prompts).toContain('Rematch, pause or continue?');
    expect(FIRST_MEETING_AGENDA).toContain(MENTOR_BOUNDARY);
    expect(PAIRING_NOTICE[1]).toMatch(/Nothing is recorded against you/);
  });
});

describe('what a coordinator sees', () => {
  const pairings = (n: number, state: Pairing['state']) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, program: 'transfer_transition' as const, mentorId: 'm', menteeId: `r${i}`, state, startsOn: '2026-09-01', endsOn: '2026-10-27', goal: '', actionItems: [] }));

  it('counts, and withholds completion figures under the cohort floor', () => {
    const s = coordinatorSummary('transfer_transition', [mentor(), mentor({ id: 'm2', conductAcknowledgedOn: null })], [request(), request({ id: 'r9' })], [...pairings(4, 'active'), ...pairings(1, 'proposed')], TODAY, () => '2026-09-01', () => true);
    expect(s).toMatchObject({ applications: 2, trainedMentors: 1, waiting: 1, unaccepted: 1, active: 4, rematches: 0 });
    expect(s.firstMeetingCompleted).toBeNull();
    expect(s.completed).toBeNull();
    expect(UNACCEPTED_DAYS).toBe(7);
  });

  it('shows a figure once the floor is reached', () => {
    const s = coordinatorSummary('transfer_transition', [mentor()], [], pairings(MIN_COHORT, 'active'), TODAY, () => TODAY, () => true);
    expect(s.firstMeetingCompleted).toBe(MIN_COHORT);
    expect(s.unaccepted).toBe(0);
  });
});
