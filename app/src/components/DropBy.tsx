import { useMemo } from 'react';
import { useNow, useStore } from '../state/store';
import { draftFor } from '../lib/mail';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { allCards } from '../data/catalog';
import { datedItems } from '../lib/select';
import { tallyBy } from '../lib/review';
import { isOfficeHours, nextSitting, whenLine, worthGoing } from '../lib/officehours';
import { CourseTag } from './CourseTag';
import { Folding } from './Fold';

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
  const { state, dispatch, catalog } = useStore();
  const now = useNow();

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
    <Folding name="DropBy">
      <SectionLabel>Office hours worth going to</SectionLabel>
      {reasons.map((r) => {
        const mod = catalog.modules.find((m) => m.course.id === r.courseId);
        const hours = (mod?.schedule ?? []).filter(isOfficeHours);
        // A sample course cannot be edited, so offering to is a dead end.
        const yours = state.courses.some((c) => c.course.id === r.courseId);
        const next = nextSitting(hours, now);
        const when = whenLine(next, now);

        return (
          <Blueprint plain key={r.courseId} style={{ paddingBlock: 'calc(13px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))', marginBottom: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
              <CourseTag id={r.courseId}>{mod?.course.code ?? r.courseId}</CourseTag>
              {when ? (
                <span style={{ flex: 1, textAlign: 'right', fontSize: 'var(--type-sm)', color: 'var(--app-dim)' }}>
                  {when}
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: 'var(--type-md)', lineHeight: 1.4, marginTop: 'calc(7px * var(--density, 1))' }}>{r.said}</div>

            {next ? (
              <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                {next.block.title}
                {next.block.meta ? ` · ${next.block.meta}` : ''}
              </div>
            ) : (
              /*
               * And when there are none, the sentence saying so — for every
               * course rather than only your own.
               *
               * The doc at the top of this file already promised it: "Where
               * it does not, it says so and offers the editor, because 'they
               * are on your syllabus and the app does not have them' is the
               * more useful sentence in that case than silence." The saying
               * so and the offering were one branch, gated on the course
               * being yours — so for the semester the app ships with, which
               * is what every new student sees first, a section headed
               * "Office hours worth going to" named a course, said what had
               * gone wrong, and never mentioned an office hour at all.
               *
               * Two branches now. The sentence is always there; only the
               * editor is yours-only, because a sample course cannot be
               * edited and offering to is the dead end that gating was for.
               */
              <>
                <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                  {yours
                    ? "The app does not have this course's office hours. They are on the syllabus, and they take a minute to add."
                    : "The app does not have this course's office hours — it is one of the ones this app ships with, and there is no syllabus behind it to read them from."}
                </div>
                {yours ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-block"
                    onClick={() => {
                      dispatch({ type: 'openCourse', id: r.courseId });
                      dispatch({ type: 'go', screen: 'edit' });
                    }}
                    style={{ height: 38, marginTop: 'calc(9px * var(--density, 1))', fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
                  >
                    Add them
                  </button>
                ) : null}
              </>
            )}

            {mod?.course.email ? (
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() =>
                  dispatch({
                    type: 'writeMail',
                    draft: draftFor('meeting', { course: mod.course, to: mod.course.email }),
                  })
                }
                style={{ height: 36, marginTop: 'var(--sp-3)', fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
              >
                Or write to {mod.course.prof || 'them'} first
              </button>
            ) : null}
          </Blueprint>
        );
      })}
    </Folding>
  );
}
