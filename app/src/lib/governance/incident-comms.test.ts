import { describe, expect, it } from 'vitest';
import { AUDIENCE_LABEL, AUDIENCES, compose, SECTIONS, type Audience, type Section } from './incident-comms';

const facts: Record<Section, string> = {
  what_happened: 'Semester could not load Today between 09:10 and 09:40 CT.',
  who_is_affected: 'Students at the pilot school using the web app.',
  what_is_impacted: 'Today and Plan did not load. No data was lost or exposed.',
  what_to_do_now: 'Check deadlines in Brightspace until the next update.',
  what_semester_is_doing: 'We rolled back the 09:05 release and are watching error rates.',
  next_update: 'By 10:30 CT.',
  where_to_get_help: 'help@semester.example or the campus help desk.',
};

describe('incident communications', () => {
  it('covers the eleven audiences with approvers and an update cadence', () => {
    expect(Object.keys(AUDIENCE_LABEL)).toHaveLength(11);
    for (const a of Object.keys(AUDIENCE_LABEL) as Audience[]) {
      expect(AUDIENCES[a].approvers.length, a).toBeGreaterThan(0);
      expect(AUDIENCES[a].updateEveryMinutes, a).toBeGreaterThan(0);
    }
  });

  it('composes a message with all seven sections in order', () => {
    const m = compose('admin_outage', facts);
    if (!m.ok) throw new Error(JSON.stringify(m));
    let at = -1;
    for (const s of SECTIONS) {
      const i = m.body.indexOf(facts[s]);
      expect(i, s).toBeGreaterThan(at);
      at = i;
    }
  });

  it('refuses a missing section, a left-in placeholder, speculation, and a missing audience line', () => {
    const { next_update: _n, ...short } = facts;
    expect(compose('admin_outage', short)).toMatchObject({ ok: false, missing: ['next_update'] });
    expect(compose('admin_outage', { ...facts, who_is_affected: '[TENANT / COHORT]' }).ok).toBe(false);
    expect(compose('admin_outage', { ...facts, what_happened: 'We believe a cache failed.' }).ok).toBe(false);
    expect(compose('student_outage', facts).ok).toBe(false);
    expect(compose('student_outage', facts, 'If a deadline was affected, contact your instructor.').ok).toBe(true);
  });
});
