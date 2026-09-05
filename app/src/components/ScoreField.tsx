import { useId, useState } from 'react';
import { ACCEPTS, interpret, settled } from '../lib/score';
import type { GradeSystem } from '../lib/cutoffs';

/** How wide the box is. The caption below it is allowed to be wider. */
const BOX = 84;
const CAPTION = 240;

/**
 * The box a grade goes in, taking it however it was written down.
 *
 * The field used to take a number and nothing else, so a course that hands
 * back letters could not be tracked at all and a rubric marked out of 20 had
 * to be divided by hand first. Both were the app making somebody do arithmetic
 * so that it did not have to. Now it reads 88, 88%, 17/20, "17 out of 20" and
 * B+ — see `lib/score.ts` for what a letter is taken to be worth, and why the
 * low end of the band.
 *
 * ## It rewrites the field, and only on the way out
 *
 * Anything the app had to work out is replaced by the number it worked out,
 * once focus leaves. Two reasons, both about not being clever at somebody's
 * expense: what the projection uses is then what they can see and correct, and
 * normalising mid-keystroke would fight them — "1" is not a mistake on the way
 * to "17/20".
 *
 * A plain number is left exactly as typed. Rewriting "88" to "88" only moves
 * the cursor.
 */
export function ScoreField({
  value,
  onChange,
  system,
  assumed = false,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  system: GradeSystem;
  /** True when the cutoffs are a common scale rather than this course's own. */
  assumed?: boolean;
  label: string;
}) {
  const [touched, setTouched] = useState(false);
  const id = useId();
  const read = interpret(value, system, assumed);
  // Only once somebody has typed in this field: a course opened and not filled
  // in should not be explaining itself.
  const say = touched ? read.said : '';

  return (
    <div style={{ width: BOX, flex: 'none' }}>
      <input
        className="input"
        // Not `decimal`. A letter has to be typable, and an input mode that
        // offers only digits makes that impossible on a phone.
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="—"
        value={value}
        onChange={(e) => {
          setTouched(true);
          onChange(e.target.value);
        }}
        onBlur={() => {
          const next = settled(value, system);
          if (next !== value) onChange(next);
        }}
        aria-label={label}
        aria-describedby={say ? id : undefined}
        title={ACCEPTS}
        style={{
          width: '100%',
          height: 38,
          fontSize: 'calc(14px * var(--text-scale, 1))',
          textAlign: 'center',
        }}
      />
      {say ? (
        <div
          id={id}
          style={{
            // Wider than the box it sits under, and reaching leftwards into
            // the space beside the label rather than wrapping to eight lines
            // in an 84px column. A negative margin in normal flow does this
            // and still makes the row taller, which an absolute one would not.
            width: CAPTION,
            marginLeft: BOX - CAPTION,
            fontSize: 'calc(10.5px * var(--text-scale, 1))',
            opacity: 0.62,
            marginTop: 5,
            lineHeight: 1.4,
            textAlign: 'right',
            textWrap: 'pretty',
          }}
        >
          {say}
        </div>
      ) : null}
    </div>
  );
}
