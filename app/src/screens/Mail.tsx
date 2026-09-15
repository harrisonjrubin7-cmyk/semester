import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNow, useStore } from '../state/store';
import { WIDE, useMedia } from '../lib/media';
import { secondLine } from '../lib/dim';
import { typing } from '../lib/keys';
import { EmptyState, TickBox } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { MenuLabel, MenuRow, MenuRule, Popover, type Corner } from '../components/Popover';
import { useTrouble } from '../lib/trouble';
import {
  ArchiveIcon,
  ChevronLeft,
  ClockIcon,
  EditIcon,
  FolderIcon,
  MenuIcon,
  OpenedIcon,
  PaneIcon,
  RefreshIcon,
  Search,
  TrashIcon,
} from '../components/Icons';
import { ruleFrom, ruleMarks, under, type Rule } from '../lib/mailrules';
import { Rules } from '../components/mail/Rules';
import { Rail } from '../components/mail/Rail';
import { List } from '../components/mail/List';
import { Reader } from '../components/mail/Reader';
import { Compose } from '../components/mail/Compose';
import { readMail, readableMail, tokens, describe as explain, type ProviderId } from '../lib/connect';
import {
  conversations,
  draftAsMail,
  FOLDERS,
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
  const { state, dispatch, catalog, account, say } = useStore();
  const now = useNow();
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
  /*
   * Which of the two menus is open, and where.
   *
   * Snooze and Move were a button each that did one thing — snooze meant
   * "tomorrow morning" and move meant "archive" — while `snoozeOptions` in
   * `lib/mailbox.ts` had four answers nothing called and the eight folders
   * had no way back to the inbox at all. A message wrongly in spam could be
   * read here and not rescued.
   */
  const [menu, setMenu] = useState<{ which: 'snooze' | 'move'; corner: Corner } | null>(null);
  /*
   * The rules panel, and the search it was opened on.
   *
   * `null` is closed; a `Rule` is "make a rule from this search", which is the
   * entry point both clients put beside the box and the one that matters — a
   * rule you write from scratch needs the query typing again, and the query
   * you want is the one already on screen finding the right things.
   */
  const [rules, setRules] = useState<Rule | null | false>(false);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  const held = tokens();
  const accounts = readableMail(held);
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

  /*
   * Your marks, with the rules' underneath them.
   *
   * The one place the two layers meet, so every list, count and reading pane
   * on this screen sees the same mailbox. Rules go under, never over: a rule
   * decides what happens to a message you have had no opinion about, and the
   * moment you have one it is yours. `lib/mailrules.ts` has the argument, and
   * the short version is that a rule re-run on every render would otherwise
   * undo an unstar before the frame was drawn.
   *
   * Writes are unaffected — every dispatch on this screen still writes to
   * `mailMarks`, which is exactly what makes yours win.
   */
  const marks = useMemo(
    () => under(ruleMarks(mails, state.mailRules), state.mailMarks),
    [mails, state.mailRules, state.mailMarks],
  );

  const shown = useMemo(() => {
    const q = [query, label ? `"${label}"` : ''].filter(Boolean).join(' ');
    return listing(mails, {
      folder,
      category: folder === 'inbox' && !q ? category : null,
      query: q,
      marks,
      now: now.getTime(),
    });
  }, [mails, folder, category, query, label, marks, now]);

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
      /*
       * `/` puts the caret in the search box, which is the one shortcut that
       * has to work *while* something else has focus and the one every client
       * and every website binds. It is still refused inside a field, or it
       * would swallow the slash of a URL somebody is typing into a reply.
       */
      if (!typing(e.target) && e.key === '/') {
        search.current?.focus();
        search.current?.select();
        e.preventDefault();
        return;
      }
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
      } else if (key === '!') {
        // Gmail's, and the one that was missing on a screen whose whole
        // reason for existing is a student's inbox of announcements.
        move(ids(target), 'spam', 'Marked as spam here.');
      } else if (key === 's') {
        markThem(ids(target), { star: !target.starred });
      } else if (key === 'r') {
        reply(target.last, 'reply');
      } else if (key === 'a') {
        reply(target.last, 'replyAll');
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

  /*
   * Opened at the button's own bottom-left corner, read at the moment of the
   * click — the toolbar scrolls sideways on a phone, and a corner captured
   * any later is a corner that has moved. `Popover` clamps it to the window.
   */
  const openMenu = (which: 'snooze' | 'move', from: HTMLElement) => {
    const box = from.getBoundingClientRect();
    setMenu((was) => (was?.which === which ? null : { which, corner: { x: box.left, y: box.bottom + 4 } }));
  };

  /** Where a message can be put, given where it is now. */
  const destinations = FOLDERS.filter((f) => !f.view && f.id !== 'drafts' && f.id !== 'sent' && f.id !== folder);

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

        {/*
          Off when there is no mailbox to check.

          `pull` opens with `if (accounts.length === 0) return`, which is right
          — there is nothing to ask — and left this button enabled, pressable,
          and completely silent. The folder underneath already says "No account
          connected" and offers Connect; the one control up here that looks
          like it would go and get something did nothing and said nothing about
          why. The same `disabled` the four actions beside it already use, and
          the title carries the reason so the answer is on the control rather
          than only in the empty state below it.
        */}
        <button
          type="button"
          className="mb-ico"
          aria-label="Check for new mail"
          title={
            accounts.length === 0
              ? 'Connect an account before checking for new mail'
              : 'Check for new mail'
          }
          disabled={busy || accounts.length === 0}
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
              aria-label="Move to"
              title="Move to a folder"
              aria-expanded={menu?.which === 'move'}
              disabled={acting.length === 0}
              onClick={(e) => openMenu('move', e.currentTarget)}
            >
              <FolderIcon size={18} />
            </button>
            <button
              type="button"
              className="mb-ico"
              aria-label="Snooze"
              title="Snooze until…"
              aria-expanded={menu?.which === 'snooze'}
              disabled={acting.length === 0}
              onClick={(e) => openMenu('snooze', e.currentTarget)}
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
            ref={search}
            className="input"
            aria-label="Search your mail"
            value={typed}
            placeholder="from:stromme course:econ -is:read"
            title="from: to: subject: label: course: has:attachment is:unread before: after: — and a minus in front of any of them to leave it out. Press / to come here."
            onChange={(e) => setTyped(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          {query && (
            <>
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
              {/* Gmail's "Create filter", in the one place it is worth being:
                  beside a search that is already finding the right things. */}
              <button
                type="button"
                className="mb-folder-n"
                onClick={() => setRules(ruleFrom(query, `rule-${Date.now()}`, now.getTime()))}
                style={{ background: 'transparent', border: 0 }}
              >
                Make a rule
              </button>
            </>
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

      {menu?.which === 'snooze' && (
        <Popover label="Snooze until" corner={menu.corner} onClose={() => setMenu(null)}>
          <MenuLabel>Snooze until</MenuLabel>
          {snoozeOptions(now).map((option) => (
            <MenuRow
              key={option.label}
              onPress={() => {
                dispatch({ type: 'moveMail', ids: acting, snooze: option.at });
                setPicked([]);
                setMenu(null);
                say(`Snoozed until ${option.label.toLowerCase()}.`);
              }}
            >
              {option.label}
            </MenuRow>
          ))}
          {folder === 'snoozed' && (
            <>
              <MenuRule />
              <MenuRow
                onPress={() => {
                  // A snooze of zero is a waking, which `mergeMark` drops
                  // rather than storing an hour in the past for the term.
                  dispatch({ type: 'moveMail', ids: acting, snooze: 0 });
                  setPicked([]);
                  setMenu(null);
                  say('Back in the inbox.');
                }}
              >
                Bring it back now
              </MenuRow>
            </>
          )}
        </Popover>
      )}

      {menu?.which === 'move' && (
        <Popover label="Move to" corner={menu.corner} onClose={() => setMenu(null)}>
          <MenuLabel>Move to</MenuLabel>
          {destinations.map((f) => (
            <MenuRow
              key={f.id}
              onPress={() => {
                move(acting, f.id, `Moved to ${f.label.toLowerCase()} here.`);
                setMenu(null);
              }}
            >
              {/* "Not spam" rather than "Inbox" when that is what pressing it
                  means. A message wrongly in spam could be read on this screen
                  and not rescued from it, which is the one filing mistake a
                  mailbox has to be able to undo. */}
              {folder === 'spam' && f.id === 'inbox' ? 'Not spam' : f.label}
            </MenuRow>
          ))}
          {catalog.courses.length > 0 && (
            <>
              <MenuRule />
              <MenuLabel>Label it</MenuLabel>
              {catalog.courses.map((c) => (
                <MenuRow
                  key={c.id}
                  onPress={() => {
                    dispatch({ type: 'labelMail', ids: acting, label: c.code });
                    setPicked([]);
                    setMenu(null);
                    say(`Labelled ${c.code}.`);
                  }}
                >
                  {c.code}
                </MenuRow>
              ))}
            </>
          )}
        </Popover>
      )}

      <div className="mb-body">
        {(wide || drawer) && (
          <Rail
            folder={folder}
            mails={mails}
            marks={marks}
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
            rules={state.mailRules}
            rulesOpen={rules !== false}
            onRules={() => {
              setRules((was) => (was === false ? null : false));
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
          {/*
            Rules take the main pane rather than floating over it.
            Writing one is a sit-down job with five fields and a live count
            against your whole mailbox, and a popover that size is a dialog
            pretending not to be one — with the focus trap and the escape
            handling it would then owe. The list is one press away and the
            rail stays where it is.
          */}
          {rules !== false ? (
            <Rules
              rules={state.mailRules}
              mails={mails}
              seed={rules}
              onPut={(rule) => dispatch({ type: 'putMailRule', rule })}
              onDrop={(id) => dispatch({ type: 'dropMailRule', id })}
              onClose={() => setRules(false)}
            />
          ) : (
          <>
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
              onMenu={openMenu}
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
          </>
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
             * On the bottom edge, because the corner is empty here.
             *
             * This used to lift by `--assistant-strip` to clear the
             * assistant's own round button, which is fixed over the bottom
             * right of nearly every screen — two round buttons in one corner
             * is one of them unreachable. It is not drawn on this one:
             * `ai/Assistant.tsx` skips the button on every screen `fills()`
             * names, because those end at the bottom edge with a control you
             * use there, and the mailbox joined that list when it was built.
             * So the lift was reserving a corner for something that never
             * arrives, and left the button floating 82px up a blank screen.
             */
            bottom: 'var(--sp-6)',
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
