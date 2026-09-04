import { useMemo } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { allCards } from '../data/catalog';
import { datedItems } from '../lib/select';
import { tallyBy } from '../lib/review';
import { isOfficeHours, nextSitting, whenLine, worthGoing } from '../lib/officehours';

/**
 * "This is the week to go", when the app can say why.
 *
 * Silent almost always, which is the entire design. It speaks when one of
 * three things has happened — two deadlines gone by unticked, a practice paper
 * under sixty, a drill deck you are missing more than you are getting — and it
 * says which one, with the number in it, and then stops. No score and no
 * advice about what to say when you get there.
 *
 * Where the course has office hours recorded it names the next one. Where it
 * does not, it says so and offers the editor, because "they are on your
 * syllabus and the app does not have them" is the more useful sentence in that
 * case than silence.
 */
export function DropBy({ courseId, limit }: { courseId?: string; limit?: number }) {
  const { state, dispatch, now, catalog } = useStore();

  const drilled = useMemo(
    () =>
      tallyBy(
        state.reviews,
        catalog.modules.map((m) => ({
          courseId: m.course.id,
          questions: allCards(m.guide).map((c) => c.q),
        })),
      ),
    [state.reviews, catalog.modules],
  );

  const reasons = useMemo(
    () =>
      worthGoing({
        items: datedItems(catalog, now),
        done: state.done,
        sittings: state.sittings,
        drilled,
        now,
      })
        .filter((r) => (courseId ? r.courseId === courseId : true))
        // Today shows two. Four cards each naming something going wrong is a
        // verdict on your semester, which is the one thing this is not for;
        // the course's own page carries its own without a cap.
        .slice(0, limit ?? Infinity),
    [catalog, now, state.done, state.sittings, drilled, courseId, limit],
  );

  if (reasons.length === 0) return null;

  return (
    <>
      <SectionLabel>Worth dropping by</SectionLabel>
      {reasons.map((r) => {
        const mod = catalog.modules.find((m) => m.course.id === r.courseId);
        const hours = (mod?.schedule ?? []).filter(isOfficeHours);
        // A sample course cannot be edited, so offering to is a dead end.
        const yours = state.courses.some((c) => c.course.id === r.courseId);
        const next = nextSitting(hours, now);
        const when = whenLine(next, now);

        return (
          <Blueprint key={r.courseId} style={{ padding: '13px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span className="tag tag-accent">{mod?.course.code ?? r.courseId}</span>
              {when ? (
                <span style={{ flex: 1, textAlign: 'right', fontSize: 12, opacity: 0.7 }}>
                  {when}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.4, marginTop: 7 }}>{r.said}</div>

            {next ? (
              <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 6, lineHeight: 1.45 }}>
                {next.block.title}
                {next.block.meta ? ` · ${next.block.meta}` : ''}
              </div>
            ) : yours ? (
              <>
                <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 6, lineHeight: 1.45 }}>
                  The app does not have this course's office hours. They are on the syllabus, and
                  they take a minute to add.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => {
                    dispatch({ type: 'openCourse', id: r.courseId });
                    dispatch({ type: 'go', screen: 'edit' });
                  }}
                  style={{ height: 38, marginTop: 9, fontSize: 12.5 }}
                >
                  Add them
                </button>
              </>
            ) : null}

            {mod?.course.email ? (
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() =>
                  dispatch({
                    type: 'writeMail',
                    purposeId: 'meeting',
                    courseId: r.courseId,
                    to: mod.course.email,
                  })
                }
                style={{ height: 36, marginTop: 6, fontSize: 12.5 }}
              >
                Or write to {mod.course.prof || 'them'} first
              </button>
            ) : null}
          </Blueprint>
        );
      })}
    </>
  );
}
