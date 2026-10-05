import { describe, expect, it } from 'vitest';
import { sameSessionScope } from './session';

describe('Semester Intelligence session scope', () => {
  it('keeps context only for the same tenant, role and person', () => {
    expect(
      sameSessionScope(
        { tenantId: 'northstar', role: 'student', personId: 'nora' },
        { tenantId: 'northstar', role: 'student', personId: 'nora' },
      ),
    ).toBe(true);
  });

  it('invalidates a conversation context when tenant changes', () => {
    expect(
      sameSessionScope(
        { tenantId: 'northstar', role: 'student', personId: 'nora' },
        { tenantId: 'cedar', role: 'student', personId: 'nora' },
      ),
    ).toBe(false);
  });

  it('invalidates a conversation context when person or role changes', () => {
    const current = { tenantId: 'northstar', role: 'student', personId: 'nora' };
    expect(sameSessionScope(current, { ...current, personId: 'sam' })).toBe(false);
    expect(sameSessionScope(current, { ...current, role: 'faculty' })).toBe(false);
  });
});
