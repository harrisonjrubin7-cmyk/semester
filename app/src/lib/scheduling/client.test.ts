import { describe, expect, it } from 'vitest';
import { overlaps, schedulingCapabilities, toInstant } from './client';

describe('which scheduling capabilities a person holds', () => {
  const grants = [
    { capability: 'space:manage', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'timetable:publish', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'space:approve', scopeKind: 'school', scopeId: 'other' },
    { capability: 'space:manage', scopeKind: 'course', scopeId: 'vu' },
    { capability: 'aid:read', scopeKind: 'school', scopeId: 'vu' },
  ];
  it('reads only space and timetable capabilities over exactly this school', () => {
    expect([...schedulingCapabilities(grants, 'vu')].sort()).toEqual(['space:manage', 'timetable:publish']);
    expect(schedulingCapabilities(grants, '').size).toBe(0);
  });
});

describe('bookings in time', () => {
  const a = { startsAt: '2026-10-05T09:00:00Z', endsAt: '2026-10-05T11:00:00Z' };
  it('overlap when they share time, not when one ends as the other begins', () => {
    expect(overlaps(a, { startsAt: '2026-10-05T10:00:00Z', endsAt: '2026-10-05T12:00:00Z' })).toBe(true);
    expect(overlaps(a, { startsAt: '2026-10-05T11:00:00Z', endsAt: '2026-10-05T12:00:00Z' })).toBe(false);
    expect(overlaps(a, { startsAt: '2026-10-05T08:00:00Z', endsAt: '2026-10-05T09:00:00Z' })).toBe(false);
  });
  it('turns a typed date and time into an instant, or null', () => {
    expect(toInstant('2026-10-05', '14:30')).toMatch(/^2026-10-05T|2026-10-0[45]T/);
    expect(toInstant('2026-10-05', '9:05')).not.toBeNull();
    for (const [d, t] of [['', '09:00'], ['2026-10-05', ''], ['10/05/2026', '09:00'], ['2026-13-45', '09:00']]) expect(toInstant(d, t), `${d} ${t}`).toBeNull();
  });
});
