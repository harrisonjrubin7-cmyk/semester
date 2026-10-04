import { describe, expect, it } from 'vitest';
import { currentSubject, hasCapability, makeSubject } from './index';
import { legacyIdentity } from './adapters';

describe('identity', () => {
  it('treats nobody as a valid subject: signed out is a state, not an error', () => {
    expect(makeSubject({ userId: null, roleId: 'student', schoolId: null, capabilities: [] })).toEqual({
      id: null, signedIn: false, roleId: 'student', schoolId: null, capabilities: [],
    });
    expect(makeSubject({ userId: '  ', roleId: 'student', schoolId: undefined, capabilities: [] }).signedIn).toBe(false);
  });

  it('tidies capabilities: sorted, unique, and none without a school', () => {
    const over = makeSubject({ userId: 'u1', roleId: 'staff', schoolId: 's1', capabilities: ['b', 'a', 'b'] });
    expect(over.capabilities).toEqual(['a', 'b']);
    expect(hasCapability(over, 'a')).toBe(true);
    expect(hasCapability(over, 'c')).toBe(false);
    // The control: the same capabilities with no school are not held over anything.
    expect(makeSubject({ userId: 'u1', roleId: 'staff', schoolId: null, capabilities: ['a'] }).capabilities).toEqual([]);
  });

  it('is read every time, so a sign-out is seen', () => {
    let user: string | null = 'u1';
    const source = { read: () => ({ userId: user, roleId: 'student', schoolId: null, capabilities: [] }) };
    expect(currentSubject(source).signedIn).toBe(true);
    user = null;
    expect(currentSubject(source).signedIn).toBe(false);
  });
});

describe('identity: the legacy adapter', () => {
  const grants = [
    { capability: 'registrar:read', scopeKind: 'school', scopeId: 's1' },
    { capability: 'registrar:read', scopeKind: 'school', scopeId: 's1' },
    { capability: 'support:read_context', scopeKind: 'school', scopeId: 's1' },
    { capability: 'platform:admin', scopeKind: 'platform', scopeId: '' },
    { capability: 'other:school', scopeKind: 'school', scopeId: 's2' },
    { capability: 'course:grade', scopeKind: 'course', scopeId: 's1' },
  ];

  it('keeps only grants over exactly the person’s school, as lib/capabilities.forSchool does', () => {
    const subject = currentSubject(legacyIdentity(() => ({ role: 'staff', userId: 'u1', schoolId: 's1', grants })));
    expect(subject.capabilities).toEqual(['registrar:read', 'support:read_context']);
  });

  it('gives nothing to a person with no school, and the default role to one it does not recognise', () => {
    const subject = currentSubject(legacyIdentity(() => ({ role: 'wizard', userId: null, schoolId: null, grants })));
    expect(subject.capabilities).toEqual([]);
    expect(subject.roleId).toBe('student');
    expect(subject.signedIn).toBe(false);
  });
});
