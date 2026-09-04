/**
 * Any timer that is counting, on Today.
 *
 * A timer you have to navigate to see is half a timer. This is one line per
 * running countdown, tapping through to the screen that can pause it, and
 * nothing at all when none is running — which is most of the time, so it costs
 * a student who never sets one exactly one array check.
 *
 * Paused timers are left out on purpose. A paused timer is not doing anything,
 * and a Today feed that lists things which are not happening is how a feed
 * stops being read.
 */

import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { clockFace, lengthLine, remaining, running } from '../lib/clocks';

export function TimerLine() {
  const { state, dispatch } = useStore();
  const counting = state.timers.filter(running);
  const [at, setAt] = useState(() => Date.now());

  useEffect(() => {
    // Only while something is counting: on Today this is mounted every time
    // the app opens, and an interval that never stops is a battery cost paid
    // by everyone for a feature few use at any given moment.
    if (counting.length === 0) return;
    const id = setInterval(() => setAt(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting.length]);

  if (counting.length === 0) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <SectionLabel style={{ margin: '0 0 8px' }}>Counting</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {counting.map((t) => (
          <button
            key={t.id}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: 'clocks' })}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              padding: '10px 13px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
            }}
          >
            <span
              style={{
                fontSize: 'calc(19px * var(--text-scale, 1))',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {clockFace(remaining(t, at))}
            </span>
            <span
              style={{
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                opacity: 0.65,
                textWrap: 'pretty',
              }}
            >
              {t.label || lengthLine(t.seconds)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
