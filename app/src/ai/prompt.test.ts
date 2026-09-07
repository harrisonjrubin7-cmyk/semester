import { describe, expect, it } from 'vitest';
import { ACTING, BOUNDS } from './prompt';
import { TOOLS } from '../lib/tools';
import { DESTINATIONS } from '../lib/nav';

/**
 * The two promises the assistant makes about what it will not do.
 *
 * Both are enforced twice over, and that is deliberate. The tool set makes the
 * thing impossible; the prompt makes the refusal useful. Either alone is a
 * half-measure — a model with no send tool that answers "I cannot help with
 * that" leaves the student holding the same errand, and a prompt that promises
 * restraint with a send tool in reach is a promise resting on the model's
 * mood. `lib/tools.test.ts` holds the first half. This is the second.
 */

describe('asked to send something', () => {
  it('has no tool that could', () => {
    // Repeated from `tools.test.ts` on purpose: the sentences below are only
    // true while this is, and a reader of this file should not have to go and
    // check another one to know that.
    const words = TOOLS.map((t) => `${t.name} ${t.description}`).join(' ').toLowerCase();
    for (const verb of ['send', 'email', 'mail to', 'post', 'share', 'publish', 'submit']) {
      expect(words).not.toContain(verb);
    }
  });

  it('says so, rather than leaving it to the model to work out', () => {
    expect(ACTING).toContain('cannot send, post or share anything');
    expect(ACTING).toContain('there will not be one');
  });

  it('names where the student goes instead, for each of the three', () => {
    // A refusal that stops at "I cannot" is a refusal that costs the student
    // the answer as well as the action.
    for (const screen of ['mail', 'essay', 'classmates']) {
      expect(ACTING).toContain(`"${screen}"`);
      // And each one is a real screen, so `open_screen` can actually reach it.
      expect(DESTINATIONS.some((d) => d.screen === screen)).toBe(true);
    }
  });

  it('offers to open it rather than describing where it is', () => {
    expect(ACTING).toContain('open_screen');
    expect(TOOLS.some((t) => t.name === 'open_screen')).toBe(true);
  });
});

describe('asked about a person rather than a term', () => {
  it('is told the app holds a timetable, not a person', () => {
    expect(BOUNDS).toContain('workload and schedule only');
    expect(BOUNDS).toContain('a timetable, not a person');
  });

  it('names the three things it must not infer', () => {
    for (const word of ['feeling', 'health', 'state of mind']) expect(BOUNDS).toContain(word);
  });
});

describe('what it may claim to have done', () => {
  it('is told that calling a tool is a proposal, not an act', () => {
    expect(ACTING).toContain('Nothing you call happens');
    expect(ACTING).toContain('future tense, never as done');
    expect(ACTING).toContain('Never say you have done something you have not');
  });
});
