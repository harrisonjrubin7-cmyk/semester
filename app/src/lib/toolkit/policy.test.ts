import { describe, expect, it } from 'vitest';
import { USES, card, fromCourse, permits, redirect, resolve, type PolicySource } from './policy';

describe('AI-use policy precedence', () => {
  const course = (blanket: PolicySource['blanket'], uses?: PolicySource['uses']): PolicySource => ({
    layer: 'course', link: '', text: '', effective: '', lastVerified: '', by: 'instructor', blanket, uses,
  });
  const assignment = (uses: PolicySource['uses']): PolicySource => ({ ...course(undefined, uses), layer: 'assignment' });

  it('shows “unavailable” when no layer says anything, and unavailable never permits', () => {
    const r = resolve('brainstorming', []);
    expect(r.state).toBe('unavailable');
    expect(permits(r.state)).toBe(false);
  });

  it('an unstated course policy produces no layer at all', () => {
    expect(fromCourse({ stance: 'unstated', note: '' })).toBeUndefined();
    expect(fromCourse(undefined)).toBeUndefined();
  });

  it('an assignment rule beats the course blanket, in both directions', () => {
    expect(resolve('grammar', [course('prohibited'), assignment({ grammar: 'allowed' })]).state).toBe('allowed');
    expect(resolve('brainstorming', [course('allowed'), assignment({ brainstorming: 'prohibited' })]).state).toBe('prohibited');
  });

  it('a named rule beats a blanket at the same layer', () => {
    expect(resolve('revision', [course('allowed', { revision: 'limited' })]).state).toBe('limited');
  });

  it('a course that “allows AI” still does not allow final answers to an assessment', () => {
    const layer = fromCourse({ stance: 'allowed', note: 'AI allowed for study.' });
    expect(resolve('final-answers', [layer]).state).toBe('prohibited');
    expect(resolve('practice', [layer]).state).toBe('allowed');
  });

  it('labels a student-recorded policy as such, with no invented link or date', () => {
    const layer = fromCourse({ stance: 'limited', note: 'Ask first.' })!;
    expect(layer.by).toBe('student-record');
    expect(layer.link).toBe('');
    expect(layer.effective).toBe('');
  });

  it('files every use into exactly one column of the card', () => {
    const c = card([fromCourse({ stance: 'limited', note: '' })]);
    expect(c.allowed.length + c.disclose.length + c.prohibited.length + c.unavailable.length).toBe(c.all.length);
  });

  it('a course that bans AI is only offered the redirects that need no AI', () => {
    const banned = [fromCourse({ stance: 'banned', note: '' })];
    const offered = redirect(banned);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((r) => r.needsAi === null)).toBe(true);
  });

  it('treats a stance it does not recognise as no policy, never as permission', () => {
    const odd = fromCourse({ stance: 'bogus' as never, note: '' });
    expect(odd).toBeUndefined();
    expect(resolve('brainstorming', [odd]).state).toBe('unavailable');
  });

  it('does not mistake an Object.prototype name for a stance', () => {
    for (const stance of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(fromCourse({ stance: stance as never, note: '' })).toBeUndefined();
    }
  });
});

/*
 * The server stores course rules published in Course Studio, and checks each
 * use against its own list in 20260928150000_course_studio.sql. A use added
 * here and not there would be offered to an instructor and refused on publish;
 * one there and not here would be a rule the engine never reads.
 */
describe('the Course Studio migration', () => {
  it('accepts exactly the uses and states this engine knows', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(join(__dirname, '../../../../supabase/migrations/20260928150000_course_studio.sql'), 'utf8');
    const listed = /uses - array\[([^\]]+)\]::text\[\]/.exec(sql)?.[1] ?? '';
    expect([...listed.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual(USES.map(([u]) => u).sort());
    const states = /\$\.\* \? \(([^)]+)\)/.exec(sql)?.[1] ?? '';
    expect([...states.matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort()).toEqual(['allowed', 'limited', 'prohibited', 'required']);
  });
});
