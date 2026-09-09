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
import { Reorder } from './Reorder';
import { MOVE_HINT, useMovable } from '../lib/arrange';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { ACCENTS, ground as groundOf, resolveGround } from '../lib/look';
import { anchorHue, tintAt } from '../lib/tint';
import { usePrefersDark } from '../lib/prefers';
import {
  LONGEST_NAME,
  nameFor,
  renamed,
  rename,
  reorder,
  tintTo,
  togglePin,
  yoursNote,
  yoursOf,
} from '../lib/yours';
import { useRowStyle } from './shell/useShell';
import type { CourseId } from '../lib/types';

export function YourCourses() {
  const { state, dispatch, catalog, tint: palette } = useStore();
  const row = useRowStyle(0);
  const [open, setOpen] = useState('');
  // The resolved ground, not the stored one: on "match my device" the swatches
  // have to be drawn for the screen in front of somebody.
  const light = groundOf(resolveGround(state.ground, usePrefersDark())).light;

  // The order as drawn, which is what the arrows and the drag both move
  // within — the stored order can be empty or partial, and a control that
  // moved a course past something not next to it on screen is a control
  // nobody could predict.
  const shown = catalog.courses.map((c) => c.id);

  /*
   * Dragging a course up the list.
   *
   * The whole of the drawn order is written back rather than the pair that
   * moved: a partial order leaves the rest at the mercy of the next import,
   * which is the one thing somebody who has just arranged their courses does
   * not expect. Held on the row's top line only — the panel it opens has a
   * text box in it, and a drag that started in a name box would be a name box
   * nobody can put their cursor in.
   *
   * Above the empty case rather than after it: a hook that is skipped on the
   * render where somebody has no courses yet is a hook the next render counts
   * differently.
   */
  const list = useMovable<CourseId>({
    items: shown,
    onMove: (order) => dispatch({ type: 'setCourseOrder', order }),
  });

  if (catalog.courses.length === 0) return null;

  return (
    <>
      <SectionLabel
        style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}
      >
        Your courses, your way
      </SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-5)', textWrap: 'pretty' }}>
        Call them what you call them and put the one you are living in this week at the top.
        Each already has a colour — your accent, divided between your classes, and worn on every
        deadline, block and dot that belongs to it. Open a course to hold it to a different one.
        The course code does not change — that is what a re-imported syllabus is matched on, and
        what a shared practice paper carries.
      </div>

      {catalog.courses.map((c, i) => {
        const mine = yoursOf(state.yours, c.id);
        const note = yoursNote(state.yours, c.id, c.name);
        const isOpen = open === c.id;

        return (
          <div key={c.id} style={row}>
            <div
              {...list.props(c.id, {
                style: { display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' },
              })}
            >
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
                  fontSize: 'var(--type-md)',
                  opacity: mine.pinned ? 1 : 0.28,
                  color: mine.pinned ? 'var(--app-accent)' : 'inherit',
                }}
              >
                {mine.pinned ? '★' : '☆'}
              </button>

              <button
                type="button"
                className="bare tappable"
                // A drop ends in a click on the row it started from, and
                // without this the course you have just moved also opens.
                onClick={() => {
                  if (list.tookDrop()) return;
                  setOpen(isOpen ? '' : c.id);
                }}
                aria-expanded={isOpen}
                aria-label={`${c.code} ${nameFor(c, state.yours)}. ${MOVE_HINT}`}
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
                      // The colour this course is actually wearing, whether it
                      // was chosen here or handed out by the palette. It used
                      // to be a hollow ring for the second case, which is to
                      // say for almost every course.
                      background: palette(c.id).fill,
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
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-1)' }}>
                    {note}
                  </span>
                ) : null}
              </button>

              <Reorder
                label={c.code}
                width={24}
                atStart={i === 0}
                atEnd={i === shown.length - 1}
                onUp={() => dispatch({ type: 'setCourseOrder', order: reorder(shown, c.id, -1) })}
                onDown={() => dispatch({ type: 'setCourseOrder', order: reorder(shown, c.id, 1) })}
              />
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
                  <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 5 }}>
                    The syllabus calls it {c.name}. Clear the box to go back to that.
                  </div>
                ) : null}

                <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 11 }}>
                  {mine.tint
                    ? 'Held here. Tap it again to hand this course back to the palette.'
                    : 'The palette placed this one. Pick a colour to hold it there instead.'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 'var(--sp-4)' }}>
                  {ACCENTS.map((a) => {
                    const on = mine.tint === a.id;
                    // Drawn as the course would actually wear it rather than as
                    // the accent's own swatch: the palette turns an accent into
                    // a tint for this ground, and a picker that showed the metal
                    // and then applied something else is a picker that lies.
                    const shown = tintAt(anchorHue(a.id, -1), light);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className="bare tappable"
                        // Tapping the colour it already has hands the course
                        // back to the palette, so there is no separate "let the
                        // app choose" swatch to explain.
                        onClick={() =>
                          dispatch({
                            type: 'setYours',
                            yours: tintTo(state.yours, c.id, on ? '' : a.id),
                          })
                        }
                        aria-pressed={on}
                        aria-label={on ? `Let the app colour ${c.code}` : `${a.label} for ${c.code}`}
                        title={a.label}
                        style={{
                          flex: 'none',
                          width: 26,
                          height: 26,
                          borderRadius: 26,
                          background: shown.fill,
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
