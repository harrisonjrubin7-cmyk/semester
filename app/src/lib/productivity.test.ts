import { describe, expect, it } from 'vitest';
import {
  EMPTY_PRODUCTIVITY,
  advisorPacket,
  newDecision,
  newOption,
  readProductivity,
  readiness,
  supportedFit,
  currentEvidence,
  withAssumption,
} from './productivity';
describe('private decision support', () => {
  it('excludes unknowns and reports coverage independently of supported fit', () => {
    const d = newDecision('Course');
    const o = newOption('A');
    o.fits[d.criteria[0].id] = {
      fit: 'strong',
      explanation: 'Catalog',
      source: 'Registrar',
      checked: '2026-10-01',
    };
    expect(supportedFit(o, d.criteria)).toEqual({
      fit: 1,
      coverage: 3 / 17,
      unknown: 6,
    });
    expect(supportedFit(newOption('B'), d.criteria).fit).toBeNull();
  });
  it('does not let unknown evidence qualify as ready', () => {
    const d = newDecision('Course');
    d.goal = 'Finish requirement';
    d.options = [newOption('A'), newOption('B')];
    d.assumptions = [
      {
        id: 'a',
        label: 'Target',
        value: '15 credits',
        owner: 'student',
        source: '',
        impacts: '',
        review: false,
      },
    ];
    expect(readiness(d).state).toBe('Needs one source check');
    d.questions = 'Placement?';
    expect(readiness(d).state).toBe('Needs official review');
    d.paused = true;
    expect(readiness(d).state).toBe('Paused by student');
  });
  it('advisor packets exclude private reflections', () => {
    const d = newDecision('Compare');
    d.reflection = 'private journal';
    d.questions = 'Can this transfer?';
    expect(advisorPacket(d)).not.toContain('private journal');
    expect(advisorPacket(d)).toContain('Can this transfer?');
  });
  it('validates nested backups and rejects damaged data', () => {
    expect(readProductivity(EMPTY_PRODUCTIVITY)).toEqual(EMPTY_PRODUCTIVITY);
    const d = newDecision('A');
    expect(
      readProductivity({ ...EMPTY_PRODUCTIVITY, decisions: [d] }).decisions,
    ).toHaveLength(1);
    expect(() =>
      readProductivity({
        ...EMPTY_PRODUCTIVITY,
        decisions: [{ ...d, options: [null] }],
      }),
    ).toThrow();
    expect(() =>
      readProductivity({
        ...EMPTY_PRODUCTIVITY,
        journal: [{ id: 's', at: 'now', decision: null }],
      }),
    ).toThrow();
  });
});

it('expires source checks and invalidates evidence when assumptions change', () => {
  const evidence = {
    fit: 'strong' as const,
    source: 'Registrar',
    explanation: 'Confirmed',
    checked: '2026-10-01',
  };
  expect(currentEvidence(evidence, Date.parse('2026-10-02'))).toBe(true);
  expect(currentEvidence(evidence, Date.parse('2026-12-02'))).toBe(false);
  const d = newDecision('A');
  const option = newOption('B');
  option.fits[d.criteria[0].id] = evidence;
  d.options = [option];
  const a = {
    id: 'a',
    label: 'Availability',
    value: 'No Thursday afternoons',
    owner: 'student' as const,
    source: '',
    impacts: 'Schedule fit',
    review: false,
  };
  const next = withAssumption(d, a);
  expect(next.options[0].fits[d.criteria[0].id].checked).toBe('');
  expect(next.options[0].fits[d.criteria[0].id].fit).toBe('strong');
  expect(d.options[0].fits[d.criteria[0].id].checked).toBe('2026-10-01');
  d.assumptions = [{ ...a, owner: 'institution' }];
  expect(() => withAssumption(d, a)).toThrow();
});

it('uses the local calendar day for source freshness and rejects impossible dates', () => {
  const evidence = {
    fit: 'strong' as const,
    source: 'Registrar',
    explanation: '',
    checked: '2026-10-01',
  };
  expect(
    currentEvidence(evidence, new Date('2026-10-01T00:30:00').getTime()),
  ).toBe(true);
  expect(
    currentEvidence(
      { ...evidence, checked: '2026-10-02' },
      new Date('2026-10-01T23:30:00').getTime(),
    ),
  ).toBe(false);
  expect(
    currentEvidence(
      { ...evidence, checked: '2026-02-30' },
      new Date('2026-03-01T12:00:00').getTime(),
    ),
  ).toBe(false);
});
