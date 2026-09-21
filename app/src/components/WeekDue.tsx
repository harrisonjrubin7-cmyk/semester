import { useMemo } from 'react';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { useRowStyle } from './shell/useShell';
import { useNow, useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { dueByDay, weekLabel, weekLine, type Span } from '../lib/weekpage';
import { clock } from '../lib/date';
import { hasTime } from '../lib/duetime';
import { Folding } from './Fold';

/**
 * The week's deadlines and your own tasks, under the grid it cannot draw them
 * on.
 *
 * The grid holds spans: a class occupies an hour and can be a rectangle. A
 * deadline is a moment, so the week view left them out entirely and pointed
 * at the month view instead — defensible on a screen you can tap through and
 * indefensible on paper, where the week you pinned up is the whole of what
 * you can see.
 *
 * Every day is listed, including the empty ones, because the point of a week
 * on paper is the space next to Thursday as much as the four things already
 * on Tuesday.
 */
export function WeekDue({
  start,
  classes,
  span = 7,
}: {
  start: Date;
  classes: number;
  /** Three days on a phone, seven where there is room. See `lib/weekpage.ts`. */
  span?: Span;
}) {
  const { state, catalog, courseCode } = useStore();
  const now = useNow();
  const row = useRowStyle(8);

  /*
   * Your tasks are here as well as on the grid, and the two do not overlap.
   *
   * The grid can only draw a task that names an hour — most do not, and
   * "before work" is a real answer to when — so without this the week showed
   * a day of your own work as an empty column. Every task dated in the week
   * is listed, the timed ones included: a printed week is the whole of what
   * you can see when it is on a wall, and "it is drawn above" is no answer
   * there.
   */
  const days = useMemo(
    () => dueByDay(datedItems(catalog, now), start, state.tasks, span),
    [catalog, now, start, state.tasks, span],
  );

  /* What to call the days below, in the heading and at the end of the line. */
  const when = span === 7 ? 'this week' : 'these three days';

  return (
    <Folding name="WeekDue">
      <SectionLabel>Due {when}</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
        {weekLabel(start, span)} · {weekLine(days, classes, when)}
      </div>

      {days.map((d) => (
        <div
          key={d.date.toISOString()}
          style={{
            display: 'flex',
            gap: 'var(--sp-6)',
            alignItems: 'baseline',
            ...row,
            minHeight: 26,
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 46,
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: d.items.length + d.tasks.length > 0 ? 'var(--app-dim)' : 'var(--app-faint)',
            }}
          >
            {d.label}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {d.items.length + d.tasks.length === 0 ? (
              <span style={{ fontSize: 'var(--type-sm-plus)', ...secondLine() }}>—</span>
            ) : (
              d.items.map((i) => (
                <div
                  key={i.id}
                  style={{
                    fontSize: 'var(--type-base)',
                    lineHeight: 'var(--leading-normal-minus)',
                    marginBottom: 'calc(3px * var(--density, 1))',
                    opacity: state.done[i.id] ? DIMMED_ROW : 1,
                    textDecoration: state.done[i.id] ? 'line-through' : 'none',
                  }}
                >
                  <span style={{ color: 'var(--app-dim)' }}>{courseCode(i.c)} · </span>
                  {i.title}
                  {/* The clock where the wording holds one, otherwise the
                      syllabus's own words. "Before class" is what it says and
                      is more use than the kind's label, which for anything
                      uncategorised reads "Other". */}
                  <span style={{ color: 'var(--app-dim)', fontSize: 'var(--type-xs-plus)' }}>
                    {' '}
                    {hasTime(i.dueTime) ? clock(i.dueAt) : i.dueTime.trim()}
                  </span>
                </div>
              ))
            )}
            {/* Yours, under the syllabus's, and never mixed into them: the
                tag is the whole point, because a week you can check against
                the PDF is a week that says which lines came out of it. */}
            {d.tasks.map((t) => (
              <div
                key={t.id}
                style={{
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-normal)',
                  marginBottom: 'var(--sp-1)',
                  opacity: t.done ? DIMMED_ROW : 1,
                  textDecoration: t.done ? 'line-through' : 'none',
                }}
              >
                <span className="tag tag-neutral" style={{ marginRight: 'var(--sp-3)' }}>
                  Yours
                </span>
                {t.title}
                {t.time.trim() && (
                  <span style={{ ...secondLine(t.done), fontSize: 'var(--type-xs)' }}> {t.time.trim()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Folding>
  );
}
