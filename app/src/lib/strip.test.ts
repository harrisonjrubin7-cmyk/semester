import { describe, expect, it } from 'vitest';
import { SHOWN_FOR, halves, leftOf, showing } from './strip';

/**
 * The change strip's clock and its two halves.
 *
 * The acceptance list asks that it "fires once on a data change and announces
 * once", which is a property of the design rather than of this file — one
 * dispatch feeds both the live region and the strip, so there is no second
 * mechanism to fall out of step. What is testable here is the rest: how long
 * it stays, what counts as still showing, and where the sentence divides.
 */

const AT = 1_800_000_000_000;

describe('how long it stays', () => {
  it('is up the moment it is said', () => {
    expect(showing({ said: 'Grade saved', at: AT }, AT)).toBe(true);
  });

  it('is still up a moment before its time', () => {
    expect(showing({ said: 'Grade saved', at: AT }, AT + SHOWN_FOR - 1)).toBe(true);
  });

  it('is down on the tick', () => {
    expect(showing({ said: 'Grade saved', at: AT }, AT + SHOWN_FOR)).toBe(false);
  });

  it('is down for an empty sentence, whatever the clock says', () => {
    // The state starts empty and is emptied again on the way out; neither is
    // a change worth a strip.
    expect(showing({ said: '', at: AT }, AT)).toBe(false);
    expect(showing({ said: '   ', at: AT }, AT)).toBe(false);
    expect(showing(null, AT)).toBe(false);
  });

  it('is down when the clock has gone backwards', () => {
    // A device whose time changed, or a tab restored from an older session.
    // Treating the future as fresh would pin a strip open until it caught up.
    expect(showing({ said: 'Saved', at: AT }, AT - 1)).toBe(false);
  });
});

describe('what is left to run', () => {
  it('counts down', () => {
    expect(leftOf({ said: 'x', at: AT }, AT)).toBe(SHOWN_FOR);
    expect(leftOf({ said: 'x', at: AT }, AT + 2000)).toBe(SHOWN_FOR - 2000);
  });

  it('never asks a timeout to wait a negative number of milliseconds', () => {
    expect(leftOf({ said: 'x', at: AT }, AT + SHOWN_FOR * 3)).toBe(0);
  });
});

describe('the sentence, divided', () => {
  it('splits on the middot the handoff writes them with', () => {
    expect(halves('Grade saved · BUS 1600 now 91%')).toEqual({
      lead: 'Grade saved',
      detail: 'BUS 1600 now 91%',
    });
  });

  it('treats a sentence without one as all detail and no label', () => {
    // The ordinary case. A label is a word or two; setting "Marked got it.
    // Next card." in 11px caps at 0.14em would be a sentence in a costume.
    expect(halves('Marked got it. Next card.')).toEqual({
      lead: '',
      detail: 'Marked got it. Next card.',
    });
  });

  it('splits on the first middot only, so a detail may contain one', () => {
    expect(halves('Moved · Friday · 9am')).toEqual({ lead: 'Moved', detail: 'Friday · 9am' });
  });

  it('trims the space either side of it', () => {
    expect(halves('Saved·now')).toEqual({ lead: 'Saved', detail: 'now' });
  });
});
