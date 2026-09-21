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

import { useNow, useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { NO_WINDOW, closing, windowLine } from '../lib/returned';
import { Folding } from './Fold';

export function ClosingWindows() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const soon = closing(
    state.returned,
    (courseId) => state.regradeWindows[courseId] ?? NO_WINDOW,
    now,
  );
  if (soon.length === 0) return null;

  const all = datedItems(catalog, now);

  return (
    <Folding name="Windows">
      <div style={{ marginTop: 'calc(14px * var(--density, 1))' }}>
        <SectionLabel style={{ marginTop: '0', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>Time to say something</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
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
                  paddingBlock: 'calc(10px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
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
                    color: 'var(--app-dim)',
                    marginTop: 'calc(3px * var(--density, 1))',
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
    </Folding>
  );
}
