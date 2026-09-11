import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, SectionLabel } from '../components/ui';
import { Folding } from '../components/Fold';
import { WIDE, useMedia } from '../lib/media';
import { secondLine } from '../lib/dim';
import { cloudConfigured } from '../lib/cloud';
import { codeIn } from '../lib/exam';
import {
  across,
  blocked as listBlocked,
  eligible,
  join,
  leave,
  myProfile,
  myRooms,
  proves,
  roomKey,
  roomsFor,
  saveProfile,
  termLabel,
  termOf,
  unblock,
  type Message,
  type Profile,
} from '../lib/classmates';
import { bucket, listed, type Say } from '../lib/roomchat';
import { markRead, marks as storedMarks, remember, type Marks } from '../lib/roomprefs';
import { Rooms } from '../components/room/Rooms';
import { Talk } from '../components/room/Talk';

/**
 * The people in your classes, as a chat rather than as a settings page.
 *
 * ## What shape this is, and why
 *
 * A list of conversations beside the one that is open — the shape every chat
 * has had for fifteen years, because it is the one that answers "has anything
 * happened" and "what was said" without making you choose between them. It was
 * a screen of rows that opened a different screen: you could see what had been
 * said in one class or which classes you were in, never both, and nothing on
 * either said whether anything was new.
 *
 * On a phone the two are one at a time, because a 200px list beside a 230px
 * conversation is neither. The list is the screen, and a room is where you go.
 *
 * ## Three honest statements, which have not changed
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
 *
 * ## What is on the device and what is on the server
 *
 * Messages, reactions and who is in a class are on the server, because they
 * are about other people. Which rooms you pinned, which you muted and how far
 * you had read are on the device — see `lib/roomprefs.ts`. Pinning a class is
 * not something the other forty people in it should be able to read.
 */
export function Classmates() {
  const { account, catalog, state, school, dispatch } = useStore();
  const wide = useMedia(WIDE);
  const term = termOf();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [handle, setHandle] = useState('');
  /** The room keys this account is in, as the account service has them. */
  const [rooms, setRooms] = useState<string[]>([]);
  /** Everything said in every room you are in, for the list's last lines. */
  const [said, setSaid] = useState<Record<string, Message[]>>({});
  const [marks, setMarks] = useState<Marks>(() => storedMarks());
  const [open, setOpen] = useState('');
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
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
      /*
       * One query for every room's last lines, rather than one per room.
       *
       * The list needs a preview and an unread count for each class; asking
       * room by room is five round trips on a phone before anything is drawn.
       * `bucket` splits the one answer back out. See `lib/roomchat.ts`.
       */
      if (mine.length > 0) {
        const recent = await across(term, mine);
        setSaid(bucket(recent, (m) => m.code));
      } else {
        setSaid({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [account, ok, term]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
   * `?room=` — the link the room's own menu copies.
   *
   * Read once and taken back out of the address, the way `components/Tapped.tsx`
   * reads `?item=`: a query string left in place is one that survives a reload
   * and re-opens a room somebody has since navigated away from.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const asked = new URLSearchParams(window.location.search).get('room');
    if (!asked) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url);
    setOpen(asked);
  }, []);

  /*
   * The paper shared from the Exam screen, read once.
   *
   * It is handed to the room as its opening draft and then cleared, so coming
   * back to the room later does not re-fill the box with a message you already
   * sent. The clear lands after the room has mounted with it, which is what
   * makes reading it once enough.
   */
  useEffect(() => {
    if (open && state.roomDraft) dispatch({ type: 'clearRoomDraft' });
  }, [open, state.roomDraft, dispatch]);

  /** Handed to the room, which knows more about its own messages than this does. */
  const onMessages = useCallback((key: string, all: Message[]) => {
    setSaid((prior) => ({ ...prior, [key]: all }));
  }, []);

  const onRead = useCallback((key: string, iso: string) => {
    setMarks(markRead(key, iso));
  }, []);

  const paperOf = useCallback((body: string) => codeIn(body) ?? null, []);

  const onPaper = useCallback(
    (code: string) => dispatch({ type: 'sitPaper', minutes: 15, formatId: 'choice', code }),
    [dispatch],
  );

  const rows = useMemo(() => {
    if (!account || !state.schoolId) return [];
    const offered = roomsFor(
      catalog.courses.map((c) => c.code),
      rooms,
      state.schoolId,
    );
    const nameOf = () => '';
    return listed(
      offered,
      said as Record<string, Say[]>,
      marks,
      account.id,
      // A preview says who spoke, and the list has no profiles for the other
      // rooms — only the open one loads them. So the last line is the words,
      // and the name arrives once you are in the room. Better an honest line
      // than four queries for forty names to prefix it with.
      nameOf,
      new Date(),
      profile?.handle ?? '',
      [],
    );
  }, [account, catalog.courses, rooms, state.schoolId, said, marks, profile]);

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
        <div
          style={{
            fontSize: 'var(--type-sm)',
            lineHeight: 'var(--leading-relaxed)',
            marginBottom: 'var(--sp-5)',
            ...secondLine(),
          }}
        >
          This is the only thing about you other people see, alongside the classes you share. Not
          your email, and it does not have to be your full name.
        </div>
        <input
          aria-label="What classmates should call you"
          className="input"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Harrison R"
          style={{ width: '100%' }}
        />
        <ActionButton
          disabled={busy || handle.trim().length < 2}
          onClick={() => {
            setBusy(true);
            setError('');
            void saveProfile(account.id, handle, '')
              .then(refresh)
              .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false));
          }}
          tone="primary"
          style={{ marginTop: 'var(--sp-6)' }}
        >
          {busy ? 'Saving…' : 'That is me'}
        </ActionButton>
        {error ? <Problem>{error}</Problem> : null}
      </Page>
    );
  }

  const onJoin = (key: string) => {
    setBusy(true);
    setError('');
    void join(account.id, term, key)
      .then(() => {
        setAdding('');
        return refresh();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const onLeave = (key: string) => {
    void leave(account.id, term, key)
      .then(() => {
        setOpen((now) => (now === key ? '' : now));
        return refresh();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const onPin = (key: string, pinned: boolean) => setMarks(remember(key, { pinned }));
  const onMute = (key: string, muted: boolean) => setMarks(remember(key, { muted }));

  /**
   * The link to a room, for somebody else in the class.
   *
   * It opens the app on that room and nothing more — there is no invitation in
   * it, because there is nothing to invite anybody to: a room is joined by
   * saying you are in the class, and the link cannot say it for you.
   */
  const onCopyLink = (key: string) => {
    const url = new URL(window.location.href);
    url.search = `?room=${encodeURIComponent(key)}`;
    url.hash = '';
    const text = url.toString();
    setError('');
    void navigator.clipboard
      ?.writeText(text)
      .then(() => setNote('Link copied.'))
      .catch(() => setNote(text));
  };

  const openRow = rows.find((r) => r.key === open);
  const list = (
    <Rooms
      rows={rows}
      openKey={open}
      onOpen={setOpen}
      onJoin={onJoin}
      onPin={onPin}
      onMute={onMute}
      onLeave={onLeave}
      onCopyLink={onCopyLink}
      adding={adding}
      onAdding={setAdding}
      onAdd={() => onJoin(roomKey(state.schoolId, adding) || adding)}
      busy={busy}
    />
  );

  const room = openRow && (
    <Talk
      key={openRow.key}
      term={term}
      roomKey={openRow.key}
      code={openRow.code}
      me={account.id}
      myHandle={profile?.handle ?? ''}
      pinned={openRow.pinned}
      muted={openRow.muted}
      mark={marks[openRow.key]?.read ?? ''}
      draft={state.roomDraft}
      wide={wide}
      onBack={() => setOpen('')}
      onLeave={() => onLeave(openRow.key)}
      onPin={(pinned) => onPin(openRow.key, pinned)}
      onMute={(muted) => onMute(openRow.key, muted)}
      onCopyLink={() => onCopyLink(openRow.key)}
      onMessages={onMessages}
      onRead={onRead}
      onPaper={onPaper}
      paperOf={paperOf}
    />
  );

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 0,
        paddingLeft: 'var(--page-pad)',
        paddingRight: 'var(--page-pad)',
      }}
    >
      {/*
        Beside the conversation where there is room, instead of it where there
        is not — the same rule the assistant's own history follows, and for the
        same measurement: a 232px rail on a 430px phone leaves 200px for a
        message, which is narrower than a sentence.
      */}
      {wide && (
        <div
          style={{
            flex: 'none',
            width: 264,
            minHeight: 0,
            paddingRight: 'var(--sp-6)',
            borderRight: '1px solid var(--app-line)',
          }}
        >
          {list}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          paddingLeft: wide ? 'var(--sp-7)' : 0,
        }}
      >
        {note ? (
          <div
            role="status"
            style={{
              flex: 'none',
              fontSize: 'var(--type-xs)',
              paddingTop: 'var(--sp-4)',
              ...secondLine(),
            }}
          >
            {note}
          </div>
        ) : null}
        {error ? <Problem>{error}</Problem> : null}

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {room ?? (wide ? <Waiting term={term} school={proves(school)} /> : list)}
        </div>

        {/* Only where there is no room open to fill the space. */}
        {!room && (
          <div style={{ flex: 'none', paddingBottom: 'var(--sp-7)' }}>
            <Blocked me={account.id} />
            <div
              style={{
                fontSize: 'var(--type-xs)',
                lineHeight: 'var(--leading-relaxed)',
                paddingTop: 'var(--sp-6)',
                ...secondLine(),
              }}
            >
              {termLabel(term)}. Leaving a room removes you from it and nothing you posted. Blocking
              somebody is immediate and is enforced by the database, so their messages stop reaching
              this device — reports are recorded, but nobody is watching a queue, and it would be
              wrong to imply otherwise.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** What the pane beside the list says while no room is open. */
function Waiting({ term, school }: { term: string; school: string }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
      <div
        style={{
          maxWidth: 'min(100%, var(--reading-width, 68ch))',
          textAlign: 'center',
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-relaxed)',
          ...secondLine(),
        }}
      >
        <div style={{ fontSize: 'var(--type-lg)', color: 'var(--app-fg)' }}>
          Pick a class to open its chat
        </div>
        <div style={{ paddingTop: 'var(--sp-5)' }}>
          {termLabel(term)}. A room is everybody who says they are in that class. {school}
        </div>
      </div>
    </div>
  );
}

function Blocked({ me }: { me: string }) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    void listBlocked(me)
      .then(setIds)
      .catch(() => setIds([]));
  }, [me]);
  if (ids.length === 0) return null;
  return (
    <Folding name="Blocked">
      <SectionLabel>Blocked</SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-sm)',
          marginBottom: 'var(--sp-4)',
          lineHeight: 'var(--leading-normal)',
          ...secondLine(),
        }}
      >
        {ids.length} {ids.length === 1 ? 'person' : 'people'}. Their messages never reach this
        device. They are not told, and they cannot see that you blocked them.
      </div>
      {ids.map((id) => (
        <div
          key={id}
          style={{
            display: 'flex',
            gap: 'var(--sp-5)',
            alignItems: 'center',
            paddingTop: 'var(--sp-4)',
            paddingBottom: 'var(--sp-4)',
          }}
        >
          <span style={{ flex: 1, fontSize: 'var(--type-sm)', ...secondLine() }}>
            Blocked account
          </span>
          <button
            type="button"
            className="bare tap-y"
            onClick={() => void unblock(me, id).then(() => setIds((x) => x.filter((y) => y !== id)))}
            style={{ width: 'auto', fontSize: 'var(--type-xs)', ...secondLine() }}
          >
            UNBLOCK
          </button>
        </div>
      ))}
    </Folding>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Page>
      <Blueprint style={{ padding: 'var(--sp-7)', background: 'var(--app-hero)' }}>
        <div className="kicker">{title}</div>
        <div
          style={{
            fontSize: 'var(--type-md)',
            marginTop: 'var(--sp-4)',
            lineHeight: 'var(--leading-relaxed)',
          }}
        >
          {children}
        </div>
      </Blueprint>
    </Page>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    // Announced when it appears. Several call sites share this one node, which
    // is why the role belongs here rather than at each of them.
    <div
      role="alert"
      style={{
        flex: 'none',
        fontSize: 'var(--type-sm)',
        marginTop: 'var(--sp-5)',
        color: 'var(--app-warn)',
        lineHeight: 'var(--leading-normal)',
      }}
    >
      {children}
    </div>
  );
}
