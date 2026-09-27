import { describe, expect, it } from 'vitest';
import type { IntegrityMode } from '../intelligence/contracts';
import {
  checkFeedback,
  classifyIntent,
  helpCeiling,
  HELP_LEVELS,
  INTENTS,
  nextMove,
  taskPolicyFor,
  tutorContract,
  type Feedback,
} from './socratic';
import { systemPrompt } from '../ai/prompt';

const MODES: IntegrityMode[] = ['explain', 'hint', 'practice', 'review', 'draft'];
const FORBIDDEN = { graded: true, directAnswerPermitted: false };
const OPEN = { graded: false };

describe('the ceiling', () => {
  it('never reaches the direct answer on a graded task that forbids one, from any mode', () => {
    for (const mode of MODES) {
      expect(helpCeiling(mode, FORBIDDEN).level).toBeLessThan(7);
    }
    // And says why, when it was the course and not the mode that stopped it.
    expect(helpCeiling('explain', FORBIDDEN).reason).toMatch(/graded assessment/);
  });

  it('lets Explain answer when nothing forbids it', () => {
    expect(helpCeiling('explain', OPEN).level).toBe(7);
    expect(helpCeiling('explain', { graded: true, directAnswerPermitted: true }).level).toBe(7);
  });

  it('stops Hint at the worked example, whatever the course allows', () => {
    expect(helpCeiling('hint', OPEN).level).toBe(5);
  });

  it('reads an unrecorded course policy as a no', () => {
    expect(taskPolicyFor(undefined).directAnswerPermitted).toBe(false);
    expect(taskPolicyFor({ stance: 'unstated', note: '' }).directAnswerPermitted).toBe(false);
    expect(taskPolicyFor({ stance: 'limited', note: '' }).directAnswerPermitted).toBe(false);
    expect(taskPolicyFor({ stance: 'allowed', note: '' }).directAnswerPermitted).toBe(true);
  });

  it('has eight levels, numbered in order', () => {
    expect(HELP_LEVELS.map((l) => l.level)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('the decision tree', () => {
  const base = { task: OPEN, mode: 'hint' as const };

  it('asks for a first step before helping with an unattempted problem', () => {
    expect(nextMove(base)).toMatchObject({ move: 'ask-first-step', level: 0 });
  });

  it('explains the foundation first, and follows it with a question', () => {
    const next = nextMove({ ...base, needsFoundation: true, attempted: true });
    expect(next.move).toBe('explain-then-retrieve');
    expect(next.says).toMatch(/question/);
  });

  it('sends a prerequisite gap to a prerequisite lesson, not a hint', () => {
    expect(nextMove({ ...base, attempted: true, misconception: 'prerequisite' }).move).toBe('prerequisite-lesson');
  });

  it('climbs one rung per hint, and ends at a person rather than a sixth hint', () => {
    const levels = [0, 1, 2, 3, 4].map((hintsUsed) =>
      nextMove({ ...base, attempted: true, misconception: 'other', hintsUsed }).level,
    );
    expect(levels).toEqual([1, 2, 3, 4, 5]);
    const past = nextMove({ ...base, attempted: true, misconception: 'other', hintsUsed: 5 });
    expect(past.move).toBe('example-or-human');
    expect(past.offerHuman).toBe(true);
  });

  it('moves a success on to transfer instead of stopping', () => {
    expect(nextMove({ ...base, attempted: true, succeeded: true }).move).toBe('transfer');
  });

  it('never returns a level above the ceiling', () => {
    for (const mode of MODES) {
      for (const hintsUsed of [0, 3, 9]) {
        for (const task of [OPEN, FORBIDDEN]) {
          const next = nextMove({ task, mode, attempted: true, misconception: 'other', hintsUsed, needsFoundation: hintsUsed === 9 });
          expect(next.level).toBeLessThanOrEqual(next.ceiling.level);
        }
      }
    }
  });
});

describe('what a student is asking for', () => {
  it.each([
    ['Explain price elasticity', 'explain'],
    ['How do I solve problem 3 on the equilibrium set?', 'work-problem'],
    ['Is this right? I said the shift is to the left', 'check-reasoning'],
    ['Quiz me for the midterm', 'practice'],
    ['What should I ask at office hours about recursion?', 'office-hours'],
    ['Make a study plan for this week', 'plan-study'],
    ['Find sources on the Cuban missile crisis', 'sources'],
    ['Help me improve my essay intro', 'revise-own-work'],
    ['Why did I lose points on the lab report?', 'understand-feedback'],
    ['How do I drop a class after the deadline?', 'navigate-process'],
  ])('%s → %s', (question, intent) => {
    expect(classifyIntent(question)).toBe(intent);
  });

  it('has a label for all ten', () => {
    expect(INTENTS).toHaveLength(10);
  });
});

describe('the feedback contract', () => {
  const good: Feedback = {
    validate: 'You correctly noticed that temperature adds heat to the system.',
    revisit: 'In an endothermic reaction, heat behaves like a reactant.',
    ask: 'If a reactant increases, which way should equilibrium shift?',
    source: 'Unit 4 notes, page 12',
    next: ['Try again', 'Comparable example', 'Find tutoring'],
  };

  it('passes the blueprint’s own example', () => {
    expect(checkFeedback(good, true)).toEqual([]);
  });

  it('asks exactly one question', () => {
    expect(checkFeedback({ ...good, ask: 'Which way? And why?' }, true)).toContain('Ask exactly one next question.');
    expect(checkFeedback({ ...good, ask: 'Think about it.' }, true)).toContain('Ask exactly one next question.');
  });

  it('shows a source whenever a course is in context, and only then requires one', () => {
    const { source: _, ...bare } = good;
    expect(checkFeedback(bare, true)).toContain('Show the course source.');
    expect(checkFeedback(bare, false)).toEqual([]);
  });

  it('always leaves a person among the next actions', () => {
    expect(checkFeedback({ ...good, next: ['Try again'] }, false)).toContain(
      'Offer human help as one of the next actions.',
    );
  });
});

describe('what the model is told', () => {
  it('adds nothing when the student asked for an explanation and nothing forbids one', () => {
    expect(tutorContract('explain', OPEN)).toBeNull();
  });

  it('forbids a complete solution in Hint mode, and lists no rung above the ceiling', () => {
    const said = tutorContract('hint', OPEN)!;
    expect(said).toContain('Do not give the final answer');
    expect(said).toContain('5. Shows a comparable worked example');
    expect(said).not.toContain('6. ');
    expect(said).not.toContain('7. ');
  });

  it('holds Explain back on a graded task whose course forbids direct answers', () => {
    const said = tutorContract('explain', taskPolicyFor({ stance: 'banned', note: 'No AI.' }))!;
    expect(said).toContain('graded assessment');
    expect(said).not.toContain('7. ');
  });

  /*
   * The bug this module was written for: the mode reached the request and
   * the answer card and never the prompt. Checked at the seam, so a caller
   * that stops passing it is caught here rather than in a screenshot.
   */
  it('reaches the system prompt, last, for grounded and general questions', () => {
    const said = tutorContract('hint', OPEN)!;
    for (const read of ['grounded', 'general'] as const) {
      const prompt = systemPrompt(read, 'CONTEXT', said);
      expect(prompt.endsWith(said)).toBe(true);
      expect(systemPrompt(read, 'CONTEXT')).not.toContain('You are tutoring');
    }
  });

  it('stays out of questions about the app itself', () => {
    expect(systemPrompt('app', '', tutorContract('hint', OPEN))).not.toContain('You are tutoring');
  });
});

describe('the caller', () => {
  /*
   * Structural, like `rootunmount.test.ts`: the seam test above proves the
   * prompt carries a contract it is handed, and nothing proves the
   * conversation hands one over. This does.
   */
  it('passes the contract for the effective mode into the system prompt', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../ai/converse.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/tutorContract\(\s*intelligence\.context\.integrityMode/);
    expect(src).toContain('systemFor(how.mode, drawn.text, tutoring)');
  });
});
