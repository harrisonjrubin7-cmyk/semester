/**
 * The timer, visible from wherever you are.
 *
 * A clock you can only see on the screen you started it from is a clock you
 * leave running — you open the reading, start it, look something up on the
 * calendar, and it is gone. That is exactly the eight-hour session the
 * recording rules have to throw away, so the cheapest fix is to keep it in
 * front of you.
 *
 * It sits in the header, it says how long and on what, and tapping it goes
 * back to the thing being worked on. It does not offer Stop: stopping is where
 * the minutes are decided, and that belongs next to the work rather than on a
 * strip at the top of an unrelated screen.
 */

import { useStore } from '../state/store';
import { useSitting } from '../lib/sitting.hook';
import { abandoned, clockLine, elapsed, running } from '../lib/session';

export function Running() {
  // The store's clock ticks every thirty seconds already, so this follows it
  // rather than keeping an interval of its own alive on every screen.
  const { state, dispatch, now } = useStore();
  const [sitting] = useSitting();

  // Nothing while paused: a paused timer is not costing anybody anything, and
  // a permanent badge for it would be the sort of chrome people learn to stop
  // seeing — which is the failure this is here to prevent.
  if (!sitting || !running(sitting)) return null;
  // Nor on the screen it belongs to, which is already showing the real thing.
  if (state.screen === 'item' && state.itemId === sitting.id) return null;

  const lost = abandoned(sitting, now.getTime());

  return (
    <button
      type="button"
      className="bare tappable"
      onClick={() => {
        if (sitting.id) dispatch({ type: 'openItem', id: sitting.id });
      }}
      aria-label={`Timer running on ${sitting.title || 'your work'}: ${clockLine(
        elapsed(sitting, now.getTime()),
      )}. Open it.`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        width: 'auto',
        flex: 'none',
        padding: '0 9px',
        height: 28,
        borderRadius: 999,
        border: `1px solid ${lost ? 'var(--app-warn-line)' : 'var(--app-line-top)'}`,
        background: lost ? 'var(--app-warn-wash)' : 'var(--app-hero)',
        fontSize: 'calc(11.5px * var(--text-scale, 1))',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 6,
          background: lost ? 'var(--app-warn)' : 'var(--app-accent-fill)',
        }}
      />
      {clockLine(elapsed(sitting, now.getTime()))}
    </button>
  );
}
