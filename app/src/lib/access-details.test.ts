import { describe, expect, it } from 'vitest';
import type { Grant } from './capabilities';
import { ACCESS_LIMITS, explainAccess } from './access-details';

const g = (capability: string, scopeKind: string, scopeId: string): Grant => ({ capability, scopeKind, scopeId });

const course = { kind: 'course', id: 'bio-101' };

describe('explainAccess', () => {
  it('opens a place when the same capability is held at the same scope', () => {
    const d = explainAccess([g('grades:enter', 'course', 'bio-101')], 'grades:enter', course);
    expect(d.allowed).toBe(true);
    expect(d.because).toEqual(['You hold grades:enter for course bio-101.']);
    expect(d.elsewhere).toEqual([]);
  });

  it('does not open a place from the same capability at another scope', () => {
    const d = explainAccess([g('grades:enter', 'course', 'bio-102')], 'grades:enter', course);
    expect(d.allowed).toBe(false);
    expect(d.because).toEqual([]);
    expect(d.elsewhere).toEqual([{ kind: 'course', id: 'bio-102' }]);
  });

  it('does not let a platform grant open a school or course, matching has_capability', () => {
    const d = explainAccess([g('grades:enter', 'platform', 'bio-101')], 'grades:enter', course);
    expect(d.allowed).toBe(false);
  });

  it('does not open a place from a different capability at the same scope', () => {
    const d = explainAccess([g('grades:moderate', 'course', 'bio-101')], 'grades:enter', course);
    expect(d.allowed).toBe(false);
    expect(d.elsewhere).toEqual([]);
  });

  it('refuses an empty scope id and an empty capability rather than matching them', () => {
    expect(explainAccess([g('grades:enter', 'course', '')], 'grades:enter', { kind: 'course', id: '' }).allowed).toBe(false);
    expect(explainAccess([g('', 'course', 'bio-101')], '', course).allowed).toBe(false);
  });

  it('lists each place once when two grants repeat it', () => {
    const grants = [g('grades:enter', 'course', 'bio-101'), g('grades:enter', 'course', 'bio-101')];
    expect(explainAccess(grants, 'grades:enter', course).because).toHaveLength(1);
    const other = [g('grades:enter', 'course', 'bio-9'), g('grades:enter', 'course', 'bio-9')];
    expect(explainAccess(other, 'grades:enter', course).elsewhere).toHaveLength(1);
  });

  it('always states what the explanation cannot tell, open or closed', () => {
    expect(explainAccess([g('grades:enter', 'course', 'bio-101')], 'grades:enter', course).limits).toEqual([...ACCESS_LIMITS]);
    expect(explainAccess([], 'grades:enter', course).limits).toEqual([...ACCESS_LIMITS]);
    expect(ACCESS_LIMITS.join(' ')).toMatch(/does not give you access/);
  });
});
