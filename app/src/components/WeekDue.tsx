import { useMemo } from 'react';
import { useRowStyle } from './shell/useShell';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { dueByDay, weekLabel, weekLine } from '../lib/weekpage';
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
export function WeekDue({ start, classes }: { start: Date; classes: number }) {
  const { state, now, catalog, courseCode } = useStore();
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
    () => dueByDay(datedItems(catalog, now), start, state.tasks),
    [catalog, now, start, state.tasks],
  );

  return (
    <Folding name="WeekDue">
      <SectionLabel>Due this week</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
        {weekLabel(start)} · {weekLine(days, classes)}
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
              opacity: d.items.length + d.tasks.length > 0 ? 0.8 : 0.35,
            }}
          >
            {d.label}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {d.items.length + d.tasks.length === 0 ? (
              <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.3 }}>—</span>
            ) : (
              d.items.map((i) => (
                <div
                  key={i.id}
                  style={{
                    fontSize: 'var(--type-base)',
                    lineHeight: 1.4,
                    marginBottom: 3,
                    opacity: state.done[i.id] ? 0.45 : 1,
                    textDecoration: state.done[i.id] ? 'line-through' : 'none',
                  }}
                >
                  <span style={{ opacity: 0.6 }}>{courseCode(i.c)} · </span>
                  {i.title}
                  {/* The clock where the wording holds one, otherwise the
                      syllabus's own words. "Before class" is what it says and
                      is more use than the kind's label, which for anything
                      uncategorised reads "Other". */}
                  <span style={{ opacity: 0.5, fontSize: 'calc(11.5px * var(--text-scale, 1))' }}>
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
                  opacity: t.done ? 0.45 : 1,
                  textDecoration: t.done ? 'line-through' : 'none',
                }}
              >
                <span className="tag tag-neutral" style={{ marginRight: 'var(--sp-3)' }}>
                  Yours
                </span>
                {t.title}
                {t.time.trim() && (
                  <span style={{ opacity: 0.5, fontSize: 'var(--type-xs)' }}> {t.time.trim()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Folding>
  );
}
