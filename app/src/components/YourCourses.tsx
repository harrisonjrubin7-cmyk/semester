/**
 * Naming, colouring and ordering your own courses.
 *
 * The app knows a course as its syllabus wrote it — "Principles of
 * Microeconomics" — and lists the four of them in whatever order the PDFs
 * were opened. Nobody thinks in those terms. They think "Econ", and the class
 * with a paper due Thursday belongs at the top of the list this week.
 *
 * The arithmetic is in `lib/yours.ts`. This is the screen for it: one row per
 * course, opening into a name, a colour and a pin.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { ACCENTS } from '../lib/look';
import {
  LONGEST_NAME,
  nameFor,
  renamed,
  rename,
  reorder,
  tintFor,
  tintTo,
  togglePin,
  yoursNote,
  yoursOf,
} from '../lib/yours';

export function YourCourses() {
  const { state, dispatch, catalog } = useStore();
  const [open, setOpen] = useState('');

  if (catalog.courses.length === 0) return null;

  // The order as drawn, which is what the arrows move within — the stored
  // order can be empty or partial, and an arrow that moved a course past
  // something not next to it would be a control nobody could predict.
  const shown = catalog.courses.map((c) => c.id);

  return (
    <>
      <SectionLabel
        style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}
      >
        Your courses, your way
      </SectionLabel>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
        Call them what you call them, colour them so four codes are four things at a glance, and
        put the one you are living in this week at the top. The course code does not change —
        that is what a re-imported syllabus is matched on, and what a shared practice paper
        carries.
      </div>

      {catalog.courses.map((c, i) => {
        const mine = yoursOf(state.yours, c.id);
        const tint = tintFor(state.yours, c.id);
        const note = yoursNote(state.yours, c.id, c.name);
        const isOpen = open === c.id;

        return (
          <div key={c.id} style={{ borderBottom: '1px solid var(--app-line)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="bare tappable"
                onClick={() => dispatch({ type: 'setYours', yours: togglePin(state.yours, c.id) })}
                aria-pressed={Boolean(mine.pinned)}
                aria-label={mine.pinned ? `Unpin ${c.code}` : `Pin ${c.code} to the top`}
                style={{
                  flex: 'none',
                  width: 28,
                  padding: '12px 0',
                  fontSize: 'calc(14px * var(--text-scale, 1))',
                  opacity: mine.pinned ? 1 : 0.28,
                  color: mine.pinned ? 'var(--app-accent)' : 'inherit',
                }}
              >
                {mine.pinned ? '★' : '☆'}
              </button>

              <button
                type="button"
                className="bare tappable"
                onClick={() => setOpen(isOpen ? '' : c.id)}
                aria-expanded={isOpen}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '10px 0' }}
              >
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: 'none',
                      width: 9,
                      height: 9,
                      borderRadius: 9,
                      // A hollow ring for a course with no colour, so the row
                      // still has something in that slot and the list does not
                      // jog sideways when one is given a colour.
                      background: tint ? tint.base : 'transparent',
                      border: tint ? 'none' : '1px solid var(--app-line-top)',
                    }}
                  />
                  {/* The code is the identifier and never wraps — without
                      this, "ECON 1020" broke across two lines and shoved the
                      name into the middle of the row. The name gives way to
                      it instead, which is the same rule the Study list uses. */}
                  <span style={{ opacity: 0.55, flex: 'none', whiteSpace: 'nowrap' }}>
                    {c.code}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {nameFor(c, state.yours)}
                  </span>
                </span>
                {note ? (
                  <span style={{ display: 'block', fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 2 }}>
                    {note}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                className="bare"
                disabled={i === 0}
                onClick={() =>
                  dispatch({ type: 'setCourseOrder', order: reorder(shown, c.id, -1) })
                }
                aria-label={`Move ${c.code} up`}
                style={{ width: 24, flex: 'none', opacity: i === 0 ? 0.2 : 0.6, fontSize: 'calc(15px * var(--text-scale, 1))' }}
              >
                ↑
              </button>
              <button
                type="button"
                className="bare"
                disabled={i === shown.length - 1}
                onClick={() => dispatch({ type: 'setCourseOrder', order: reorder(shown, c.id, 1) })}
                aria-label={`Move ${c.code} down`}
                style={{
                  width: 24,
                  flex: 'none',
                  opacity: i === shown.length - 1 ? 0.2 : 0.6,
                  fontSize: 'calc(15px * var(--text-scale, 1))',
                }}
              >
                ↓
              </button>
            </div>

            {isOpen && (
              <div style={{ padding: '2px 0 14px 36px' }}>
                <input
                  className="input"
                  value={mine.name ?? ''}
                  maxLength={LONGEST_NAME}
                  onChange={(e) =>
                    dispatch({ type: 'setYours', yours: rename(state.yours, c, e.target.value) })
                  }
                  // The syllabus name as the placeholder rather than as the
                  // value: an empty box that shows what it will fall back to
                  // says "clear this to get that name back", which is exactly
                  // what clearing it does.
                  placeholder={c.name}
                  aria-label={`Your name for ${c.code}`}
                  style={{ width: '100%', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
                />
                {renamed(c, state.yours) ? (
                  <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 5 }}>
                    The syllabus calls it {c.name}. Clear the box to go back to that.
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 11 }}>
                  {ACCENTS.map((a) => {
                    const on = mine.tint === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className="bare tappable"
                        // Tapping the colour it already has clears it, so
                        // there is no separate "no colour" swatch to explain.
                        onClick={() =>
                          dispatch({
                            type: 'setYours',
                            yours: tintTo(state.yours, c.id, on ? '' : a.id),
                          })
                        }
                        aria-pressed={on}
                        aria-label={on ? `Clear ${a.label}` : `${a.label} for ${c.code}`}
                        title={a.label}
                        style={{
                          flex: 'none',
                          width: 26,
                          height: 26,
                          borderRadius: 26,
                          background: a.base,
                          border: on ? '2px solid var(--app-fg)' : '1px solid var(--app-line)',
                          boxShadow: on ? '0 0 0 2px var(--app-bg) inset' : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
