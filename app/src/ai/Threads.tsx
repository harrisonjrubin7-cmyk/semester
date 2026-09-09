import { useEffect, useState } from 'react';
import { useModal } from '../a11y/modal';
import { foundIn, grouped, nameOf, search, startedOn, type Thread } from '../lib/threads';
import { destination } from '../lib/nav';
import type { Screen } from '../lib/types';

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
  onRename,
  onPin,
  archived,
  onRestore,
  now,
}: {
  threads: Thread[];
  openId: string;
  onOpen: (id: string) => void;
  onDrop: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  /** The ones that came out of the list. Almost always empty. */
  archived: Thread[];
  onRestore: (id: string) => void;
  /** Passed in rather than read, so a test can say what time it is. */
  now: number;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  /** The thread being renamed, and the name so far. */
  const [naming, setNaming] = useState<{ id: string; text: string } | null>(null);
  /*
   * The older list is shut until asked for.
   *
   * It is empty for almost everybody and long for the few it is not, and
   * neither of those wants to be the first thing in a panel whose job is the
   * conversation you are having now.
   */
  const [showOlder, setShowOlder] = useState(false);

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

  // Pinned first, then newest — the same order with a query and without, so
  // typing does not make the reader re-find their bearings on every keystroke.
  const order = search(threads, query);
  /*
   * The same rows, under headings.
   *
   * Forty conversations sorted by time is a list you scroll rather than one
   * you scan: every row says "3 days ago" in small grey text and none of them
   * says where the boundary is. `grouped` puts pinned at the top and the rest
   * under Today / Yesterday / Previous 7 days / Older, and leaves out any
   * heading with nothing under it.
   *
   * Not while searching. A filtered list is already the answer to a question,
   * and cutting six results into four headed sections of one or two makes it
   * harder to read, not easier.
   */
  const sections = query.trim() ? [{ label: '', threads: order }] : grouped(order, now);

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
        {/*
          Shown once there is more than one to look through. A search box over a
          list of one is furniture.
        */}
        {threads.length > 1 && (
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            style={{ marginTop: 'var(--sp-3)', height: 34, fontSize: 'var(--type-sm)' }}
          />
        )}
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
        {sections.flatMap((section) => [
          section.label ? (
            <li
              key={`h:${section.label}`}
              // A heading, not a row: it is not tappable and a screen reader
              // should not offer it as one.
              style={{
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.45,
                padding: 'var(--sp-5) var(--sp-5) var(--sp-2)',
              }}
            >
              {section.label}
            </li>
          ) : null,
          ...section.threads.map((t) => {
          const found = foundIn(t, query);
          return (
          <li key={t.id} style={{ display: 'flex', flexDirection: 'column' }}>
            {naming?.id === t.id ? (
              /*
                Renaming happens in the row, not in a dialog.

                The thing being named is right there and stays visible, which
                is the whole reason to rename it — you are looking at the list
                to tell it apart from the others in the list.
              */
              <form
                data-confirm=""
                onSubmit={(e) => {
                  e.preventDefault();
                  onRename(t.id, naming.text);
                  setNaming(null);
                }}
                style={{ flex: 1, minWidth: 0, display: 'flex', gap: 'var(--sp-2)' }}
              >
                <input
                  className="input"
                  autoFocus
                  value={naming.text}
                  onChange={(e) => setNaming({ id: t.id, text: e.target.value })}
                  onKeyDown={(e) => e.key === 'Escape' && setNaming(null)}
                  // Empty is a name removed, not a blank row: it goes back to
                  // being called by its first question.
                  placeholder={t.title}
                  aria-label={`Name for "${t.title}"`}
                  style={{ flex: 1, minWidth: 0, height: 34, fontSize: 'var(--type-sm)' }}
                />
                <button type="submit" className="bare" data-confirm="" style={{ ...SIDE, opacity: 0.8 }}>
                  ✓
                </button>
              </form>
            ) : (
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
              <span style={ONE_LINE}>
                {t.pinned && (
                  <span aria-label="Pinned" title="Pinned" style={{ opacity: 0.55 }}>
                    ▪{' '}
                  </span>
                )}
                {t.turns.length === 0 ? 'New conversation' : nameOf(t)}
              </span>
              <span style={UNDER}>
                {t.turns.length === 0
                  ? 'Nothing asked yet'
                  : `${where(t)}${ago(t.at, now)} · ${count(t.turns.length)}`}
              </span>
              {/*
                Where the query was found, when it was not in the title.
                Five rows all called "New conversation", one of which matched
                on something said in the middle, is a list you open five times.
              */}
              {found && (
                <span style={{ ...UNDER, opacity: 0.55, fontStyle: 'italic' }}>{found}</span>
              )}
            </button>

            )}

            {/*
              The three things you can do to a conversation, under it rather
              than beside it.

              Beside it was the first version and it did not fit: three 40px
              controls in a 232px panel left 84px for the title, so every row
              read "Midter…" and the list stopped being a list you could tell
              things apart in. A row is two lines already; a third of small
              text costs less than the name of the thing.

              Written out rather than behind a menu or a long-press: both of
              those are gestures nobody finds, and there are only three.
            */}
            {naming?.id !== t.id && (
              <div style={ACTIONS}>
                <button
                  type="button"
                  className="bare"
                  data-confirm=""
                  onClick={() => onPin(t.id, !t.pinned)}
                  aria-pressed={Boolean(t.pinned)}
                  aria-label={t.pinned ? `Unpin "${nameOf(t)}"` : `Pin "${nameOf(t)}" so it is kept`}
                  style={{ ...ACT, opacity: t.pinned ? 0.85 : 0.4 }}
                >
                  {t.pinned ? 'PINNED' : 'PIN'}
                </button>
                <button
                  type="button"
                  className="bare"
                  data-confirm=""
                  onClick={() => setNaming({ id: t.id, text: t.name ?? '' })}
                  aria-label={`Rename "${nameOf(t)}"`}
                  style={ACT}
                >
                  RENAME
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
                    aria-label={`Delete "${nameOf(t)}" for good`}
                    style={{ ...ACT, opacity: 0.95 }}
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
                    aria-label={`Delete "${nameOf(t)}"`}
                    style={ACT}
                  >
                    DELETE
                  </button>
                )}
              </div>
            )}
          </li>
          );
        }),
        ])}

        {/*
          The conversations that came out of the list.

          Under it rather than mixed into it, and shut until asked for. These
          are not deleted and never were meant to be — the list holds a hundred
          and the older ones move here — but they are also not what somebody
          opening this panel is looking for.
        */}
        {archived.length > 0 && (
          <li style={{ marginTop: 'var(--sp-4)' }}>
            <button
              type="button"
              className="bare"
              onClick={() => setShowOlder((was) => !was)}
              aria-expanded={showOlder}
              style={{ ...ACT, opacity: 0.55, padding: '0 var(--sp-5)' }}
            >
              {showOlder ? '▾' : '▸'} OLDER ({archived.length})
            </button>
            {showOlder && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {search(archived, query).map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="bare"
                      onClick={() => onRestore(t.id)}
                      // Named for what pressing it does. "Restore" alone, in a
                      // list of six, is six buttons with the same name.
                      aria-label={`Put "${nameOf(t)}" back in the list and open it`}
                      style={{
                        width: 'auto',
                        textAlign: 'left',
                        padding: 'var(--sp-3) var(--sp-5)',
                        opacity: 0.75,
                      }}
                    >
                      <span style={ONE_LINE}>{nameOf(t)}</span>
                      <span style={UNDER}>
                        {`${where(t)}${ago(t.at, now)} · ${count(t.turns.length)}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}

const ONE_LINE = {
  display: 'block',
  fontSize: 'var(--type-sm)',
  lineHeight: 'var(--leading-tight)',
  // One line, cut with an ellipsis. `titleFor` already cuts at a word, and
  // this is the second guard for a narrow panel.
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const UNDER = {
  display: 'block',
  fontSize: 'var(--type-xs)',
  opacity: 0.45,
  marginTop: 'var(--sp-1)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** The row of small controls under a conversation. */
const ACTIONS = {
  display: 'flex',
  gap: 'var(--sp-4)',
  padding: '0 var(--sp-5) var(--sp-3)',
} as const;

const ACT = {
  fontSize: 'var(--type-xs)',
  letterSpacing: '0.08em',
  opacity: 0.4,
  width: 'auto',
} as const;

const SIDE = {
  flex: 'none',
  width: 40,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 'var(--r-md)',
} as const;

/**
 * "from Grades · ", or nothing at all.
 *
 * On the line that already says when and how long, rather than on one of its
 * own: a row is three lines already, and where a conversation started is a
 * qualifier on it, not a fact that stands alone.
 *
 * First on that line rather than last, which is not a preference. Three facts
 * do not fit a 232px panel — "59 min ago · 1 question · from Grades" renders
 * as "from Gr…" — so something is always at risk of the ellipsis, and this
 * decides which. Last in the order is "1 question", a number the title above
 * it already implies. Where the conversation came from is the thing that
 * cannot be guessed from the rest of the row.
 */
function where(t: Thread): string {
  const from = startedOn(t, (screen) => destination(screen as Screen)?.label);
  return from ? `from ${from} · ` : '';
}

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
  /*
   * Escape moves off the window and onto the dialog.
   *
   * A `window` listener closes this from anywhere on the page, including from
   * inside whatever else is open — and it fired while focus was somewhere
   * this dialog does not own. The dialog's own handler is the narrower and
   * more honest claim, and it arrives with the tab ring and the focus return
   * this had neither of.
   */
  const modal = useModal<HTMLDivElement>({ onClose });

  return (
    <div
      ref={modal.ref}
      onKeyDown={modal.onKeyDown}
      tabIndex={-1}
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
