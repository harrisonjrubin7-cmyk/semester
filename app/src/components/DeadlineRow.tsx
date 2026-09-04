import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { TickBox } from './ui';
import { lateBy, type Standing } from '../lib/standing';
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
  const { state, dispatch, catalog } = useStore();
  const done = !!state.done[item.id];
  const late = tone === 'overdue';

  const marker =
    trail === undefined ? (late ? lateBy(item) : item.daysAway === 0 ? 'today' : `${item.daysAway}d`) : trail;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        borderBottom: '1px solid var(--app-line)',
      }}
    >
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'toggleDone', id: item.id })}
        aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
        style={{ flex: 'none', padding: '13px 2px 13px 0', width: 30 }}
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
          padding: '13px 0',
          textAlign: 'left',
          opacity: done ? 0.45 : 1,
        }}
      >
        <span className="tag tag-accent" style={{ flex: 'none' }}>
          {catalog.byId[item.c]?.code}
        </span>
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
          <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>
            {meta ?? (
              <>
                {item.dueShort} · {item.kind}
                {item.weight ? ` · ${item.weight}` : ''}
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
