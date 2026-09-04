import { useMemo } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { dueByDay, weekLabel, weekLine } from '../lib/weekpage';
import { clock } from '../lib/date';
import { hasTime } from '../lib/duetime';

/**
 * The week's deadlines, under the grid it cannot draw them on.
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

  const days = useMemo(
    () => dueByDay(datedItems(catalog, now), start),
    [catalog, now, start],
  );

  return (
    <>
      <SectionLabel>Due this week</SectionLabel>
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 8, lineHeight: 1.5 }}>
        {weekLabel(start)} · {weekLine(days, classes)}
      </div>

      {days.map((d) => (
        <div
          key={d.date.toISOString()}
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'baseline',
            padding: '8px 0',
            borderBottom: '1px solid var(--app-line)',
            minHeight: 26,
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 46,
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(11px * var(--text-scale, 1))',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: d.items.length > 0 ? 0.8 : 0.35,
            }}
          >
            {d.label}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {d.items.length === 0 ? (
              <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.3 }}>—</span>
            ) : (
              d.items.map((i) => (
                <div
                  key={i.id}
                  style={{
                    fontSize: 'calc(13px * var(--text-scale, 1))',
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
          </div>
        </div>
      ))}
    </>
  );
}
