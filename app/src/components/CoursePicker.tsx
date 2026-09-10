import { useStore } from '../state/store';
import type { CourseId } from '../lib/types';

/**
 * Which course a thing belongs to, or none.
 *
 * A row of the term's courses with "Personal" at the front, which is what
 * every add form in the app needs and what four of them had each written out
 * by hand. It lived privately inside `screens/Mine.tsx` until the making
 * screens needed the same answer; a second copy would have been the fifth,
 * and the drift `components/ui.tsx` describes at length would have started
 * again — a padding of 5px here and 7px there, and the same control looking
 * like two.
 *
 * "Personal" rather than "None": a document filed against no course is not
 * missing a course, it is yours. The word matters on a screen where every
 * other chip is a course code.
 */
export function CoursePicker({
  value,
  onChange,
  none = 'Personal',
  style,
}: {
  value: CourseId | null;
  onChange: (id: CourseId | null) => void;
  /** What the first chip says, where "Personal" is the wrong word. */
  none?: string;
  style?: React.CSSProperties;
}) {
  const { catalog } = useStore();
  return (
    <div className="chiprow" style={{ marginTop: 'var(--sp-5)', ...style }}>
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        {[{ id: null, label: none }, ...catalog.courses.map((c) => ({ id: c.id, label: c.code }))].map(
          (o) => {
            const on = value === o.id;
            return (
              <button
                key={o.label}
                type="button"
                className="btn"
                onClick={() => onChange(o.id as CourseId | null)}
                aria-pressed={on}
                style={{
                  flex: 'none',
                  padding: 'var(--sp-3) var(--sp-6)',
                  fontSize: 'var(--type-xs)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: on ? 'var(--chrome)' : 'transparent',
                  color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                  borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                  fontWeight: on ? 600 : 400,
                }}
              >
                {o.label}
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}
