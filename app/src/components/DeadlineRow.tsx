import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { TickBox } from './ui';
import { lateBy, type Standing } from '../lib/standing';
import { isUnderway, openLine } from '../lib/underway';
import type { DatedItem } from '../lib/types';

/**
 * One deadline, readable without opening it.
 *
 * The tick box is the whole point. Marking something done used to mean
 * opening the deadline, finding the button, and coming back — and then the row
 * you returned to looked exactly as it had before, so the only way to check
 * your own work was to open it again. Now the state is on the row, the row can
 * be changed from where you are reading it, and the tap target for ticking is
 * held apart from the tap target for opening so neither steals the other.
 *
 * It lives here rather than in a screen because the calendar and the course
 * page were each drawing their own version of this row, and each one had
 * quietly forgotten to show whether the thing was done.
 *
 * ## Three ways of drawing it
 *
 * `state.feed` is Cards, Compact rows, or Timeline — three genuinely different
 * readings of the same day rather than three skins. Cards separate things and
 * are easiest to tap; rows fit roughly twice as much on a screen, which matters
 * on a heavy Tuesday; the timeline puts everything on one vertical line in due
 * order, which is the only one of the three that shows the *gaps*.
 *
 * The choice is applied here, once, rather than in each screen — the calendar
 * and the course page use this row too, and a setting that only worked on Today
 * would be a setting people report as broken.
 */
export function DeadlineRow({
  item,
  tone,
  meta,
  trail,
}: {
  item: DatedItem;
  tone: Standing;
  /** Overrides the default "date · kind · weight" line. */
  meta?: ReactNode;
  /** Overrides the right-hand marker; pass null to drop it. */
  trail?: ReactNode | null;
}) {
  // `now` rather than `Date.now()`: the store's clock ticks once a minute, so
  // "open 4 days" stays right without making the render impure.
  const { state, dispatch, catalog, now } = useStore();
  const done = !!state.done[item.id];
  const late = tone === 'overdue';
  const style = state.feed;
  // Shown in every list, not only on the Working tab: the whole value of the
  // mark is knowing which of eleven things you have already opened, and that
  // is a question asked while looking at Ahead.
  const going = isUnderway(item.id, state.started, state.done);
  const tight = style === 'rows';
  const pad = tight ? '8px 0' : '13px 0';

  const marker =
    trail === undefined ? (late ? lateBy(item) : item.daysAway === 0 ? 'today' : `${item.daysAway}d`) : trail;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        // Cards get their own edge and a gap; rows and the timeline share one
        // hairline, which is what lets twice as many fit.
        ...(style === 'cards'
          ? {
              background: 'var(--app-panel)',
              border: '1px solid var(--app-line)',
              borderRadius: 'var(--r-md)',
              padding: '0 12px',
              marginBottom: 8,
            }
          : { borderBottom: '1px solid var(--app-line)' }),
        ...(style === 'timeline'
          ? {
              // The line itself, drawn as a left border on every row so it is
              // continuous down the list without a wrapper element that each
              // caller would have to remember to add.
              borderLeft: '2px solid var(--app-line)',
              marginLeft: 7,
              paddingLeft: 12,
            }
          : {}),
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'toggleDone', id: item.id })}
        aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
        style={{ flex: 'none', padding: tight ? '8px 2px 8px 0' : '13px 2px 13px 0', width: 30 }}
      >
        <TickBox on={done} />
      </button>
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'openItem', id: item.id })}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          padding: pad,
          textAlign: 'left',
          opacity: done ? 0.45 : 1,
        }}
      >
        <span className="tag tag-accent" style={{ flex: 'none' }}>
          {catalog.byId[item.c]?.code}
        </span>
        {going && (
          // A pip rather than a word: the row is already carrying a course
          // code, a title, a date, a kind and a weight, and a sixth label
          // would cost more than the fact is worth.
          <span
            aria-hidden
            style={{
              flex: 'none',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--app-accent)',
            }}
          />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 'calc(14px * var(--text-scale, 1))',
              lineHeight: 1.3,
              textDecoration: done ? 'line-through' : 'none',
            }}
          >
            {item.title}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 'calc(11px * var(--text-scale, 1))',
              opacity: 0.55,
              marginTop: tight ? 0 : 2,
              // On one line in compact rows. Dropped entirely would be a
              // deadline with no date on it, which is not "compact".
              whiteSpace: tight ? 'nowrap' : undefined,
              overflow: tight ? 'hidden' : undefined,
              textOverflow: tight ? 'ellipsis' : undefined,
            }}
          >
            {meta ?? (
              <>
                {item.dueShort} · {item.kind}
                {item.weight ? ` · ${item.weight}` : ''}
                {going ? ` · ${openLine(item.id, state.started, now.getTime()).toLowerCase()}` : ''}
              </>
            )}
          </span>
        </span>
        {marker != null && (
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(11px * var(--text-scale, 1))',
              flex: 'none',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: late ? 'var(--app-warn)' : 'inherit',
              opacity: late ? 0.95 : 0.45,
            }}
          >
            {marker}
          </span>
        )}
      </button>
    </div>
  );
}
