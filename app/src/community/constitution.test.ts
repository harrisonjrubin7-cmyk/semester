import { describe, expect, it } from 'vitest';
import { DISCIPLINE_BOUNDARY, FIELDS, REQUIRED, SECTIONS, acknowledge, amend, draft, missing, readyToAdopt, unknownFields } from './constitution';
import { NOT_AN_EMERGENCY_SERVICE } from './governance';

const filled = () => {
  const c = draft('chess-club');
  const fields: Record<string, string> = {};
  for (const id of REQUIRED) fields[id] = c.fields[id] ?? `Written: ${id}`;
  return { ...c, fields: { ...c.fields, ...fields } };
};

describe('the template', () => {
  it('has the eleven sections in the blueprint\'s order, with every field id unique', () => {
    expect(SECTIONS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(SECTIONS.map((s) => s.title)).toEqual([
      'Organization identity', 'Mission and purpose', 'Membership', 'Governance and officer roles', 'Meetings and decisions',
      'Events and activities', 'Finance and assets', 'Conduct, safety and privacy', 'Digital tools and communications',
      'Amendments, renewal and dissolution', 'Acknowledgements',
    ]);
    expect(new Set(FIELDS.map((f) => f.id)).size).toBe(FIELDS.length);
    for (const f of FIELDS) expect(f.label.length, f.id).toBeGreaterThan(3);
  });

  it('a draft already carries the two boundary sentences', () => {
    const c = draft('x');
    expect(c.version).toBe(1);
    expect(c.fields.no_emergency).toBe(NOT_AN_EMERGENCY_SERVICE);
    expect(c.fields.discipline_boundary).toBe(DISCIPLINE_BOUNDARY);
    expect(missing(c)).toContain('mission');
    expect(missing(c)).not.toContain('no_emergency');
  });
});

describe('adoption', () => {
  const signed = (c = filled()) => acknowledge(acknowledge(c, { by: 'p', seat: 'officer', on: '2026-09-28' }), { by: 't', seat: 'officer', on: '2026-09-28' });

  it('needs every required field, two officers, and the advisor when required', () => {
    expect(readyToAdopt(filled(), { advisorRequired: false }).problems).toEqual(['at least two officers must sign']);
    expect(readyToAdopt(signed(), { advisorRequired: false })).toEqual({ ready: true, problems: [] });
    expect(readyToAdopt(signed(), { advisorRequired: true }).problems).toEqual(['the advisor has not acknowledged it']);
    expect(readyToAdopt(acknowledge(signed(), { by: 'dr', seat: 'advisor', on: '2026-09-28' }), { advisorRequired: true }).ready).toBe(true);
  });

  it('the same person signing twice is one signature', () => {
    const c = acknowledge(acknowledge(filled(), { by: 'p', seat: 'officer', on: '2026-09-28' }), { by: 'p', seat: 'officer', on: '2026-09-29' });
    expect(c.acknowledgements).toHaveLength(1);
    expect(readyToAdopt(c, { advisorRequired: false }).ready).toBe(false);
  });

  it('refuses a boundary sentence written away, and a field the template does not have', () => {
    const c = signed({ ...filled(), fields: { ...filled().fields, no_emergency: 'We respond to every emergency, day or night.', discipline_boundary: 'The board may expel anyone.' } });
    const v = readyToAdopt(c, { advisorRequired: false });
    expect(v.problems).toContain('the no-emergency-service notice was changed');
    expect(v.problems).toContain('the disciplinary boundary was changed');
    const extra = { ...filled(), fields: { ...filled().fields, member_gpa_minimum: '3.0' } };
    expect(unknownFields(extra)).toEqual(['member_gpa_minimum']);
    expect(readyToAdopt(signed(extra), { advisorRequired: false }).problems).toContain('fields the template does not have: member_gpa_minimum');
  });
});

describe('amendment', () => {
  it('makes a new version, keeps the old one with its reason, and drops the signatures', () => {
    const c = acknowledge(filled(), { by: 'p', seat: 'officer', on: '2026-09-28' });
    const next = amend(c, { quorum: 'Half of voting members' }, 'p', 'Quorum was unreachable at a third of members.', '2026-10-02');
    expect(next.version).toBe(2);
    expect(next.fields.quorum).toBe('Half of voting members');
    expect(next.acknowledgements).toEqual([]);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({ version: 1, amendedBy: 'p', on: '2026-10-02' });
    expect(next.history[0].fields.quorum).toBe(c.fields.quorum);
  });

  it('refuses an amendment with no reason or no change', () => {
    expect(() => amend(filled(), { quorum: 'x' }, 'p', 'because', '2026-10-02')).toThrow(/says why/);
    expect(() => amend(filled(), {}, 'p', 'A reason of adequate length.', '2026-10-02')).toThrow(/changes something/);
  });
});
