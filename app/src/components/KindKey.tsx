import type { ReactNode } from 'react';
import { CAMPUS_KIND, CLASS_TINT, EVENT_KINDS, kindTint } from '../lib/kinds';
import { useStore } from '../state/store';
import { ground as groundOf, resolveGround } from '../lib/look';
import { usePrefersDark } from '../lib/prefers';
import { ChevronRight } from './Icons';

/**
 * What the colours mean, behind a tap.
 *
 * The month calendar shipped for a year drawing three different marks and
 * explaining none of them, which made the whole grid decorative. Not repeating
 * that: a grid that colours by category needs its key on the same screen.
 *
 * Since classes are drawn in their own course's colour rather than in one
 * accent, the key names the courses too — a legend that said "Class" once
 * while the grid drew four different colours would be worse than none. With
 * the setting off there is one class colour again, and the key says so.
 *
 * The courses come first and the kinds after, because that is also the
 * difference the grids draw: a class is filled with its colour, something of
 * yours carries its colour on the edge. Two colours landing near each other on
 * the wheel is possible — there are seven kinds and no promise about where a
 * course falls — and filled-versus-outlined is what still tells them apart
 * when they do.
 *
 * ## Why it folds
 *
 * Naming the courses took the key from eight entries to eleven, which on a
 * phone is two or three lines above the grid, on every calendar view, every
 * time, forever — and a key is read while the colours are being learned and
 * then not again. So it is one line saying it is there, and it remembers
 * being opened: `state.keyOpen`, the same shape as the guide's "Ways to study
 * this". Closed is the default, because nothing here is the only way to know
 * anything — every block says its course and its kind in words to a screen
 * reader, and the calendar is legible without the key in a way the month grid
 * was not before it existed.
 *
 * Closed, the swatches are the label. A row of the colours themselves reads as
 * "the key" faster than the word does, and it fits on the same line, so the
 * fold costs the recognisable part of the key nothing.
 */
export function KindKey({ compact = false, lead }: { compact?: boolean; lead?: ReactNode }) {
  const { catalog, state, dispatch, tint } = useStore();
  const byCourse = state.courseColours !== 'off' && !catalog.empty;
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;
  const open = state.keyOpen;

  // One list rather than three copies of the same row: the swatch and its word
  // are the same shape whether it names a course or a kind.
  const courses = byCourse
    ? catalog.courses.map((c) => ({ key: c.id, tint: tint(c.id).fill, label: catalog.short[c.id] }))
    : [{ key: 'class', tint: CLASS_TINT, label: 'Class' }];
  const rows = [
    ...courses,
    ...EVENT_KINDS.map((k) => ({ key: k.id, tint: kindTint(k.id, light), label: k.label })),
    // Last, because it is the one colour on the grids that is nobody's choice:
    // what is on around campus, and what a calendar you connected says is on.
    { key: CAMPUS_KIND, tint: kindTint(CAMPUS_KIND, light), label: 'Campus' },
  ];

  /** The caps both halves are set in — the quietest line the app draws. */
  const caps = {
    fontSize: 'calc(10px * var(--text-scale, 1))',
    fontFamily: 'var(--font-heading)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    opacity: 0.55,
  };

  return (
    <div style={{ marginTop: compact ? 8 : 10 }}>
      <button
        type="button"
        className="bare tappable"
        onClick={() => dispatch({ type: 'toggleKey' })}
        aria-expanded={open}
        style={{
          ...caps,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          width: '100%',
          padding: 'var(--sp-2) 0',
          textAlign: 'left',
        }}
      >
        <span aria-hidden style={{ display: 'flex', gap: 'var(--sp-1)', flex: 'none' }}>
          {courses.map((row) => (
            <span key={row.key} style={{ width: 3, height: 10, background: row.tint }} />
          ))}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>{open ? 'What the colours mean' : 'Colour key'}</span>
        <span style={{ flex: 'none', opacity: 0.8 }}>{open ? 'Hide' : rows.length}</span>
        <ChevronRight
          size={12}
          style={{ flex: 'none', opacity: 0.6, transform: open ? 'rotate(90deg)' : 'none' }}
        />
      </button>

      {open && (
        <>
          {/* The month grid's own marks — a square, a circle, an outline —
              which are a second key about the same grid. Inside this fold
              rather than stacked above it, so one tap opens the lot. */}
          {lead}
          <div
            style={{
              ...caps,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '5px 12px',
              marginTop: 'var(--sp-3)',
            }}
          >
            {rows.map((row) => (
              <span key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 3, height: 10, background: row.tint, flex: 'none' }} />
                {row.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
