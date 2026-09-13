import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Search, StarIcon } from '../Icons';
import { EmptyState } from '../ui';
import { secondLine } from '../../lib/dim';
import {
  block,
  here,
  initials,
  listen,
  listenReactions,
  react,
  reactionsIn,
  recent,
  report,
  say as post,
  unreact,
  unsay,
  whoIsIn,
  type Message,
  type Profile,
  type Reaction,
} from '../../lib/classmates';
import {
  clockAt,
  conversation,
  findSaid,
  shared,
  tally,
  unread,
  type Say,
} from '../../lib/roomchat';
import { Says } from './Says';
import { Write } from './Write';

/** Which of the three faces of a room is showing. */
type Tab = 'chat' | 'files' | 'people';

/**
 * One class conversation, and everything that hangs off it.
 *
 * The three tabs are the same three every group chat has, and each of them is
 * an answer to a question the transcript cannot answer by scrolling: what was
 * posted (Files), who is in here (People), and where did somebody say that
 * (Find in chat). None of them is a separate screen — leaving the conversation
 * to answer a question about the conversation is the thing that makes a chat
 * feel like a filing cabinet.
 *
 * ## What this loads, and what it listens to
 *
 * The last sixty messages, the people, and the reactions on them, in three
 * queries at open. Then three live channels: new messages, reactions coming
 * and going, and who else has the room open. Every one of them is behind the
 * same row-level policies as the reads — a blocked person's words never reach
 * the device, which is why blocking is in the database and not in here.
 *
 * ## The key and the name are two different strings
 *
 * Everything that leaves the device uses `roomKey` — the school and the course
 * code together, which is what a room is stored under and what the policies
 * match on. Everything on the screen uses `code`, which is the course on its
 * own. They were one argument until this screen was drawn with real rows in
 * front of it: the header said ECON 1020 and the transcript said "nothing said
 * yet", because the messages are filed under `vanderbilt/ECON 1020` and
 * nothing had asked for those. Without the school in the key four
 * universities' ECON 1020 would be one room, which is why the key exists —
 * see `roomKey` in `lib/classmates.ts`.
 *
 * ## The read mark
 *
 * Frozen at open, on purpose. The NEW rule is drawn from where you were when
 * you arrived, not from where you are now, or it would never be above
 * anything. The mark itself moves forward as messages arrive while you are
 * looking, so the list outside stops counting them.
 */
export function Talk({
  term,
  roomKey,
  code,
  me,
  myHandle,
  pinned,
  muted,
  mark,
  draft,
  wide,
  onBack,
  onLeave,
  onPin,
  onMute,
  onCopyLink,
  onMessages,
  onRead,
  onPaper,
  paperOf,
}: {
  term: string;
  /** How the room is stored: school and code. What everything is keyed by. */
  roomKey: string;
  /** What it is called on screen. */
  code: string;
  me: string;
  myHandle: string;
  pinned: boolean;
  muted: boolean;
  /** Where you had read to when this opened. */
  mark: string;
  /** A message queued from somewhere else in the app — a shared paper. */
  draft: string;
  /** Whether the list of rooms is beside this, which decides the way back. */
  wide: boolean;
  onBack: () => void;
  onLeave: () => void;
  onPin: (pinned: boolean) => void;
  onMute: (muted: boolean) => void;
  onCopyLink: () => void;
  /** Hands the room's messages up, so the list outside shows the same last line. */
  onMessages: (key: string, said: Message[]) => void;
  onRead: (key: string, iso: string) => void;
  onPaper: (code: string) => void;
  paperOf: (body: string) => string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [present, setPresent] = useState<string[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [tab, setTab] = useState<Tab>('chat');
  const [menu, setMenu] = useState(false);
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [hitId, setHitId] = useState('');
  const [text, setText] = useState(draft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const foot = useRef<HTMLDivElement>(null);
  /*
   * Where you were when you walked in.
   *
   * A ref, read once, and never written again — which is the whole of what
   * "frozen at open" means. `mark` moves forward as you read, because the list
   * outside has to stop counting what is on your screen; an effect that copied
   * it into here on every change would drag the NEW rule down the transcript
   * behind you until it was above nothing.
   *
   * Nothing resets it, because nothing has to: the screen mounts this with the
   * room's key, so opening a different room is a different component with a
   * different mark rather than this one being told to forget.
   */
  const opened = useRef(mark);

  useEffect(() => {
    let live = true;
    setMessages([]);
    setReactions([]);
    setPresent([]);

    void Promise.all([recent(term, roomKey), whoIsIn(term, roomKey), reactionsIn(term, roomKey)])
      .then(([said, who, faces]) => {
        if (!live) return;
        setMessages(said);
        setPeople(who);
        setReactions(faces);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));

    const stopSaid = listen(term, roomKey, (m) =>
      setMessages((prior) => (prior.some((x) => x.id === m.id) ? prior : [...prior, m])),
    );
    const stopFaces = listenReactions(
      term,
      roomKey,
      (r) =>
        setReactions((prior) =>
          prior.some(
            (x) => x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji,
          )
            ? prior
            : [...prior, r],
        ),
      (gone) =>
        setReactions((prior) =>
          prior.filter(
            (x) =>
              !(
                x.message_id === gone.message_id &&
                x.user_id === gone.user_id &&
                x.emoji === gone.emoji
              ),
          ),
        ),
    );
    const stopHere = here(term, roomKey, me, setPresent);

    return () => {
      live = false;
      stopSaid();
      stopFaces();
      stopHere();
    };
  }, [term, roomKey, me]);

  // The list outside shows the same last line as the room inside, without a
  // second query for it.
  useEffect(() => {
    onMessages(roomKey, messages);
  }, [messages, roomKey, onMessages]);

  // Read up to the newest thing on screen. Only on the conversation: reading
  // the Files tab is not reading the room.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (tab === 'chat' && last) onRead(roomKey, last.created_at);
  }, [messages, tab, roomKey, onRead]);

  useEffect(() => {
    if (tab === 'chat') foot.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, tab]);

  const nameOf = useCallback(
    (id: string) =>
      id === me ? myHandle || 'You' : (people.find((p) => p.user_id === id)?.handle ?? 'Someone'),
    [me, myHandle, people],
  );

  const handles = useMemo(() => people.map((p) => p.handle).filter(Boolean), [people]);
  const days = useMemo(() => conversation(messages as Say[], new Date()), [messages]);
  const tallies = useMemo(() => tally(reactions, me, nameOf), [reactions, me, nameOf]);
  const seen = unread(messages as Say[], opened.current, me, myHandle, handles);
  const hits = useMemo(() => findSaid(messages as Say[], query), [messages, query]);
  const files = useMemo(
    () => shared(messages as Say[], nameOf, paperOf),
    [messages, nameOf, paperOf],
  );

  const send = () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    // Cleared straight away: getting it back on failure is easier than
    // wondering whether the tap registered.
    setText('');
    void post(me, term, roomKey, body)
      .catch((e: unknown) => {
        setText(body);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setSending(false));
  };

  const onReact = (messageId: string, emoji: string, ours: boolean) => {
    setError('');
    const done = ours ? unreact(me, messageId, emoji) : react(me, term, roomKey, messageId, emoji);
    void done.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const jump = (id: string) => {
    setHitId(id);
    setFinding(false);
    setTab('chat');
    // After the tab has drawn, or the element is not in the document yet.
    window.setTimeout(() => {
      document.getElementById(`say-${id}`)?.scrollIntoView({ block: 'center' });
    }, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ── The header ─────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          paddingTop: 'var(--sp-4)',
          paddingBottom: 'var(--sp-4)',
          borderBottom: '1px solid var(--app-line-soft)',
        }}
      >
        {!wide && (
          <button
            type="button"
            className="bare tap"
            aria-label="Back to your class chats"
            onClick={onBack}
            style={{ flex: 'none', width: 24 }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <span
          aria-hidden="true"
          style={{
            flex: 'none',
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--r-lg)',
            background: 'var(--app-accent-wash)',
            border: '1px solid var(--app-accent-deep)',
            color: 'var(--app-accent)',
            fontSize: 'var(--type-xs)',
          }}
        >
          {initials(code.split(' ')[0] ?? code)}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 'var(--type-lg)' }}>{code}</span>
          <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine() }}>
            {people.length} {people.length === 1 ? 'person' : 'people'}
            {present.length > 0 ? ` · ${present.length} here now` : ''}
            {muted ? ' · muted' : ''}
          </span>
        </span>
        <button
          type="button"
          className="bare tap"
          aria-label={finding ? 'Close find in chat' : 'Find in chat'}
          aria-expanded={finding}
          onClick={() => setFinding((s) => !s)}
          style={{ flex: 'none', width: 28 }}
        >
          <Search size={15} />
        </button>
        <button
          type="button"
          className="bare tap"
          aria-label={`More for ${code}`}
          aria-expanded={menu}
          onClick={() => setMenu((s) => !s)}
          style={{ flex: 'none', width: 24, fontSize: 'var(--type-md)' }}
        >
          ⋯
        </button>
      </div>

      {menu && (
        <div
          style={{
            flex: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-5)',
            paddingTop: 'var(--sp-4)',
            paddingBottom: 'var(--sp-4)',
            borderBottom: '1px solid var(--app-line-soft)',
          }}
        >
          <Quiet
            onClick={() => {
              onPin(!pinned);
              setMenu(false);
            }}
          >
            <StarIcon on={pinned} size={12} /> {pinned ? 'UNPIN' : 'PIN'}
          </Quiet>
          <Quiet
            onClick={() => {
              onMute(!muted);
              setMenu(false);
            }}
          >
            {muted ? 'UNMUTE' : 'MUTE'}
          </Quiet>
          <Quiet
            onClick={() => {
              onCopyLink();
              setMenu(false);
            }}
          >
            COPY LINK
          </Quiet>
          <Quiet
            onClick={() => {
              setMenu(false);
              onLeave();
            }}
          >
            LEAVE
          </Quiet>
        </div>
      )}

      {finding && (
        <div style={{ flex: 'none', paddingTop: 'var(--sp-4)', paddingBottom: 'var(--sp-4)' }}>
          <input
            aria-label={`Find in ${code}`}
            className="input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in chat"
            style={{ width: '100%' }}
          />
          {query.trim() && (
            <div style={{ paddingTop: 'var(--sp-4)' }}>
              {hits.length === 0 && (
                <div style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                  Nothing in the last {messages.length} messages.
                </div>
              )}
              {hits.slice(0, 8).map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="bare tappable"
                  onClick={() => jump(hit.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    paddingTop: 'var(--sp-3)',
                    paddingBottom: 'var(--sp-3)',
                    borderBottom: '1px solid var(--app-line-soft)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine() }}>
                    {nameOf(hit.user_id)} · {clockAt(hit.created_at)}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-sm)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {hit.body}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── The three faces of the room ────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="This class chat"
        style={{
          flex: 'none',
          display: 'flex',
          gap: 'var(--sp-6)',
          borderBottom: '1px solid var(--app-line-soft)',
        }}
      >
        {(
          [
            ['chat', 'Chat'],
            ['files', `Files${files.length ? ` (${files.length})` : ''}`],
            ['people', `People${people.length ? ` (${people.length})` : ''}`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="bare tap-y"
            onClick={() => setTab(id)}
            style={{
              width: 'auto',
              paddingTop: 'var(--sp-4)',
              paddingBottom: 'var(--sp-4)',
              fontSize: 'var(--type-sm)',
              borderBottom: `2px solid ${tab === id ? 'var(--app-accent)' : 'transparent'}`,
              ...(tab === id ? { color: 'var(--app-fg)' } : secondLine()),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── The body ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {tab === 'chat' && (
          <>
            {messages.length === 0 && (
              <EmptyState
                inline
                title="Nothing said yet"
                body="Somebody has to be first — a question about the reading is usually the easiest one."
              />
            )}
            {days.map((day) => (
              <div key={day.label}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    paddingTop: 'var(--sp-6)',
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: 'var(--app-line-soft)' }} />
                  <span style={{ flex: 'none', fontSize: 'var(--type-xs)', ...secondLine() }}>
                    {day.label}
                  </span>
                  <span style={{ flex: 1, height: 1, background: 'var(--app-line-soft)' }} />
                </div>
                {day.runs.map((run) => (
                  <Says
                    key={run.says[0].id}
                    run={run}
                    name={nameOf(run.user_id)}
                    mine={run.user_id === me}
                    present={present.includes(run.user_id) && run.user_id !== me}
                    handles={handles}
                    myHandle={myHandle}
                    tallies={tallies}
                    onReact={onReact}
                    onDelete={(id) =>
                      void unsay(id)
                        .then(() => setMessages((all) => all.filter((x) => x.id !== id)))
                        .catch((e: unknown) =>
                          setError(e instanceof Error ? e.message : String(e)),
                        )
                    }
                    onReport={(id) => {
                      const m = messages.find((x) => x.id === id);
                      if (!m) return;
                      const why = window.prompt(
                        'What is wrong with this message? It is recorded for whoever runs this instance — blocking is the thing that takes effect immediately.',
                      );
                      if (why?.trim()) void report(me, m, why);
                    }}
                    onPaper={onPaper}
                    paperOf={paperOf}
                    markId={seen.firstId}
                    hitId={hitId}
                  />
                ))}
              </div>
            ))}
            <div ref={foot} />
          </>
        )}

        {tab === 'files' && (
          <div>
            {files.length === 0 && (
              <EmptyState
                inline
                title="Nothing shared yet"
                body="Links and practice papers posted in this room collect here. There is nowhere to upload a file to — nothing in this app leaves your device unless you send it."
              />
            )}
            {files.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-5)',
                  paddingTop: 'var(--sp-5)',
                  paddingBottom: 'var(--sp-5)',
                  borderBottom: '1px solid var(--app-line-soft)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--type-md)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </span>
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine() }}>
                    {item.by} · {clockAt(item.at)}
                  </span>
                </span>
                {item.kind === 'paper' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onPaper(item.code ?? '')}
                    style={{
                      flex: 'none',
                      height: 32,
                      width: 'auto',
                      paddingLeft: 'var(--sp-6)',
                      paddingRight: 'var(--sp-6)',
                      fontSize: 'var(--type-sm)',
                    }}
                  >
                    Sit
                  </button>
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn btn-secondary"
                    style={{
                      flex: 'none',
                      height: 32,
                      width: 'auto',
                      display: 'grid',
                      placeItems: 'center',
                      paddingLeft: 'var(--sp-6)',
                      paddingRight: 'var(--sp-6)',
                      fontSize: 'var(--type-sm)',
                    }}
                  >
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'people' && (
          <div>
            <div
              style={{
                fontSize: 'var(--type-sm)',
                lineHeight: 'var(--leading-relaxed)',
                paddingTop: 'var(--sp-5)',
                ...secondLine(),
              }}
            >
              Everybody who says they are in {code} this term. A confirmed address proves somebody
              controls a mailbox at your school — it is not a roster, because nothing here can read
              a registrar. Blocking is immediate and is enforced by the database, so their messages
              stop reaching this device.
            </div>
            {people.map((person) => (
              <div
                key={person.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-5)',
                  paddingTop: 'var(--sp-5)',
                  paddingBottom: 'var(--sp-5)',
                  borderBottom: '1px solid var(--app-line-soft)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: 'none',
                    width: 28,
                    height: 28,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 'var(--r-lg)',
                    background: 'var(--app-raise)',
                    fontSize: 'var(--type-xs)',
                  }}
                >
                  {initials(person.handle)}
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}>
                  {person.handle}
                  {person.user_id === me ? ' (you)' : ''}
                  {present.includes(person.user_id) && person.user_id !== me ? (
                    <span style={{ fontSize: 'var(--type-xs)', ...secondLine() }}> · here now</span>
                  ) : null}
                </span>
                {person.user_id !== me && (
                  <button
                    type="button"
                    className="bare tap-y"
                    onClick={() =>
                      void block(me, person.user_id).then(() =>
                        setMessages((all) => all.filter((x) => x.user_id !== person.user_id)),
                      )
                    }
                    style={{
                      flex: 'none',
                      width: 'auto',
                      fontSize: 'var(--type-xs)',
                      letterSpacing: '0.06em',
                      ...secondLine(),
                    }}
                  >
                    BLOCK
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── The dock ───────────────────────────────────────────────────── */}
      {error ? (
        <div
          role="alert"
          style={{
            flex: 'none',
            fontSize: 'var(--type-sm)',
            lineHeight: 'var(--leading-normal)',
            color: 'var(--app-warn)',
            paddingTop: 'var(--sp-4)',
          }}
        >
          {error}
        </div>
      ) : null}

      {tab === 'chat' && (
        <div style={{ flex: 'none', paddingTop: 'var(--sp-5)' }}>
          <Write
            value={text}
            onChange={setText}
            onSend={send}
            people={people}
            code={code}
            sending={sending}
          />
          <div
            style={{
              fontSize: 'var(--type-xs)',
              lineHeight: 'var(--leading-normal)',
              paddingTop: 'var(--sp-3)',
              ...secondLine(),
            }}
          >
            Everybody in {code} can read this. Messages cannot be edited — delete and say it again.
          </div>
        </div>
      )}
    </div>
  );
}

/** One item of the room's menu. Caps, quiet, and a finger's height. */
function Quiet({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="bare tap-y"
      onClick={onClick}
      style={{
        width: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        fontSize: 'var(--type-xs)',
        letterSpacing: '0.08em',
        ...secondLine(),
      }}
    >
      {children}
    </button>
  );
}
