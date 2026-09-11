import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { WIDE, useMedia } from '../lib/media';
import { secondLine } from '../lib/dim';
import { typing } from '../lib/keys';
import { EmptyState, TickBox } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import {
  ArchiveIcon,
  ChevronLeft,
  ClockIcon,
  EditIcon,
  MenuIcon,
  OpenedIcon,
  PaneIcon,
  RefreshIcon,
  Search,
  TrashIcon,
} from '../components/Icons';
import { Rail } from '../components/mail/Rail';
import { List } from '../components/mail/List';
import { Reader } from '../components/mail/Reader';
import { Compose } from '../components/mail/Compose';
import { readMail, tokens, describe as explain, type ProviderId } from '../lib/connect';
import {
  conversations,
  draftAsMail,
  folder as folderById,
  listing,
  pageLabel,
  pages,
  prefill,
  snoozeOptions,
  type Category,
  type FolderId,
  type Mail as Message,
  type MailDraft,
  type Thread,
} from '../lib/mailbox';

/** How many conversations a page holds. Gmail's number, and it is a good one. */
const PER_PAGE = 50;

/** The accounts that have a mailbox this app can read. */
const MAIL_PROVIDERS: ProviderId[] = ['google', 'microsoft'];

/**
 * Email.
 *
 * This screen used to be a form that produced a draft, which was the right
 * half of the problem and the smaller one. The email you owe a professor is
 * almost always an answer to one you were sent, and an answer written in a
 * different tab from the message is an answer that does not get written — so
 * the screen is now the mailbox, in the shape Gmail and Outlook have taught
 * everybody: folders, a list, the message beside it, and compose over the top
 * of all three. The form is still here, inside the compose window, under
 * **Help me write**.
 *
 * ## What it can and cannot do, in one paragraph
 *
 * It reads. The scopes are `gmail.readonly` and `Mail.Read`, and they are not
 * going to change: a study app that can delete a professor's email or send one
 * as you is a bigger promise than this one makes, and the failure mode is
 * unrecoverable. Everything else works anyway — read, unread, star, archive,
 * snooze, label, delete, search with `from:` and `is:unread`, conversations,
 * categories, paging — because those are *your* marks over the provider's copy
 * and the app keeps them (`lib/mailbox.ts`). Sending means the compose window
 * opens in Gmail or Outlook with every field filled in and you press send.
 *
 * ## And it works with nothing connected
 *
 * Drafts and Sent are the app's own and need no account at all. That matters:
 * the commonest reason somebody opens this screen is to write to a professor,
 * and being told to go and connect Google first would be a screen that helps
 * nobody on the day they need it.
 */
export function Mail() {
  const { state, dispatch, now, catalog, account, say } = useStore();
  const wide = useMedia(WIDE);
  const trouble = useTrouble();

  const folder = state.mailFolder;
  const pane = state.mailPane;

  // Everything the app has been handed by a provider this session, across all
  // the folders that have been opened. One pool rather than a list per folder,
  // because a message archived here has to leave one folder and appear in
  // another without being re-fetched.
  const [pool, setPool] = useState<Message[]>([]);
  const [pulled, setPulled] = useState<FolderId[]>([]);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('primary');
  const [label, setLabel] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const held = tokens();
  const accounts = MAIL_PROVIDERS.filter((id) => held[id]);
  const me = useMemo(
    () => ({ name: state.myName || 'You', address: account?.email ?? '' }),
    [state.myName, account?.email],
  );

  /** Ask the connected accounts for a folder, and fold the answer into the pool. */
  const pull = useCallback(
    async (which: FolderId, search = '') => {
      if (accounts.length === 0) return;
      setBusy(true);
      trouble.clear();
      try {
        const answers = await Promise.all(
          accounts.map((id) => readMail(catalog.courses, id, { folder: which, query: search })),
        );
        const fresh = answers.flat();
        setPool((was) => {
          const by = new Map(was.map((m) => [m.id, m]));
          for (const m of fresh) by.set(m.id, m);
          return [...by.values()];
        });
        setPulled((was) => (was.includes(which) ? was : [...was, which]));
      } catch (e) {
        trouble.wrong(explain(e));
      } finally {
        setBusy(false);
      }
    },
    // `accounts` is derived from storage and would be a new array every render;
    // its contents are what matter and they change only on connect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts.join(','), catalog.courses, trouble],
  );

  useEffect(() => {
    if (!pulled.includes(folder)) void pull(folder);
  }, [folder, pulled, pull]);

  /*
   * The app's own drafts, as rows.
   *
   * Folded in here rather than fetched, so Drafts and Sent are ordinary
   * folders with ordinary rows — the same list, the same actions, the same
   * search. A draft is the one kind of mail this app really owns.
   */
  const mails = useMemo(
    () => [...pool, ...state.mailDrafts.map((d) => draftAsMail(d, me))],
    [pool, state.mailDrafts, me],
  );

  const shown = useMemo(() => {
    const q = [query, label ? `"${label}"` : ''].filter(Boolean).join(' ');
    return listing(mails, {
      folder,
      category: folder === 'inbox' && !q ? category : null,
      query: q,
      marks: state.mailMarks,
      now: now.getTime(),
    });
  }, [mails, folder, category, query, label, state.mailMarks, now]);

  const threads = useMemo(() => conversations(shown), [shown]);
  const here = threads.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const open = threads.find((t) => t.id === state.mailOpen) ?? null;

  // A folder, a tab or a search all reset the paging, or page 4 of the inbox
  // becomes page 4 of a search with three results and the list reads empty.
  useEffect(() => {
    setPage(0);
    setPicked([]);
  }, [folder, category, query, label]);

  const ids = (t: Thread) => t.mails.map((m) => m.id);
  const chosen = useMemo(
    () => threads.filter((t) => picked.includes(t.id)).flatMap(ids),
    [threads, picked],
  );

  function markThem(on: string[], patch: { read?: boolean; star?: boolean }) {
    if (on.length === 0) return;
    dispatch({ type: 'markMail', ids: on, mark: patch });
  }

  const openThread = (t: Thread) => {
    // A draft is opened by writing it, not by reading it — which is what both
    // clients do and the only sensible answer for something you wrote.
    if (t.last.draftId) {
      dispatch({ type: 'openMailDraft', id: t.last.draftId });
      return;
    }
    dispatch({ type: 'openMail', id: t.id });
    const unreadIds = t.mails.filter((m) => m.unread).map((m) => m.id);
    if (unreadIds.length) markThem(unreadIds, { read: true });
  };

  const move = (on: string[], to: FolderId, said: string) => {
    if (on.length === 0) return;
    dispatch({ type: 'moveMail', ids: on, to });
    setPicked([]);
    say(said);
  };

  const snooze = (on: string[]) => {
    if (on.length === 0) return;
    const [, tomorrow] = snoozeOptions(now);
    dispatch({ type: 'moveMail', ids: on, snooze: tomorrow.at });
    setPicked([]);
    say('Snoozed until tomorrow morning.');
  };

  const reply = (mail: Message, mode: 'reply' | 'replyAll' | 'forward') => {
    const fill = prefill(mail, mode, me.address);
    dispatch({
      type: 'composeMail',
      draft: {
        to: fill.to,
        cc: fill.cc,
        subject: fill.subject,
        body: fill.body,
        courseId: mail.courseId ?? '',
        purposeId: mode === 'forward' ? 'question' : 'reply',
      },
    });
  };

  const draft = state.mailDrafts.find((d) => d.id === state.mailDraftId) ?? null;

  const patch = useCallback(
    (fields: Partial<Omit<MailDraft, 'id' | 'updated'>>) => {
      if (!state.mailDraftId) return;
      dispatch({ type: 'editMailDraft', id: state.mailDraftId, patch: fields });
    },
    [dispatch, state.mailDraftId],
  );

  /*
   * ── Keys ────────────────────────────────────────────────────────────────
   *
   * Gmail's, minus the ones this app has already spent. `c` is Courses here
   * and `k` is the calendar (`lib/keys.ts`), and rebinding a global shortcut
   * on one screen is worse than not having the shortcut: it means the same
   * key does two things depending on where you are. So the movement keys are
   * the arrows — which is what a keyboard user reaches for anyway, and it
   * moves real focus rather than a highlight of our own, so the row is read
   * out and scrolled to for free.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target)) return;
      const rows = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('.mb-lines') ?? []);
      const at = rows.findIndex((r) => r === document.activeElement);
      const key = e.key.toLowerCase();

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (rows.length === 0) return;
        const next = e.key === 'ArrowDown' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at - 1);
        rows[next]?.focus();
        e.preventDefault();
        return;
      }

      const target = open ?? (at >= 0 ? here[at] : null);
      if (!target) return;

      if (key === 'u') {
        dispatch({ type: 'openMail', id: null });
      } else if (key === 'e') {
        move(ids(target), 'archive', 'Archived here.');
      } else if (key === '#') {
        move(ids(target), 'trash', 'Moved to trash here.');
      } else if (key === 'r') {
        reply(target.last, 'reply');
      } else if (key === 'f') {
        reply(target.last, 'forward');
      } else if (key === 'x') {
        setPicked((was) =>
          was.includes(target.id) ? was.filter((id) => id !== target.id) : [...was, target.id],
        );
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const allPicked = here.length > 0 && picked.length === here.length;
  const acting = chosen.length > 0 ? chosen : open ? ids(open) : [];
  /*
   * On a phone the toolbar is the folders, the search and a refresh, and the
   * actions appear once something is selected — which is what Gmail does on a
   * phone and the only thing that fits: eight icons and a search field across
   * 390px is eight icons you cannot hit and a field you cannot read.
   *
   * A selection rather than `acting`, which also counts the open message: the
   * reader draws the same four actions across its own top, and the two rows
   * one above the other on a 390px screen are the same four buttons twice.
   */
  const showActions = wide || chosen.length > 0;

  return (
    <div className="mb">
      <div className="mb-top">
        {!wide && (
          <button
            type="button"
            className="mb-ico"
            aria-label="Folders"
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
          >
            <MenuIcon size={19} />
          </button>
        )}

        {showActions && (
          <button
            type="button"
            className="mb-ico"
            aria-label={allPicked ? 'Deselect everything on this page' : 'Select everything on this page'}
            aria-pressed={allPicked}
            onClick={() => setPicked(allPicked ? [] : here.map((t) => t.id))}
          >
            <TickBox on={allPicked} size={17} />
          </button>
        )}

        <button
          type="button"
          className="mb-ico"
          aria-label="Check for new mail"
          title="Check for new mail"
          disabled={busy}
          onClick={() => void pull(folder, query)}
        >
          <RefreshIcon size={18} />
        </button>

        {showActions && (
          <>
            <button
              type="button"
              className="mb-ico"
              aria-label="Archive"
              title="Archive"
              disabled={acting.length === 0}
              onClick={() => move(acting, 'archive', 'Archived here.')}
            >
              <ArchiveIcon size={18} />
            </button>
            <button
              type="button"
              className="mb-ico"
              aria-label="Delete"
              title="Delete"
              disabled={acting.length === 0}
              onClick={() => move(acting, 'trash', 'Moved to trash here.')}
            >
              <TrashIcon size={18} />
            </button>
            <button
              type="button"
              className="mb-ico"
              aria-label="Snooze"
              title="Snooze until tomorrow morning"
              disabled={acting.length === 0}
              onClick={() => snooze(acting)}
            >
              <ClockIcon size={18} />
            </button>
            <button
              type="button"
              className="mb-ico"
              aria-label="Mark read"
              title="Mark read"
              disabled={acting.length === 0}
              onClick={() => {
                markThem(acting, { read: true });
                setPicked([]);
              }}
            >
              <OpenedIcon size={18} />
            </button>
          </>
        )}

        <form
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(typed.trim());
            // The pool holds what has been opened; the provider holds the rest
            // of the year. A search asks both, which is the difference between
            // finding the message and finding the ones you happened to load.
            if (typed.trim()) void pull(folder, typed.trim());
          }}
        >
          <Search size={16} style={{ flex: 'none', color: 'var(--app-dim)' }} />
          <input
            className="input"
            aria-label="Search your mail"
            value={typed}
            placeholder="from:stromme is:unread"
            onChange={(e) => setTyped(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          {query && (
            <button
              type="button"
              className="mb-folder-n"
              onClick={() => {
                setTyped('');
                setQuery('');
              }}
              style={{ background: 'transparent', border: 0 }}
            >
              Clear
            </button>
          )}
        </form>

        {wide && (
          <>
            {threads.length > 0 && (
              <>
                <span className="mb-folder-n">{pageLabel(threads.length, page, PER_PAGE)}</span>
                <button
                  type="button"
                  className="mb-ico"
                  aria-label="Newer"
                  disabled={page === 0}
                  onClick={() => setPage((n) => Math.max(0, n - 1))}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  className="mb-ico"
                  aria-label="Older"
                  disabled={page + 1 >= pages(threads.length, PER_PAGE)}
                  onClick={() => setPage((n) => n + 1)}
                >
                  <ChevronLeft size={17} style={{ transform: 'rotate(180deg)' }} />
                </button>
              </>
            )}
            <button
              type="button"
              className="mb-ico"
              aria-label={`Reading pane: ${pane}`}
              title={`Reading pane: ${pane}. Press to change.`}
              onClick={() =>
                dispatch({
                  type: 'setMailPane',
                  pane: pane === 'right' ? 'bottom' : pane === 'bottom' ? 'off' : 'right',
                })
              }
            >
              <PaneIcon size={18} />
            </button>
          </>
        )}
      </div>

      <div className="mb-body">
        {(wide || drawer) && (
          <Rail
            folder={folder}
            mails={mails}
            marks={state.mailMarks}
            now={now.getTime()}
            labels={catalog.courses.map((c) => ({ id: c.id, code: c.code }))}
            label={label}
            onFolder={(id) => {
              dispatch({ type: 'mailFolder', folder: id });
              setLabel('');
              setDrawer(false);
            }}
            onLabel={(code) => {
              setLabel(label === code ? '' : code);
              setDrawer(false);
            }}
            onCompose={() => {
              dispatch({ type: 'composeMail', draft: {} });
              setDrawer(false);
            }}
          />
        )}
        {drawer && !wide && (
          <button
            type="button"
            className="mb-shade"
            aria-label="Close the folders"
            onClick={() => setDrawer(false)}
          />
        )}

        <div className={`mb-main is-${pane}${open ? ' has-open' : ''}`} ref={list}>
          {/* On a phone the message replaces the list; on a wide window it sits
              beside it, unless the reading pane is switched off. */}
          {(wide || !open) && (pane !== 'off' || !open || !wide) && (
            <List
              threads={here}
              folder={folder}
              category={query || label || mails.length === 0 ? null : category}
              onCategory={setCategory}
              open={open?.id ?? null}
              picked={picked}
              now={now}
              onOpen={openThread}
              onPick={(t) =>
                setPicked((was) => (was.includes(t.id) ? was.filter((id) => id !== t.id) : [...was, t.id]))
              }
              onStar={(t) => markThem(ids(t), { star: !t.starred })}
              onRead={(t) => markThem(ids(t), { read: t.unread })}
              onArchive={(t) => move(ids(t), 'archive', 'Archived here.')}
              onTrash={(t) => move(ids(t), 'trash', 'Moved to trash here.')}
              onSnooze={(t) => snooze(ids(t))}
              empty={
                <Nothing
                  folder={folder}
                  busy={busy}
                  searching={Boolean(query || label)}
                  accounts={accounts}
                  onConnect={() => dispatch({ type: 'go', screen: 'connect' })}
                  onCompose={() => dispatch({ type: 'composeMail', draft: {} })}
                />
              }
            />
          )}

          {open && (
            <Reader
              thread={open}
              narrow={!wide}
              onClose={() => dispatch({ type: 'openMail', id: null })}
              onStar={() => markThem(ids(open), { star: !open.starred })}
              onRead={() => {
                markThem(ids(open), { read: open.unread });
                dispatch({ type: 'openMail', id: null });
              }}
              onArchive={() => move(ids(open), 'archive', 'Archived here.')}
              onTrash={() => move(ids(open), 'trash', 'Moved to trash here.')}
              onSnooze={() => snooze(ids(open))}
              onReply={reply}
              onTask={(mail) => {
                dispatch({
                  type: 'addTask',
                  task: {
                    title: mail.subject,
                    // Undated: the email says what, not when, and a task
                    // dated today because that is when it arrived is a task
                    // that goes overdue tomorrow for no reason.
                    date: null,
                    time: '',
                    note: `From ${mail.from.name || mail.from.address}. ${mail.snippet}`,
                    courseId: mail.courseId ?? null,
                  },
                });
                say('Added to your tasks.', 'mine');
              }}
              onChanges={(mail) => {
                dispatch({ type: 'tellChange', text: `${mail.subject}\n\n${mail.body}` });
              }}
            />
          )}
        </div>
      </div>

      <Trouble said={trouble.said} onRetry={trouble.again} busy={busy} />

      {draft && (
        <Compose
          key={draft.id}
          draft={draft}
          onPatch={patch}
          onClose={() => dispatch({ type: 'composeMail', draft: null })}
          onDiscard={() => {
            dispatch({ type: 'dropMailDraft', id: draft.id });
            say('Draft deleted.');
          }}
          onHanded={() => {
            dispatch({ type: 'handedMail', id: draft.id, at: Date.now() });
            say('Opened in your mail app, and kept in Sent.');
          }}
        />
      )}

      {/* The one control a phone needs that a desktop does not: Compose lives
          in the rail, and on a phone the rail is behind a button. */}
      {/* Not while a message is open: the reader has Reply under it, and a
          floating button over that is the wrong one in the way of the right
          one. */}
      {!wide && !draft && !open && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'composeMail', draft: {} })}
          style={{
            position: 'absolute',
            right: 'var(--sp-6)',
            /*
             * Above the assistant's button rather than under it. That one is
             * fixed over the bottom right of every screen in the app, and two
             * round buttons in the same corner is one of them unreachable.
             */
            bottom: 'calc(var(--assistant-strip) + var(--sp-3))',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            height: 48,
            borderRadius: 999,
          }}
        >
          <EditIcon size={18} />
          Compose
        </button>
      )}
    </div>
  );
}

/** What an empty folder says, which depends on why it is empty. */
function Nothing({
  folder,
  busy,
  searching,
  accounts,
  onConnect,
  onCompose,
}: {
  folder: FolderId;
  busy: boolean;
  searching: boolean;
  accounts: ProviderId[];
  onConnect: () => void;
  onCompose: () => void;
}) {
  if (busy) {
    return (
      <div style={{ padding: 'var(--sp-7)', fontSize: 'var(--type-base)', ...secondLine() }}>
        Reading your mail…
      </div>
    );
  }

  if (searching) {
    return (
      <EmptyState
        title="Nothing matched"
        body="Try fewer words, or drop the from: — a search here looks through every folder but spam and the trash."
      />
    );
  }

  const own = folder === 'drafts' || folder === 'sent';
  if (accounts.length === 0 && !own) {
    return (
      <EmptyState
        title="No account connected"
        body="Connect Google or Microsoft and this folder fills with your own mail, read-only. Writing an email works without one — press Compose."

        action={{ label: 'Connect an account', onClick: onConnect }}
      />
    );
  }

  if (folder === 'drafts') {
    return (
      <EmptyState
        title="Nothing half-written"
        body="Emails you start here and close stay in this folder until you send them."
        action={{ label: 'Write one', onClick: onCompose }}
      />
    );
  }

  return (
    <EmptyState
      title={`${folderById(folder).label} is empty`}
      body={folderById(folder).blurb}
    />
  );
}
