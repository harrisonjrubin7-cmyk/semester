import { useState } from 'react';
import { useStore } from '../state/store';
import { DESKTOP, TOUCH, useMedia } from '../lib/media';
import { useAI } from './store';
import { useConversation, provider } from './converse';
import { configured, modelLabel } from '../lib/claude';
import { Composer, sendHint } from './Composer';
import { Dropped, Question, Reply, Waiting, Looked, useFollowing } from './Turns';
import { Threads, ThreadsOver } from './Threads';
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
 */
export function Chat() {
  const { dispatch, now } = useStore();
  const talk = useConversation();
  const touch = useMedia(TOUCH);
  const wide = useMedia(DESKTOP);
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
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--sp-7) 0' }}
      >
        <div style={COLUMN}>
          {empty && <Opening onPick={(q) => ask(q)} />}

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
                {talk.streaming ? <Answering text={talk.streaming} /> : <Waiting who={provider()} />}
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

      <div style={{ borderTop: '1px solid var(--app-line)', padding: 'var(--sp-5) 0 var(--sp-6)' }}>
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
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--sp-6)',
              marginTop: 'var(--sp-4)',
            }}
          >
            <button
              type="button"
              className="bare"
              onClick={() => dispatch({ type: 'back' })}
              style={QUIET}
            >
              ← BACK TO APP
            </button>
            {/*
              Where the key, the model and the cost went.

              This tab used to *be* that form, which is the thing the rewrite
              undid — but somebody who wants to change the model should not
              have to guess that it is under Settings now, so the way there is
              one tap from the conversation it changes.
            */}
            <button
              type="button"
              className="bare"
              onClick={() => dispatch({ type: 'go', screen: 'setAssistant' })}
              style={QUIET}
            >
              {configured() ? modelLabel().toUpperCase() : 'SET A KEY'}
            </button>
            <span style={{ flex: 1 }} />
            {/* Only where the panel is not already showing the list. */}
            {!wide && (
              <button
                type="button"
                className="bare"
                onClick={() => setListing(true)}
                style={QUIET}
              >
                {talk.threads.filter((t) => t.turns.length > 0).length > 1
                  ? `${talk.threads.filter((t) => t.turns.length > 0).length} CONVERSATIONS`
                  : 'CONVERSATIONS'}
              </button>
            )}
            {talk.turns.length > 0 && !talk.busy && (
              <button type="button" className="bare" onClick={talk.clear} style={QUIET}>
                NEW
              </button>
            )}
          </div>
          {/* A failed request, and the retry for it. The sheet has had this
              since the assistant shipped; the chat did not, so a request that
              failed on this surface said nothing at all. */}
          <Trouble said={talk.said} onRetry={talk.again} busy={talk.busy} />
          {talk.cost.asks > 0 && (
            <div style={{ fontSize: 'var(--type-xs)', opacity: 0.4, marginTop: 'var(--sp-3)' }}>
              {talk.cost.asks} {talk.cost.asks === 1 ? 'answer' : 'answers'} this month. Estimated.
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

const QUIET = {
  width: 'auto',
  flex: 'none',
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.1em',
  opacity: 0.55,
} as const;

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

/**
 * A new thread, which is not a blank page.
 *
 * What it can see, three or four things worth asking from the screen you came
 * from, and one line about what it can do. The suggestions come from that
 * screen's own provider, so they are about what is actually on it rather than
 * a fixed list that would be wrong four screens out of five.
 */
function Opening({ onPick }: { onPick: (q: string) => void }) {
  const ai = useAI();
  const suggestions = ai.suggestions().slice(0, 4);

  /*
   * What it is looking at — unless the answer is this page.
   *
   * The sheet's version of this line is the point of the sheet: it comes up
   * over Grades and says so, because the question you are about to ask is
   * about what is behind it. Here there is nothing behind it, and the first
   * draft printed "You are on Chat." — the assistant telling you that you
   * have opened the assistant. So on this screen the line says what it can
   * see rather than where you are, which is the thing that was actually
   * worth saying.
   */
  const seen = ai.screen === 'ask' ? null : ai.look().label;

  return (
    <div style={{ marginBottom: 'calc(var(--sp-7) * 1.6)' }}>
      <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
        {seen ? `You are on ${seen}.` : 'Ask about your term.'}
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="btn btn-secondary"
              onClick={() => onPick(s)}
              style={{
                height: 'auto',
                padding: 'var(--sp-5) var(--sp-6)',
                textAlign: 'left',
                justifyContent: 'flex-start',
                fontSize: 'var(--type-sm)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          fontSize: 'var(--type-xs)',
          opacity: 0.5,
          lineHeight: 'var(--leading-normal)',
          marginTop: 'var(--sp-6)',
          textWrap: 'pretty',
        }}
      >
        {seen ? 'It sees what this screen is showing, your ' : 'It sees your '}
        deadlines and your grades — never your notes, your drafts or anyone in People. It can offer
        to change something, and nothing happens until you tap it.
      </div>
    </div>
  );
}
