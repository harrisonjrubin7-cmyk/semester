/**
 * A page number instead of a checkbox, for anything that takes more than one
 * sitting.
 *
 * Shown under a reading's own row. Everything it says is arithmetic from
 * `lib/progress.ts`, which refuses to guess a reading speed — so the line
 * under the bar is either a measured figure or an admission that there is not
 * one yet, never a plausible default.
 *
 * The length is asked for once and suggested from what the syllabus already
 * stated: "pp. 112–140" is twenty-eight pages, and `lib/reading.ts` had
 * already read that out of the title. Where the syllabus stated nothing the
 * field is empty and the app says what that costs, rather than filling it in.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { extent, isReading } from '../lib/reading';
import { SectionLabel } from './ui';
import { datedItems } from '../lib/select';
import {
  far,
  farLine,
  leftLine,
  open as openReadings,
  pct,
  perDayLine,
  suggestTotal,
  type Unit,
} from '../lib/progress';
import type { DatedItem } from '../lib/types';

const UNITS: { id: Unit; label: string }[] = [
  { id: 'pages', label: 'Pages' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'percent', label: 'Per cent' },
];

export function ReadingProgress({ item }: { item: DatedItem }) {
  const { state, dispatch } = useStore();
  const saved = state.progress[item.id];
  const [open, setOpen] = useState(Boolean(saved && saved.marks.length > 0));
  const [typed, setTyped] = useState('');

  // Only for readings. A problem set is done or it is not, and a page number
  // for one would be a field nobody can fill in.
  if (!isReading(item)) return null;

  const suggested = suggestTotal(extent(item));
  const p =
    saved ??
    ({
      id: item.id,
      unit: suggested.unit,
      total: suggested.total,
      marks: [],
      updated: 0,
    } as const);

  if (!open) {
    return (
      <button
        type="button"
        className="bare tappable"
        onClick={() => setOpen(true)}
        style={{
          width: 'auto',
          padding: '8px 0 2px',
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.6,
          textAlign: 'left',
        }}
      >
        Keep your place in this one
      </button>
    );
  }

  const along = pct(p);
  const spread = perDayLine(p, item.daysAway);

  const save = () => {
    const n = Number.parseInt(typed, 10);
    if (!Number.isFinite(n)) return;
    // The length is set alongside the mark rather than in a separate step:
    // somebody who has just read to page 40 of a book the syllabus did not
    // size should not have to fill in two fields before either counts.
    if (!saved) {
      dispatch({ type: 'setReadingLength', id: item.id, unit: p.unit, total: p.total });
    }
    dispatch({ type: 'markReading', id: item.id, done: n });
    setTyped('');
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: '12px 13px',
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', textWrap: 'pretty' }}>
        {farLine(p)}
      </div>

      {along !== null ? (
        <div
          style={{
            height: 5,
            borderRadius: 3,
            background: 'var(--app-line)',
            margin: '9px 0 10px',
            overflow: 'hidden',
          }}
        >
          <div style={{ width: `${along}%`, height: '100%', background: 'var(--app-accent)' }} />
        </div>
      ) : (
        <div style={{ height: 9 }} />
      )}

      <div
        style={{
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.72,
          lineHeight: 1.5,
          textWrap: 'pretty',
        }}
      >
        {leftLine(p)}
        {spread ? ` ${spread}` : ''}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 11, flexWrap: 'wrap' }}>
        <input
          className="input"
          inputMode="numeric"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          placeholder={p.unit === 'percent' ? '%' : `${far(p) || ''}`}
          aria-label={`Where you have got to in ${item.title}`}
          style={{ width: 84, height: 38, textAlign: 'center' }}
        />
        <button
          type="button"
          className="bare tappable"
          onClick={save}
          style={{
            width: 'auto',
            padding: '9px 14px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line)',
            fontSize: 'calc(12px * var(--text-scale, 1))',
          }}
        >
          I am here now
        </button>
      </div>

      <div className="kicker" style={{ marginTop: 13 }}>
        How much there is
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          inputMode="numeric"
          value={p.total || ''}
          placeholder="—"
          onChange={(e) =>
            dispatch({
              type: 'setReadingLength',
              id: item.id,
              unit: p.unit,
              total: Number.parseInt(e.target.value, 10) || 0,
            })
          }
          aria-label={`How long ${item.title} is`}
          style={{ width: 84, height: 36, textAlign: 'center' }}
        />
        {UNITS.map((u) => (
          <button
            key={u.id}
            type="button"
            className="bare tappable"
            aria-pressed={p.unit === u.id}
            onClick={() =>
              dispatch({ type: 'setReadingLength', id: item.id, unit: u.id, total: p.total })
            }
            style={{
              width: 'auto',
              padding: '7px 11px',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${p.unit === u.id ? 'var(--app-accent)' : 'var(--app-line)'}`,
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
            }}
          >
            {u.label}
          </button>
        ))}
      </div>
      {p.total === 0 ? (
        <div
          style={{
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.55,
            marginTop: 7,
            lineHeight: 1.5,
            textWrap: 'pretty',
          }}
        >
          The syllabus did not say how long this is, so nothing can be counted down until you
          do. The app will not guess it.
        </div>
      ) : null}

      {saved ? (
        <button
          type="button"
          className="bare"
          onClick={() => {
            dispatch({ type: 'clearReading', id: item.id });
            setOpen(false);
          }}
          style={{
            width: 'auto',
            marginTop: 11,
            fontSize: 'calc(11.5px * var(--text-scale, 1))',
            opacity: 0.5,
          }}
        >
          Forget where I was
        </button>
      ) : null}
    </div>
  );
}

/**
 * Readings you are part-way through, on Today.
 *
 * The half-finished ones are the ones that disappear: a reading you have not
 * started is on the checklist and a reading you have finished is ticked, but
 * one you are forty pages into looks exactly like one you have not opened.
 *
 * Nothing at all when there is nothing on the go, which is most days.
 */
export function ReadingsOnTheGo() {
  const { state, dispatch, now, catalog } = useStore();
  const going = openReadings(state.progress);
  if (going.length === 0) return null;

  const all = datedItems(catalog, now);

  return (
    <div style={{ marginTop: 14 }}>
      <SectionLabel style={{ margin: '0 0 8px' }}>Part way through</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {going.map((p) => {
          const item = all.find((i) => i.id === p.id);
          const along = pct(p);
          return (
            <button
              key={p.id}
              type="button"
              className="bare tappable"
              onClick={() => dispatch({ type: 'openItem', id: p.id })}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 13px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--app-line)',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(13.5px * var(--text-scale, 1))',
                  lineHeight: 1.35,
                  textWrap: 'pretty',
                }}
              >
                {item?.title ?? 'A reading'}
              </span>
              {along !== null ? (
                <span
                  style={{
                    display: 'block',
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--app-line)',
                    margin: '7px 0 6px',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: `${along}%`,
                      height: '100%',
                      background: 'var(--app-accent)',
                    }}
                  />
                </span>
              ) : null}
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  opacity: 0.62,
                  textWrap: 'pretty',
                }}
              >
                {leftLine(p)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
