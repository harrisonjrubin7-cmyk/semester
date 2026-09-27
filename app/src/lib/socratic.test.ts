import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { systemPrompt } from '../ai/prompt';
import { DIRECT, FEEDBACK, HANDOFF, MODES, RUNGS, STEPS, tutorPolicy, tutoring } from './socratic';
import type { CoursePolicy } from './types';

const course = (ai?: CoursePolicy) => ({ code: 'CHEM 101', ...(ai ? { ai } : {}) });

describe('the ladder', () => {
  it('has eight rungs, in order, and only the last is the answer', () => {
    expect(RUNGS.map((r) => r.rung)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(DIRECT).toBe(7);
    expect(RUNGS[7].move).toMatch(/direct answer/);
    for (const r of RUNGS.slice(0, 7)) expect(r.move).not.toMatch(/answer\./);
  });
});

describe('the limits for the course in view', () => {
  it('with no course, every mode and the whole ladder', () => {
    const p = tutorPolicy();
    expect(p.allowed).toEqual([...MODES]);
    expect(p.ceiling).toBe(7);
  });

  it('an unrecorded policy keeps every mode but never reaches the answer', () => {
    for (const ai of [undefined, { stance: 'unstated' as const, note: '' }]) {
      const p = tutorPolicy(course(ai));
      expect(p.allowed).toEqual([...MODES]);
      expect(p.ceiling).toBe(6);
      expect(p.reason).toContain('No AI policy is recorded for CHEM 101');
    }
  });

  it('a course that allows AI still does not permit final answers', () => {
    const p = tutorPolicy(course({ stance: 'allowed', note: '' }));
    expect(p.allowed).toEqual([...MODES]);
    expect(p.ceiling).toBe(6);
  });

  it('a course that bans AI offers no mode, and only the non-AI alternatives', () => {
    const p = tutorPolicy(course({ stance: 'banned', note: 'No AI.' }));
    expect(p.allowed).toEqual([]);
    expect(p.reason).toContain('does not allow AI help');
    expect(p.instead.length).toBeGreaterThan(0);
    expect(p.instead.join(' ')).not.toMatch(/Explain|Practise/);
  });

  it('an unrecognised stance is not a permission', () => {
    const p = tutorPolicy(course({ stance: 'whatever' as never, note: '' }));
    expect(p.ceiling).toBe(6);
  });
});

describe('what each mode tells the model', () => {
  const open = tutorPolicy();
  const capped = tutorPolicy(course({ stance: 'allowed', note: '' }));

  it('Explain says nothing, so the default assistant is unchanged', () => {
    expect(tutoring('explain', open)).toBe('');
    expect(tutoring('explain', capped)).toBe('');
  });

  it('Hint carries the decision order, the ladder, the feedback contract and the people', () => {
    const text = tutoring('hint', open);
    for (const step of STEPS) expect(text).toContain(step);
    expect(text).toContain(FEEDBACK);
    expect(text).toContain(HANDOFF);
    expect(text).toContain('one rung per reply');
    expect(text).toContain('7. Give the direct answer.');
  });

  it('under a course cap, Hint stops at rung 6 and says why', () => {
    const text = tutoring('hint', capped);
    expect(text).toContain('6. Review their full attempt');
    expect(text).not.toContain('7. Give the direct answer.');
    expect(text).toContain('Do not give the final answer to CHEM 101');
  });

  /*
   * The limit is the course's, not the assistant's. The course in view is
   * whatever screen the student last opened, so a cap worded as "do not give
   * final answers" would hold back "explain elasticity" because ECON happened
   * to be open. Each mode's cap has to name the course's coursework.
   */
  it('scopes the cap to that course\u2019s coursework in every mode that carries one', () => {
    for (const mode of ['hint', 'practice', 'review'] as const) {
      expect(tutoring(mode, capped)).toContain('final answer to CHEM 101 coursework');
    }
  });

  it('Practice and Review both hold the feedback contract and never offer the answer under a cap', () => {
    for (const mode of ['practice', 'review'] as const) {
      const text = tutoring(mode, capped);
      expect(text).toContain(FEEDBACK);
      expect(text).toContain('Ceiling: rung 6');
    }
    expect(tutoring('review', capped)).toContain('Do not rewrite it');
  });

  it('Draft keeps the words theirs', () => {
    expect(tutoring('draft', open)).toContain('Do not write a submission');
  });

  it('a banned course refuses its own work and offers the alternatives, whatever the mode', () => {
    const banned = tutorPolicy(course({ stance: 'banned', note: '' }));
    for (const mode of [...MODES, null]) {
      const text = tutoring(mode, banned);
      expect(text).toContain('does not allow AI help');
      expect(text).toContain('Questions that are not about that course are unaffected');
    }
  });
});

describe('in the system prompt', () => {
  it('goes into grounded and general questions and never into app questions', () => {
    const text = tutoring('hint', tutorPolicy());
    expect(systemPrompt('grounded', 'ctx', text)).toContain(text);
    expect(systemPrompt('general', 'ctx', text)).toContain(text);
    expect(systemPrompt('app', 'ctx', text)).not.toContain(text);
  });

  it('with no tutoring the prompt is exactly what it was', () => {
    expect(systemPrompt('general', 'ctx', '')).toBe(systemPrompt('general', 'ctx'));
  });
});

describe('on the local path', () => {
  /*
   * The failure this module exists for: the picker's mode went into the
   * request envelope and the gateway call, and never into the prompt the
   * local path sends. These read the source because standing up the whole
   * conversation hook to inspect one argument is heavier than the fault.
   */
  const src = readFileSync(new URL('../ai/converse.ts', import.meta.url), 'utf8');

  it('sends the tutoring for the chosen mode with every question', () => {
    const call = src.slice(src.indexOf('await ask('));
    const system = call.slice(call.indexOf('system:'), call.indexOf('messages:'));
    expect(system).toContain('tutoring(');
    expect(system).toContain('integrityMode');
  });

  it('offers the modes the course policy allows when the gateway is off', () => {
    expect(src).toContain('allowedIntegrityModes: governed ? live.allowedIntegrityModes : limits.allowed');
  });
});
