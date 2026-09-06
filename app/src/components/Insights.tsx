import { useMemo } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from './Blueprint';
import { SectionLabel } from './ui';
import { MOST, topInsights, type Insight } from '../lib/insight';

/**
 * What the app noticed, and the one thing to do about each.
 *
 * The arithmetic is in `lib/insight.ts` and the rules are written there. This
 * is only the rendering, and it has two jobs the library cannot do.
 *
 * **It shows the evidence.** Every finding prints what it rests on, under the
 * advice, in the person's own units — "from 3 of your own reports". The number
 * is small on purpose and present on purpose: advice you cannot weigh is advice
 * you either swallow whole or ignore, and both are worse than advice you can
 * check.
 *
 * **It renders nothing when there is nothing.** No "you're all caught up",
 * no encouraging placeholder. A section that always appears is a section people
 * stop seeing, and this one is worth seeing precisely because it is not always
 * there.
 *
 * It sits inside the reports rather than on a screen of its own. Somebody
 * reading their week is already in the frame of mind to act on it; a separate
 * Insights tab would be a place you go when you already know something is
 * wrong, which is exactly when you do not need to be told.
 */
export function Insights({ most = MOST, heading = 'What stands out' }: { most?: number; heading?: string }) {
  const { state, dispatch, now, catalog, courseCode } = useStore();

  const found = useMemo(
    () =>
      topInsights(
        {
          catalog,
          now,
          done: state.done,
          spent: state.spent,
          sittings: state.sittings,
          reviews: state.reviews,
          code: courseCode,
        },
        most,
      ),
    [catalog, now, state.done, state.spent, state.sittings, state.reviews, courseCode, most],
  );

  if (found.length === 0) return null;

  const act = (f: Insight) => {
    if (!f.action) return;
    // A course-bearing action has to set the course before the screen, or the
    // guide opens on whatever was last looked at — which is the course this
    // finding is telling you that you have been ignoring.
    if (f.action.courseId) dispatch({ type: 'openGuide', id: f.action.courseId });
    dispatch({ type: 'go', screen: f.action.screen });
  };

  return (
    <>
      <SectionLabel>{heading}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {found.map((f) => (
          <Blueprint key={f.id} plain style={{ padding: '13px 14px' }}>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'calc(15px * var(--text-scale, 1))',
                lineHeight: 1.3,
                textWrap: 'pretty',
              }}
            >
              {f.title}
            </div>
            <div
              style={{
                fontSize: 'calc(13px * var(--text-scale, 1))',
                opacity: 0.75,
                lineHeight: 1.5,
                marginTop: 5,
                textWrap: 'pretty',
              }}
            >
              {f.body}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
                flexWrap: 'wrap',
              }}
            >
              {f.action && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => act(f)}
                  style={{
                    height: 34,
                    flex: 'none',
                    width: 'auto',
                    padding: '0 12px',
                    fontSize: 'calc(11.5px * var(--text-scale, 1))',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {f.action.label}
                </button>
              )}
              {/* The receipt. Small, and never omitted. */}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  opacity: 0.45,
                  lineHeight: 1.4,
                  textWrap: 'pretty',
                }}
              >
                Based on {f.from}.
              </span>
            </div>
          </Blueprint>
        ))}
      </div>
    </>
  );
}
