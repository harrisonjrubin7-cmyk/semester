import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { focusablesIn, nextInRing } from '../a11y/modal';
import { useStore } from '../state/store';
import { useAI, useSeed } from './store';
import { TOUCH, WIDE, useMedia } from '../lib/media';
import { screenName } from '../lib/nav';
import { useConversation, provider } from './converse';
import { AskSelection } from './AskAbout';
import { Composer, sendHint } from './Composer';
import { Dropped, Question, Reply, Waiting, Looked, useFollowing } from './Turns';
import { Opening } from './Opening';
import { money } from '../lib/spend';
import { configured, modelLabel } from '../lib/claude';
import { nameOf } from '../lib/threads';
import { Trouble } from '../components/Trouble';
import { Applied, Locally, Proposals } from './Actions';
import { fills } from '../components/shell/exempt';

/**
 * The assistant, everywhere.
 *
 * A button in the corner and a chat panel that comes up over whatever you
 * were looking at — mounted once in the shell rather than rendered by a
 * screen, so there is exactly one of it and it can never disagree with itself
 * about where you are.
 *
 * ## It is the chat, not a preview of it
 *
 * There is one destination for the assistant — the Ask tab — and one
 * conversation behind both of them, held in `ai/live.ts` and read through
 * `useConversation`. This panel is the way *in* to that conversation from
 * wherever you happen to be standing, carrying that screen's context with it.
 *
 * So it is shaped like the thing it is: a titled header, a transcript at a
 * reading measure that follows the stream and lets you scroll back out of it,
 * the answer's own offers in the flow of the answer, and a composer pinned to
 * the bottom. Every one of those pieces is the *same component* the tab
 * draws — `Turns.tsx`, `Opening.tsx`, `Composer.tsx`, `Actions.tsx` — because
 * a panel that rendered its own smaller version of a message is how one
 * conversation starts reading as two products.
 *
 * What it does not have is the history list. Twelve rows inside a panel sized
 * to leave the screen behind it visible would be the panel; `ALL CHATS` opens
 * the tab, which is a navigation and not a handoff, since there was only ever
 * one log.
 *
 * ## Partial on purpose, and a card on a laptop
 *
 * On a phone it comes up to about three-fifths and the screen behind stays
 * visible and usable. That is the whole difference between an assistant that
 * is part of the app and a chat window that happens to float: you can read
 * your grades while you ask about them, and tap a row behind it without
 * dismissing anything. Full height is a swipe, a drag or a tap away.
 *
 * On a wide window a strip across the bottom of a laptop would be neither —
 * the measure is wrong and the composer ends up a long way from the answer —
 * so it docks as a card in the corner it was opened from. Opened out, both
 * become a modal over a wash, and only then is the app behind it inert.
 *
 * ## Where the button sits
 *
 * Above the tab bar, inset from the right, and it must not cover a primary
 * action on any screen. Two screens already put something in that corner —
 * Today's import button when the feed nav is on, and the desktop shortcut
 * sheet — so this steps aside for both rather than stacking on them.
 */

/** How tall the sheet is when it first comes up, as a share of the window. */
const PART = 0.6;

/** How far the button lifts when something it would cover is underneath. */
const LIFT = 58;

/**
 * How far the handle has to travel before a tap becomes a drag.
 *
 * Forty pixels rather than five: a tap on a phone moves the finger a little,
 * and a sheet that treated four pixels of that as "drag down" would close
 * itself on every attempt to expand it.
 */
const DRAG = 40;

/**
 * Whether an element is something a person would tap.
 *
 * The question the button is asking of the point beneath it. Deliberately
 * generous — a card that navigates is as much a primary action as a button
 * labelled Save, and the cost of lifting unnecessarily is a button two
 * centimetres higher than it might have been.
 */
function tappable(el: Element | null, self: Element | null, at: DOMRect | null): boolean {
  if (!el) return false;
  /*
   * The button is not something the button covers.
   *
   * Left out, this oscillates forever and the first version did: unlifted,
   * the point it asks about is the point it is sitting on, so it finds
   * itself, lifts, finds the space it left empty, drops, and flips between
   * two positions for as long as the screen is open.
   */
  if (self && (el === self || self.contains(el))) return false;
  const node = el.closest('button, a, input, textarea, select, [role="button"]');
  if (!node) return false;
  // The tab bar is always under it and is not something it covers: the button
  // sits above the bar by construction, and its own hit area does not reach.
  if (node.closest('.app-tabs')) return false;

  /*
   * Covered is not the same as unusable, and the rule is about the second.
   *
   * The first version treated anything tappable as a collision, which on a
   * dense screen is every position on the page — six screens ran out of room
   * after two lifts because a list has a row under the button at every
   * offset. But a full-width row with its right-hand corner clipped is still
   * a row you can tap; it has lost nothing you needed. A text field or a
   * small icon button that disappears underneath has.
   *
   * So the question is what the overlap costs. A form field always counts —
   * a caret you cannot see is unusable even when most of the box shows. Past
   * that it is proportional: something the button hides half of is hidden.
   */
  const tag = node.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

  if (!at) return true;
  const r = node.getBoundingClientRect();
  const area = r.width * r.height;
  if (area === 0) return true;
  const over =
    Math.max(0, Math.min(r.right, at.right) - Math.max(r.left, at.left)) *
    Math.max(0, Math.min(r.bottom, at.bottom) - Math.max(r.top, at.top));
  return over / area >= 0.5;
}

/**
 * Where the button can sit without covering something.
 *
 * The brief says it must never cover a primary action on any of fifty
 * screens. Auditing fifty layouts finds today's collisions and none of
 * tomorrow's — the one this found was Costs, where "Add it" is a full-width
 * block button whose right end lands exactly in the corner, and *any* corner
 * button clips *any* full-width button that happens to sit in its band.
 *
 * So it asks instead. `elementsFromPoint` is the browser's own answer to
 * "what is under here", and the button lifts by its own height until nothing
 * tappable is. Two lifts is the cap: past that the screen is dense enough
 * that anywhere is a compromise, and a button wandering up the page is worse
 * than one that overlaps.
 */
function clearOf(rest: DOMRect, self: Element | null, tries = 3): number {
  const x = rest.left + rest.width / 2;
  const y = rest.top + rest.height / 2;
  let lifted = 0;
  for (let i = 0; i < tries; i += 1) {
    // Where the button would actually be, so the overlap below is the real
    // overlap rather than one measured against where it is now.
    const would = new DOMRect(rest.left, rest.top - lifted, rest.width, rest.height);
    const under = document.elementsFromPoint(x, y - lifted);
    if (!under.some((el) => tappable(el, self, would))) return lifted;
    lifted += LIFT;
  }
  return lifted;
}

/** Where the button can rest. Dragging it across the middle moves it. */
type Corner = 'right' | 'left';
const CORNER_KEY = 'semester.ai.corner';

function savedCorner(): Corner {
  try {
    return localStorage.getItem(CORNER_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

export function Assistant() {
  const { state, dispatch } = useStore();
  const ai = useAI();
  const seed = useSeed();
  const wide = useMedia(WIDE);
  const touch = useMedia(TOUCH);
  const [corner, setCorner] = useState<Corner>(savedCorner);
  const [full, setFull] = useState(false);
  const [draft, setDraft] = useState('');

  // One place that empties the box and sends, because the send button and the
  // Enter key must not drift into doing slightly different things.
  const ask = () => {
    const q = draft;
    setDraft('');
    void talk.send(q);
  };
  /**
   * The conversation, from the one place it lives.
   *
   * Not built here: `ai/converse.ts` holds the turns, the request, the
   * proposals and the undo, so the sheet and the older Ask screen are two
   * views of one assistant rather than two assistants. See its header.
   */
  const talk = useConversation();
  /** Whether the "what's included" panel is open. Nothing hidden, on request. */
  const [showing, setShowing] = useState(false);

  const sheet = useRef<HTMLDivElement | null>(null);
  /** What had focus before the sheet opened, to give it back on close. */
  const cameFrom = useRef<HTMLElement | null>(null);

  const assembled = useMemo(() => (ai.open ? ai.look() : null), [ai]);
  /*
   * `screenName`, not the registry directly. Twenty screens are not
   * destinations — the eight settings pages and the twelve you reach from
   * something else — so `?? ai.screen` was the answer on all twenty, and the
   * button announced itself as "Ask about setNav", "Ask about drill", "Ask
   * about slides". `lib/nav.ts` names them; nothing here has to know which
   * of the three registries a given screen's name is kept in.
   */
  const here = useMemo(() => screenName(ai.screen), [ai.screen]);

  /** Nothing asked in this thread yet, so the opening stands in for it. */
  const empty = talk.turns.length === 0 && !talk.busy;

  /**
   * What the panel is called: the conversation you are in.
   *
   * The thread's own name if it has been renamed, otherwise its first
   * question — the same string the history list shows, so opening the tab
   * finds the row you were just reading under the name you were just reading.
   * A new thread has no question yet and says who is answering instead.
   */
  const open = talk.threads.find((t) => t.id === talk.openId);
  const title = open && open.turns.length > 0 ? nameOf(open) : `Ask ${provider()}`;

  /**
   * Follows the stream, and stops the moment you scroll up.
   *
   * The sheet had neither. It was a plain overflow box, so a streaming answer
   * wrote itself past the bottom edge while the reader sat looking at their
   * own question — the one bug in this panel that made it read as not being a
   * chat at all. `useFollowing` is the tab's rule and this is the same one.
   */
  const { box, following, toEnd } = useFollowing([
    talk.turns.length,
    talk.streaming,
    talk.busy,
    ai.open,
  ]);

  /** Where a drag on the handle started, or null when it is a tap. */
  const grab = useRef<number | null>(null);

  /*
   * The one corner it must not take.
   *
   * Today already puts the import button bottom-right when the feed nav is
   * on. Stacking on it would bury a primary action behind a floating one,
   * which is the failure the brief calls out by name, so the assistant takes
   * the other side there instead of arguing about z-index.
   */
  const taken = state.nav === 'feed' && state.screen === 'home' && !wide;
  const side: Corner = taken && corner === 'right' ? 'left' : corner;

  /**
   * The panel's geometry, which is three shapes and not one.
   *
   * On a phone it is a bottom sheet: full-bleed, three-fifths of the height,
   * rounded at the top, and the screen behind it still visible. That is the
   * embedded assistant, and it is what the corner button is for.
   *
   * On a wide window a full-bleed strip across the bottom of a laptop is
   * neither: the measure is wrong, the composer is a metre from the answer,
   * and it covers a screen that had the room to keep showing. So there it
   * docks as a card in the corner it was opened from — the shape every
   * embedded assistant on the web has settled on, for the reason they all
   * settled on it.
   *
   * Opened out, both become the same thing: a modal over a wash, capped at a
   * reading width on a wide window rather than stretched across it.
   */
  const shape = useMemo((): React.CSSProperties => {
    if (!wide) {
      return {
        left: 0,
        right: 0,
        bottom: 0,
        height: full ? '100%' : `${Math.round(PART * 100)}%`,
        borderRadius: full ? 0 : 'var(--r-lg) var(--r-lg) 0 0',
        borderInline: full ? 0 : undefined,
        borderBottom: full ? 0 : undefined,
      };
    }
    if (full) {
      return {
        top: 24,
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(980px, calc(100vw - 48px))',
        borderRadius: 'var(--r-lg)',
      };
    }
    return {
      [side]: 20,
      bottom: 20,
      width: 'min(440px, calc(100vw - 40px))',
      height: 'min(700px, calc(100vh - 96px))',
      borderRadius: 'var(--r-lg)',
    };
  }, [wide, full, side]);

  /*
   * Cmd/Ctrl+K, and Escape while the sheet is up.
   *
   * Not `a`. That is in `lib/keys.ts` with every other single-letter shortcut,
   * because for a while it was in both: this listener opened the sheet while
   * that one navigated to the Ask screen, and pressing `a` did both. A key
   * with two owners has no correct behaviour, and the `?` sheet — which reads
   * that list — could only ever describe one of them.
   *
   * Cmd+K stays here. `lib/keys.ts` ignores anything carrying a modifier on
   * principle, so adding it there would mean weakening the rule that keeps the
   * app out of the browser's shortcuts.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ai.show();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && ai.open) {
        e.preventDefault();
        ai.hide();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ai]);

  /*
   * Remember what had focus, and give it back on close.
   *
   * Focusing *into* the box is the composer's own job now — it mounts with
   * the sheet and focuses itself, which is one fewer thing that can race. The
   * timeout that used to be here was working around the box not existing yet.
   */
  useEffect(() => {
    if (ai.open) {
      cameFrom.current = document.activeElement as HTMLElement | null;
      return;
    }
    cameFrom.current?.focus?.();
    setFull(false);
    setShowing(false);
  }, [ai.open]);

  useEffect(() => {
    if (seed.seeded) {
      setDraft(seed.seeded);
      seed.clear();
    }
  }, [seed]);

  /*
   * Focus is trapped only at full height.
   *
   * At the partial height the screen behind is meant to stay usable — that is
   * what makes this feel embedded — and trapping focus would make the tab key
   * disagree with the pointer about whether the app behind is live. Full
   * height covers everything, so there it is a real modal and traps.
   */
  const onTab = useCallback(
    (e: React.KeyboardEvent) => {
      if (!full || e.key !== 'Tab' || !sheet.current) return;
      /*
       * The ring is `a11y/modal.ts`'s rather than this file's.
       *
       * Only the ring: this sheet is open and shut by `ai.open` rather than
       * by mounting, and it is a modal only at full height, so `useModal`'s
       * other half — take focus on open, give it back on close — would be
       * fighting the effect above that already does exactly that on the
       * right signal. What was here was a second copy of the arithmetic, and
       * it had the bug a second copy gets: no `[disabled]`, so a Send button
       * greyed out until you type was a dead stop at the end of the ring.
       */
      const to = nextInRing(focusablesIn(sheet.current), document.activeElement, e.shiftKey);
      if (!to) return;
      e.preventDefault();
      to.focus();
    },
    [full],
  );

  const moveCorner = (to: Corner) => {
    setCorner(to);
    try {
      localStorage.setItem(CORNER_KEY, to);
    } catch {
      /* the position is a convenience, not a setting worth failing over */
    }
  };

  /*
   * Lifted, when the screen puts something tappable under it.
   *
   * Measured after the screen has painted, and again if the window resizes.
   * Not on every render: this reads layout, and doing that in a render is how
   * a scroll turns into a stutter.
   */
  const [lift, setLift] = useState(0);
  const fab = useRef<HTMLButtonElement | null>(null);
  /*
   * Lifted when the screen puts something tappable under it.
   *
   * Tied to scrolling rather than only to the screen changing, for two
   * reasons. The honest one: what is under the button is a property of the
   * scroll position, not of the screen — a list has a row under it at every
   * offset and a form has its Save button under it at exactly one. The
   * practical one: measuring on a timer after a screen change measured the
   * *previous* screen's layout about half the time, which is why the first
   * version lifted on the screens that were already clear and stayed put on
   * Costs, the one screen that needed it.
   */
  useEffect(() => {
    if (ai.open) return;
    let waiting = 0;
    const check = () => {
      const node = fab.current;
      if (!node) return;
      const box = node.getBoundingClientRect();
      // From the resting place, not the lifted one, or each measurement is of
      // the answer to the last.
      const rest = new DOMRect(box.left, box.top + lift, box.width, box.height);
      setLift(clearOf(rest, node));
    };
    const soon = () => {
      if (waiting) return;
      waiting = window.requestAnimationFrame(() => {
        waiting = 0;
        check();
      });
    };
    /*
     * Checked several times over the first second, not once.
     *
     * A single measurement after a screen change was the bug: every screen is
     * lazy and arrives behind a Suspense boundary, so at 120ms Costs had not
     * painted its "Add it" button yet, the point under the assistant was
     * empty, and it settled at the one position that covers it. Screens also
     * fill in after their first paint — a list that loads, a figure that
     * measures — so there is no single moment that is "after the screen".
     *
     * Four `elementsFromPoint` calls spread over a second cost nothing, and
     * between them they are right whenever the content actually arrives.
     */
    const timers = [120, 350, 700, 1200].map((ms) => window.setTimeout(soon, ms));
    const area = document.querySelector('.scrollarea');
    area?.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    return () => {
      for (const t of timers) window.clearTimeout(t);
      if (waiting) window.cancelAnimationFrame(waiting);
      area?.removeEventListener('scroll', soon);
      window.removeEventListener('resize', soon);
    };
  }, [ai.open, state.screen, state.mode, wide, lift]);

  return (
    <>
      {/* Select a sentence anywhere and ask about that instead of the page. */}
      <AskSelection />
      {/*
        Not on a screen whose composer is on the bottom edge.

        The button's whole job is to bring the assistant over what you are
        looking at. On the Ask tab you are looking at the assistant, so it
        offered to open a sheet showing the same conversation on top of the
        same conversation — and the sheet's header would have read "Looking
        at: Ask Claude". It also sat over the composer, which is the one
        control on that screen that matters.

        That second reason is the general one, and it is why this asks
        `fills()` rather than naming the Ask tab. A screen on that list ends
        at the bottom edge with something you type into there — the class
        conversation does too — so the floating button lands on the send
        control of whatever chat is open. See `shell/exempt.ts`.
      */}
      {!ai.open && !fills(state.screen) && (
        <button
          type="button"
          ref={fab}
          onClick={() => ai.show()}
          /*
           * Named for where you are, so a screen reader hears what it will be
           * asked about rather than "button, ask".
           *
           * From the registry, not from `look()` — that assembles the whole
           * context, and calling it to write a label would rebuild four
           * courses' worth of grading rows on every render of a button.
           */
          aria-label={`Ask about ${here}`}
          aria-keyshortcuts="a"
          onDragEnd={(e) => moveCorner(e.clientX < window.innerWidth / 2 ? 'left' : 'right')}
          draggable
          style={{
            position: 'fixed',
            [side]: 18,
            /*
             * Above the tab bar, measured rather than guessed.
             *
             * The bar has no fixed height — it is a flex child sized by its
             * own content, and it grows with the text-size setting. A
             * hard-coded 64 left a two-pixel gap at the default size and would
             * have sat on top of the bar at the largest one, so the shell
             * measures it and writes `--tabbar-h`.
             */
            /*
             * A wide window has no tab bar — the rail replaces it and the
             * shell removes `--tabbar-h` — so the fallback would strand the
             * button 76px above nothing.
             */
            bottom: wide ? 20 + lift : `calc(var(--tabbar-h, 76px) + ${12 + lift}px)`,
            width: 52,
            height: 52,
            borderRadius: '50%',
            zIndex: 55,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--chrome)',
            color: 'var(--chrome-ink)',
            border: '1px solid rgba(255,255,255,.45)',
            boxShadow: 'var(--glow)',
            fontFamily: 'var(--font-heading)',
            fontSize: 'calc(17px * var(--text-scale, 1))',
            cursor: 'pointer',
          }}
        >
          {/* A glyph rather than an icon import: the tab bar's icon set has
              nothing that reads as "ask", and a wrong icon is worse than a
              letter people learn in a day. */}
          <span aria-hidden>✦</span>
        </button>
      )}

      {ai.open && assembled && (
        <>
          {/*
            The wash, at full height only.

            At the partial height the screen behind is meant to stay readable
            and tappable — that is the whole difference between an assistant
            embedded in the app and a chat window that floats over it, and a
            scrim would take it away. At full height the panel is a real modal
            and the wash is what says so; tapping it closes, which is what
            everybody tries first.
          */}
          {full && (
            <button
              type="button"
              className="bare"
              aria-label="Close the assistant"
              onClick={() => ai.hide()}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 69,
                width: '100%',
                background: 'var(--scrim)',
                border: 0,
                cursor: 'default',
              }}
            />
          )}
          <div
            ref={sheet}
            role="dialog"
            aria-label={`Ask about ${assembled.label}`}
            aria-modal={full}
            onKeyDown={onTab}
            style={{
              position: 'fixed',
              zIndex: 70,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: 'var(--app-panel)',
              border: '1px solid var(--app-line)',
              boxShadow: 'var(--lift-2), 0 -18px 40px rgba(0,0,0,0.45)',
              ...shape,
            }}
          >
            {/*
              The grab handle, on the surface that has a grab.

              A phone sheet is dragged; a panel docked in the corner of a
              laptop is not, and a handle there is a decoration pretending to
              be a control. It doubles as the full-height toggle, which is
              what a swipe would do and what a keyboard cannot swipe for.
            */}
            {!wide && (
              <button
                type="button"
                className="bare"
                onClick={() => setFull((was) => !was)}
                onPointerDown={(e) => {
                  grab.current = e.clientY;
                }}
                onPointerUp={(e) => {
                  const from = grab.current;
                  grab.current = null;
                  if (from === null) return;
                  const moved = e.clientY - from;
                  // A drag, not a tap. Up opens it out, down puts it back and
                  // then closes it — the two gestures every sheet on a phone
                  // already answers to.
                  if (moved < -DRAG) setFull(true);
                  else if (moved > DRAG) {
                    if (full) setFull(false);
                    else ai.hide();
                  }
                }}
                aria-label={full ? 'Shrink the assistant' : 'Expand the assistant'}
                aria-expanded={full}
                style={{
                  width: '100%',
                  padding: '9px 0 5px',
                  display: 'grid',
                  placeItems: 'center',
                  touchAction: 'none',
                }}
              >
                <span
                  aria-hidden
                  style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--app-line-top)' }}
                />
              </button>
            )}

            {/*
              The header a chat has: who is answering, and what to do with the
              conversation. Two rows rather than one, because the two things
              it has to say are of different ranks — the title is the thread
              you are in, and "looking at" is the context that thread carries.
              Folding them into one line made the second read as a subtitle of
              the app rather than as a statement about this question.
            */}
            <div
              style={{
                flex: 'none',
                padding: wide ? 'var(--sp-6) var(--sp-6) var(--sp-4)' : 'var(--sp-3) var(--sp-6) var(--sp-4)',
                borderBottom: '1px solid var(--app-line-soft)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                <span
                  aria-hidden
                  style={{
                    flex: 'none',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--app-accent-wash)',
                    border: '1px solid var(--app-line)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-xs)',
                  }}
                >
                  ✦
                </span>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'var(--type-md)',
                    lineHeight: 'var(--leading-tight)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </div>
                {/* New, expand, close — in that order, because that is the
                    order of how often they are wanted and the close button
                    belongs at the edge where a thumb reaches for it. */}
                {talk.turns.length > 0 && !talk.busy && (
                  <button
                    type="button"
                    className="bare tap"
                    onClick={talk.clear}
                    aria-label="New conversation"
                    style={ICON}
                  >
                    <span aria-hidden>＋</span>
                  </button>
                )}
                <button
                  type="button"
                  className="bare tap"
                  onClick={() => setFull((was) => !was)}
                  aria-label={full ? 'Shrink the assistant' : 'Expand the assistant'}
                  aria-expanded={full}
                  style={ICON}
                >
                  <span aria-hidden>{full ? '⤡' : '⤢'}</span>
                </button>
                <button
                  type="button"
                  className="bare tap"
                  onClick={() => ai.hide()}
                  aria-label="Close the assistant"
                  style={{ ...ICON, fontSize: 'var(--type-lg)' }}
                >
                  <span aria-hidden>×</span>
                </button>
              </div>

              {/* What it can see, tappable to see exactly what. Nothing
                  hidden — an answer whose basis you cannot check is one you
                  either swallow or ignore.

                  The chevron leads the line rather than following it: the
                  summary is one line and is often longer than the panel, so a
                  trailing marker was the first thing the ellipsis ate, and the
                  only sign that this was a control at all disappeared exactly
                  when there was most to disclose. */}
              <button
                type="button"
                className="bare"
                onClick={() => setShowing((was) => !was)}
                aria-expanded={showing}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  marginTop: 'var(--sp-2)',
                  paddingLeft: 'calc(24px + var(--sp-4))',
                  fontSize: 'var(--type-xs)',
                  lineHeight: 'var(--leading-normal)',
                  opacity: 0.55,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {/*
                  What it is actually about, which is not always the screen.
                  A long press on a deadline says "Looking at: that deadline";
                  saying "Looking at: Courses" while the question is scoped to
                  one row is the header telling the student something untrue
                  about their own question.
                */}
                <span aria-hidden>{showing ? '▾' : '▸'}</span> Looking at:{' '}
                {assembled.extra.length > 0
                  ? assembled.extra[0].summary.replace(/\.$/, '')
                  : `${assembled.label}${
                      assembled.own
                        ? ` — ${assembled.own.summary.replace(/\.$/, '')}`
                        : ' — nothing of its own'
                    }`}
              </button>
            </div>

            <div
              ref={box}
              /*
               * `log`, not `feed`, and the same region the full chat uses.
               *
               * A log is a live region whose new entries are announced in
               * order, which is what a transcript is. `polite` so a completed
               * answer waits for the reader to pause rather than cutting
               * across them — and the streaming text below is deliberately
               * marked hidden, so tokens do not announce one at a time.
               */
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--sp-7) 0' }}
            >
              <div style={COLUMN}>
                {showing && (
                  <div style={{ marginBottom: 'var(--sp-7)' }}>
                    <div className="kicker">Exactly what goes with your question</div>
                    <pre
                      style={{
                        marginTop: 'var(--sp-3)',
                        padding: 'var(--sp-5)',
                        borderRadius: 'var(--r-sm)',
                        border: '1px solid var(--app-line)',
                        background: 'var(--app-hero)',
                        fontSize: 'var(--type-xs)',
                        lineHeight: 'var(--leading-normal)',
                        whiteSpace: 'pre-wrap',
                        overflowX: 'auto',
                      }}
                    >
                      {assembled.text || 'This screen tells the assistant nothing of its own.'}
                    </pre>
                    {assembled.dropped > 0 && (
                      <div style={{ fontSize: 'var(--type-xs)', opacity: 0.6, marginTop: 5 }}>
                        {assembled.dropped} more rows did not fit and were left out. The assistant
                        is told that too, so it will not count from a partial list.
                      </div>
                    )}
                  </div>
                )}

                {/* Nothing asked yet. The same opening the tab draws, from
                    `Opening.tsx` — a sentence about what it can see and four
                    things worth asking here, rather than four naked buttons. */}
                {empty && <Opening onPick={(q) => void talk.send(q)} tight />}

                {/*
                  The same two components the full chat draws, from
                  `Turns.tsx`, laid out the same way: the question in a tinted
                  block, the answer as prose at the reading measure, and the
                  turns a clear distance apart. Not a second implementation of
                  them — the sheet and the tab are two views of one
                  conversation, and a turn that looked like one thing here and
                  another there would make opening the tab read as having gone
                  somewhere else. The shapes and the reasons are in that file.
                */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'calc(var(--sp-7) * 1.6)',
                  }}
                >
                  <Dropped n={talk.dropped} />
                  {talk.turns.map((t, i) =>
                    t.role === 'user' ? (
                      <Question
                        key={i}
                        text={t.content}
                        onEdit={
                          i === talk.turns.length - 2 && !talk.busy
                            ? (next) => void talk.send(next, talk.turns.slice(0, i))
                            : undefined
                        }
                      />
                    ) : (
                      <Reply
                        key={i}
                        text={t.content}
                        incomplete={t.incomplete}
                        onRetry={i === talk.turns.length - 1 ? (talk.redo ?? undefined) : undefined}
                        /*
                         * The offers belong to the answer that made them.
                         *
                         * They used to sit in a tray under the whole
                         * transcript here, which put a live "add a reminder"
                         * button several screens below the sentence that
                         * offered it. The tab has had them in the flow since
                         * it was written; this is the same arrangement.
                         */
                        extra={
                          i === talk.turns.length - 1 && !talk.busy ? (
                            <>
                              {talk.used.length > 0 && (
                                <Looked
                                  said={`Read ${talk.used.length} ${
                                    talk.used.length === 1 ? 'part' : 'parts'
                                  } of your records`}
                                  detail={talk.used.join('\n')}
                                />
                              )}
                              <Locally
                                locally={talk.locally}
                                onGo={(screen) => {
                                  dispatch({ type: 'go', screen });
                                  ai.hide();
                                }}
                              />
                              <Proposals
                                proposals={talk.proposals}
                                line={talk.proposalsLine}
                                onRun={talk.run}
                                onDismiss={talk.dismiss}
                              />
                              <Applied applied={talk.applied} onTakeBack={talk.takeBack} />
                            </>
                          ) : undefined
                        }
                      />
                    ),
                  )}

                  {/*
                    Hidden from the reader, on purpose.

                    A live region containing the streaming text would announce
                    every token — a paragraph read one word at a time as it
                    arrives, which is unusable. The completed turn is announced
                    by the log when it lands; this is the sighted view of it
                    arriving.
                  */}
                  {talk.busy && (
                    <div aria-hidden style={{ fontSize: 'var(--type-sm)' }}>
                      {talk.streaming && <Reply text={talk.streaming} />}
                      {(!talk.streaming || talk.looking.length > 0) && (
                        <Waiting who={provider()} doing={talk.looking} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Never yanks anybody back down: it appears, and it waits. The
                sheet had no such rule at all — it did not follow the stream
                either, so a long answer wrote itself off the bottom edge
                while you sat looking at the question. */}
            {!following && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={toEnd}
                  style={{
                    position: 'absolute',
                    bottom: 'var(--sp-4)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    height: 32,
                    padding: '0 var(--sp-6)',
                    fontSize: 'var(--type-xs)',
                    letterSpacing: '0.08em',
                    borderRadius: 'var(--r-lg)',
                    boxShadow: 'var(--lift-2)',
                    background: 'var(--app-panel)',
                    zIndex: 2,
                  }}
                >
                  ↓ Latest
                </button>
              </div>
            )}

            <div
              style={{
                flex: 'none',
                borderTop: '1px solid var(--app-line)',
                padding: 'var(--sp-5) 0',
                paddingBottom: wide
                  ? 'var(--sp-5)'
                  : 'max(var(--sp-5), env(safe-area-inset-bottom))',
              }}
            >
              <div style={COLUMN}>
                {/*
                  The same box the full chat uses, from `Composer.tsx`, so
                  Enter means the same thing on both — including on a touch
                  keyboard, where it makes a new line and the arrow sends.
                */}
                <Composer
                  value={draft}
                  onChange={setDraft}
                  onSend={ask}
                  onStop={talk.stop}
                  onRecall={() => {
                    // The last thing *you* asked, not the last thing said.
                    for (let i = talk.turns.length - 1; i >= 0; i -= 1) {
                      if (talk.turns[i].role === 'user') return talk.turns[i].content;
                    }
                    return null;
                  }}
                  busy={talk.busy}
                  placeholder={`Ask about ${assembled.label} — ${sendHint(touch)}`}
                  autoFocus
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 'var(--sp-6)',
                    marginTop: 'var(--sp-4)',
                  }}
                >
                  {/*
                    Where the key, the model and the cost live. One tap from
                    the conversation they change, because somebody who wants a
                    different model should not have to guess it is in Settings.
                  */}
                  <button
                    type="button"
                    className="bare"
                    onClick={() => {
                      ai.hide();
                      dispatch({ type: 'go', screen: 'setAssistant' });
                    }}
                    style={QUIET}
                  >
                    {configured() ? modelLabel().toUpperCase() : 'SET A KEY'}
                  </button>
                  <span style={{ flex: 1 }} />
                  {/* The same conversation, with the page to itself. Not a
                      handoff and nothing is copied — both surfaces read the
                      one conversation in `ai/live.ts`, so this is a
                      navigation.

                      This is what the sheet is *for*, now that there is one
                      destination: it is the way in from wherever you were
                      standing, holding that screen's context, and the tab is
                      where the history of every conversation lives. The list
                      is there rather than here because twelve rows inside a
                      panel sized to leave the screen behind it visible would
                      fill the panel. */}
                  <button
                    type="button"
                    className="bare"
                    onClick={() => {
                      ai.hide();
                      dispatch({ type: 'go', screen: 'ask' });
                    }}
                    style={QUIET}
                  >
                    ALL CHATS ↗
                  </button>
                </div>
                {/* A failed request, and the retry for it. */}
                <Trouble said={talk.said} onRetry={talk.again} busy={talk.busy} />
                {/* The running cost, in small print. Silent when nothing was
                    measured — a zero would read as "this was free". See
                    `lib/spend.ts`. */}
                {talk.cost.asks > 0 && (
                  <div
                    style={{
                      fontSize: 'var(--type-xs)',
                      opacity: 0.45,
                      marginTop: 'var(--sp-3)',
                      lineHeight: 'var(--leading-normal)',
                    }}
                  >
                    About {money(talk.cost.dollars)} this month, over {talk.cost.asks}{' '}
                    {talk.cost.asks === 1 ? 'answer' : 'answers'}
                    {talk.cost.unpriced > 0 ? ` (${talk.cost.unpriced} unpriced)` : ''}. Estimated.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** A header control: square, named, and quiet until you reach for it. */
const ICON = {
  flex: 'none',
  width: 28,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 'var(--r-sm)',
  fontSize: 'var(--type-md)',
  opacity: 0.6,
} as const;

const QUIET = {
  width: 'auto',
  flex: 'none',
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.1em',
  opacity: 0.55,
} as const;

/**
 * The reading measure, the same one the tab uses.
 *
 * Around sixty-eight characters — the width a paragraph is comfortable at,
 * which is the whole point of not putting answers in a bubble. The panel is
 * narrower than that on a phone and at the docked width, so this only bites
 * when the sheet is opened out on a wide window, which is exactly where an
 * answer would otherwise run the full width of a laptop.
 *
 * `--reading-width` is the reader's own setting, so somebody who set the guide
 * wider gets this wider too rather than two different measures in one app.
 */
const COLUMN = {
  maxWidth: 'min(100%, var(--reading-width, 68ch))',
  margin: '0 auto',
  padding: '0 var(--sp-7)',
} as const;
