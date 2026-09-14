import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { focusablesIn, nextInRing } from '../a11y/modal';
import { useStore } from '../state/store';
import { useAI, useSeed } from './store';
import { assemble } from './assemble';
import { TOUCH, WIDE, useMedia } from '../lib/media';
import { useConversation, provider } from './converse';
import { Composer, sendHint } from './Composer';
import { Dropped, Question, Reply, Waiting, Looked, useFollowing } from './Turns';
import { Opening } from './Opening';
import { money } from '../lib/spend';
import { configured, modelLabel } from '../lib/assistant';
import { nameOf } from '../lib/threads';
import { Trouble } from '../components/Trouble';
import { Applied, Locally, Proposals } from './Actions';

/**
 * The panel: the assistant once it is open, and nothing that is true before.
 *
 * This is the other half of `ai/Assistant.tsx`, and the split is about weight
 * rather than about design. The two were one component, and `App.tsx` mounts
 * it in all three shells — so the whole conversation stack came down the wire
 * and was parsed before anything rendered: this file, `converse.ts`, `Turns`,
 * `Composer`, `Actions`, `lib/claude.ts`, `lib/tools.ts` and the rest. Twenty
 * modules and 7,287 lines, measured on the eager import graph, for a panel
 * that opens on a tap.
 *
 * So the button stayed where it was and this left, behind `lazy()`. A tap
 * that has to fetch would be a tap that does nothing for a moment, so the
 * button asks for this file when the browser next goes idle — off the
 * critical path, and already there by the time anybody reaches for it. See
 * `ENGINEERING-AUDIT.md` §1.
 *
 * ## Why unmounting is safe
 *
 * Nothing about the conversation lives in this component. `ai/live.ts` holds
 * the turns, the request in flight and the thread list at module scope, on
 * purpose and with its own note saying why — the tab and this panel are two
 * views of one assistant, and only one of them is ever mounted. So closing
 * the panel mid-answer does not cancel it: the request keeps running, and
 * opening it again reads the same conversation, further along.
 *
 * What does belong to this component is what is true only while it is up —
 * whether it is opened out, what is in the composer, whether the "what's
 * included" panel is showing, and what had focus before. All four are reset
 * by unmounting, which is what the close branch used to do by hand.
 *
 * ## What it is, on each shape
 *
 * The three geometries, the drag, the focus trap at full height and the
 * reading measure are all unchanged and documented where they are used
 * below. `side` is the only thing it is told rather than knowing: which
 * corner the button is resting in, so a docked card opens from it.
 */

/** How tall the sheet is when it first comes up, as a share of the window. */
const PART = 0.6;

/**
 * How far the handle has to travel before a tap becomes a drag.
 *
 * Forty pixels rather than five: a tap on a phone moves the finger a little,
 * and a sheet that treated four pixels of that as "drag down" would close
 * itself on every attempt to expand it.
 */
const DRAG = 40;

export function Panel({ side }: { side: 'right' | 'left' }) {
  const { dispatch } = useStore();
  const ai = useAI();
  const seed = useSeed();
  const wide = useMedia(WIDE);
  const touch = useMedia(TOUCH);
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

  /*
   * Always assembled, because this component exists only while the panel is
   * open. It used to read `ai.open ? ai.look() : null` — the file was
   * mounted all the time and the panel was a branch inside it.
   */
  const assembled = useMemo(() => assemble(ai), [ai]);

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
  const { box, following, toEnd } = useFollowing([talk.turns.length, talk.streaming, talk.busy]);

  /** Where a drag on the handle started, or null when it is a tap. */
  const grab = useRef<number | null>(null);


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
   * Remember what had focus, and give it back on close.
   *
   * Focusing *into* the box is the composer's own job — it mounts with the
   * sheet and focuses itself, which is one fewer thing that can race.
   *
   * This watched `ai.open` when the file was mounted all the time. Now the
   * component *is* the open panel, so mount and unmount say open and shut,
   * and the two resets that used to be in the close branch — `setFull(false)`
   * and `setShowing(false)` — are what unmounting does for nothing. A ref to
   * carry the value across a flag change is not needed either: a closure over
   * the mount is the value, and it cannot be overwritten by a later open.
   */
  useEffect(() => {
    const cameFrom = document.activeElement as HTMLElement | null;
    return () => cameFrom?.focus?.();
  }, []);

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

  return (
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
