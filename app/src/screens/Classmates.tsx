import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { ChevronRight } from '../components/Icons';
import { cloudConfigured } from '../lib/cloud';
import {
  block,
  blocked as listBlocked,
  eligible,
  proves,
  initials,
  join,
  leave,
  listen,
  myProfile,
  myRooms,
  normaliseCode,
  recent,
  report,
  roomsFor,
  saveProfile,
  say,
  termLabel,
  termOf,
  unblock,
  unsay,
  whenSaid,
  whoIsIn,
  type Message,
  type Profile,
} from '../lib/classmates';
import { codeIn } from '../lib/exam';

/**
 * The people in your classes.
 *
 * Three honest statements sit on this screen, and they are here rather than
 * buried because each one is something somebody could otherwise be hurt by
 * assuming.
 *
 * A confirmed address at your school's own domain proves somebody controls a
 * mailbox there. It does not prove they are in ECON 1020 — no student-usable
 * API exposes a class roster, so a room is people who *say* they are in that
 * class. Which domains count comes off the school profile, and a school that
 * lists none gets no domain check with the screen saying so.
 *
 * Blocking is enforced by a database policy, so a blocked person's messages
 * never reach the device at all.
 *
 * Reports are stored and nobody is watching a queue. Saying otherwise would be
 * the worst kind of lie here, because somebody would rely on it.
 */
export function Classmates() {
  const { account, catalog, state, school } = useStore();
  const rowFlush = useRowStyle(0);
  const term = termOf();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [handle, setHandle] = useState('');
  const [rooms, setRooms] = useState<string[]>([]);
  const [open, setOpen] = useState('');
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  // The school decides which addresses count, and a school that lists none
  // admits any confirmed one — see `lib/classmates.ts`. Refusing everybody at
  // every university but one was the old behaviour and the ground rules for
  // school support say never to do it.
  const ok = eligible(account?.email, school);

  const refresh = useCallback(async () => {
    if (!account || !ok) return;
    setError('');
    try {
      const [p, mine] = await Promise.all([myProfile(account.id), myRooms(account.id, term)]);
      setProfile(p);
      setHandle(p?.handle ?? '');
      setRooms(mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [account, ok, term]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!cloudConfigured) {
    return (
      <Note title="No account service on this build">
        Classmates needs the account service, because a message has to live somewhere both people
        can reach. Everything else in the app works without it and stays on this device.
      </Note>
    );
  }

  if (!account) {
    return (
      <Note title="Sign in first">
        Talking to somebody means both of you have an account. Me → Account.
      </Note>
    );
  }

  if (!ok) {
    return (
      <Note title="Needs an address at your school">
        This account is {account.email || 'signed in with another address'}. {proves(school)}{' '}
        Everything else in the app works on any address — sign in with your university one to take
        part here.
      </Note>
    );
  }

  if (!state.schoolId) {
    return (
      <Note title="Set your school first">
        A room belongs to a school as well as a course: without one, four universities’ ECON 1020
        would be the same conversation. Me → Settings → where you study.
      </Note>
    );
  }

  if (loaded && !profile) {
    return (
      <Page>
        <SectionLabel>What classmates should call you</SectionLabel>
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', marginBottom: 'var(--sp-5)' }}>
          This is the only thing about you other people see, alongside the classes you share. Not
          your email, and it does not have to be your full name.
        </div>
        <input
          className="input"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Harrison R"
          style={{ width: '100%' }}
        />
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={busy || handle.trim().length < 2}
          onClick={() => {
            setBusy(true);
            setError('');
            void saveProfile(account.id, handle, '')
              .then(refresh)
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
          style={{ height: 46, marginTop: 'var(--sp-6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {busy ? 'Saving…' : 'That is me'}
        </button>
        {error ? <Problem>{error}</Problem> : null}
      </Page>
    );
  }

  if (open) {
    return (
      <Room
        term={term}
        code={open}
        me={account.id}
        onBack={() => setOpen('')}
        onLeave={() => {
          void leave(account.id, term, open).then(() => {
            setOpen('');
            void refresh();
          });
        }}
      />
    );
  }

  const offered = roomsFor(
    catalog.courses.map((c) => c.code),
    rooms,
    state.schoolId,
  );

  return (
    <Page bottom={26}>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        {/*
          The shell and the type tokens are main's; the sentence is this
          branch's. The old copy named Vanderbilt in a line shown to every
          school, which is the thing this branch exists to stop — `proves`
          says what the room actually guarantees for the school you are in.
        */}
        {termLabel(term)}. A room is everybody who says they are in that class. {proves(school)}
      </div>

      <SectionLabel>Your classes</SectionLabel>
      {offered.length === 0 && (
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.55, padding: '10px 0' }}>
          No courses yet. Add one from a syllabus, or type a code below.
        </div>
      )}
      {offered.map((room) => (
        <div
          key={room.code}
          style={{
            display: 'flex',
            gap: 'var(--sp-5)',
            alignItems: 'center',
            ...rowFlush,
          }}
        >
          <button
            type="button"
            className="bare tappable"
            disabled={!room.joined}
            onClick={() => setOpen(room.code)}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              padding: '13px 0',
              opacity: room.joined ? 1 : 0.6,
            }}
          >
            <span style={{ display: 'block', fontSize: 'var(--type-lg)' }}>{room.code}</span>
            <span style={{ display: 'block', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-1)' }}>
              {room.joined ? 'You are in this room' : 'Not in it yet'}
            </span>
          </button>
          {room.joined ? (
            <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError('');
                void join(account.id, term, room.code)
                  .then(refresh)
                  .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
                  .finally(() => setBusy(false));
              }}
              style={{ flex: 'none', padding: '0 14px', height: 34, fontSize: 'var(--type-sm)' }}
            >
              Join
            </button>
          )}
        </div>
      ))}

      <SectionLabel>Another class</SectionLabel>
      <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
        <input
          className="input"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="ECON 1020"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || !normaliseCode(adding)}
          onClick={() => {
            setBusy(true);
            setError('');
            void join(account.id, term, adding)
              .then(() => {
                setAdding('');
                return refresh();
              })
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
          style={{ flex: 'none', padding: '0 16px', height: 44 }}
        >
          Join
        </button>
      </div>

      {error ? <Problem>{error}</Problem> : null}

      <SectionLabel>What other people see</SectionLabel>
      <Blueprint style={{ padding: '13px 14px' }}>
        <div style={{ fontSize: 'var(--type-md)' }}>{profile?.handle}</div>
        <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>
          That name, and which of your classes they are also in. Not your email, not your other
          courses, not your notes, your grades or anything else in the app.
        </div>
      </Blueprint>

      <Blocked me={account.id} />

      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 18, lineHeight: 'var(--leading-relaxed)' }}>
        Leaving a room removes you from it and nothing you posted. Delete your own messages first if
        you want them gone. Blocking somebody is immediate and is enforced by the database, so their
        messages stop reaching this device — reports are recorded, but nobody is watching a queue,
        and it would be wrong to imply otherwise.
      </div>
    </Page>
  );
}

/** One class, and what has been said in it. */
function Room({
  term,
  code,
  me,
  onBack,
  onLeave,
}: {
  term: string;
  code: string;
  me: string;
  onBack: () => void;
  onLeave: () => void;
}) {
  const { state, dispatch } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  // A paper shared from the Exam screen arrives here as a queued message,
  // read once so coming back later does not re-fill the box.
  const [draft, setDraft] = useState(state.roomDraft);
  useEffect(() => {
    if (state.roomDraft) dispatch({ type: 'clearRoomDraft' });
  }, [state.roomDraft, dispatch]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([recent(term, code), whoIsIn(term, code)])
      .then(([said, here]) => {
        if (!live) return;
        setMessages(said);
        setPeople(here);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));

    const stop = listen(term, code, (m) =>
      setMessages((prior) => (prior.some((x) => x.id === m.id) ? prior : [...prior, m])),
    );
    return () => {
      live = false;
      stop();
    };
  }, [term, code]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const nameOf = (id: string) =>
    id === me ? 'You' : (people.find((p) => p.user_id === id)?.handle ?? 'Someone');

  const send = () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError('');
    // Cleared straight away: getting it back on failure is easier than
    // wondering whether the tap registered.
    setDraft('');
    void say(me, term, code, text)
      .catch((e: unknown) => {
        setDraft(text);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setSending(false));
  };

  return (
    <Page bottom={26}>
      <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={onBack} style={{ padding: '0 14px', height: 36 }}>
          ← Rooms
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-lg)' }}>{code}</div>
        <button
          type="button"
          className="bare"
          onClick={() => setShowPeople((s) => !s)}
          style={{ width: 'auto', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.7, letterSpacing: '0.06em' }}
        >
          {people.length} HERE
        </button>
      </div>

      {showPeople && (
        <Blueprint style={{ padding: '11px 13px', marginTop: 'var(--sp-5)' }}>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            Everybody who says they are in {code} this term. Confirmed Vanderbilt addresses, not a
            roster — no app can read the registrar.
          </div>
          {people.map((p) => (
            <div key={p.user_id} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '5px 0' }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  flex: 'none',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 'calc(10.5px * var(--text-scale, 1))',
                  background: 'var(--app-raise)',
                }}
              >
                {initials(p.handle)}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>
                {p.handle}
                {p.user_id === me ? ' (you)' : ''}
              </span>
              {p.user_id !== me && (
                <button
                  type="button"
                  className="bare"
                  onClick={() => void block(me, p.user_id).then(() => setMessages((m) => m.filter((x) => x.user_id !== p.user_id)))}
                  style={{ width: 'auto', fontSize: 'var(--type-xs)', opacity: 0.5 }}
                >
                  BLOCK
                </button>
              )}
            </div>
          ))}
        </Blueprint>
      )}

      <div style={{ marginTop: 14 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.55, padding: '18px 0', lineHeight: 'var(--leading-relaxed)' }}>
            Nothing said yet. Somebody has to be first — a question about the reading is usually the
            easiest one.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.user_id === me;
          return (
            <div
              key={m.id}
              style={{
                padding: '9px 0',
                borderBottom: '1px solid var(--app-line-soft)',
              }}
            >
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: mine ? 0.9 : 0.7 }}>{nameOf(m.user_id)}</span>
                <span style={{ fontSize: 'calc(10.5px * var(--text-scale, 1))', opacity: 0.4, flex: 1 }}>{whenSaid(m.created_at)}</span>
                {mine ? (
                  <button
                    type="button"
                    className="bare"
                    onClick={() =>
                      void unsay(m.id).then(() => setMessages((all) => all.filter((x) => x.id !== m.id)))
                    }
                    style={{ width: 'auto', fontSize: 'calc(10.5px * var(--text-scale, 1))', opacity: 0.45 }}
                  >
                    DELETE
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bare"
                    onClick={() => {
                      const why = window.prompt(
                        'What is wrong with this message? It is recorded for whoever runs this instance — blocking is the thing that takes effect immediately.',
                      );
                      if (why?.trim()) void report(me, m, why);
                    }}
                    style={{ width: 'auto', fontSize: 'calc(10.5px * var(--text-scale, 1))', opacity: 0.45 }}
                  >
                    REPORT
                  </button>
                )}
              </div>
              <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-relaxed)', marginTop: 3, whiteSpace: 'pre-wrap' }}>
                {m.body}
              </div>
              {/*
                A message carrying a paper code gets a way to sit it. The code
                reproduces the questions exactly, so two people in a room can
                answer the same paper without either one's answers leaving
                their device.
              */}
              {codeIn(m.body) ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    dispatch({
                      type: 'sitPaper',
                      minutes: 15,
                      formatId: 'choice',
                      code: codeIn(m.body) ?? undefined,
                    });
                  }}
                  style={{ height: 36, marginTop: 'var(--sp-4)', fontSize: 'calc(12.5px * var(--text-scale, 1))', width: 'auto', padding: '0 14px' }}
                >
                  Sit paper {codeIn(m.body)}
                </button>
              ) : null}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {error ? <Problem>{error}</Problem> : null}

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
        <textarea
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Say something to ${code}`}
          style={{ flex: 1, minWidth: 0, minHeight: 46, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={sending || !draft.trim()}
          onClick={send}
          style={{ flex: 'none', padding: '0 16px', height: 46 }}
        >
          Send
        </button>
      </div>
      <div style={{ fontSize: 'var(--type-xs)', opacity: 0.45, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        Everybody in {code} can read this, and it is not private to a group of friends. Messages
        cannot be edited — delete and say it again.
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={onLeave}
        style={{ height: 42, marginTop: 'var(--sp-7)' }}
      >
        Leave this room
      </button>
    </Page>
  );
}

function Blocked({ me }: { me: string }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    void listBlocked(me).then(setIds).catch(() => setIds([]));
  }, [me]);
  if (ids.length === 0) return null;
  return (
    <>
      <SectionLabel>Blocked</SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        {ids.length} {ids.length === 1 ? 'person' : 'people'}. Their messages never reach this
        device. They are not told, and they cannot see that you blocked them.
      </div>
      {ids.map((id) => (
        <div key={id} style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'center', padding: '8px 0' }}>
          <span style={{ flex: 1, fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6 }}>Blocked account</span>
          <button
            type="button"
            className="bare"
            onClick={() => void unblock(me, id).then(() => setIds((x) => x.filter((y) => y !== id)))}
            style={{ width: 'auto', fontSize: 'var(--type-xs)', opacity: 0.6 }}
          >
            UNBLOCK
          </button>
        </div>
      ))}
    </>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Page>
      <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
        <div className="kicker">{title}</div>
        <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', opacity: 0.8 }}>{children}</div>
      </Blueprint>
    </Page>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', marginTop: 'var(--sp-6)', color: 'var(--app-warn)', lineHeight: 'var(--leading-normal)' }}>
      {children}
    </div>
  );
}
