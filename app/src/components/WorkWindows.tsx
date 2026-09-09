import { useStore } from '../state/store';
import { useRowStyle } from './shell/useShell';
import { SectionLabel } from './ui';
import { SUGGESTED, daysLine, hoursAWeek, spanLine, tidy } from '../lib/windows';
import { Folding } from './Fold';

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
  const row = useRowStyle(11);
  const windows = state.windows;

  return (
    <Folding name="WorkWindows">
      <SectionLabel>When you actually work</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-5)' }}>
        The app counts a day as sixteen waking hours until you say otherwise, which is a default
        rather than a fact about you. Two or three windows here make every hour figure in the app
        true — the week ahead, the exam runway, what is left over.
      </div>

      {windows.map((w) => (
        <div
          key={w.id}
          style={{
            ...row,
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
            <input
              className="input"
              value={w.label}
              aria-label="What to call this window"
              placeholder="Weekday evenings"
              onChange={(e) =>
                dispatch({ type: 'patchWindow', id: w.id, patch: { label: e.target.value } })
              }
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
            />
            <button
              type="button"
              className="bare"
              aria-label={`Remove ${w.label || 'this window'}`}
              onClick={() => dispatch({ type: 'dropWindow', id: w.id })}
              style={{ width: 30, flex: 'none', opacity: 0.5, fontSize: 'var(--type-lg)' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
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
                    fontSize: 'var(--type-xs)',
                    background: on ? 'var(--app-accent-wash)' : 'transparent',
                    borderColor: on ? 'var(--app-accent-deep)' : 'var(--app-line)',
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)', alignItems: 'center' }}>
            <input
              className="input"
              type="time"
              value={toField(w.from)}
              aria-label="From"
              onChange={(e) => {
                const m = fromField(e.target.value);
                if (m !== null) dispatch({ type: 'patchWindow', id: w.id, patch: { from: m } });
              }}
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
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
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
            />
          </div>

          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-3)' }}>
            {tidy(w)
              ? `${daysLine(w.days)} · ${spanLine(w)} · ${hoursAWeek([w])} hours a week`
              : 'Pick at least one day, and an end after the start. Counted as nothing until you do.'}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginTop: 'var(--sp-6)' }}>
        {SUGGESTED.filter((s) => !windows.some((w) => w.label === s.label)).map((s) => (
          <button
            key={s.label}
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'addWindow', window: s })}
            style={{ height: 34, fontSize: 'var(--type-sm)', padding: '0 11px', flex: 'none' }}
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
          style={{ height: 34, fontSize: 'var(--type-sm)', padding: '0 11px', flex: 'none' }}
        >
          + One of your own
        </button>
      </div>

      {windows.length > 0 && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
          {hoursAWeek(windows)} hours a week before anything is promised. Nothing is ever scheduled
          into a window — this only says how many hours are actually there.
        </div>
      )}
    </Folding>
  );
}
