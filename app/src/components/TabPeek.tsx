/**
 * The card that appears when you rest on a tab.
 *
 * What it says is `lib/peek.ts`, and the note there explains the one thing
 * this is not: a picture. A tab in this app is a saved place rather than a
 * running document, so there is no rendered page anywhere to thumbnail, and
 * rendering one to photograph would mean dispatching its actions — which is
 * going there, which is exactly what hovering must not do.
 *
 * ## Not a `Popover`
 *
 * The strip's two menus and the bookmarks bar share that shell, and this
 * deliberately does not: `Popover` is a `role="dialog"` with `useModal` on it,
 * which takes focus, traps Tab and closes on Escape. All three are right for
 * a menu you opened and wrong for a card that appeared because a pointer
 * passed over something. A hover card that steals focus is a hover card that
 * breaks the keyboard for everybody who was not using the mouse.
 *
 * So: `role="tooltip"`, no focus, no trap, `pointer-events: none` — you can
 * never hover the card itself, which also means it can never keep itself
 * alive under a pointer that has moved on.
 *
 * ## Fixed, and clamped
 *
 * Same reason as `Popover`: the strip is a box with `overflow-x: auto`, and
 * anything positioned inside it is clipped to the height of one tab. The
 * caller reads the tab's rectangle at the moment the pointer arrives, and
 * this places itself against the window and keeps off both edges.
 *
 * ## And portalled, for the same reason again
 *
 * `z-index: 60` bought nothing where it was. `.device > *` puts the strip at
 * 1 with `isolation: isolate` closing the context around it, and the header
 * is a later sibling — so on the wide layout the card was painted behind the
 * header entirely: hovering a tab there showed nothing at all, and with the
 * card's `pointer-events: none` lifted for the measurement,
 * `elementFromPoint` over its lower half returned `HEADER.app-header`. It
 * looked right on the workspace only because that layout raises its own
 * strip to 21 for an unrelated reason.
 *
 * So it draws from `.device`, as `Popover` does — the frame rather than the
 * body, because the card is made of the app's own surfaces. `id` still
 * reaches the tab's `aria-describedby` from here; that association is by id
 * across the document and does not care where either end sits.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { secondLine } from '../lib/dim';
import { SpeakerIcon, SpeakerOffIcon } from './Icons';
import { peekSaid, type Peek } from '../lib/peek';

/** How close to the window's edge the card may sit. */
const EDGE = 8;
/** And how far below the tab it hangs. */
const GAP = 4;
/** Wide enough for a long course name, and no wider. */
const WIDE = 248;

/** A key, drawn as one. Small enough that three of them are a hint, not a row. */
const KEY = {
  display: 'inline-block',
  minWidth: 16,
  // Two axes, two properties: the ledger counts a `padding` shorthand and it
  // is right to — a string is one value where these are two decisions.
  paddingBlock: 'var(--sp-1)',
  paddingInline: 'var(--sp-2)',
  borderRadius: 'var(--r-xs)',
  border: '1px solid var(--app-line)',
  background: 'var(--app-hero)',
  fontFamily: 'var(--font-heading)',
  fontSize: 'var(--type-xs)',
  lineHeight: 'var(--leading-tight)',
  textAlign: 'center',
} as const;

export function TabPeek({ peek, at, tone, id }: {
  peek: Peek;
  /** The tab's rectangle, read when the pointer arrived. */
  at: { left: number; bottom: number };
  /** The group's colour, when it is in one. */
  tone?: string;
  /** So the tab can point at this with `aria-describedby`. */
  id: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(at.left);
  /*
   * Measured before the paint, so a card near the right-hand edge does not
   * visibly slide left after it has been read. The strip's last tabs are
   * exactly where this matters, and they are the ones people hover most on a
   * strip that has run out of room.
   */
  useLayoutEffect(() => {
    const card = box.current;
    if (!card) return;
    const wide = card.offsetWidth;
    const room = window.innerWidth - EDGE;
    setLeft(at.left + wide > room ? Math.max(EDGE, room - wide) : at.left);
  }, [at.left, peek]);

  const card = (
    <div
      ref={box}
      id={id}
      role="tooltip"
      style={{
        position: 'fixed',
        left,
        top: at.bottom + GAP,
        width: WIDE,
        zIndex: 60,
        // Never a hover target itself: a card that can be hovered is a card
        // that keeps itself open under a pointer that has already left.
        pointerEvents: 'none',
        padding: 'var(--sp-5)',
        borderRadius: 'var(--r-md)',
        background: 'var(--app-panel)',
        border: '1px solid var(--app-line)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}
    >
      {/*
        * The whole card as one sentence, and the visible version hidden from
        * the reader that gets it.
        *
        * What is drawn below is fragments — a name, a word, a coloured dot, a
        * glyph — which read well in a corner and announce as a pile of nouns.
        * `aria-describedby` on the tab points here, so what a reader hears is
        * `peekSaid`: the same facts, in an order that is a sentence.
        */}
      <span className="sr-only">{peekSaid(peek)}</span>
      <div
        aria-hidden="true"
        style={{
          fontSize: 'var(--type-sm)',
          lineHeight: 'var(--leading-tight)',
          // Two lines and then an ellipsis: the card exists to show a name the
          // strip cut, and a card that cuts it again in the same place would
          // be no answer at all — but a tab named after a whole reading list
          // must not become a column of text either.
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {peek.title}
      </div>

      {(peek.kind || peek.group || peek.sound) && (
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            flexWrap: 'wrap',
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--type-xs)',
            ...secondLine(),
          }}
        >
          {peek.kind && <span>{peek.kind}</span>}
          {peek.group && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <span
                aria-hidden="true"
                style={{ width: 'var(--sp-3)', height: 'var(--sp-3)', borderRadius: '50%', background: tone }}
              />
              {peek.group}
            </span>
          )}
          {peek.sound && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              {peek.sound === 'muted' ? <SpeakerOffIcon size={12} /> : <SpeakerIcon size={12} />}
              {peek.sound === 'muted' ? 'Muted' : 'Playing'}
            </span>
          )}
        </div>
      )}

      {peek.query && (
        <div aria-hidden="true" style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--type-xs)', ...secondLine() }}>
          Searched “{peek.query}”
        </div>
      )}

      {peek.moves && (
        <div
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            marginTop: 'var(--sp-4)',
            paddingTop: 'var(--sp-3)',
            borderTop: '1px solid var(--app-line)',
            fontSize: 'var(--type-xs)',
            ...secondLine(),
          }}
        >
          {/*
            * Under a rule, because it is the one line here that is not about
            * the tab. Everything above answers "what is this"; this answers
            * "what can you do with it", and a reader who wants the first
            * should be able to stop at the line.
            */}
          <kbd style={KEY}>Alt</kbd>
          <kbd style={KEY}>←</kbd>
          <kbd style={KEY}>→</kbd>
          <span>to move it</span>
        </div>
      )}
    </div>
  );

  // The frame, not the strip it was summoned from. See the note at the top.
  const frame = typeof document === 'undefined' ? null : document.querySelector('.device');
  return frame ? createPortal(card, frame) : card;
}
