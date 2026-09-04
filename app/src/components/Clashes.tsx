/**
 * The days ahead that are going to hurt.
 *
 * Two shapes from one source. On Today it is a single line about the nearest
 * hard day, because a screen that opens with four warnings is a screen people
 * learn to scroll past. In the week ahead it is the full list, where somebody
 * has already come to look at the shape of a fortnight.
 *
 * Each one carries what to do about it. A warning without that is a
 * description, and the app has never been short of those.
 */

import { useMemo } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { adviceFor, clashes, whenLine, worstAhead, type Clash } from '../lib/clash';

function useClashes(): Clash[] {
  const { state, now, catalog, courseCode } = useStore();
  return useMemo(
    () =>
      clashes(
        // Ticked work is not a clash. What counts as done is the store's
        // business, so it is filtered here rather than inside `lib/clash.ts`.
        datedItems(catalog, now).filter((i) => !state.done[i.id]),
        state.spent,
        state.commitments,
        courseCode,
        state.dayBudget,
      ),
    [catalog, now, state.done, state.spent, state.commitments, courseCode, state.dayBudget],
  );
}

/**
 * Opening a day takes three dispatches, not one.
 *
 * `setCalDay` alone changes which day the calendar has selected and leaves you
 * looking at the screen you were already on — which is a tappable row that
 * appears to do nothing. The view has to be put into `day` and the calendar
 * has to be gone to as well.
 */
function useOpenDay(): (date: string) => void {
  const { dispatch } = useStore();
  return (date: string) => {
    dispatch({ type: 'setCalDay', date });
    dispatch({ type: 'setCalView', view: 'day' });
    dispatch({ type: 'go', screen: 'calendar' });
  };
}

function Row({ c, onOpen }: { c: Clash; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onOpen}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 13px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-warn-line)',
        background: 'var(--app-warn-wash)',
      }}
    >
      <span className="kicker" style={{ display: 'block' }}>
        {whenLine(c)}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 'calc(14px * var(--text-scale, 1))',
          marginTop: 4,
          lineHeight: 1.4,
          textWrap: 'pretty',
        }}
      >
        {c.says}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.7,
          marginTop: 5,
          lineHeight: 1.45,
          textWrap: 'pretty',
        }}
      >
        {adviceFor(c)}
      </span>
    </button>
  );
}

/** One line on Today, or nothing. */
export function WorstDay() {
  const openDay = useOpenDay();
  const worst = worstAhead(useClashes());
  if (!worst) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <Row c={worst} onOpen={() => openDay(worst.date)} />
    </div>
  );
}

/**
 * What counts as a heavy day, set by the person having it.
 *
 * Four hours is a default, not a fact. A student with a shift most evenings
 * and one with none do not have the same day, and the warning is worth
 * nothing to either unless the line is where they would draw it.
 *
 * Shown whether or not anything is currently flagged — somebody who thinks
 * three hours is plenty needs to be able to say so on a quiet week, which is
 * exactly the week the list is empty.
 */
export function DayBudget() {
  const { state, dispatch } = useStore();
  const hours = state.dayBudget;

  const step = (delta: number) =>
    dispatch({ type: 'setDayBudget', hours: hours + delta });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
        fontSize: 'calc(12px * var(--text-scale, 1))',
        opacity: 0.7,
      }}
    >
      <span style={{ textWrap: 'pretty' }}>
        A day is heavy past {hours === 1 ? '1 hour' : `${hours} hours`} of coursework.
      </span>
      <span style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
        <button
          type="button"
          className="bare tappable"
          onClick={() => step(-0.5)}
          disabled={hours <= 1}
          aria-label="Fewer hours before a day counts as heavy"
          style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', border: '1px solid var(--app-line)' }}
        >
          −
        </button>
        <button
          type="button"
          className="bare tappable"
          onClick={() => step(0.5)}
          disabled={hours >= 16}
          aria-label="More hours before a day counts as heavy"
          style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', border: '1px solid var(--app-line)' }}
        >
          +
        </button>
      </span>
    </div>
  );
}

/** The full list, for a screen somebody opened to look at the fortnight. */
export function ClashList() {
  const openDay = useOpenDay();
  const all = useClashes();
  if (all.length === 0) return null;

  return (
    <>
      <SectionLabel style={{ margin: 'calc(24px * var(--density, 1)) 0 calc(8px * var(--density, 1))' }}>
        Worth seeing coming
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {all.map((c, i) => (
          <Row
            key={`${c.date}:${c.kind}:${i}`}
            c={c}
            onOpen={() => openDay(c.date)}
          />
        ))}
      </div>
    </>
  );
}
