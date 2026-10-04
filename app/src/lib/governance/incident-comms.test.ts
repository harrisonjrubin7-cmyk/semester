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
  it('covers the thirteen audiences with approvers and an update cadence', () => {
    expect(Object.keys(AUDIENCE_LABEL)).toHaveLength(13);
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

  it('refuses a missing section, a left-in placeholder of either case, and speculation', () => {
    const { next_update: _n, ...short } = facts;
    expect(compose('admin_outage', short)).toMatchObject({ ok: false, missing: ['next_update'] });
    expect(compose('admin_outage', { ...facts, who_is_affected: '[TENANT / COHORT]' }).ok).toBe(false);
    expect(compose('admin_outage', { ...facts, who_is_affected: 'Students at [school].' }).ok).toBe(false);
    expect(compose('admin_outage', { ...facts, where_to_get_help: 'See [the status page](https://status.example).' }).ok).toBe(true);
    expect(compose('admin_outage', { ...facts, what_happened: 'We believe a cache failed.' }).ok).toBe(false);
  });

  it('requires each audience field by name, not any line of text', () => {
    expect(compose('student_outage', facts).ok).toBe(false);
    expect(compose('integration_delay', facts, { source_system: 'foo' }).ok).toBe(false);
    const sync = compose('integration_delay', facts, { source_system: 'Banner SIS', last_successful_sync: '06:00 CT' });
    if (!sync.ok) throw new Error(JSON.stringify(sync));
    expect(sync.body).toContain('Last successful sync\n06:00 CT');
    expect(compose('security', facts, { data_exposure: 'probably fine' }).ok).toBe(false);
    expect(compose('security', facts, { data_exposure: 'Not indicated' }).ok).toBe(true);
    expect(compose('student_outage', facts, { deadline_contact: '[instructor]' }).ok).toBe(false);
  });

  it('a launch delay names the check not yet complete and whether anything changed', () => {
    expect(compose('launch_delay', facts).ok).toBe(false);
    expect(compose('launch_delay', facts, { gate_pending: 'Accessibility review' }).ok).toBe(false);
    expect(compose('launch_delay', facts, { gate_pending: 'Accessibility review', data_changed: 'Maybe' }).ok).toBe(false);
    expect(compose('launch_delay', facts, { gate_pending: '[the check]', data_changed: 'No' }).ok).toBe(false);
    const m = compose('launch_delay', facts, { gate_pending: 'Accessibility review', data_changed: 'No' });
    if (!m.ok) throw new Error(JSON.stringify(m));
    expect(m.subject).toBe('Semester — Launch delay');
    expect(m.body).toContain('Check not yet complete\nAccessibility review');
    expect(AUDIENCES.launch_delay.approvers).toEqual(['Founder']);
  });

  it('a change notice says when it takes effect, whether work is affected, and needs privacy and counsel', () => {
    expect(compose('change_notice', facts).ok).toBe(false);
    expect(compose('change_notice', facts, { effective_date: '1 November', work_affected: 'Not sure' }).ok).toBe(false);
    expect(compose('change_notice', facts, { effective_date: '[date]', work_affected: 'No' }).ok).toBe(false);
    const m = compose('change_notice', facts, { effective_date: '1 November', work_affected: 'No' });
    if (!m.ok) throw new Error(JSON.stringify(m));
    expect(m.body).toContain('Takes effect\n1 November');
    expect(AUDIENCES.change_notice.approvers).toEqual(['Product owner', 'Privacy owner', 'Legal']);
  });
});
