/**
 * Silencing one course without silencing the app.
 *
 * Every other reminder control here is a rule — a kind of thing, a lead time,
 * an hour. None of them can express the commonest reason a student turns
 * notifications off altogether: one course is noisy. A seminar with a reading
 * response due every session produces a deadline reminder every session, and
 * the student who has already built that into their week does not need seven
 * of them a term to find out. Their choice is currently between that and
 * hearing nothing about the other four courses either, which is how a phone
 * ends up with this app muted at the operating system.
 *
 * So this is the subtractive half of `MyRules`, which is explicit that it can
 * only add ("nothing here can make a reminder stop arriving"). A muted course
 * is dropped from what the reminders see, once, in `dueReminders` — not per
 * rule, and not per caller. See `lib/notify.ts`.
 *
 * ## It says what it costs
 *
 * A switch that quietly stops telling somebody about a deadline is a switch
 * that has to be honest about it, so the line under each muted course names
 * what stops: not just the nudges, the class warnings too. A student who
 * silences a course and then misses the exam date should have been told that
 * was the deal at the moment they chose it, not afterwards.
 */

import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { secondLine } from '../lib/dim';
import { ItemRow } from './shell/Rows';

export function MuteCourses() {
  const { state, dispatch, catalog } = useStore();
  const muted = state.mutedCourses;

  // Nothing to mute is not a control worth drawing — a student with no
  // courses imported reads an empty switch list as a broken screen.
  if (catalog.courses.length === 0) return null;

  return (
    <>
      <SectionLabel
        style={{
          marginTop: 'calc(26px * var(--density, 1))',
          marginBottom: 'calc(6px * var(--density, 1))',
        }}
      >
        Silence a course
      </SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-base)',
          marginBottom: 'var(--sp-5)',
          textWrap: 'pretty',
          ...secondLine(),
        }}
      >
        Everything above applies to every course. Tick one here and it is left out of all of it —
        the reminders, the morning summary, the fifteen-minute class warning. Its deadlines stay
        on your screens; the phone just stops mentioning them.
      </div>

      {catalog.courses.map((c) => {
        const off = muted.includes(c.id);
        return (
          <ItemRow
            key={c.id}
            role="switch"
            ariaChecked={off}
            ariaLabel={off ? `Unmute ${c.code}` : `Mute ${c.code}`}
            onClick={() => dispatch({ type: 'muteCourse', courseId: c.id, on: !off })}
            /*
              The code leads and the name sits under it, where this drew them
              side by side with the name clipped to an ellipsis. Stacking is
              `ItemRow`'s shape and it is the better one here: on a phone the
              name is the half that was being cut, and it is what somebody
              scans when two courses share a department.
            */
            title={c.code}
            meta={c.name}
            trailing={
              <span
                style={{
                  fontSize: 'var(--type-xs)',
                  color: off ? 'var(--app-warn)' : undefined,
                  ...(off ? {} : secondLine()),
                }}
              >
                {off ? 'silenced' : 'on'}
              </span>
            }
          />
        );
      })}

      {muted.length > 0 ? (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
            ...secondLine(),
          }}
        >
          {/* Counted and named, because the whole failure this guards against
              is forgetting a course was silenced in week two and wondering in
              week nine why nothing arrives about it. */}
          Nothing will be sent about{' '}
          {catalog.courses
            .filter((c) => muted.includes(c.id))
            .map((c) => c.code)
            .join(', ')}
          , including exams.
        </div>
      ) : null}
    </>
  );
}
