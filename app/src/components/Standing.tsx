import { useState } from 'react';
import { Meter } from './ui';
import { forgetting, says, why, type Evidence, type Knowing } from '../lib/knowing';
import type { Reviews } from '../lib/review';

/**
 * Where a unit stands, in words, with the counts it was read from.
 *
 * This is what replaced the mastery percentage on screen. `lib/knowing.ts`
 * has the argument for the five states; this is the argument for how they are
 * drawn, which is a separate one and has three parts.
 *
 * ## The state is text, not a colour
 *
 * The obvious drawing is five coloured pills — green for retained, amber for
 * review — and it is wrong here for a reason this repository has already paid
 * for twice. `CLAUDE.md` records the faded rungs in `lib/look.ts` being
 * measured against the wrong surface on two separate occasions; there are
 * thirteen grounds, and a state that means something only in colour has to
 * clear contrast on all of them, at two strengths, in both themes. A word
 * clears every ground by construction, reads out loud correctly, and survives
 * Windows High Contrast, which drops author backgrounds entirely.
 *
 * So the state is the word. The bar under it is not the state at all.
 *
 * ## The bar counts cards, and says so
 *
 * The meter this replaced was `unitMastery`: answers blended with a figure a
 * person wrote into the guide, curved and rounded. The bar here is
 * `held / cards` — the share of this unit's cards you have got right twice
 * running — and its `aria-label` says that in words rather than saying
 * "Mastery". It is a count of things that happened, so the length and the
 * sentence beside it cannot come apart.
 *
 * A unit with nothing answered draws no bar. `screens/Study.tsx` already
 * argued this for the course meter — "nothing measured, nothing claimed" —
 * and the same applies one level down.
 *
 * ## Why the reset is a second component
 *
 * `ClearEvidence` is separate and it is not tidiness. Both places this is
 * drawn put the standing **inside a row that is itself a `<button>`**, and a
 * button inside a button is invalid markup that browsers resolve by dropping
 * one of them — silently, and differently in each engine. Splitting them
 * means the reset cannot be put somewhere it would break: there is nothing
 * inside `Standing` for it to be put in.
 */
export function Standing({
  state,
  evidence,
  name,
  bar = true,
}: {
  state: Knowing;
  evidence: Evidence;
  /** What this is the standing *of*, for the bar's name. */
  name: string;
  /** Whether to draw the held-cards bar. Off in tight rows. */
  bar?: boolean;
}) {
  const held = evidence.cards > 0 ? (evidence.held / evidence.cards) * 100 : 0;
  return (
    <span style={{ display: 'block' }}>
      <span className="kicker" style={{ display: 'block', color: 'var(--app-fg)' }}>
        {says(state)}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 'var(--type-xs)',
          color: 'var(--app-dim)',
          marginTop: 'var(--sp-1)',
        }}
      >
        {why(evidence, state)}
      </span>
      {bar && evidence.answered > 0 && (
        <span style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
          <Meter
            pct={held}
            height={5}
            label={`${evidence.held} of ${evidence.cards} cards holding, ${name}`}
          />
        </span>
      )}
    </span>
  );
}

/**
 * "Not right?", and the two buttons it opens onto.
 *
 * The other half of saying a state out loud. A state derived from evidence
 * that cannot be disputed is a percentage with better manners: the whole
 * argument for replacing the number was that the counts under it can be
 * argued with, and arguing with a count means being allowed to throw it away.
 *
 * Renders nothing at all when there is nothing recorded. Not a disabled
 * button — a disabled control invites a press and then explains itself, and
 * here there is nothing to explain. `forgetting` is what decides, so the
 * control and the action agree about what evidence means.
 *
 * The confirm step is one press, not a dialog. It destroys real work and it
 * destroys a small, rebuildable amount of it; a modal for this is the kind of
 * ceremony that teaches people to click through ceremony.
 */
export function ClearEvidence({
  keys,
  reviews,
  name,
  onClear,
}: {
  keys: string[];
  reviews: Reviews;
  /** Named in the button's label, which is read out of context. */
  name: string;
  onClear: (keys: string[]) => void;
}) {
  const [asking, setAsking] = useState(false);
  const clearable = forgetting(keys, reviews);
  if (clearable.length === 0) return null;

  if (!asking) {
    return (
      <button
        type="button"
        className="bare tappable tap-y standing-clear"
        onClick={() => setAsking(true)}
        // The visible words are "Not right?", which is short enough for a row
        // and useless on its own out of context — a reader moving button to
        // button hears it with no idea what it is about.
        aria-label={`This is not right — clear the recorded evidence for ${name}`}
      >
        Not right?
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className="bare tappable tap-y standing-clear"
        onClick={() => {
          onClear(clearable);
          setAsking(false);
        }}
        /*
          Says what goes and where, for a reader arriving on this button with
          none of the row above it read out.

          The visible words carry the count only. "Clear 4 cards of evidence in
          1 · What economics is" is the sentence this needs to be, and at 420px
          it wrapped onto three lines beside a one-line "Keep it" — two
          controls of a pair at visibly different weights, which reads as one
          being the safe one. The count is the part that has to be visible,
          because it is the part that says how much is at stake; the rest is
          on screen directly above, and in the label for anybody who is not
          looking at the screen.
        */
        aria-label={`Clear the recorded evidence for ${clearable.length} card${
          clearable.length === 1 ? '' : 's'
        } in ${name}`}
      >
        Clear {clearable.length} card{clearable.length === 1 ? '' : 's'}
      </button>
      <button
        type="button"
        className="bare tappable tap-y standing-clear"
        onClick={() => setAsking(false)}
      >
        Keep it
      </button>
    </>
  );
}
