import { describe, expect, it } from 'vitest';
import { DEAL_POLICY } from '../governance/deal-desk';
import {
  COHORT_MAX,
  LIFECYCLE,
  advanceProblems,
  charterProblems,
  salesMoveProblems,
  type PilotCharter,
  type PilotState,
} from './pilot';

/**
 * The pilot's rules, each broken on its own from a charter that passes them
 * all. The first test is that control: if the good charter ever reads as
 * wrong, every refusal below means nothing.
 */

function charter(): PilotCharter {
  return {
    institution: 'Example State University',
    champion: { role: 'Associate Provost for Student Success', atInstitution: true },
    cohort: { description: 'Incoming transfer students, fall', size: 120 },
    months: 4,
    modules: ['today', 'path-and-plan', 'human-help'],
    dataScope: ['account-and-affiliation', 'published-catalog', 'student-entered', 'aggregate-usage'],
    sources: [{ name: 'Academic calendar', owner: 'Registrar', freshness: 'weekly' }],
    integrations: [],
    metrics: [
      { name: 'Weekly active share of cohort', source: 'activity, cohort aggregate', baseline: null, target: 0.6, unit: 'share' },
      { name: 'Registration plans completed before window opens', source: 'aggregate-usage', baseline: 0.3, target: 0.6, unit: 'share' },
    ],
    responsibilities: { semester: ['Configure tenant', 'Weekly report'], institution: ['Recruit cohort', 'Name source owners'] },
    reviews: { security: true, privacy: true, accessibility: true },
    support: { hours: 'Weekdays 9–5 CT', contact: 'Pilot support queue' },
    decisions: ['expand', 'extend', 'stop'],
    conversion: 'Annual department licence at the deal desk tier, decided at week 14.',
  };
}

const with_ = (over: Partial<PilotCharter>) => ({ ...charter(), ...over });

describe('a pilot charter', () => {
  it('passes when it says everything the command asks — the control', () => {
    expect(charterProblems(charter())).toEqual([]);
  });

  it('needs a champion who is at the institution', () => {
    expect(charterProblems(with_({ champion: null }))[0]).toMatch(/champion/);
    expect(charterProblems(with_({ champion: { role: 'Semester AE', atInstitution: false } }))[0]).toMatch(/at the institution/);
  });

  it('refuses forbidden data by name, and anything not on the approved list', () => {
    expect(charterProblems(with_({ dataScope: ['student grades'] }))).toEqual([
      'Data scope asks for grades, which no pilot may use through a generic flow.',
    ]);
    expect(charterProblems(with_({ dataScope: ['financial aid status'] }))[0]).toMatch(/financial aid/);
    expect(charterProblems(with_({ dataScope: ['lms-clickstream'] }))[0]).toMatch(/not an approved pilot data class/);
  });

  it('refuses a metric about individual students', () => {
    for (const name of ['At-risk students flagged', 'GPA change per student', 'Early alert volume']) {
      const problems = charterProblems(with_({ metrics: [{ name, source: 'x', baseline: 0, target: 1, unit: 'n' }] }));
      expect(problems.some((p) => p.includes('measures individual students')), name).toBe(true);
    }
  });

  it('keeps to the deal desk’s pilot length, so the two cannot disagree', () => {
    expect(charterProblems(with_({ months: DEAL_POLICY.maxPilotMonths }))).toEqual([]);
    expect(charterProblems(with_({ months: DEAL_POLICY.maxPilotMonths + 1 }))[0]).toMatch(/months under the deal desk/);
  });

  it('bounds the cohort between reportable and supportable', () => {
    expect(charterProblems(with_({ cohort: { description: 'x', size: COHORT_MAX + 1 } }))[0]).toMatch(/at most/);
    expect(charterProblems(with_({ cohort: { description: 'x', size: 6 } }))[0]).toMatch(/without identifying people/);
  });

  it('needs "stop" to be a real outcome', () => {
    expect(charterProblems(with_({ decisions: ['expand', 'extend'] }))).toEqual([
      '"Stop" must be a real outcome, or the criteria were decoration.',
    ]);
  });

  it('needs an owner and a freshness commitment for every source', () => {
    expect(charterProblems(with_({ sources: [{ name: 'Catalog', owner: '', freshness: '' }] }))).toHaveLength(2);
  });
});

describe('the pilot lifecycle', () => {
  const ready = (): PilotState => ({
    charterSigned: true, charter: charter(), goNoGo: 'go', tenantConfigured: true, trainingDone: true,
    supportRoutingLive: true, baselineMeasured: true, weeksLive: 3, outcomesMeasured: true,
  });

  it('walks every stage in order from a state that meets each gate — the control', () => {
    for (let i = 0; i < LIFECYCLE.length - 1; i++) {
      expect(advanceProblems(LIFECYCLE[i], LIFECYCLE[i + 1], ready()), LIFECYCLE[i + 1]).toEqual([]);
    }
  });

  it('moves one stage at a time', () => {
    expect(advanceProblems('configure', 'launch', ready())[0]).toMatch(/one stage at a time/);
    expect(advanceProblems('launch', 'train', ready())[0]).toMatch(/one stage at a time/);
  });

  it('will not configure on an unsigned or faulty charter', () => {
    expect(advanceProblems('discovery', 'configure', { ...ready(), charterSigned: false })).toEqual(['The charter is not signed.']);
    const bad = { ...ready(), charter: with_({ decisions: ['expand'] }) };
    expect(advanceProblems('discovery', 'configure', bad)[0]).toMatch(/^Charter: "Stop"/);
  });

  it('will not launch without a baseline, support, training and the council’s go', () => {
    const none = { ...ready(), trainingDone: false, supportRoutingLive: false, baselineMeasured: false, goNoGo: 'no-go' as const };
    expect(advanceProblems('train', 'launch', none)).toHaveLength(4);
    expect(advanceProblems('train', 'launch', { ...ready(), goNoGo: null })).toEqual(['The launch council has not returned go for this cohort.']);
  });

  it('decides only on measured outcomes', () => {
    expect(advanceProblems('learn', 'decide', { ...ready(), outcomesMeasured: false })[0]).toMatch(/not measured/);
  });
});

describe('sales stages', () => {
  it('lets an opportunity step forward and close from anywhere — the control', () => {
    expect(salesMoveProblems('target_account', 'discovery')).toEqual([]);
    expect(salesMoveProblems('proposal', 'closed_lost')).toEqual([]);
  });

  it('refuses a skip over a gated stage, and names the gate', () => {
    const skip = salesMoveProblems('discovery', 'proposal');
    expect(skip.some((p) => p.startsWith('Skips qualified'))).toBe(true);
    expect(skip.some((p) => p.startsWith('Skips outcome_workshop'))).toBe(true);
  });

  it('never goes live without passing the contract and the council', () => {
    expect(salesMoveProblems('proposal', 'live').map((p) => p.split(':')[0])).toEqual([
      'Skips pilot_or_implementation_SOW', 'Skips contracted',
    ]);
  });

  it('does not move backwards or reopen a lost deal', () => {
    expect(salesMoveProblems('proposal', 'discovery')[0]).toMatch(/comes before/);
    expect(salesMoveProblems('closed_lost', 'discovery')[0]).toMatch(/new target account/);
  });
});
