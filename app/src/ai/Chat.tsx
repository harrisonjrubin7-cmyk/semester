import { useState, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { TOUCH, WIDE, useMedia } from '../lib/media';
import { chromeFor } from '../lib/chrome';
import { useKeyboardInset } from '../lib/keyboard';
import { useConversation, provider } from './converse';
import { configured, modelLabel } from '../lib/claude';
import { Composer, sendHint } from './Composer';
import { Dropped, Question, Reply, Waiting, Looked, useFollowing } from './Turns';
import { Threads, ThreadsOver } from './Threads';
import { Opening } from './Opening';
import { Applied, Locally, Proposals } from './Actions';
import { Trouble } from '../components/Trouble';

/**
 * The assistant, full screen.
 *
 * The second of two surfaces over **one** conversation. The sheet is for a
 * question you have while looking at something; this is for the conversation
 * that question turned into. Both call `useConversation`, which reads and
 * writes the same log — expanding from the sheet is a navigation, not a
 * handoff, and there is nothing to copy across because there were never two
 * copies.
 *
 * ## Why this is not the sheet at full height
 *
 * The sheet is a panel over a screen: it has a grab handle, a "looking at"
 * header, and it is sized so the screen behind stays visible. All three are
 * right there and wrong here. This has the page to itself, so the answer gets
 * the measure, the composer gets the bottom of the window, and there is no
 * chrome saying what is behind — because nothing is.
 *
 * ## And it ends at the bottom of the window
 *
 * A chat is a log that scrolls and a composer that does not, and the composer
 * sits on the bottom edge. That is not a stylistic preference — it is the
 * only arrangement where the thing you type into is in the same place after
 * every answer, which is why every chat anybody has used is shaped this way.
 *
 * The shell used to break it: `.scrollarea` reserves 76px under every screen
 * for the assistant's floating button, and this is the one screen where that
 * button is not drawn, so the reservation was a band of empty ground between
 * the composer and the tab bar — the chat floating in the upper two-thirds of
 * an otherwise empty phone. `shell/exempt.ts` names this screen as one that
 * fills its box and `.scrollarea.is-filled` takes the reservation back.
 */
export function Chat() {
  const { state, dispatch, now } = useStore();
  const talk = useConversation();
  const touch = useMedia(TOUCH);
  const wide = useMedia(WIDE);
  /*
   * What else the shell is drawing, which decides two things here.
   *
   * The home indicator: with a tab bar under the composer the bar is what
   * clears it, and paying for it twice leaves a finger's width of ground
   * below the pill. With no bar — one feed, a springboard — the composer *is*
   * the bottom edge and has to clear it itself.
   *
   * And the way out: "back to app" is the only exit from a navigation that
   * has none of its own, and pure clutter beside a tab bar that is already
   * showing five of them.
   */
  const chrome = chromeFor(state.nav, state.screen, wide);
  /*
   * And how much of the window the keyboard is standing on.
   *
   * Mounted here rather than in the shell because this is the screen it is
   * for: a composer on the bottom edge is the one control an iOS keyboard
   * covers completely. Everywhere else a focused field is somewhere in a
   * scrolling column and the browser scrolls it into view by itself, which is
   * the behaviour this deliberately does not touch on forty-nine screens.
   */
  useKeyboardInset();
  const [draft, setDraft] = useState('');
  /** The history, when there is no room for it beside the conversation. */
  const [listing, setListing] = useState(false);

  const { box, following, toEnd } = useFollowing([talk.turns.length, talk.streaming, talk.busy]);

  const ask = (text = draft) => {
    if (!text.trim() || talk.busy) return;
    setDraft('');
    void talk.send(text);
  };

  const empty = talk.turns.length === 0 && !talk.busy;
  const list = {
    threads: talk.threads,
    openId: talk.openId,
    onOpen: talk.open,
    onDrop: talk.drop,
    onNew: talk.clear,
    onRename: talk.rename,
    onPin: talk.pin,
    archived: talk.archived,
    onRestore: talk.restore,
    // The store's `now` is a Date — it is the app's one clock, and every
    // screen reads the day off it. The list wants milliseconds.
    now: now.getTime(),
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0, position: 'relative' }}>
      {/*
        Beside the conversation where there is room, over it where there is
        not. A 200px rail on a 430px phone leaves 230px for the answer, which
        is narrower than the measure this whole layout exists to protect.
      */}
      {wide && (
        <div
          style={{
            flex: 'none',
            width: 232,
            minHeight: 0,
            borderRight: '1px solid var(--app-line)',
          }}
        >
          <Threads {...list} />
        </div>
      )}
      {listing && !wide && <ThreadsOver {...list} onClose={() => setListing(false)} />}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div
        ref={box}
        /*
         * `log`, not `feed`.
         *
         * A log is a live region whose new entries are announced in order,
         * which is what a transcript is. `polite` so a completed answer waits
         * for the reader to pause rather than cutting across them — and the
         * streaming text below is deliberately outside this, so tokens do not
         * announce one at a time. See the note on the streaming block.
         */
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 'var(--sp-7) 0',
          /*
           * An empty conversation is centred; a conversation is not.
           *
           * The first screen used to be pinned to the top with the whole rest
           * of the window empty under it — three suggestions and a paragraph,
           * then eight inches of ground, then the composer. Centring puts the
           * greeting where the eye already is and the suggestions within a
           * thumb's reach of the box you would otherwise type in.
           *
           * Only while it is empty. Once there are turns the log is a
           * transcript and a transcript starts at the top, or a two-line
           * first answer would sit stranded in the middle of the screen.
           */
          display: empty ? 'flex' : 'block',
          flexDirection: 'column',
          /*
           * `safe center`, not `center`.
           *
           * A centred flex item taller than its box overflows *both* ends,
           * and the top end of a scroller cannot be reached — the greeting
           * gets its head cut off with no way to scroll up to it. That is not
           * hypothetical here: raise the keyboard on a phone and the log is
           * suddenly 200px tall with the same opening in it. `safe` says
           * centre while it fits and fall back to the start when it does not,
           * which is the whole of what was wanted. A browser too old for it
           * drops the declaration and top-aligns, which is where this screen
           * started.
           */
          justifyContent: 'safe center',
        }}
      >
        <div style={COLUMN}>
          {empty && <Opening onPick={(q) => ask(q)} big />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--sp-7) * 1.6)' }}>
            <Dropped n={talk.dropped} />
            {talk.turns.map((t, i) =>
              t.role === 'user' ? (
                <Question
                  key={i}
                  text={t.content}
                  // Only the last one. Editing an earlier question would throw
                  // away every exchange after it, which is a thing a button
                  // should not do quietly.
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
                   * The offers belong to the answer that made them, and sit
                   * inside it rather than in a tray at the bottom.
                   *
                   * Only on the last one: a proposal is about the exchange it
                   * came out of, and `talk.proposals` holds the current set
                   * rather than a set per turn. Hanging them under an older
                   * answer would put a live button under text that did not
                   * produce it.
                   */
                  extra={
                    i === talk.turns.length - 1 && !talk.busy ? (
                      <>
                        {talk.used.length > 0 && (
                          <Looked
                            said={`Read ${talk.used.length} ${talk.used.length === 1 ? 'part' : 'parts'} of your records`}
                            detail={talk.used.join('\n')}
                          />
                        )}
                        <Locally
                          locally={talk.locally}
                          onGo={(screen) => dispatch({ type: 'go', screen })}
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
              Outside the log, on purpose.

              A live region containing the streaming text would announce every
              token — a screen reader reading a paragraph one word at a time as
              it arrives, which is unusable. The completed turn is announced by
              the log above when it lands; this is the sighted view of it
              arriving, and is `aria-hidden` until it does.
            */}
            {talk.busy && (
              <div aria-hidden style={{ fontSize: 'var(--type-sm)' }}>
                {talk.streaming && <Answering text={talk.streaming} />}
                {(!talk.streaming || talk.looking.length > 0) && (
                  <Waiting who={provider()} doing={talk.looking} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Never yanks anybody back down: it appears, and it waits. */}
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

      {/*
        The dock: the composer, and one quiet line under it.

        `.chat-dock` in `styles/app.css` owns the padding, because the bottom
        of it is the bottom of the window and only `env()` knows how much of
        that a home indicator is taking. `--dock-safe` is 0 where a tab bar is
        already clearing it — otherwise the two both pay and the composer
        floats a finger's width up from the edge.
      */}
      <div
        className="chat-dock"
        style={
          {
            ['--dock-safe' as string]: chrome.tabs ? '0px' : 'env(safe-area-inset-bottom, 0px)',
          } as CSSProperties
        }
      >
        <div style={COLUMN}>
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => ask()}
            onStop={talk.stop}
            onRecall={() => {
              // The last thing *you* asked, not the last thing said.
              for (let i = talk.turns.length - 1; i >= 0; i -= 1) {
                if (talk.turns[i].role === 'user') return talk.turns[i].content;
              }
              return null;
            }}
            busy={talk.busy}
            placeholder={sendHint(touch)}
            autoFocus={!touch}
          />
          {/*
            One line, centred, under the pill — the shape every chat has, and
            not the four-button toolbar this was.

            It used to be a row justified to both edges: BACK TO APP and the
            model on the left, CONVERSATIONS and NEW pushed to the right. Four
            controls of equal weight strung across the foot of the screen read
            as a toolbar, which made the composer above them look like one
            field in a form rather than the thing the screen is for. Centred
            and separated by dots they read as what they are: the small print
            under the box.

            Each of them earns its place or is not drawn. Back to app only
            where the navigation has no other way out — beside a tab bar
            showing five destinations it is a fifth wheel. The history only
            where the panel beside the conversation is not already the
            history. New only when there is something to start again from.
          */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 'var(--sp-4)',
              marginTop: 'var(--sp-4)',
            }}
          >
            {!chrome.tabs && !chrome.rail && !chrome.shelves && (
              <>
                <button
                  type="button"
                  className="bare tap-y"
                  onClick={() => dispatch({ type: 'back' })}
                  style={QUIET}
                >
                  ← BACK
                </button>
                <Dot />
              </>
            )}
            {/* Only where the panel is not already showing the list. */}
            {!wide && (
              <>
                <button
                  type="button"
                  className="bare tap-y"
                  onClick={() => setListing(true)}
                  style={QUIET}
                >
                  {talk.threads.filter((t) => t.turns.length > 0).length > 1
                    ? `${talk.threads.filter((t) => t.turns.length > 0).length} CHATS`
                    : 'CHATS'}
                </button>
                <Dot />
              </>
            )}
            {talk.turns.length > 0 && !talk.busy && (
              <>
                <button type="button" className="bare tap-y" onClick={talk.clear} style={QUIET}>
                  NEW
                </button>
                <Dot />
              </>
            )}
            {/*
              Where the key, the model and the cost went.

              This tab used to *be* that form, which is the thing the rewrite
              undid — but somebody who wants to change the model should not
              have to guess that it is under Settings now, so the way there is
              one tap from the conversation it changes. Last in the line
              because it is the one you touch least, and because an unset key
              is the one thing here worth reading twice.
            */}
            <button
              type="button"
              className="bare tap-y"
              onClick={() => dispatch({ type: 'go', screen: 'setAssistant' })}
              style={QUIET}
            >
              {configured() ? modelLabel().toUpperCase() : 'SET A KEY'}
            </button>
          </div>
          {/* A failed request, and the retry for it. The sheet has had this
              since the assistant shipped; the chat did not, so a request that
              failed on this surface said nothing at all. */}
          <Trouble said={talk.said} onRetry={talk.again} busy={talk.busy} />
          {talk.cost.asks > 0 && (
            <div
              style={{
                fontSize: 'var(--type-xs)',
                opacity: 0.4,
                marginTop: 'var(--sp-3)',
                textAlign: 'center',
              }}
            >
              {talk.cost.asks} {talk.cost.asks === 1 ? 'answer' : 'answers'} this month. Estimated.
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * The small print under the composer — and why each of the four wears
 * `bare tap-y` beside this.
 *
 * Set as caps at `--type-xs` they are 17px tall: measured on the running app
 * at 390×844, CHATS came out 38×17 and SET A KEY 60×17, against a fingertip's
 * 44. They are the whole of the chat's chrome — the way back, the history, a
 * new thread and the key — and every one of them was a miss. `tap-y` rather
 * than `tap`, because they share one centred row and a target that grew
 * sideways would reach across the dot into the control beside it. See the
 * tap-target note in `styles/app.css`.
 */
const QUIET = {
  width: 'auto',
  flex: 'none',
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.1em',
  opacity: 0.55,
} as const;

/** The separator between two of those. Decoration, so no reader hears it. */
function Dot() {
  return (
    <span aria-hidden style={{ fontSize: 'var(--type-xs)', opacity: 0.25 }}>
      ·
    </span>
  );
}

/**
 * The reading measure, and the reason for it.
 *
 * Around sixty-eight characters on a wide window — the width a paragraph is
 * comfortable at, which is the whole point of not putting answers in a bubble.
 * Full width below that, because a phone is already narrower than the measure
 * and capping it again would only add margins.
 *
 * `--reading-width` is the reader's own setting, so somebody who set the guide
 * wider gets this wider too rather than two different measures in one app.
 */
const COLUMN = {
  maxWidth: 'min(100%, var(--reading-width, 68ch))',
  margin: '0 auto',
  padding: '0 var(--sp-7)',
} as const;

/** The streaming answer, with no controls under it until it has finished. */
function Answering({ text }: { text: string }) {
  return <Reply text={text} />;
}
