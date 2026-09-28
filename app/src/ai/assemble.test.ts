import { describe, expect, it } from 'vitest';
import { assemble, suggestionsFor, TERM_STARTERS, type Inputs } from './assemble';

const input = (screen: Inputs['screen']): Inputs => ({
  screen,
  live: () => null,
  registered: () => [],
});

describe('journey-aware assistant context', () => {
  it('tells Semester Intelligence where the current screen sits in the larger journey', () => {
    const context = assemble(input('write')).text;
    expect(context).toContain('Semester journey: Complete an assignment');
    expect(context).toContain('Current part:');
    expect(context).toContain('Next part:');
  });

  it('offers a journey-level question alongside screen-level intelligence', () => {
    expect(suggestionsFor(input('write'))[0]).toBe(
      'What should I do next in Complete an assignment?',
    );
  });
});

describe('the Ask tab opened directly', () => {
  /*
   * It sits in the Learn area, so the journey line used to be its only
   * starter: "What should I do next in Learn and practice?", alone on an empty
   * page. Opened directly it offers the term-wide jobs instead.
   */
  it('starts from the term-wide questions, not the name of a menu area', () => {
    const offered = suggestionsFor(input('ask'));
    expect(offered).toEqual([...TERM_STARTERS]);
    expect(offered.join(' ')).not.toMatch(/Learn and practice/);
  });
});
