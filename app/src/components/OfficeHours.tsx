import { useStore } from '../state/store';
import { useRowStyle } from './shell/useShell';
import { SectionLabel } from './ui';
import { isOfficeHours, nextSitting, whenLine } from '../lib/officehours';
import { Folding } from './Fold';

/**
 * A course's office hours, on the course, always.
 *
 * Unlike the nudge next to it this is not conditional — it is a fact about the
 * course, and it sits with the room and the meeting pattern where a person
 * would look for it. Where a course has none recorded it says so and offers
 * the editor rather than showing nothing, because a missing section is
 * indistinguishable from a professor who holds none.
 */
export function OfficeHours({ courseId }: { courseId: string }) {
  const { state, dispatch, now, catalog } = useStore();
  const row = useRowStyle(9);
  const mod = catalog.modules.find((m) => m.course.id === courseId);
  const hours = (mod?.schedule ?? []).filter(isOfficeHours);
  const yours = state.courses.some((c) => c.course.id === courseId);

  if (hours.length === 0) {
    // Nothing to offer on a sample course, which cannot be edited.
    if (!yours) return null;
    return (
      <Folding name="OfficeHours">
        <SectionLabel style={{ margin: '22px 0 6px' }}>Office hours</SectionLabel>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, lineHeight: 'var(--leading-relaxed)' }}>
          None recorded. They are on the syllabus, and having them here means the app can point at
          them in a week that is going badly.
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'edit' })}
          style={{ height: 40, marginTop: 9, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
        >
          Add them
        </button>
      </Folding>
    );
  }

  const next = nextSitting(hours, now);

  return (
    <Folding name="OfficeHours">
      <SectionLabel style={{ margin: '22px 0 6px' }}>Office hours</SectionLabel>
      {hours.map((h, i) => (
        <div
          key={`${h.title}-${i}`}
          style={{
            display: 'flex',
            gap: 'var(--sp-5)',
            alignItems: 'baseline',
            ...row,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
            {h.title}
            {h.meta ? <span style={{ opacity: 0.55 }}> · {h.meta}</span> : null}
          </span>
          <span style={{ flex: 'none', fontSize: 'var(--type-sm)', opacity: 0.7 }}>{h.time}</span>
        </div>
      ))}
      {next ? (
        <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
          Next: {whenLine(next, now)}.
        </div>
      ) : null}
    </Folding>
  );
}
