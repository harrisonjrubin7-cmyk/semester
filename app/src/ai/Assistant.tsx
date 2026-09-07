import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useAI, useSeed } from './store';
import { DESKTOP, TOUCH, useMedia } from '../lib/media';
import { DESTINATIONS } from '../lib/nav';
import { useConversation, provider } from './converse';
import { AskSelection } from './AskAbout';
import { Composer, sendHint } from './Composer';
import { Question, Reply, Waiting } from './Turns';
import { money } from '../lib/spend';
import { Trouble } from '../components/Trouble';
import { Applied, Locally, Proposals } from './Actions';

/**
 * The assistant, everywhere.
 *
 * A button in the corner and a sheet that comes up over whatever you were
 * looking at — mounted once in the shell rather than rendered by a screen,
 * so there is exactly one of it and it can never disagree with itself about
 * where you are.
 *
 * ## The sheet is partial on purpose
 *
 * It comes up to about three-fifths and the screen behind stays visible and
 * usable. That is the whole difference between an assistant that is part of
 * the app and a chat window that happens to float: you can read your grades
 * while you ask about them, and tap a row behind it without dismissing
 * anything. Full height is a swipe or a tap away for a long answer.
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
  const wide = useMedia(DESKTOP);
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
  const here = useMemo(
    () => DESTINATIONS.find((d) => d.screen === ai.screen)?.label ?? ai.screen,
    [ai.screen],
  );

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
      const focusable = sheet.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
   * The one corner it must not take.
   *
   * Today already puts the import button bottom-right when the feed nav is
   * on. Stacking on it would bury a primary action behind a floating one,
   * which is the failure the brief calls out by name, so the assistant takes
   * the other side there instead of arguing about z-index.
   */
  const taken = state.nav === 'feed' && state.screen === 'home' && !wide;
  const side: Corner = taken && corner === 'right' ? 'left' : corner;

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
        Not on the chat screen itself.

        The button's whole job is to bring the assistant over what you are
        looking at. On `/chat` you are looking at the assistant, so it offered
        to open a sheet showing the same conversation on top of the same
        conversation — and the sheet's header would have read "Looking at:
        Chat". It also sat over the composer, which is the one control on that
        screen that matters.
      */}
      {!ai.open && state.screen !== 'chat' && (
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
            bottom: `calc(var(--tabbar-h, 76px) + ${12 + lift}px)`,
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
        <div
          ref={sheet}
          role="dialog"
          aria-label={`Ask about ${assembled.label}`}
          aria-modal={full}
          onKeyDown={onTab}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 70,
            height: full ? '100%' : `${Math.round(PART * 100)}%`,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--app-panel)',
            borderTop: '1px solid var(--app-line-top)',
            borderRadius: full ? 0 : 'var(--r-lg) var(--r-lg) 0 0',
            boxShadow: '0 -18px 40px rgba(0,0,0,0.45)',
          }}
        >
          {/* The grab handle doubles as the full-height toggle, which is what
              a swipe would do and what a keyboard cannot swipe for. */}
          <button
            type="button"
            className="bare"
            onClick={() => setFull((was) => !was)}
            aria-label={full ? 'Shrink the assistant' : 'Expand the assistant'}
            aria-expanded={full}
            style={{ width: '100%', padding: '9px 0 4px', display: 'grid', placeItems: 'center' }}
          >
            <span
              aria-hidden
              style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--app-line-top)' }}
            />
          </button>

          <div style={{ padding: '4px 16px 0', display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
            {/* What it can see, in the header, tappable to see exactly what.
                Nothing hidden — an answer whose basis you cannot check is one
                you either swallow or ignore. */}
            <button
              type="button"
              className="bare"
              onClick={() => setShowing((was) => !was)}
              aria-expanded={showing}
              style={{
                flex: 1,
                width: 'auto',
                textAlign: 'left',
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: 0.65,
              }}
            >
              {/*
                What it is actually about, which is not always the screen.
                A long press on a deadline says "Looking at: that deadline";
                saying "Looking at: Courses" while the question is scoped to
                one row is the header telling the student something untrue
                about their own question.
              */}
              Looking at:{' '}
              {assembled.extra.length > 0
                ? assembled.extra[0].summary.replace(/\.$/, '')
                : `${assembled.label}${
                    assembled.own ? ` — ${assembled.own.summary.replace(/\.$/, '')}` : ' — nothing of its own'
                  }`}
              {' '}
              <span aria-hidden>{showing ? '▾' : '▸'}</span>
            </button>
            <button
              type="button"
              className="bare"
              onClick={() => ai.hide()}
              aria-label="Close the assistant"
              style={{ flex: 'none', width: 'auto', opacity: 0.5, fontSize: 'var(--type-lg)' }}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 0' }}>
            {showing && (
              <div style={{ marginBottom: 14 }}>
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
                    {assembled.dropped} more rows did not fit and were left out. The assistant is
                    told that too, so it will not count from a partial list.
                  </div>
                )}
              </div>
            )}

            {/* Nothing asked yet: what is worth asking here, from this
                screen's own provider. */}
            {talk.turns.length === 0 && !talk.streaming && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                {ai.suggestions().map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void talk.send(s)}
                    style={{
                      height: 'auto',
                      padding: '10px 12px',
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      fontSize: 'var(--type-sm)',
                      lineHeight: 1.4,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/*
              The same two components the full chat draws, from `Turns.tsx`.

              Not a second implementation of them. The sheet and the chat are
              two views of one conversation, and a turn that looked like one
              thing on the sheet and another on the chat would make expanding
              read as having gone somewhere else. The shapes and the reasons
              for them are in that file's header.
            */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-7)' }}>
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
                    onRetry={i === talk.turns.length - 1 ? (talk.redo ?? undefined) : undefined}
                  />
                ),
              )}

              {/* Streaming, and before the first token arrives — a sheet that
                  sits blank for two seconds reads as one that did nothing. */}
              {talk.busy && (
                <div style={{ fontSize: 'var(--type-sm)' }}>
                  {talk.streaming ? <Reply text={talk.streaming} /> : <Waiting who={provider()} />}
                </div>
              )}
            </div>

            {/* Announced once, on completion — not per token, which would
                read every fragment of a paragraph out loud. */}
            <div aria-live="polite" className="sr-only">
              {talk.busy ? '' : talk.turns.at(-1)?.role === 'assistant' ? 'Answer ready.' : ''}
            </div>

            {/*
              The offers, the undo, and what the app can say by itself — the
              same components the full chat draws, from `Actions.tsx`.

              These used to be written out here, which is how the chat came to
              have no action cards at all: the model would propose adding a
              reminder, `talk.proposals` would fill, and the other surface
              rendered none of it.
            */}
            <Locally locally={talk.locally} onGo={(screen) => { dispatch({ type: 'go', screen }); ai.hide(); }} />
            <Proposals
              proposals={talk.busy ? [] : talk.proposals}
              line={talk.proposalsLine}
              onRun={talk.run}
              onDismiss={talk.dismiss}
            />
            <Applied applied={talk.applied} onTakeBack={talk.takeBack} />

            <Trouble said={talk.said} onRetry={talk.again} busy={talk.busy} />
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--app-line)' }}>
            {/*
              The same box the full chat uses, from `Composer.tsx`.

              This used to be its own textarea that grew by counting newlines,
              which is wrong for the commonest case — a long question with no
              newlines in it wraps to four lines and the count says one — and
              it sent on Enter even on a phone, where there is no Shift+Enter
              and so no way to type a second sentence. Both are fixed there,
              once, for both surfaces.
            */}
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={ask}
              onStop={talk.stop}
              busy={talk.busy}
              placeholder={`Ask about ${assembled.label} — ${sendHint(touch)}`}
              autoFocus
            />

            {talk.turns.length > 0 && !talk.busy && (
              <div style={{ display: 'flex', gap: 'var(--sp-6)', marginTop: 'var(--sp-4)' }}>
                <button
                  type="button"
                  className="bare"
                  onClick={talk.clear}
                  style={{ width: 'auto', flex: 'none', fontSize: 'var(--type-xs)', letterSpacing: '0.1em', opacity: 0.55 }}
                >
                  NEW CONVERSATION
                </button>
                {/* The same conversation, with the page to itself. Not a
                    handoff and nothing is copied — both surfaces read the one
                    conversation in `ai/live.ts`, so this is a navigation.

                    The history lives there rather than here: a list of twelve
                    conversations inside a panel sized to leave the screen
                    behind it visible would fill the panel. */}
                <button
                  type="button"
                  className="bare"
                  onClick={() => {
                    ai.hide();
                    dispatch({ type: 'go', screen: 'chat' });
                  }}
                  style={{ width: 'auto', flex: 'none', fontSize: 'var(--type-xs)', letterSpacing: '0.1em', opacity: 0.55 }}
                >
                  OPEN FULL CHAT
                </button>
              </div>
            )}
            {/* The running cost, in the header's own row of small print.
                Silent when nothing was measured — a zero would read as
                "this was free". See `lib/spend.ts`. */}
            {talk.cost.asks > 0 && (
              <div style={{ fontSize: 'var(--type-xs)', opacity: 0.5, marginTop: 'var(--sp-3)', lineHeight: 1.4 }}>
                About {money(talk.cost.dollars)} this month, over {talk.cost.asks}{' '}
                {talk.cost.asks === 1 ? 'answer' : 'answers'}
                {talk.cost.unpriced > 0 ? ` (${talk.cost.unpriced} unpriced)` : ''}. Estimated.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
