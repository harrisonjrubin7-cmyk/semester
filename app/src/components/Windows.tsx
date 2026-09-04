/**
 * Regrade windows about to shut, on Today.
 *
 * This is the half that makes the feature worth having. Recording that
 * something came back is a note to yourself; a note to yourself is not a
 * deadline, and the whole problem with a seven-day window is that it runs out
 * while you are deciding whether to use it.
 *
 * Only the open ones, soonest to close first. A window that has shut is not a
 * task, and one that has been raised is finished.
 */

import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { NO_WINDOW, closing, windowLine } from '../lib/returned';

export function ClosingWindows() {
  const { state, dispatch, now, catalog } = useStore();
  const soon = closing(
    state.returned,
    (courseId) => state.regradeWindows[courseId] ?? NO_WINDOW,
    now,
  );
  if (soon.length === 0) return null;

  const all = datedItems(catalog, now);

  return (
    <div style={{ marginTop: 14 }}>
      <SectionLabel style={{ margin: '0 0 8px' }}>Time to say something</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {soon.map((r) => {
          const item = all.find((i) => i.id === r.id);
          return (
            <button
              key={r.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: r.id })}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 13px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--app-warn-line)',
                background: 'var(--app-warn-wash)',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(13.5px * var(--text-scale, 1))',
                  lineHeight: 1.35,
                  textWrap: 'pretty',
                }}
              >
                {item?.title ?? 'A piece of work'}
                {r.score ? ` · ${r.score}` : ''}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.7,
                  marginTop: 3,
                  textWrap: 'pretty',
                }}
              >
                {windowLine(r, state.regradeWindows[r.courseId] ?? NO_WINDOW, now)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
