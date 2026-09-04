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

import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import { forecast } from '../lib/pace';
import { over, takenLine, verdict, weekCapacity } from '../lib/rest';

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function Capacity() {
  const { state, dispatch, now, catalog } = useStore();

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
    <>
      <SectionLabel style={{ margin: '0 0 8px' }}>Does this week fit?</SectionLabel>
      <div
        style={{
          padding: '13px 14px',
          borderRadius: 'var(--r-md)',
          border: `1px solid ${tight ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
          background: tight ? 'var(--app-warn-wash)' : 'transparent',
          fontSize: 'calc(13px * var(--text-scale, 1))',
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {verdict(needed, cap, state.contract)}
        {taken ? (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.7, marginTop: 6 }}>
            {taken}
          </div>
        ) : null}
      </div>

      <SectionLabel style={{ margin: '22px 0 8px' }}>How many hours school gets</SectionLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          inputMode="numeric"
          value={state.contract.hours || ''}
          placeholder="—"
          onChange={(e) => dispatch({ type: 'setContract', hours: Number(e.target.value) || 0 })}
          aria-label="Hours a week school gets"
          style={{ width: 72, height: 40, textAlign: 'center' }}
        />
        <span style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.65, flex: 1, textWrap: 'pretty' }}>
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
          fontSize: 'calc(12px * var(--text-scale, 1))',
        }}
      >
        {state.floor.on ? `On — ${clock(state.floor.from)} to ${clock(state.floor.to)}` : 'Off'}
      </button>
      {state.floor.on ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
          <Bump label="Start earlier" onClick={() => shift('from', -30)} />
          <Bump label="Start later" onClick={() => shift('from', 30)} />
          <Bump label="Lift earlier" onClick={() => shift('to', -30)} />
          <Bump label="Lift later" onClick={() => shift('to', 30)} />
        </div>
      ) : null}
      <p
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.6,
          marginTop: 9,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        Hours inside the floor come out of the week before anything is planned, so a week that
        only fits by working at half past one does not fit. Nothing is prevented — the app takes
        those hours off its own arithmetic, not off you.
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
        fontSize: 'calc(11px * var(--text-scale, 1))',
      }}
    >
      {label}
    </button>
  );
}
