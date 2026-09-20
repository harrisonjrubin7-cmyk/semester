/**
 * Whether the week you have planned is one a human can have.
 *
 * The app could tell you what was due and could not tell you the plan was
 * impossible. Saying so on Monday is worth more than any reminder on
 * Thursday — and the sentence has to be said without softening, because
 * calling nineteen hours out of eleven "ambitious" wastes the one chance to
 * say it while something can still be done.
 *
 * The floor is off by default. Turning a constraint on for somebody who never
 * asked for it is the fastest way to have it turned off for good.
 */

import { useNow, useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { forecast } from '../lib/pace';
import { SUGGESTED_REST, keeps, over, takenLine, verdict, weekCapacity } from '../lib/rest';
import { Folding } from './Fold';

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function Capacity() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();

  const week = datedItems(catalog, now).filter(
    (i) => !state.done[i.id] && i.daysAway >= 0 && i.daysAway <= 7,
  );
  const needed = forecast(state.spent, week.map((i) => ({ c: i.c, kind: i.kind }))).hours;
  const cap = weekCapacity(state.windows, state.floor, state.rest);
  const tight = over(needed, cap, state.contract);
  const taken = takenLine(cap);

  const shift = (which: 'from' | 'to', by: number) =>
    dispatch({
      type: 'setFloor',
      patch: { [which]: (state.floor[which] + by + 24 * 60) % (24 * 60) },
    });

  return (
    <Folding name="Capacity">
      <SectionLabel style={{ margin: '0 0 8px' }}>Does this week fit?</SectionLabel>
      <div
        style={{
          padding: '13px 14px',
          borderRadius: 'var(--r-md)',
          border: `1px solid ${tight ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
          background: tight ? 'var(--app-warn-wash)' : 'transparent',
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {verdict(needed, cap, state.contract)}
        {taken ? (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
            {taken}
          </div>
        ) : null}
      </div>

      <SectionLabel style={{ margin: '22px 0 8px' }}>How many hours school gets</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          inputMode="numeric"
          value={state.contract.hours || ''}
          placeholder="—"
          onChange={(e) => dispatch({ type: 'setContract', hours: Number(e.target.value) || 0 })}
          aria-label="Hours a week school gets"
          style={{ width: 72, height: 40, textAlign: 'center' }}
        />
        <span style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', flex: 1, textWrap: 'pretty' }}>
          hours a week, decided by you. Without one the week is measured against whatever happens
          to be left, which is how a term reaches October before anybody notices it was overloaded
          in September.
        </span>
      </div>

      <SectionLabel style={{ margin: '22px 0 8px' }}>The sleep floor</SectionLabel>
      <button
        type="button"
        className="bare tappable"
        aria-pressed={state.floor.on}
        onClick={() => dispatch({ type: 'setFloor', patch: { on: !state.floor.on } })}
        style={{
          width: 'auto',
          padding: '9px 14px',
          borderRadius: 'var(--r-sm)',
          border: `1px solid ${state.floor.on ? 'var(--app-accent)' : 'var(--app-line)'}`,
          fontSize: 'var(--type-sm)',
        }}
      >
        {state.floor.on ? `On — ${clock(state.floor.from)} to ${clock(state.floor.to)}` : 'Off'}
      </button>
      {state.floor.on ? (
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 9, flexWrap: 'wrap' }}>
          <Bump label="Start earlier" onClick={() => shift('from', -30)} />
          <Bump label="Start later" onClick={() => shift('from', 30)} />
          <Bump label="Lift earlier" onClick={() => shift('to', -30)} />
          <Bump label="Lift later" onClick={() => shift('to', 30)} />
        </div>
      ) : null}
      <p
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          color: 'var(--app-dim)',
          marginTop: 9,
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        Hours inside the floor come out of the week before anything is planned, so a week that
        only fits by working at half past one does not fit. Nothing is prevented — the app takes
        those hours off its own arithmetic, not off you.
      </p>

      <Kept />
    </Folding>
  );
}

const DAYS = [
  { day: 0, label: 'S', name: 'Sunday' },
  { day: 1, label: 'M', name: 'Monday' },
  { day: 2, label: 'T', name: 'Tuesday' },
  { day: 3, label: 'W', name: 'Wednesday' },
  { day: 4, label: 'T', name: 'Thursday' },
  { day: 5, label: 'F', name: 'Friday' },
  { day: 6, label: 'S', name: 'Saturday' },
];

/** "19:00" from minutes, and back — what an `<input type=time>` speaks. */
const toField = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromField = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/**
 * The hours you keep for yourself — the half of `lib/rest.ts` that had no way in.
 *
 * Everything under this was already built and none of it could be reached. The
 * `Rest` type, the two reducer cases, `insideRest`, the careful bit of
 * `dayCapacity` that refuses to deduct a nine o'clock dinner twice on a day
 * whose floor starts at eleven, and the clause in `takenLine` that says
 * "N to what you have kept for yourself" — all of it shipped, and `state.rest`
 * was empty on every device because nothing in the app could add one.
 *
 * So the verdict above ran with the sleep floor and nothing else, and the
 * "kept for yourself" clause was a sentence that could not print. The file's
 * own heading calls protected blocks "the point"; this is the control that
 * makes them one.
 *
 * Shaped like `components/WorkWindows.tsx` on purpose. It is the same question
 * asked the other way round — a label, the days, a start and an end — and two
 * different editors for one shape is how the pair drifts.
 */
function Kept() {
  const { state, dispatch } = useStore();
  const rest = state.rest;

  return (
    <>
      <SectionLabel style={{ margin: '22px 0 8px' }}>What you keep for yourself</SectionLabel>

      {rest.map((r) => (
        <div key={r.id} style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
            <input
              className="input"
              value={r.label}
              aria-label="What to call this block"
              placeholder="Dinner"
              onChange={(e) =>
                dispatch({ type: 'patchRest', id: r.id, patch: { label: e.target.value } })
              }
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
            />
            <button
              type="button"
              className="bare"
              aria-label={`Remove ${r.label || 'this block'}`}
              onClick={() => dispatch({ type: 'dropRest', id: r.id })}
              style={{ width: 30, flex: 'none', color: 'var(--app-dim)', fontSize: 'var(--type-lg)' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
            {DAYS.map((d) => {
              const on = r.days.includes(d.day);
              return (
                <button
                  key={d.day}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  aria-label={d.name}
                  onClick={() =>
                    dispatch({
                      type: 'patchRest',
                      id: r.id,
                      patch: { days: on ? r.days.filter((x) => x !== d.day) : [...r.days, d.day] },
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
              value={toField(r.from)}
              aria-label="From"
              onChange={(e) => {
                const m = fromField(e.target.value);
                if (m !== null) dispatch({ type: 'patchRest', id: r.id, patch: { from: m } });
              }}
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
            />
            <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', ...secondLine(), flex: 'none' }}>
              to
            </span>
            <input
              className="input"
              type="time"
              value={toField(r.to)}
              aria-label="To"
              onChange={(e) => {
                const m = fromField(e.target.value);
                if (m !== null) dispatch({ type: 'patchRest', id: r.id, patch: { to: m } });
              }}
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
            />
          </div>

          {/* The same sentence `WorkWindows` says about an unfinished window,
              and for the same reason: a block with no days silently takes no
              hours out, which reads as the arithmetic being wrong. */}
          {keeps(r) ? null : (
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
              Pick at least one day, and an end after the start. Counted as nothing until you do.
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
        {SUGGESTED_REST.filter((s) => !rest.some((r) => r.label === s.label)).map((s) => (
          <button
            key={s.label}
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'addRest', patch: s })}
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
              type: 'addRest',
              patch: { label: '', days: [1, 2, 3, 4, 5], from: 18 * 60, to: 19 * 60 },
            })
          }
          style={{ height: 34, fontSize: 'var(--type-sm)', padding: '0 11px', flex: 'none' }}
        >
          + One of your own
        </button>
      </div>

      <p
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          color: 'var(--app-dim)',
          marginTop: 9,
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        These come out of the week the way the floor does. A club or a job is something you
        promised somebody else and the app already knows about it; this is for the hours you
        promised yourself, which are the ones that go first because nobody else will defend them.
      </p>
    </>
  );
}

function Bump({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onClick}
      style={{
        width: 'auto',
        padding: '7px 11px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--app-line)',
        fontSize: 'var(--type-xs)',
      }}
    >
      {label}
    </button>
  );
}
