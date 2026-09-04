import { useState } from 'react';
import { useStore } from '../state/store';
import {
  COMMON_LETTER,
  fromTyped,
  sourceLine,
  systemFor,
  targetsOf,
} from '../lib/cutoffs';

/**
 * Where "you need 91% on the final" gets its 91 from.
 *
 * The projection has always drawn a letter table and never said whose numbers
 * they were. They were a constant — the common American cutoffs — which is
 * right for a lot of courses and wrong for plenty, and a cutoff shown without
 * a source reads as institutional fact and gets planned around.
 *
 * So the line under the table says where the numbers came from, and where they
 * came from nowhere it says *assumed* and offers the two taps that fix it. The
 * syllabus is the thing that actually governs the grade, so the correction
 * lives per course rather than per school.
 */
export function Cutoffs({ courseId, code }: { courseId: string; code: string }) {
  const { state, dispatch, school } = useStore();
  const { system, source } = systemFor(courseId, state.gradeSystems, school);

  const [open, setOpen] = useState(false);
  // Seeded from whatever is in force, so editing starts from the numbers on
  // the screen rather than from a blank table. A scale with no cutoffs at all
  // seeds from the common one, which is the only sensible starting point for
  // typing your own.
  const seed = () => {
    const t = targetsOf(system);
    const from = t.length > 0 ? t : targetsOf(COMMON_LETTER);
    return from.map((b) => ({ label: b.label, min: String(b.at) }));
  };
  const [rows, setRows] = useState(seed);

  const typed = fromTyped(rows, system.gpaMax);

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.55,
          lineHeight: 1.45,
          textWrap: 'pretty',
        }}
      >
        {sourceLine(source, school)}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="bare tappable"
          onClick={() => {
            setRows(seed());
            setOpen(!open);
          }}
          style={{
            width: 'auto',
            padding: '6px 10px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--app-line)',
            fontSize: 'calc(11px * var(--text-scale, 1))',
            fontFamily: 'var(--font-heading)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {open ? 'Close' : `Cutoffs for ${code}`}
        </button>
        {source === 'course' && (
          <button
            type="button"
            className="bare tappable"
            onClick={() => {
              dispatch({ type: 'setCutoffs', courseId, system: null });
              setOpen(false);
            }}
            style={{
              width: 'auto',
              padding: '6px 10px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'calc(11px * var(--text-scale, 1))',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}
          >
            Use the default
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 'calc(11.5px * var(--text-scale, 1))',
              opacity: 0.6,
              lineHeight: 1.45,
              marginBottom: 8,
              textWrap: 'pretty',
            }}
          >
            The lowest percentage that earns each grade, from the syllabus. Leave one blank to drop
            that band — a blank is not a zero.
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}>
              <input
                className="input"
                value={r.label}
                aria-label={`Grade ${i + 1} in ${code}`}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))
                }
                style={{ width: 76, flex: 'none', height: 36, fontSize: 'calc(13px * var(--text-scale, 1))', textAlign: 'center' }}
              />
              <span style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55 }}>
                from
              </span>
              <input
                className="input"
                inputMode="decimal"
                value={r.min}
                aria-label={`Cutoff for ${r.label || `grade ${i + 1}`} in ${code}`}
                onChange={(e) =>
                  setRows(rows.map((x, j) => (i === j ? { ...x, min: e.target.value } : x)))
                }
                style={{ width: 76, flex: 'none', height: 36, fontSize: 'calc(13px * var(--text-scale, 1))', textAlign: 'center' }}
              />
              <span style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55 }}>%</span>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={typed === null}
            onClick={() => {
              if (!typed) return;
              dispatch({ type: 'setCutoffs', courseId, system: typed });
              setOpen(false);
            }}
            style={{
              height: 42,
              marginTop: 4,
              fontSize: 'calc(13px * var(--text-scale, 1))',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: typed === null ? 0.45 : 1,
            }}
          >
            {typed === null ? 'Nothing to save yet' : `Use these for ${code}`}
          </button>
        </div>
      )}
    </div>
  );
}
