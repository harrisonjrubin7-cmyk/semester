import { useEffect, useRef, useState } from 'react';
import type { Thread } from '../lib/threads';

/**
 * The list of conversations, and the way back into one.
 *
 * ## Where it lives
 *
 * A panel beside the chat on a wide window, and a sheet over it on a phone.
 * Not a permanent column on both: on a 430px screen a 200px rail leaves 230px
 * for the answer, which is narrower than the measure the whole layout exists
 * to protect. So on a phone it is somewhere you go and come back from, and on
 * a desktop it is just there, because there the space is free.
 *
 * ## What a row says
 *
 * The first question, and when it was last touched. Not a preview of the last
 * answer, which was the first version: an answer's opening line is about the
 * answer, and what somebody scanning this list is trying to remember is what
 * they *asked*. "When is the ECON final" finds itself. "Two of the four are
 * above where you need to be" does not.
 *
 * ## Deleting
 *
 * Behind a second tap, and never behind a dialog. A conversation is not
 * precious enough for "are you sure?" in a modal, and is too easy to lose to
 * a single mis-tap on a phone — so the delete control turns into a confirm in
 * place, and goes back to itself if you tap anywhere else.
 */
export function Threads({
  threads,
  openId,
  onOpen,
  onDrop,
  onNew,
  now,
}: {
  threads: Thread[];
  openId: string;
  onOpen: (id: string) => void;
  onDrop: (id: string) => void;
  onNew: () => void;
  /** Passed in rather than read, so a test can say what time it is. */
  now: number;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  /*
   * Any tap that is not on the confirm itself puts it back.
   *
   * A destructive control left armed is one somebody meets by accident later,
   * so it disarms on the next pointer down anywhere. The exception has to be
   * decided *here*, by looking at what was tapped — not in the button, by
   * stopping the event.
   *
   * That was the first version and it made the confirm unclickable, which
   * looked exactly like a delete button that did not work: this listener is
   * on `window` in the capture phase, so it runs on the way *down* to the
   * target and has already cleared `confirming` before the button's own
   * handler exists to stop anything. React then swapped the confirm back to
   * "×" and the click landed on that instead, re-arming it.
   */
  useEffect(() => {
    if (!confirming) return;
    const off = (e: PointerEvent) => {
      const on = e.target instanceof Element ? e.target.closest('[data-confirm]') : null;
      if (on) return;
      setConfirming(null);
    };
    window.addEventListener('pointerdown', off, { capture: true });
    return () => window.removeEventListener('pointerdown', off, { capture: true });
  }, [confirming]);

  const order = [...threads].sort((a, b) => b.at - a.at);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-4)' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onNew}
          style={{ width: '100%', height: 34, fontSize: 'var(--type-xs)', letterSpacing: '0.08em' }}
        >
          + NEW CONVERSATION
        </button>
      </div>

      <ul
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          listStyle: 'none',
          margin: 0,
          padding: '0 var(--sp-4) var(--sp-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-2)',
        }}
      >
        {order.map((t) => (
          <li key={t.id} style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--sp-2)' }}>
            <button
              type="button"
              className="bare"
              onClick={() => onOpen(t.id)}
              // The open one is a state, not a decoration: a list where the
              // current row looks like every other row is one people tap
              // twice.
              aria-current={t.id === openId ? 'true' : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                width: 'auto',
                textAlign: 'left',
                padding: 'var(--sp-4) var(--sp-5)',
                borderRadius: 'var(--r-md)',
                background: t.id === openId ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-sm)',
                  lineHeight: 'var(--leading-tight)',
                  // One line, cut with an ellipsis. `titleFor` already cuts at
                  // a word, and this is the second guard for a narrow panel.
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.turns.length === 0 ? 'New conversation' : t.title}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-xs)',
                  opacity: 0.45,
                  marginTop: 'var(--sp-1)',
                }}
              >
                {t.turns.length === 0 ? 'Nothing asked yet' : `${ago(t.at, now)} · ${count(t.turns.length)}`}
              </span>
            </button>

            {confirming === t.id ? (
              <button
                type="button"
                className="bare"
                // The one thing the disarm listener above skips. See its note.
                data-confirm=""
                onClick={() => {
                  onDrop(t.id);
                  setConfirming(null);
                }}
                // Named for what it deletes, so a screen reader hears which
                // conversation is about to go rather than "delete, button".
                aria-label={`Delete "${t.title}" for good`}
                style={{ ...SIDE, opacity: 0.9, fontSize: 'var(--type-xs)', letterSpacing: '0.08em' }}
              >
                SURE?
              </button>
            ) : (
              <button
                type="button"
                className="bare"
                // Also skipped, so arming does not immediately disarm itself.
                data-confirm=""
                onClick={() => setConfirming(t.id)}
                aria-label={`Delete "${t.title}"`}
                style={{ ...SIDE, opacity: 0.35 }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const SIDE = {
  flex: 'none',
  width: 40,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 'var(--r-md)',
} as const;

function count(turns: number): string {
  // Exchanges, not messages: two turns is one question answered, and "4
  // messages" is a number about the data model rather than about the day.
  const asked = Math.ceil(turns / 2);
  return `${asked} ${asked === 1 ? 'question' : 'questions'}`;
}

/**
 * How long ago, in the coarsest unit that is still true.
 *
 * A conversation list is scanned, not read, and "3 days" is the answer to the
 * question being asked of it. Minutes matter only inside the hour, where the
 * difference between "just now" and "earlier" is the difference between the
 * thread you are in and the one before it.
 */
export function ago(at: number, now: number): string {
  const secs = Math.max(0, Math.round((now - at) / 1000));
  if (secs < 90) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
}

/**
 * The same list, as something that opens over the page.
 *
 * For the phone, and for the sheet. Focus moves into it and Escape closes it,
 * because a panel that traps neither is one a keyboard cannot leave.
 */
export function ThreadsOver({
  onClose,
  ...rest
}: Parameters<typeof Threads>[0] & { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={box}
      role="dialog"
      aria-modal="true"
      aria-label="Your conversations"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--app-panel)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 'var(--sp-5) var(--sp-6) 0',
        }}
      >
        <span className="kicker" style={{ flex: 1 }}>
          Your conversations
        </span>
        <button
          type="button"
          className="bare"
          onClick={onClose}
          aria-label="Close the list"
          style={{ width: 'auto', flex: 'none', opacity: 0.5, fontSize: 'var(--type-lg)' }}
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Threads
          {...rest}
          onOpen={(id) => {
            rest.onOpen(id);
            onClose();
          }}
          onNew={() => {
            rest.onNew();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
