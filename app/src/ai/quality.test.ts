import { describe, expect, it } from 'vitest';
import { isKind } from '../lib/feedback';
import { REASONS, policyState, quality, sourceStrength, sourcesRead } from './quality';

const grounded = { mode: 'grounded' as const, says: 'Using: your courses', because: '', screens: [] };
const app = { mode: 'app' as const, says: 'About the app', because: '', screens: ['help'] };
const general = { mode: 'general' as const, says: 'General', because: '', screens: [] };

describe('answer quality', () => {
  it('rates the source by what was actually read, never by the mode alone', () => {
    expect(sourceStrength(grounded, 3)).toBe('strong');
    expect(sourceStrength(grounded, 0)).toBe('limited');
    expect(sourceStrength(app, 0)).toBe('limited');
    expect(sourceStrength(general, 5)).toBe('none');
    expect(sourceStrength(null, 5)).toBe('none');
  });

  it('reads the policy state from the help state the composer already obeys', () => {
    expect(policyState({ kind: 'ready' })).toBe('allowed');
    expect(policyState({ kind: 'course-off', course: 'ECON 1020', instead: [] })).toBe('limited');
    expect(policyState({ kind: 'school-off' })).toBe('unavailable');
    expect(policyState({ kind: 'unreachable' })).toBe('unavailable');
    expect(policyState({ kind: 'checking' })).toBe('unavailable');
  });

  it('says what it can support, what it cannot, and what needs a person', () => {
    const q = quality({ read: grounded, help: { kind: 'ready' }, sources: 2 });
    expect(q.source.says).toMatch(/^Strong source/);
    expect(q.policy.says).toMatch(/^Allowed/);
    expect(q.can).toContain('your material');
    expect(q.cannot).toContain('grades of record');
    expect(q.confirm).toContain('official record');
    const banned = quality({ read: general, help: { kind: 'course-off', course: 'x', instead: [] }, sources: 0 });
    expect(banned.source.says).toMatch(/^No source/);
    expect(banned.confirm).toContain('instructor');
  });

  it('offers six reasons: two kept on the device, four that open a real report', () => {
    expect(REASONS.map((r) => r.id)).toEqual(['helpful', 'not-helpful', 'incorrect', 'source', 'policy', 'accessibility']);
    expect(REASONS.filter((r) => !r.report)).toHaveLength(2);
    for (const r of REASONS.filter((r) => r.report)) {
      expect(isKind(r.report!.kind), r.id).toBe(true);
      expect(r.report!.note.endsWith(': '), r.id).toBe(true);
    }
  });

  it('counts material read, never the generic context lines', () => {
    const generic = ["today's date", 'the active term', 'which screen you are on', 'what this screen is showing'];
    expect(sourcesRead(generic, 0)).toBe(0);
    expect(sourceStrength(grounded, sourcesRead(generic, 0))).toBe('limited');
    expect(sourcesRead([...generic, 'ECON 1020 study material', 'PSCI 1100 study material'], 0)).toBe(2);
    expect(sourcesRead(generic, 3)).toBe(3);
    expect(sourceStrength(grounded, sourcesRead(['ECON 1020 study material'], 0))).toBe('strong');
  });
});
