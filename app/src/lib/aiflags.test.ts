import { describe, expect, it } from 'vitest';
import { AI_CATEGORIES, aiAllows, isAiOff, offLine, readAiOff, type AiOff } from './aiflags';

describe('the categories', () => {
  it('offers six, each with a label and a blurb', () => {
    expect(AI_CATEGORIES).toHaveLength(6);
    for (const c of AI_CATEGORIES) {
      expect(c.label.length, c.id).toBeGreaterThan(0);
      expect(c.blurb.length, c.id).toBeGreaterThan(0);
    }
  });

  it('recognises its own and nothing else', () => {
    for (const c of AI_CATEGORIES) expect(isAiOff(c.id)).toBe(true);
    // The brief that prompted this file names ten flags. These four govern
    // features this app does not have, and a switch over nothing is a promise
    // to a university that nothing keeps.
    expect(isAiOff('ai_registration')).toBe(false);
    expect(isAiOff('ai_email')).toBe(false);
    expect(isAiOff('ai_meetings')).toBe(false);
    expect(isAiOff('')).toBe(false);
  });
});

describe('reading what a pack says', () => {
  it('keeps the categories it understands', () => {
    expect(readAiOff(['grades', 'attendance'])).toEqual(['grades', 'attendance']);
  });

  it('drops one it does not, rather than guessing', () => {
    expect(readAiOff(['grades', 'grade', 'GRADEZ'])).toEqual(['grades']);
  });

  it('accepts a spelling that differs only in case or space', () => {
    expect(readAiOff([' Grades ', 'ATTENDANCE'])).toEqual(['grades', 'attendance']);
  });

  it('does not repeat one named twice', () => {
    expect(readAiOff(['grades', 'grades'])).toEqual(['grades']);
  });

  it('answers with nothing for anything that is not a list', () => {
    expect(readAiOff(undefined)).toEqual([]);
    expect(readAiOff(null)).toEqual([]);
    expect(readAiOff('grades')).toEqual([]);
    expect(readAiOff({ grades: true })).toEqual([]);
    expect(readAiOff([1, true, null, {}])).toEqual([]);
  });
});

describe('what travels', () => {
  it('allows everything for a school that has configured nothing', () => {
    // The default, and the reason this is a list of what is OFF. An allowlist
    // would have emptied the assistant for every existing school on the day
    // this shipped.
    for (const c of AI_CATEGORIES) {
      expect(aiAllows([], c.id), c.id).toBe(true);
      expect(aiAllows(undefined, c.id), c.id).toBe(true);
    }
  });

  it('refuses the one that was named', () => {
    expect(aiAllows(['grades'], 'grades')).toBe(false);
  });

  it('refuses only the one that was named', () => {
    // The control. An `aiAllows` that refused everything once anything was
    // configured would pass the test above it and be badly wrong.
    const off: AiOff[] = ['grades'];
    expect(aiAllows(off, 'deadlines')).toBe(true);
    expect(aiAllows(off, 'attendance')).toBe(true);
    expect(aiAllows(off, 'screen')).toBe(true);
  });

  it('refuses everything when a university names everything', () => {
    const all = AI_CATEGORIES.map((c) => c.id);
    for (const c of AI_CATEGORIES) expect(aiAllows(all, c.id), c.id).toBe(false);
  });
});

describe('saying so on a screen', () => {
  it('says nothing when nothing is off', () => {
    expect(offLine([])).toBe('');
    expect(offLine(undefined)).toBe('');
  });

  it('names one', () => {
    expect(offLine(['grades'])).toBe('Your university has switched off grades.');
  });

  it('names two', () => {
    expect(offLine(['grades', 'attendance'])).toBe(
      'Your university has switched off grades and attendance.',
    );
  });

  it('names three in the order the categories are declared', () => {
    // Not the order they were configured in — `deadlines` is declared before
    // `grades`, so it is said first however the pack listed them. The next
    // test is the same property stated directly.
    expect(offLine(['grades', 'attendance', 'deadlines'])).toBe(
      'Your university has switched off deadlines, grades and attendance.',
    );
  });

  it('says it in the order the list is written, not the order it was configured', () => {
    // So two universities with the same switches read the same, and a console
    // cannot make the sentence depend on which box was ticked first.
    expect(offLine(['attendance', 'grades'])).toBe(offLine(['grades', 'attendance']));
  });
});
