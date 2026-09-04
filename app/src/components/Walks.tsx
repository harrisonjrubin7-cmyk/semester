import { useMemo } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { railFor } from '../lib/select';
import { daySummary, hopLine, hops, tight } from '../lib/rooms';

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
  const day = date ?? now;

  const list = useMemo(
    () => hops(railFor(catalog, day, state.appointments, state.commitments), state.places),
    [catalog, day, state.appointments, state.commitments, state.places],
  );

  if (list.length === 0) return null;
  const measurable = list.filter((h) => h.known);
  const pressed = measurable.filter((h) => tight(h));

  return (
    <>
      <SectionLabel>Getting between them</SectionLabel>
      <div style={{ fontSize: 12.5, opacity: 0.7, lineHeight: 1.5, marginBottom: 8 }}>
        {daySummary(list)}
      </div>

      {list.map((h) => (
        <div
          key={`${h.from.title}-${h.to.title}-${h.to.at}`}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'baseline',
            padding: '9px 0',
            borderBottom: '1px solid var(--app-line)',
            opacity: h.known ? 1 : 0.6,
          }}
        >
          <span
            style={{
              flex: 'none',
              width: 16,
              fontSize: 12,
              color: h.known && tight(h) ? 'var(--app-warn)' : 'var(--app-fg)',
              opacity: h.known && tight(h) ? 1 : 0.35,
            }}
          >
            {h.known && tight(h) ? '!' : '→'}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.4 }}>{hopLine(h)}</span>
        </div>
      ))}

      {measurable.length < list.length && (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => dispatch({ type: 'go', screen: 'maps' })}
          style={{ height: 38, marginTop: 9, fontSize: 12.5 }}
        >
          Name the buildings you use
        </button>
      )}

      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 8, lineHeight: 1.45 }}>
        {pressed.length > 0
          ? 'Measured between places you saved, at an unhurried eighty metres a minute — slow on purpose, since an estimate that says you will make it and is wrong costs more than one that says you will not.'
          : 'Measured between places you saved. The app never geocodes an address, so a building it has no place for gets no distance rather than a guessed one.'}
      </div>
    </>
  );
}
