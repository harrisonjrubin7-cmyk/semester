import { useEffect, useState, type ReactNode } from 'react';
import { Answer } from './Answer';

/**
 * How a turn looks, on both surfaces.
 *
 * The two turns are shaped differently on purpose, and the difference is the
 * whole reason this reads better than a generic chat widget:
 *
 * A question is short and it is yours. It sits in a tinted bubble on the
 * right, so the eye can find where each exchange begins without reading.
 *
 * An answer is long and is the thing you came for. It takes the full measure
 * with **no bubble, no avatar and no card** — plain on the page. Two bubbles
 * facing each other is what a support widget looks like, it spends a third of
 * a phone's width on whitespace, and the width it spends is the width the
 * answer needed. Every long answer in this app is more readable for that one
 * decision than for anything else here.
 */

export function Question({ text, onEdit }: { text: string; onEdit?: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  if (editing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '86%', width: '100%' }}>
          <textarea
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Edit your question"
            style={{ margin: 0, fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-3)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="bare"
              onClick={() => {
                setDraft(text);
                setEditing(false);
              }}
              style={{ width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.1em', opacity: 0.55 }}
            >
              CANCEL
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!draft.trim()}
              // Named for what it does. "Save" would be wrong: this throws
              // away the answer below and asks again.
              onClick={() => {
                setEditing(false);
                onEdit?.(draft);
              }}
              style={{ height: 30, fontSize: 'var(--type-xs)' }}
            >
              Ask again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ maxWidth: '86%' }}>
        <div style={BUBBLE}>{text}</div>
        {onEdit && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
            <button
              type="button"
              className="bare"
              onClick={() => setEditing(true)}
              style={{ width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.1em', opacity: 0.45 }}
            >
              EDIT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const BUBBLE = {
  padding: 'var(--sp-4) var(--sp-6)',
  borderRadius: 'var(--r-lg)',
  // The accent at low opacity, which is a real token and follows every ground
  // — including the light ones, where a fixed tint would have been a grey
  // rectangle on parchment.
  background: 'var(--app-accent-wash)',
  border: '1px solid var(--app-line)',
  fontSize: 'var(--type-sm)',
  lineHeight: 'var(--leading-relaxed)',
  whiteSpace: 'pre-wrap',
  textWrap: 'pretty',
} as const;

/** An answer: full width, no container, and what you can do with it. */
/**
 * The line saying the middle of the conversation is gone.
 *
 * Shown where the gap is — at the top, under the opening exchange that was
 * kept — rather than in a settings screen nobody opens. A model that has
 * forgotten what you can still scroll up and read will contradict it, and the
 * only thing worse than that happening is it happening unexplained.
 */
export function Dropped({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <div
      className="kicker"
      style={{
        textTransform: 'none',
        letterSpacing: 0,
        opacity: 0.5,
        textAlign: 'center',
        lineHeight: 'var(--leading-relaxed)',
      }}
    >
      {n} earlier {n === 1 ? 'turn is' : 'turns are'} no longer being sent — this conversation has
      outgrown what fits. The first exchange and everything recent are still here.
    </div>
  );
}

export function Reply({
  text,
  incomplete,
  onRetry,
  extra,
}: {
  text: string;
  /** Stopped part-way. Says so rather than passing a fragment off as an answer. */
  incomplete?: boolean;
  onRetry?: () => void;
  /** Action cards and tool rows, inside the flow rather than after it. */
  extra?: ReactNode;
}) {
  return (
    <div style={{ fontSize: 'var(--type-sm)' }}>
      <Answer text={text} />
      {incomplete && (
        <div style={{ fontSize: 'var(--type-xs)', opacity: 0.5, marginTop: 'var(--sp-2)' }}>
          Stopped here.
        </div>
      )}
      {extra}
      <Beneath text={text} onRetry={onRetry} />
    </div>
  );
}

/**
 * What you can do with an answer once it is there.
 *
 * Copy, because an answer worth keeping goes into a note or an email and
 * retyping it is what people do instead. Retry only on the last one:
 * regenerating from the middle would throw away every turn after it, and a
 * button that silently deletes four exchanges is not a button.
 *
 * The feedback pair is local and says so. Nothing is sent — there is nowhere
 * to send it — and a thumb that quietly did nothing would be worse than none.
 * It marks the answer so it can be found again in the thread.
 */
function Beneath({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [mark, setMark] = useState<'' | 'good' | 'bad'>('');
  return (
    <div style={{ display: 'flex', gap: 'var(--sp-6)', marginTop: 'var(--sp-3)', flexWrap: 'wrap' }}>
      <button
        type="button"
        className="bare"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(text)
            .then(() => setCopied(true))
            .catch(() => {});
        }}
        style={QUIET}
      >
        {copied ? 'COPIED' : 'COPY'}
      </button>
      {onRetry && (
        <button type="button" className="bare" onClick={onRetry} style={QUIET}>
          ASK AGAIN
        </button>
      )}
      <button
        type="button"
        className="bare"
        aria-pressed={mark === 'good'}
        onClick={() => setMark((was) => (was === 'good' ? '' : 'good'))}
        style={{ ...QUIET, opacity: mark === 'good' ? 0.85 : 0.5 }}
      >
        GOOD
      </button>
      <button
        type="button"
        className="bare"
        aria-pressed={mark === 'bad'}
        onClick={() => setMark((was) => (was === 'bad' ? '' : 'bad'))}
        style={{ ...QUIET, opacity: mark === 'bad' ? 0.85 : 0.5 }}
      >
        NOT USEFUL
      </button>
      {mark && (
        <span style={{ fontSize: 'var(--type-xs)', opacity: 0.4 }}>
          Marked on this device. Nothing is sent.
        </span>
      )}
    </div>
  );
}

const QUIET = {
  width: 'auto',
  flex: 'none',
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.1em',
  opacity: 0.5,
} as const;

/**
 * Waiting for the first token.
 *
 * Three dots and a sentence naming what is happening. Not a spinner, which
 * says "something is loading" and nothing else, and not invented status text
 * — it does not claim to be "thinking about your grades" when what it is
 * doing is waiting on a network.
 */
export function Waiting({ who }: { who: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        opacity: 0.55,
        fontSize: 'var(--type-sm)',
      }}
    >
      <span aria-hidden style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'var(--app-fg)',
              opacity: 0.5,
              animation: `aiPulse 1.1s ${i * 0.16}s infinite ease-in-out`,
            }}
          />
        ))}
      </span>
      {who} is reading your screen…
    </div>
  );
}

/**
 * "Looked at your Grades" — what it did, folded away.
 *
 * A row rather than a paragraph, because on most turns the answer is the point
 * and the lookup is not. Expandable, because on the turn where a number looks
 * wrong the first question is what it was reading, and an assistant that
 * cannot answer that is one you either trust blindly or not at all.
 */
export function Looked({ said, detail }: { said: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ margin: 'var(--sp-3) 0 var(--sp-5)' }}>
      <button
        type="button"
        className="bare"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        style={{
          width: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          fontSize: 'var(--type-xs)',
          letterSpacing: '0.06em',
          opacity: 0.55,
        }}
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span>
        {said}
      </button>
      {open && (
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
          {detail}
        </pre>
      )}
    </div>
  );
}

/**
 * The list of turns, and the scrolling rule.
 *
 * Follows the stream while you are at the bottom, and stops the moment you
 * scroll up — a page that yanks you back down mid-sentence is one you cannot
 * read the middle of. A pill appears instead, so getting back is one tap and
 * a decision rather than something that happens to you.
 */
export function useFollowing(deps: unknown[]) {
  /*
   * The element in state, not in a ref, and that is not a style choice.
   *
   * A ref is null on the first run of every effect, and an effect with an
   * empty dependency list only ever gets that one run. On the tab, where the
   * transcript is mounted for as long as the screen is, that is harmless —
   * the box happens to exist by the time React commits. In the assistant's
   * panel it is not: the transcript is mounted when the panel opens, several
   * renders after this hook first ran, so the scroll listener was attached to
   * nothing, `following` never turned off, and the way back down never
   * appeared however far you scrolled up. A callback ref runs when the node
   * arrives and when it goes, which is exactly when the listener should.
   */
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    if (!el) return;
    const onScroll = () => {
      // Sixty pixels of slack: "at the bottom" has to survive the last line of
      // a paragraph arriving, or following turns itself off as it works.
      const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      setFollowing(atEnd);
    };
    // A panel that opens on an old conversation opens at the end of it, which
    // is where the last answer is. Re-following on mount also undoes a
    // `following` left false by the previous time it was open.
    setFollowing(true);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [el]);

  useEffect(() => {
    if (!following || !el) return;
    el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el, following, ...deps]);

  const toEnd = () => {
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setFollowing(true);
  };

  return { box: setEl, following, toEnd };
}
