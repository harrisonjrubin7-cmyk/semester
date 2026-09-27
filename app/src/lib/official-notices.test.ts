import { describe, expect, it } from 'vitest';
import { officialMessages } from './official-notices';
import { admit, visible, EMPTY_PREFS } from './comms';
import type { Fact, SchoolRecordsView } from './integration/school-records';

/**
 * The school's facts as hub messages. The control is the first case: a current
 * emergency must reach Required. A mapping that never said Required would pass
 * every "is not Required" case below and be useless in an emergency.
 */

const NOW = new Date('2026-09-28T15:00:00Z');

const fact = (id: string, text: string, patch: Partial<Fact> = {}): Fact => ({
  id, text, source: 'Public safety', freshness: 'live', official: true, link: 'https://safety.example.edu/alert', mine: false, ...patch,
});

const view = (patch: Partial<SchoolRecordsView>): SchoolRecordsView => ({
  readiness: 'unknown', window: null, holds: [], enrollment: null, requirements: null, alerts: [], appointment: null,
  referrals: [], actions: [], opportunity: null, event: null, empty: false, ...patch,
});

const shown = (v: SchoolRecordsView) => admit(officialMessages(v, NOW)).shown;

describe('official notices', () => {
  it('lets a current emergency alert say Required — THE CONTROL', () => {
    const [m] = shown(view({ alerts: [fact('e', 'Emergency: shelter in place', { caveat: 'Follow Public safety for anything urgent.' })] }));
    expect(m).toMatchObject({ channel: 'official', priority: 'required', source: 'Public safety', url: 'https://safety.example.edu/alert' });
    expect(m.body).toContain('Follow Public safety for anything urgent.');
    expect(m.sourceLabel).toBe('institution_verified');
  });

  it('never lets a stale emergency say Required, and says it is not current', () => {
    const [m] = shown(view({ alerts: [fact('e', 'Emergency: shelter in place', { official: false, freshness: 'stale' })] }));
    expect(m.priority).toBe('high');
    expect(m.body).toContain('Not the official current record');
    expect(m.sourceLabel).toBe('needs_review');
  });

  it('lets only a current blocking hold say Required among holds', () => {
    const out = shown(view({
      holds: [
        fact('b', 'Action required before you can register — Bursar', { source: 'Bursar' }),
        fact('n', 'Action required — Health center', { source: 'Health center' }),
        fact('s', 'Action required before you can register — Registrar', { source: 'Registrar', official: false, freshness: 'stale' }),
      ],
    }));
    const p = (id: string) => out.find((m) => m.id === `official:hold:${id}`)!.priority;
    expect([p('b'), p('n'), p('s')]).toEqual(['required', 'high', 'high']);
  });

  it('keeps advisories, actions, referrals, windows and appointments below Required', () => {
    const out = shown(view({
      alerts: [fact('a', 'Advisory: icy walkways'), fact('i', 'Notice: library hours change')],
      actions: [fact('x', 'An action from Bursar — due Fri Oct 2', { source: 'Bursar' })],
      referrals: [fact('r', 'Advising asked to hear from you', { source: 'Advising' })],
      window: fact('w', 'Registration opens Mon Nov 2', { source: 'Registrar' }),
      appointment: fact('ap', 'Advising appointment Tue Sep 29', { source: 'Advising' }),
    }));
    expect(out.every((m) => m.priority !== 'required')).toBe(true);
    expect(out.find((m) => m.id === 'official:alert:a')!.priority).toBe('high');
    expect(out.find((m) => m.id === 'official:alert:i')!.priority).toBe('normal');
    expect(out).toHaveLength(6);
  });

  it('drops a link that is not https', () => {
    const [m] = shown(view({ alerts: [fact('e', 'Advisory: storm', { link: 'http://insecure.example.edu' })] }));
    expect(m.url).toBeUndefined();
  });

  it('shows a current emergency through mute and quiet hours, and holds a stale one', () => {
    const out = shown(view({ alerts: [fact('c', 'Emergency: now'), fact('s', 'Emergency: earlier', { official: false, freshness: 'stale' })] }));
    const late = visible(out, { ...EMPTY_PREFS, muted: ['official'] }, 23 * 60);
    expect(late.now.map((m) => m.id)).toEqual(['official:alert:c']);
  });
});
