import { useMemo } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from './Blueprint';
import { SectionLabel } from './ui';
import { forScope, insights, type Insight, type Scope } from '../insights';
import { useAI } from '../ai/store';
import { factsFrom } from '../insights/facts';

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
 *
 * ## One engine, since this file used to be a second one
 *
 * The arithmetic was in `lib/insight.ts` and is now in `src/insights/`, which
 * `worked` also reads. Having both was not a duplication in the abstract: for
 * a while the two ran side by side on the same screen, one saying "You
 * estimate 1 hour 30, you take about 2 hours 35" and the other "You estimate
 * 1.5 hours. You take about 2.5 hours. A ratio of 1.72." Two engines quoting
 * one fact with different rounding is worse than either alone, because the
 * reader has to work out which to believe.
 */
export function Insights({
  most = 3,
  heading = 'What stands out',
  scope = 'all',
}: {
  most?: number;
  heading?: string;
  /** Which surface this is. `worked` takes everything; a brief takes the day. */
  scope?: Scope | 'all';
}) {
  const { state, dispatch, now, catalog } = useStore();
  const ai = useAI();

  const found = useMemo(
    () => forScope(insights(factsFrom(state, catalog, now)), scope, most),
    [state, catalog, now, scope, most],
  );

  if (found.length === 0) return null;

  const act = (f: Insight) => {
    if (!f.action) return;
    // A course-bearing action has to set the course before the screen, or the
    // guide opens on whatever was last looked at — which is the course this
    // finding is telling you that you have been ignoring.
    if (f.courseId) dispatch({ type: 'openGuide', id: f.courseId });
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
              {f.headline}
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
              {f.detail}
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
              {/*
                An insight is an assertion, so it carries the one row in the
                app with an always-visible way to interrogate it. A long press
                is right for a deadline, which is a fact; this is a claim, and
                a claim you cannot question is one you either swallow whole or
                ignore.
              */}
              <button
                type="button"
                className="bare"
                onClick={() => {
                  ai.forgetAbout();
                  ai.register(`about:insight:${f.id}`, {
                    summary: `One finding the app made: ${f.headline}`,
                    focus: {
                      finding: f.headline,
                      detail: f.detail,
                      restsOn: `${f.evidence.length} records`,
                      confidence: f.confidence,
                      ...(f.courseId ? { course: catalog.byId[f.courseId]?.code } : {}),
                    },
                    visible: [],
                    actions: ['open_screen', 'add_task', 'start_timer'],
                    suggestions: [
                      'How sure is this?',
                      'What would change it?',
                      'What should I actually do about it?',
                    ],
                  });
                  ai.show('About this: ');
                }}
                aria-label={`Ask about: ${f.headline}`}
                style={{
                  flex: 'none',
                  width: 'auto',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(11px * var(--text-scale, 1))',
                  letterSpacing: '0.08em',
                  opacity: 0.55,
                }}
              >
                ASK
              </button>
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
                From {f.evidence.length} {f.evidence.length === 1 ? 'record' : 'records'}{f.confidence === 'tentative' ? ', so this may shift' : ''}.
              </span>
            </div>
          </Blueprint>
        ))}
      </div>
    </>
  );
}
