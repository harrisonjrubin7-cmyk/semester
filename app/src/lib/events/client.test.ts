import { describe, expect, it } from 'vitest';
import { canManageEvents, standing } from './client';

describe('who manages events', () => {
  const grants = [
    { capability: 'events:manage', scopeKind: 'school', scopeId: 'vu' },
    { capability: 'events:manage', scopeKind: 'school', scopeId: 'other' },
    { capability: 'events:manage', scopeKind: 'course', scopeId: 'vu' },
  ];
  it('is exactly events:manage over this school', () => {
    expect(canManageEvents(grants, 'vu')).toBe(true);
    expect(canManageEvents(grants.slice(1), 'vu')).toBe(false);
    expect(canManageEvents(grants, '')).toBe(false);
    expect(canManageEvents([grants[2]], 'vu')).toBe(false);
  });
});

describe('where a person stands on an event', () => {
  it('says going, waiting, full, or nothing', () => {
    expect(standing({ myStatus: 'going', capacity: 2, going: 2 })).toBe('You are going.');
    expect(standing({ myStatus: 'waitlisted', capacity: 2, going: 2 })).toContain('waitlist');
    expect(standing({ myStatus: null, capacity: 2, going: 2 })).toBe('Full: you would join the waitlist.');
    expect(standing({ myStatus: null, capacity: 2, going: 1 })).toBe('');
    expect(standing({ myStatus: null, capacity: null, going: 50 })).toBe('');
    expect(standing({ myStatus: 'cancelled', capacity: 2, going: 1 })).toBe('');
  });
});
