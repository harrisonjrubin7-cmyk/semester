import { describe, expect, it } from 'vitest';
import { MAX_SHOTS, tooMany } from './shots';

/**
 * Saying that photos were left out, on both screens that leave them out.
 *
 * Two screens take a batch of photographs and cap it at `MAX_SHOTS`. The
 * camera screen said so — "Only 12 photos go in one batch — the rest were
 * left out" — and Work the problem, capping in the same place with the same
 * constant, said nothing: fifteen photographed pages became a worked solution
 * covering twelve, handed back as the answer.
 *
 * Measured in a browser before the fix, picking the same fifteen files:
 * the camera screen showed the sentence and `12 of 12`; Work the problem
 * showed neither, and no error, because nothing had gone wrong.
 *
 * The sentence lives next to the number it quotes so the two screens cannot
 * come to say different things about the same cap, and the two `room` shapes
 * below are why it takes the number rather than reading it: the camera screen
 * is adding to a batch that may already be part full.
 */
describe('tooMany', () => {
  it('says nothing when they all fit', () => {
    expect(tooMany(MAX_SHOTS, MAX_SHOTS)).toBeNull();
    expect(tooMany(1, MAX_SHOTS)).toBeNull();
    expect(tooMany(0, 0)).toBeNull();
  });

  it('says so on the first one over', () => {
    expect(tooMany(MAX_SHOTS + 1, MAX_SHOTS)).toContain('left out');
  });

  it('quotes the cap rather than a number of its own', () => {
    expect(tooMany(99, MAX_SHOTS)).toContain(String(MAX_SHOTS));
  });

  /*
   * A batch that is already part full has less room than the cap, and a batch
   * that is full has none — where every photo picked is one left out, and the
   * screen would otherwise take fifteen files and show nothing at all.
   */
  it('measures against the room left, not against the cap', () => {
    expect(tooMany(3, 2)).toContain('left out');
    expect(tooMany(1, 0)).toContain('left out');
    expect(tooMany(2, 3)).toBeNull();
  });
});
