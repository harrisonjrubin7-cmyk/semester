import { useMemo } from 'react';
import { useStore } from '../state/store';
import { railFor, datedItems } from '../lib/select';
import { clock, minutesNow } from '../lib/date';
import {
  current,
  homeWalk,
  moveOutAt,
  moveOutLine,
  moveOutSoon,
  morningLine,
  packLine,
} from '../lib/housing';

/**
 * What the housing portal knows, on the morning it matters.
 *
 * Two lines, each of which appears only on the day it is any use. Before your
 * first class, what time to leave the building — which needs a residence hall,
 * a classroom, and both of them saved on the map, and says nothing at all if
 * any of the three is missing. In the last three weeks of term, the move-out
 * date and how many exams still stand in front of it.
 *
 * Silent the rest of the time, which is most of the time. A housing card that
 * sat on Today all semester saying "you live in Branscomb" would be the kind
 * of thing people switch off in the first week.
 */
export function HomeWalk() {
  const { state, dispatch, now, catalog } = useStore();

  const mine = useMemo(() => current(state.residences, state.term), [state.residences, state.term]);

  const firstToday = useMemo(() => {
    const first = railFor(catalog, now, state.appointments, state.commitments).find(
      (b) => !b.optional && !b.canceled && b.c !== null,
    );
    if (!first) return null;
    const course = first.c ? catalog.byId[first.c] : null;
    return { title: first.title, room: course?.room ?? first.meta, at: first.at };
  }, [catalog, now, state.appointments, state.commitments]);

  const exams = useMemo(
    () => datedItems(catalog, now).filter((i) => i.kind === 'Exam'),
    [catalog, now],
  );

  const moveOut = useMemo(() => {
    const sorted = [...exams].sort((a, b) => b.date.getTime() - a.date.getTime());
    const last = sorted[0] ? { title: sorted[0].title, date: sorted[0].date } : null;
    return moveOutAt(mine, last);
  }, [mine, exams]);

  if (!mine) return null;

  // Only before it has started. Telling somebody when to leave for a class
  // they are already sitting in is the sort of line that costs the app its
  // credit on every other line.
  const stillToCome = firstToday !== null && firstToday.at > minutesNow(now);
  const walk = homeWalk(mine, firstToday?.room ?? '', state.places);
  const morning =
    stillToCome && walk.known && walk.minutes > 0
      ? morningLine(mine, firstToday, state.places, clock)
      : '';

  const soon = moveOutSoon(moveOut, now);
  if (!morning && !soon) return null;

  return (
    <button
      type="button"
      className="bare"
      onClick={() => dispatch({ type: 'go', screen: 'housing' })}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        marginBottom: 14,
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
      }}
    >
      <div className="kicker">{morning ? 'Before your first class' : 'Move-out'}</div>
      {morning ? (
        <div style={{ fontSize: 14.5, lineHeight: 1.4, marginTop: 5, textWrap: 'pretty' }}>
          {morning}
        </div>
      ) : null}
      {soon ? (
        <div
          style={{
            fontSize: morning ? 12.5 : 14.5,
            opacity: morning ? 0.7 : 1,
            lineHeight: 1.45,
            marginTop: morning ? 7 : 5,
            textWrap: 'pretty',
          }}
        >
          {moveOutLine(moveOut, now)} {packLine(exams, moveOut, now)}
        </div>
      ) : null}
    </button>
  );
}
