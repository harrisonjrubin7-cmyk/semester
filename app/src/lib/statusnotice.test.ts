import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { live, noticesFor, readIncidents, say, type Incident } from './statusnotice';

const NOW = Date.UTC(2026, 8, 28, 12);
const H = 60 * 60 * 1000;

const incident = (over: Partial<Incident> = {}): Incident => ({
  id: 'i1',
  date: '2026-09-28',
  title: 'Course source sync delayed',
  status: 'identified',
  kind: 'incident',
  screens: ['calendar'],
  from: NOW - H,
  until: null,
  affects: 'Course source sync is delayed.',
  still: 'Your saved plan is still available.',
  ...over,
});

describe('service notices', () => {
  it('reads the file the status page reads, old shape and new', () => {
    const real = JSON.parse(readFileSync(join(import.meta.dirname, '../../public/status-incidents.json'), 'utf8'));
    expect(readIncidents(real)).toEqual([]);
    const [old] = readIncidents({ incidents: [{ date: '2026-09-01', title: 'Slow sign-in', status: 'resolved' }] });
    expect(old).toMatchObject({ kind: 'incident', screens: [], from: null, until: null, status: 'resolved' });
    const [full] = readIncidents({ incidents: [{ id: 'm1', date: '2026-10-03', title: 'Calendar sync maintenance', status: 'scheduled', kind: 'maintenance', screens: ['calendar'], from: '2026-10-03T06:00:00Z', until: '2026-10-03T07:00:00Z', affects: 'Calendar sync will be unavailable Saturday 1–2 AM Central.', still: 'No action required.' }] });
    expect(full.kind).toBe('maintenance');
    expect(full.screens).toEqual(['calendar']);
    expect(full.until).toBe(Date.UTC(2026, 9, 3, 7));
    // The shape scripts/status-history.mjs validates, which is what an operator posts now.
    const recorded = (over: Record<string, unknown> = {}) => ({
      id: 'checkout-slow', title: 'Checkout is slow', components: ['checkout'], impact: 'partial',
      started: '2026-10-05T10:00:00Z', resolved: null,
      updates: [{ at: '2026-10-05T10:00:00Z', status: 'investigating', body: 'Plus checkout is answering slowly.' }, { at: '2026-10-05T10:30:00Z', status: 'identified', body: 'We have found the cause.' }],
      ...over,
    });
    const [open] = readIncidents({ incidents: [recorded()] });
    expect(open).toMatchObject({ id: 'checkout-slow', date: '2026-10-05', status: 'identified', kind: 'incident', screens: [], until: null, affects: 'We have found the cause.' });
    expect(open.from).toBe(Date.UTC(2026, 9, 5, 10));
    expect(live(open, Date.UTC(2026, 9, 5, 11))).toBe(true);
    const [done] = readIncidents({ incidents: [recorded({ resolved: '2026-10-05T11:00:00Z', updates: [{ at: '2026-10-05T11:00:00Z', status: 'resolved', body: 'Fixed.' }] })] });
    expect(done.status).toBe('resolved');
    expect(live(done, Date.UTC(2026, 9, 5, 12))).toBe(false);
    expect(readIncidents({ incidents: [recorded({ impact: 'maintenance' })] })[0].kind).toBe('maintenance');
    expect(readIncidents({ incidents: [{ title: 7 }, null, 'x'] })).toEqual([]);
    expect(readIncidents(null)).toEqual([]);
  });

  it('is live while open, and not once resolved or past its window', () => {
    expect(live(incident(), NOW)).toBe(true);
    expect(live(incident({ status: 'resolved' }), NOW)).toBe(false);
    expect(live(incident({ until: NOW - 1 }), NOW)).toBe(false);
    expect(live(incident({ kind: 'maintenance', from: NOW + 30 * H, until: NOW + 31 * H, status: 'scheduled' }), NOW)).toBe(false);
    expect(live(incident({ kind: 'maintenance', from: NOW + 20 * H, until: NOW + 21 * H, status: 'scheduled' }), NOW)).toBe(true);
  });

  it('shows on the screens it names, everywhere when it names none, and never elsewhere', () => {
    const all = [incident(), incident({ id: 'i2', screens: [], title: 'Sign-in slow' })];
    expect(noticesFor('calendar', all, NOW).map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(noticesFor('home', all, NOW).map((i) => i.id)).toEqual(['i2']);
    expect(noticesFor('home', [incident()], NOW)).toEqual([]);
  });

  it('says what is affected and what still works, in one line', () => {
    expect(say(incident())).toEqual({ head: 'Status', body: 'Course source sync is delayed. Your saved plan is still available.' });
    expect(say(incident({ kind: 'maintenance', affects: '', still: '' }))).toEqual({ head: 'Maintenance', body: 'Course source sync delayed No action required.' });
  });
});
