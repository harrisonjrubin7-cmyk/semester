import { describe, expect, it } from 'vitest';
import { readMode } from './mode';
import { DESTINATIONS } from './nav';

/**
 * Which of three questions somebody asked, decided without asking them.
 *
 * The failure this exists to prevent is a study app that answers "explain
 * price elasticity" with "I can only help with your courses". So the default
 * is General and the two narrower modes have to be recognised — which means
 * most of what is tested here is that ordinary questions stay ordinary.
 */

const mode = (q: string) => readMode(q).mode;

describe('questions about the app', () => {
  it('knows one when the question is about a screen', () => {
    expect(mode('where do I set my grade scale')).toBe('app');
    expect(mode('how do I add a reading')).toBe('app');
    expect(mode('how do I import a syllabus')).toBe('app');
  });

  it('names screens that exist, and only those', () => {
    // The registry is the boundary, the same as it is for the guide.
    const known = new Set(DESTINATIONS.map((d) => d.screen));
    for (const q of ['where do I set my grade scale', 'how do I export my notes', 'shortcuts']) {
      for (const s of readMode(q).screens) expect(known, `${q} → ${s}`).toContain(s);
    }
  });

  it('does not answer a study question out of the screen registry', () => {
    /*
     * "How do I revise for a closed-book exam" is shaped like an app question
     * and is not one. Both halves are needed: the shape, and something in the
     * registry it could plausibly be about.
     */
    expect(mode('how do I revise for a closed-book exam')).not.toBe('app');
    expect(mode('how do I approach a proof by induction')).not.toBe('app');
  });
});

describe('questions about this student', () => {
  it('knows one by what it asks after', () => {
    expect(mode('what is due Thursday')).toBe('grounded');
    expect(mode('how many absences do I have left in CORE')).toBe('grounded');
    expect(mode('what do I need on the BUS 1600 final')).toBe('grounded');
    expect(mode('where do I stand')).toBe('grounded');
  });

  it('grounds an advice question that touches the data, which is right', () => {
    /*
     * "What should I say to a professor whose class I have been missing" came
     * back grounded and the expectation that it should not was wrong.
     *
     * Grounded does not mean "only answers with facts" — it means the context
     * is attached. The app knows how many of that class have been missed, and
     * an answer that can say so is better than one that cannot. Advice is
     * still advice; it is just advice that knows the number.
     */
    expect(readMode('what should I say to a professor whose class I have been missing').mode)
      .toBe('grounded');
  });

  it('says what it is drawing on rather than leaving it a mystery', () => {
    expect(readMode('what is due Thursday').says).toBe('Using: your courses');
    expect(readMode('explain price elasticity').says).toBe('General');
  });
});

describe('everything else, which is most things', () => {
  it('answers a concept question as a concept question', () => {
    for (const q of [
      'explain price elasticity',
      'how do photosynthesis and respiration differ',
      'what is a monad',
      'write me a python function that reverses a linked list',
      'is a masters worth it for policy work',
      'how do I write a cover letter for a summer internship',
    ]) {
      expect(mode(q), q).toBe('general');
    }
  });

  it('treats an empty question as general rather than throwing', () => {
    expect(mode('')).toBe('general');
    expect(mode('   ')).toBe('general');
  });
});

describe('what it shows for it', () => {
  it('quotes the words that decided it, so a wrong read can be argued with', () => {
    const app = readMode('where do I set my grade scale');
    expect(app.because.length).toBeGreaterThan(0);
    expect('where do i set my grade scale').toContain(app.because.toLowerCase());

    const mine = readMode('what is due Thursday');
    expect(mine.because.length).toBeGreaterThan(0);
  });

  it('says nothing decided a general question, because nothing did', () => {
    expect(readMode('explain price elasticity').because).toBe('');
  });
});
