import { describe, expect, it } from 'vitest';
import { saidAbout, type Adopted } from './ltilanding';

/**
 * The sentences a person reads, one per word the database returns.
 *
 * The parsing and the address-bar cleaning moved to `ltiarrival.test.ts` with
 * the leaf they test. What is left here is the half that needs `cloud`, and
 * the only part of it that can be tested without a network is the translation
 * — which is worth testing on its own, because a missing sentence shows up as
 * a screen printing a database word at somebody.
 */

describe('what a person is told', () => {
  const words: Adopted[] = ['ok', 'signed-out', 'stale', 'same-account', 'in-use', 'failed'];

  it('has a sentence for every word the database can return', () => {
    for (const w of words) {
      expect(saidAbout(w), `no sentence for ${w}`).toBeTruthy();
      expect(saidAbout(w).length, `${w} reads as a code, not a sentence`).toBeGreaterThan(20);
    }
  });

  it('says something different for each one', () => {
    expect(new Set(words.map(saidAbout)).size).toBe(words.length);
  });

  /*
   * The one refusal a student cannot resolve by trying again. It has to point
   * at a person rather than imply effort would help.
   */
  it('sends the merge case to a human instead of suggesting they retry', () => {
    const said = saidAbout('in-use');
    expect(said).toMatch(/get in touch|by hand/i);
    expect(said).not.toMatch(/try again/i);
  });
});
