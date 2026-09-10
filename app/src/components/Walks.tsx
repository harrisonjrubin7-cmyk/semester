import { useMemo } from 'react';
import { secondLine } from '../lib/dim';
import { useRowStyle } from './shell/useShell';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { lengthOf, railFor } from '../lib/select';
import { daySummary, hopLine, hops, tight } from '../lib/rooms';
import { Folding } from './Fold';

/**
 * The eight minutes between Buttrick and Furman.
 *
 * A course knows its room as text and the map knows the places you have stood
 * in and named. Until now the two never met, so a Tuesday with a class ending
 * in one building and another starting ten minutes later in a different one
 * looked exactly like a Tuesday with both in the same room.
 *
 * Silent when nothing moves between buildings, and silent about a walk it
 * cannot measure — a room whose building you have not saved produces no
 * distance rather than a guessed one. It says how many of those there were,
 * so an absent number is visible rather than merely missing.
 */
export function Walks({ date }: { date?: Date }) {
  const { state, dispatch, now, catalog } = useStore();
  const row = useRowStyle(9);
  const day = date ?? now;

  const list = useMemo(
    () =>
      hops(
        // How long each one runs, so the gap after a seventy-five minute
        // seminar is not measured as though it were fifty. A commitment
        // states its own length; a class's is on its course; an appointment
        // states none and falls back the same way the hour grid does.
        railFor(catalog, day, state.appointments, state.commitments).map((b) => ({
          ...b,
          minutes: b.minutes ?? lengthOf(catalog, b),
        })),
        state.places,
      ),
    [catalog, day, state.appointments, state.commitments, state.places],
  );

  if (list.length === 0) return null;
  const measurable = list.filter((h) => h.known);
  const pressed = measurable.filter((h) => tight(h));

  return (
    <Folding name="Walks">
      <SectionLabel>Getting between them</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7, lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-4)' }}>
        {daySummary(list)}
      </div>

      {list.map((h) => (
        <div
          key={`${h.from.title}-${h.to.title}-${h.to.at}`}
          style={{
            display: 'flex',
            gap: 'var(--sp-5)',
            alignItems: 'baseline',
            ...row,
            opacity: h.known ? 1 : 0.6,
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 16,
              fontSize: 'var(--type-sm)',
              color: h.known && tight(h) ? 'var(--app-warn)' : 'var(--app-fg)',
              opacity: h.known && tight(h) ? 1 : 0.35,
            }}
          >
            {h.known && tight(h) ? '!' : '→'}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 1.4 }}>{hopLine(h)}</span>
        </div>
      ))}

      {measurable.length < list.length && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'maps' })}
          style={{ height: 38, marginTop: 9, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
        >
          Find the buildings you use
        </button>
      )}

      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        {pressed.length > 0
          ? 'Measured between places you saved, at an unhurried eighty metres a minute — slow on purpose, since an estimate that says you will make it and is wrong costs more than one that says you will not.'
          : 'Measured between places you saved, and a building you have not placed gets no distance rather than a guessed one. The map can look up every building this semester names in one tap.'}
      </div>
    </Folding>
  );
}
