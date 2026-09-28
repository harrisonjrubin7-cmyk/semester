import { describe, expect, it } from 'vitest';
import { NEEDS } from './help-routes';
import { destination } from './nav';
import { settingsTitle } from './settings';
import { NEVER, allDoors, door, match, route, summary } from './nowrongdoor';

describe('no wrong door', () => {
  it('opens the right door for the sentences the brief gives', () => {
    expect(match('I do not understand why I cannot register.')).toBe('registration');
    expect(match('I need help with a paper.')).toBe('writing');
    expect(match('I am worried about my course schedule.')).toBe('registration');
    expect(match('I need an accommodation.')).toBe('accessibility');
    expect(match('I need help paying for school.')).toBe('money');
    expect(match('I want to study abroad.')).toBe('registration');
  });

  it('hears distress before the subject it is about', () => {
    expect(match('I am so overwhelmed by my schedule I cannot cope')).toBe('wellbeing');
    expect(match('I feel anxious about the exam')).toBe('wellbeing');
    // The direct formulations, each of which must never fall through to the list of every door.
    for (const s of ['I want to kill myself', 'I am suicidal', 'I am thinking about suicide', 'I want to end my life', 'I want to die', 'I don’t want to be here anymore', 'I have been self-harming', 'I keep hurting myself', 'there is no reason to live']) {
      expect(match(s), s).toBe('wellbeing');
      expect(route(s)?.need.id, s).toBe('wellbeing');
    }
    expect(door('wellbeing').handoff).toBe('directory');
    expect(door('wellbeing').owner).toBe('Campus counseling service');
  });

  it('shows every door rather than guessing when nothing in the sentence says', () => {
    expect(match('')).toBeNull();
    expect(match('hello')).toBeNull();
    expect(route('hello')).toBeNull();
    expect(allDoors().map((d) => d.need.id)).toEqual(NEEDS.map((n) => n.id));
  });

  it('points, and never stores, for the needs the help route keeps directory-only', () => {
    expect(door('accessibility').handoff).toBe('directory');
    expect(door('money').handoff).toBe('directory');
    expect(door('registration').handoff).toBe('request');
    expect(door('course').handoff).toBe('request');
  });

  it('names an owner and a first step in the app for every need, and every screen exists', () => {
    for (const d of allDoors()) {
      expect(d.owner.length, d.need.id).toBeGreaterThan(3);
      expect(d.can.length, d.need.id).toBeGreaterThan(0);
      expect(d.next.length, d.need.id).toBeGreaterThan(0);
      for (const s of d.next) if (s.screen) expect(destination(s.screen) ?? settingsTitle(s.screen), `${d.need.id} → ${s.screen}`).toBeTruthy();
    }
  });

  it('writes a summary from the sentence alone, and says what it never does', () => {
    const text = summary('I cannot register and the portal says HOLD', door('registration'));
    expect(text).toContain('I cannot register and the portal says HOLD');
    expect(text).toContain('Academic advisor');
    expect(text).toContain('Bring your plan and the exact message you saw');
    expect(text).toContain(NEVER);
    // Nothing the student did not type: no grade, no name, no course id.
    expect(text).not.toMatch(/GPA|grade|@/);
    expect(summary('   ', door('course'))).toContain('(not written yet)');
  });
});
