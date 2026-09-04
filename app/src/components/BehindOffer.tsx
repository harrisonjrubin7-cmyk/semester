/**
 * The way in, offered only when it is needed.
 *
 * A permanent "I'm behind" button is a permanent accusation, and a screen you
 * have to go looking for in a bad week is a screen nobody finds — the whole
 * failure this is for is that people stop opening the app. So it appears on
 * Today when the arithmetic says the week does not fit, and vanishes when it
 * does.
 *
 * Worded as a fact rather than a diagnosis. "You are behind" is a thing to
 * argue with; "three deadlines have gone by" is a thing to look at.
 */

import { useStore } from '../state/store';
import { datedItems } from '../lib/select';
import { WAKING_HOURS, hoursOn } from '../lib/windows';
import { behindLine, howBehind } from '../lib/behind';

export function BehindOffer() {
  const { state, dispatch, now, catalog } = useStore();
  const week =
    state.windows.length > 0
      ? [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + hoursOn(state.windows, d), 0)
      : WAKING_HOURS * 7;
  const b = howBehind(datedItems(catalog, now), state.done, state.spent, week);
  // Only when it is genuinely not a matter of a better plan. A screen that
  // offered itself every time something was a day late would be furniture.
  if (!b.deep) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'go', screen: 'behind' })}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '13px 14px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--app-line)',
        }}
      >
        <span className="kicker" style={{ display: 'block' }}>
          This week
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(13.5px * var(--text-scale, 1))',
            marginTop: 4,
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          {behindLine(b)}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.65,
            marginTop: 5,
            lineHeight: 1.45,
          }}
        >
          Sort out what still matters →
        </span>
      </button>
    </div>
  );
}
