import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * One filled action on the map, and the right one.
 *
 * `scripts/wallsweep.mjs` opens all fifty-eight destinations and asks how many
 * filled actions each offers at once. Maps answered two, on both its tabs, and
 * that is a non-zero exit rather than a note — the script's own reason for
 * existing is the sentence this screen was an instance of:
 *
 *   > the hierarchy is local rather than designed — each section decided its
 *   > own emphasis
 *
 * Neither section was wrong alone. The next-stop card is already a proper
 * pair: one filled action and a link beside it. `FillPlaces` is a card of its
 * own, and its action is filled because on a new install it is the only thing
 * on the screen worth pressing. Neither could see the other.
 *
 * Placing the buildings wins while any are unplaced, and not because it is the
 * bigger job. It is the precondition: with no coordinate there is no walk to
 * measure, and the next-stop card says exactly that — *"Nothing saved for X
 * yet, so there is no walk to measure."* A screen that says so beside a filled
 * button offering to do it is arguing with itself.
 *
 * ## Why this reads the source and does not mount the screen
 *
 * It was written the other way first, mounting `Maps` in jsdom and counting
 * `.btn-primary`. That test passed, and it was measuring nothing: with the
 * shipped seed jsdom renders *neither* card — no "Find them on the map" and no
 * next stop — and the one filled button it finds is the search field's "Find".
 * The count came out at one before the fix and one after it, for a reason that
 * has nothing to do with either.
 *
 * The state the sweep found needs a real browser to reach. So the browser
 * keeps the count, and this keeps the mechanism: that the next stop's weight
 * is read from the same value that decides whether `FillPlaces` mounts at all,
 * rather than hard-wired to either answer.
 */
const SRC = readFileSync(new URL('./Maps.tsx', import.meta.url), 'utf8');

describe('the map screen’s one filled action', () => {
  it('does not hard-wire the next stop to filled', () => {
    expect(SRC, 'this is the two-filled-actions state wallsweep exits on').not.toMatch(
      /tone="primary"\s*\n\s*onClick=\{\(\) => pick\(nextStop\)\}/,
    );
  });

  it('reads its weight from the buildings that still have no coordinate', () => {
    expect(SRC).toMatch(/tone=\{toPlace\.length > 0 \? 'secondary' : 'primary'\}/);
  });

  it('and hands FillPlaces that same value, so the two cannot disagree', () => {
    expect(SRC, 'computing it twice lets them drift apart').toMatch(
      /<FillPlaces buildings=\{toPlace\} \/>/,
    );
    expect(SRC, 'toPlace should be read once').toMatch(/const toPlace = unplaced\(everything\);/);
  });
});
