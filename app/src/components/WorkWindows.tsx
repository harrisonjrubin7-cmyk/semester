import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { SUGGESTED, daysLine, hoursAWeek, spanLine, tidy } from '../lib/windows';

const DAYS = [
  { day: 0, label: 'S' },
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
];

/** "19:00" from minutes, and back — what an <input type=time> speaks. */
const toField = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromField = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/**
 * The hours you actually work in, set once.
 *
 * Two or three spans and the days they run on. Not a chronotype quiz and not a
 * schedule — nothing is ever placed into a window. It is the answer to "how
 * many hours are actually there", which every hour figure in the app was
 * previously guessing at with a constant.
 *
 * Suggestions rather than a blank "add a window", because three plausible
 * answers to adjust is a much easier question than an empty form.
 */
export function WorkWindows() {
  const { state, dispatch } = useStore();
  const windows = state.windows;

  return (
    <>
      <SectionLabel>When you actually work</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, marginBottom: 10 }}>
        The app counts a day as sixteen waking hours until you say otherwise, which is a default
        rather than a fact about you. Two or three windows here make every hour figure in the app
        true — the week ahead, the exam runway, what is left over.
      </div>

      {windows.map((w) => (
        <div
          key={w.id}
          style={{
            padding: '11px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              value={w.label}
              aria-label="What to call this window"
              placeholder="Weekday evenings"
              onChange={(e) =>
                dispatch({ type: 'patchWindow', id: w.id, patch: { label: e.target.value } })
              }
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'calc(13px * var(--text-scale, 1))' }}
            />
            <button
              type="button"
              className="bare"
              aria-label={`Remove ${w.label || 'this window'}`}
              onClick={() => dispatch({ type: 'dropWindow', id: w.id })}
              style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 'calc(15px * var(--text-scale, 1))' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            {DAYS.map((d, i) => {
              const on = w.days.includes(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                  onClick={() =>
                    dispatch({
                      type: 'patchWindow',
                      id: w.id,
                      patch: {
                        days: on ? w.days.filter((x) => x !== d.day) : [...w.days, d.day],
                      },
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: 'calc(11px * var(--text-scale, 1))',
                    background: on ? 'var(--app-accent-wash)' : 'transparent',
                    borderColor: on ? 'var(--app-accent-deep)' : 'var(--app-line)',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <input
              className="input"
              type="time"
              value={toField(w.from)}
              aria-label="From"
              onChange={(e) => {
                const m = fromField(e.target.value);
                if (m !== null) dispatch({ type: 'patchWindow', id: w.id, patch: { from: m } });
              }}
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'calc(13px * var(--text-scale, 1))' }}
            />
            <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.45, flex: 'none' }}>to</span>
            <input
              className="input"
              type="time"
              value={toField(w.to)}
              aria-label="To"
              onChange={(e) => {
                const m = fromField(e.target.value);
                if (m !== null) dispatch({ type: 'patchWindow', id: w.id, patch: { to: m } });
              }}
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'calc(13px * var(--text-scale, 1))' }}
            />
          </div>

          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 6 }}>
            {tidy(w)
              ? `${daysLine(w.days)} · ${spanLine(w)} · ${hoursAWeek([w])} hours a week`
              : 'Pick at least one day, and an end after the start. Counted as nothing until you do.'}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
        {SUGGESTED.filter((s) => !windows.some((w) => w.label === s.label)).map((s) => (
          <button
            key={s.label}
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'addWindow', window: s })}
            style={{ height: 34, fontSize: 'calc(12px * var(--text-scale, 1))', padding: '0 11px', flex: 'none' }}
          >
            + {s.label}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            dispatch({
              type: 'addWindow',
              window: { label: '', days: [1, 2, 3, 4, 5], from: 9 * 60, to: 12 * 60 },
            })
          }
          style={{ height: 34, fontSize: 'calc(12px * var(--text-scale, 1))', padding: '0 11px', flex: 'none' }}
        >
          + One of your own
        </button>
      </div>

      {windows.length > 0 && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 10, lineHeight: 1.45 }}>
          {hoursAWeek(windows)} hours a week before anything is promised. Nothing is ever scheduled
          into a window — this only says how many hours are actually there.
        </div>
      )}
    </>
  );
}
