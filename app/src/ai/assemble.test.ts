import { describe, expect, it } from 'vitest';
import { assemble, suggestionsFor, type Inputs } from './assemble';

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
