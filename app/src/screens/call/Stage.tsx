import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { Page } from '../../components/Page';
import { SectionLabel } from '../../components/ui';
import {
  CallIcon,
  CamOffIcon,
  ChatIcon,
  GalleryIcon,
  HandIcon,
  LeaveIcon,
  MicIcon,
  MicOffIcon,
  MoreIcon,
  Person,
  ScreenShareIcon,
  SpotlightIcon,
} from '../../components/Icons';
import { secondLine } from '../../lib/dim';
import { dictate, dictationSupported } from '../../lib/mic';
import {
  SILENT,
  elapsed,
  grid,
  load,
  ordered,
  spotlight,
  talk,
  type Peer,
  type Talk,
} from '../../lib/call';
import {
  MARKS,
  RESTING,
  drop,
  expired,
  heard,
  admitted,
  captioned,
  heldBack,
  hostOf,
  hosting,
  readable,
  waiting,
  reacted,
  seen,
  type Flags,
  type Line,
  type Caption,
  type Mark,
  type Roster,
} from '../../lib/mesh';
import { canShare, join, meter, share, shut, type Session } from '../../lib/rtc';
import { Bar, Control } from './Bar';
import { Tile } from './Tile';
import { copy, shareLink } from './link';

/** The live call. Everything above this is preparation; this is the thing. */
export function Stage({
  code,
  title,
  local,
  name,
  start,
  wantShare,
  onLeave,
}: {
  code: string;
  title: string;
  local: MediaStream;
  name: string;
  /** What the green room was left with — muted, camera off, or neither. */
  start: { muted: boolean; camera: boolean };
  /** Whether this call was started from "Share screen" on the lobby. */
  wantShare: boolean;
  onLeave: () => void;
}) {
  const { dispatch, catalog } = useStore();

  const [session, setSession] = useState<Session | null>(null);
  const [roster, setRoster] = useState<Roster>({});
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [lines, setLines] = useState<Line[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  /*
   * Captions.
   *
   * `on` is this device's own switch and only ever starts this device's
   * recogniser: a caption is written by the person speaking, because a browser
   * can transcribe the microphone it holds and cannot usefully transcribe an
   * incoming stream. So turning them on shows everybody else's lines too —
   * whoever has also turned them on — and there is no way to make somebody
   * else's speech into text from here. The switch says that.
   */
  const [captionsOn, setCaptionsOn] = useState(false);
  /*
   * Asked once, not on every render.
   *
   * `dictationSupported` answers by constructing a recogniser and throwing it
   * away, so calling it from the render body built one per frame — harmless
   * and wasteful, and the sort of thing that is obvious in the function's own
   * source and invisible at the call site.
   */
  const [canCaption] = useState(dictationSupported);
  const [captions, setCaptions] = useState<Caption[]>([]);
  /*
   * The door.
   *
   * `holding` is this device's own setting and only means anything while this
   * device is the host — every tab computes `hosting` separately and they
   * agree, so a host who leaves takes their door with them and the next host's
   * setting applies. `allowed` is this device's copy of who has been let in,
   * built only from what the host says. Both are state rather than derived
   * because `admitted` folds signals into the second one over time.
   */
  const [holding, setHolding] = useState(false);
  const [allowed, setAllowed] = useState<string[]>([]);
  /** Set when the host says so, purely so the screen can explain the wait. */
  const [outside, setOutside] = useState(false);
  /*
   * People taken out, which is not the same list as people not yet let in.
   *
   * Removal has to work in an open call too, and in an open call `allowed`
   * means nothing — everybody in the roster gets a connection. Without this,
   * removing somebody would reconnect them on the next roster change, or the
   * host would have to be silently switched to holding the door, which is a
   * setting they did not touch appearing to have changed by itself.
   */
  const [removed, setRemoved] = useState<string[]>([]);
  const [flags, setFlags] = useState<Flags>({
    ...RESTING,
    name,
    muted: start.muted,
    camera: start.camera,
  });
  const [view, setView] = useState<'gallery' | 'speaker'>('gallery');
  const [pinned, setPinned] = useState('');
  const [panel, setPanel] = useState<'' | 'people' | 'chat' | 'more'>('');
  const [screen, setScreen] = useState<MediaStream | null>(null);
  const [trouble, setTrouble] = useState('');
  const [asked, setAsked] = useState(0);
  const [volume, setVolume] = useState(1);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [since] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  /*
   * The signal handler, held in a ref rather than passed fresh.
   *
   * `join` takes its callbacks once, at the top of the call, and they close
   * over whatever state existed then. A handler that read `flags` directly
   * would be reading the flags from the moment the call started for the rest
   * of the call. The ref is the ordinary fix and it is the only reason this
   * indirection exists.
   */
  const latest = useRef({ flags, roster });
  latest.current = { flags, roster };
  /* The same trick, for the same reason: `onSignal` is made once. */
  const hostRef = useRef('');

  useEffect(() => {
    let live = true;
    let made: Session | null = null;

    void join(
      code,
      local,
      { ...RESTING, name, muted: start.muted, camera: start.camera },
      {
        onSignal: (signal) => {
          if (!live) return;
          setRoster((was) => seen(was, signal, Date.now()));
          /*
           * Who this device will connect to. Folded here, next to the roster,
           * because both are answers to the same signal and a second effect
           * reading the roster afterwards would be a frame behind — long
           * enough for `keep` to run once against a stale door.
           *
           * `hostRef` rather than `host`: this closure is made once, for the
           * life of the call, for the reason the comment on `latest` gives.
           */
          setAllowed((was) => admitted(was, signal, hostRef.current));
          if ((signal.t === 'evict' || signal.t === 'deny') && signal.from === hostRef.current) {
            setRemoved((was) => (was.includes(signal.to) ? was : [...was, signal.to]));
          }
          if (signal.t === 'admit' && signal.from === hostRef.current) {
            setRemoved((was) => was.filter((id) => id !== signal.to));
          }
          if (heldBack(signal, me, hostRef.current)) setOutside(true);
          if (signal.t === 'admit' && signal.to === me) setOutside(false);
          setLines((was) => heard(was, signal, latest.current.roster));
          setMarks((was) => reacted(was, signal, Date.now()));
          setCaptions((was) => captioned(was, signal, Date.now()));
          if (signal.t === 'ask' && signal.what === 'mute') setAsked(Date.now());
        },
        onStream: (id, stream) => {
          if (!live) return;
          setStreams((was) => {
            if (!stream) {
              const next = { ...was };
              delete next[id];
              return next;
            }
            return { ...was, [id]: stream };
          });
        },
        onTrouble: (said) => {
          if (live) setTrouble(said);
        },
      },
    )
      .then((s) => {
        if (!live) {
          s.leave();
          return;
        }
        made = s;
        setSession(s);
      })
      .catch((e: unknown) => {
        if (live) setTrouble(e instanceof Error ? e.message : String(e));
      });

    return () => {
      live = false;
      made?.leave();
    };
    // Once, for the life of this call. The code cannot change without the
    // component being rebuilt — see the `key` on it in `Index.tsx`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The clock, and the sweep for peers that stopped saying anything. */
  useEffect(() => {
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setRoster((was) => {
        const gone = expired(was, at);
        return gone.length ? drop(was, gone) : was;
      });
      // A caption goes when nothing replaces it, and in a quiet call nothing
      // does — so the clock has to be what lets it go, not the next signal.
      setCaptions((was) => captioned(was, { t: 'gone', from: '' }, at));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* Muting is a track being disabled, not a message. Both, in fact: the track
     so nothing is sent, the flag so everybody's tile shows it. */
  useEffect(() => {
    for (const track of local.getAudioTracks()) track.enabled = !flags.muted;
    for (const track of local.getVideoTracks()) track.enabled = flags.camera;
    session?.announce(flags);
  }, [session, local, flags]);

  /*
   * The shared screen has an owner too, for the same reason the camera does.
   *
   * It was stopped in one place — `present`, when sharing is toggled off — so
   * navigating away mid-share left the capture running and the browser's "you
   * are sharing your screen" bar up, for a call already left. Same shape as
   * the effect in `Index.tsx`: keyed on the stream rather than written as an
   * unmount-only cleanup, because `StrictMode` doubles the first mount and
   * `screen` is null for that pass.
   */
  useEffect(() => {
    if (!screen) return;
    return () => shut(screen);
  }, [screen]);

  /* Who is talking, mine and everybody else's. */
  const speaking = useSpeaking(local, streams, flags.muted);

  /* "Share screen" from the lobby: the picker opens as soon as the call does. */
  const started = useRef(false);
  const present = useCallback(async () => {
    if (screen) {
      // No `shut` here: clearing it runs the cleanup above, which is the one
      // place the capture is stopped however sharing ends.
      setScreen(null);
      await session?.present(null);
      setFlags((f) => ({ ...f, sharing: false }));
      return;
    }
    try {
      const got = await share();
      setScreen(got);
      setFlags((f) => ({ ...f, sharing: true }));
      await session?.present(got.getVideoTracks()[0] ?? null);
      // The browser's own "Stop sharing" bar is outside this app, so the end
      // of a share arrives as a track ending rather than as a click.
      got.getVideoTracks()[0]?.addEventListener('ended', () => {
        setScreen(null);
        setFlags((f) => ({ ...f, sharing: false }));
        void session?.present(null);
      });
    } catch {
      // Cancelling the picker is not an error worth a message.
    }
  }, [screen, session]);

  useEffect(() => {
    if (session && wantShare && !started.current) {
      started.current = true;
      void present();
    }
  }, [session, wantShare, present]);

  const me = session?.id ?? 'me';
  const peers: Peer[] = useMemo(() => {
    const mine: Peer = {
      id: me,
      name: flags.name,
      self: true,
      joinedAt: since,
      camera: flags.camera,
      muted: flags.muted,
      hand: flags.hand,
      sharing: flags.sharing,
      spokeAt: speaking[me] ?? 0,
    };
    const theirs = Object.values(roster).map((k) => ({
      id: k.id,
      name: k.flags.name || 'Somebody',
      joinedAt: k.joinedAt,
      camera: k.flags.camera,
      muted: k.flags.muted,
      hand: k.flags.hand,
      sharing: k.flags.sharing,
      spokeAt: speaking[k.id] ?? 0,
    }));
    return [mine, ...theirs];
  }, [me, flags, since, roster, speaking]);

  const host = hostOf(roster, me, since);
  hostRef.current = host;
  const iHost = hosting(roster, me, since);
  const atDoor = holding && iHost ? waiting(roster, [me, ...allowed]) : [];

  /*
   * One connection per person in the roster, and none to anybody else — or,
   * with the door shut, none to anybody who has not been let in.
   *
   * This is the line that enforces the waiting room. Not the host's refusal,
   * which is a message somebody's client can be written to ignore: a
   * connection nobody opens carries no media, so declining to open one is the
   * one kind of authority a mesh actually has. See the long note in
   * `lib/mesh.ts`.
   *
   * `me` is in the allowed set always. A call whose host is not allowed into
   * it is a call that empties itself.
   */
  useEffect(() => {
    if (!session) return;
    const held = holding || outside;
    if (!held && removed.length === 0) {
      // Exactly the call this was before there was a door, so an ordinary
      // call provably takes the path it always took.
      session.keep(roster);
      return;
    }
    const inside = held ? [me, ...allowed] : [me, ...Object.keys(roster)];
    session.keep(
      roster,
      inside.filter((id) => id === me || !removed.includes(id)),
    );
  }, [session, roster, holding, outside, allowed, removed, me]);

  /*
   * My own speech, as text, sent to everybody.
   *
   * `dictate` is `lib/mic.ts`'s — the same recogniser the note dictation uses,
   * which is why this is thirty lines rather than three hundred. It hands back
   * the transcript so far on every result, so what goes out is a line that
   * grows and then settles, and `captioned` replaces rather than appends.
   *
   * Muting stops it. A caption of what you said while muted would be the
   * worst possible bug in this feature: the one thing a mute button promises
   * is that the call does not learn what you just said.
   */
  useEffect(() => {
    if (!captionsOn || !session || flags.muted) return;
    let last = '';
    const stop = dictate(
      (text, final) => {
        const line = text.trim();
        // The recogniser fires on every interim result; only send when the
        // words actually changed, or a still room is a signal every 100ms.
        if (line === last && !final) return;
        last = line;
        const signal = { t: 'caption' as const, from: me, at: Date.now(), text: line, done: final };
        session.send(signal);
        // Broadcast does not echo to the sender, so my own line is applied here.
        setCaptions((was) => captioned(was, signal, Date.now()));
      },
      (message) => setTrouble(message),
    );
    return stop;
  }, [captionsOn, session, flags.muted, me]);

  /* The host lets somebody know they are at a door rather than in an empty
     call. A courtesy: nothing about the door depends on it arriving. */
  useEffect(() => {
    if (!session || !holding || !iHost) return;
    for (const k of atDoor) session.send({ t: 'held', from: me, to: k.id });
    // Only when the queue changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, holding, iHost, atDoor.map((k) => k.id).join(',')]);
  const shown = ordered(peers, now, pinned);
  const big = spotlight(peers, now, pinned);
  const busy = load(peers.length);

  const streamFor = (id: string) => (id === me ? (screen ?? local) : (streams[id] ?? null));

  const box = useBox();
  const cells = grid(view === 'gallery' ? shown.length : 1, box);

  const say = () => {
    const body = draft.trim();
    if (!body || !session) return;
    const signal = { t: 'said' as const, from: me, at: Date.now(), body };
    session.send(signal);
    // Said to the room, and shown here: broadcast does not echo to the sender.
    setLines((was) => heard(was, signal, { ...roster, [me]: { id: me, flags, joinedAt: since, heard: Date.now() } }));
    setDraft('');
  };

  return (
    <Page wide bottom={12}>
      {/* The strip that answers "where am I" — the call, the clock, the code. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          paddingInline: 'var(--sp-6)',
          paddingBlock: 'var(--sp-4)',
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
            {title || 'Call'}
          </span>
          <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-1)' }}>
            {elapsed(now - since)} · {code} · {peers.length === 1 ? 'just you so far' : `${peers.length} here`}
          </span>
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void copy(shareLink(code)).then(setCopied)}
          style={{ flex: 'none', height: 34, paddingInline: 'var(--sp-6)', fontSize: 'var(--type-xs)', width: 'auto' }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      {trouble ? (
        <div
          role="alert"
          style={{
            fontSize: 'var(--type-sm)',
            color: 'var(--app-warn)',
            paddingInline: 'var(--sp-6)',
            paddingBlock: 'var(--sp-3)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {trouble}
        </div>
      ) : null}

      {/*
        * Waiting at the door.
        *
        * Without this, being held looks exactly like being first into an empty
        * call: your own tile, nobody else's, and no reason given. The sentence
        * is the whole difference between waiting and thinking it is broken.
        * It appears only when the host said so — see `heldBack` — because a
        * call that really is empty must not claim somebody is deciding.
        */}
      {outside ? (
        <div
          role="status"
          style={{
            fontSize: 'var(--type-sm)',
            paddingInline: 'var(--sp-6)',
            paddingBlock: 'var(--sp-3)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          Waiting to be let in. {roster[host]?.flags.name || 'Whoever started this call'} has been asked.
        </div>
      ) : null}

      {/*
        * The captions, under the video and above the controls, oldest first so
        * a line does not jump while somebody is reading it.
        */}
      {captionsOn && captions.length > 0 ? (
        <div
          aria-live="polite"
          style={{
            paddingInline: 'var(--sp-6)',
            paddingBlock: 'var(--sp-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-2)',
          }}
        >
          {readable(captions).map((c) => (
            <div key={c.from} style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
              <span style={{ ...secondLine() }}>
                {c.from === me ? 'You' : roster[c.from]?.flags.name || 'Somebody'}:{' '}
              </span>
              {/* An unsettled line is still being heard and may change under
                  the reader, so it is drawn quieter rather than as a claim —
                  with `secondLine`, the audited dim, rather than a hand-rolled
                  opacity that `lint:styles` would be right to object to. */}
              <span style={c.done ? undefined : secondLine()}>{c.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      {asked && now - asked < 20_000 ? (
        <div
          role="status"
          style={{
            fontSize: 'var(--type-sm)',
            paddingInline: 'var(--sp-6)',
            paddingBlock: 'var(--sp-3)',
            color: 'var(--app-accent)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          Somebody asked everybody to mute.{' '}
          {flags.muted ? 'You already are.' : 'Your microphone is still on.'}
        </div>
      ) : null}

      {/* The tiles.

          The padding is on the outside of the measured element on purpose:
          `clientWidth` includes padding, so measuring a padded box hands
          `grid` a width that is sixteen pixels wider than the room the tiles
          actually have — and every tile is drawn that much too wide, which
          reads as the last column being clipped. */}
      <div style={{ paddingInline: 'var(--sp-4)' }}>
       <div ref={box.ref}>
        {view === 'gallery' ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 'var(--sp-4)',
            }}
          >
            {shown.map((p) => (
              <Tile
                key={p.id}
                stream={streamFor(p.id)}
                name={p.name}
                muted={p.muted}
                camera={p.camera || Boolean(p.self && screen)}
                hand={p.hand > 0}
                speaking={now - (speaking[p.id] ?? 0) < 1200}
                mirrored={Boolean(p.self) && !screen}
                you={Boolean(p.self)}
                mark={marks.find((m) => m.from === p.id)?.mark ?? ''}
                width={cells.width || undefined}
                height={cells.width ? cells.height : undefined}
                volume={volume}
                onClick={() => setPinned((was) => (was === p.id ? '' : p.id))}
              />
            ))}
          </div>
        ) : (
          <>
            {big ? (
              <Tile
                stream={streamFor(big.id)}
                name={big.name}
                muted={big.muted}
                camera={big.camera || Boolean(big.self && screen)}
                hand={big.hand > 0}
                speaking={now - (speaking[big.id] ?? 0) < 1200}
                mirrored={Boolean(big.self) && !screen}
                you={Boolean(big.self)}
                mark={marks.find((m) => m.from === big.id)?.mark ?? ''}
                volume={volume}
                onClick={() => setPinned((was) => (was === big.id ? '' : big.id))}
              />
            ) : null}
            <div
              style={{
                display: 'flex',
                gap: 'var(--sp-3)',
                overflowX: 'auto',
                marginTop: 'var(--sp-3)',
              }}
            >
              {shown
                .filter((p) => p.id !== big?.id)
                .map((p) => (
                  <div key={p.id} style={{ flex: 'none', width: 116 }}>
                    <Tile
                      stream={streamFor(p.id)}
                      name={p.name}
                      muted={p.muted}
                      camera={p.camera || Boolean(p.self && screen)}
                      hand={p.hand > 0}
                      speaking={now - (speaking[p.id] ?? 0) < 1200}
                      mirrored={Boolean(p.self) && !screen}
                      you={Boolean(p.self)}
                      mark={marks.find((m) => m.from === p.id)?.mark ?? ''}
                      volume={volume}
                      onClick={() => setPinned((was) => (was === p.id ? '' : p.id))}
                    />
                  </div>
                ))}
            </div>
          </>
        )}
       </div>
      </div>

      {pinned ? (
        <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), textAlign: 'center', paddingBlock: 'var(--sp-3)' }}>
          Pinned. Tap the tile again to unpin.
        </div>
      ) : null}

      <Bar>
        <Control
          label={flags.muted ? 'Unmute' : 'Mute'}
          icon={flags.muted ? <MicOffIcon size={19} /> : <MicIcon size={19} />}
          warn={flags.muted}
          pressed={flags.muted}
          onClick={() => setFlags((f) => ({ ...f, muted: !f.muted }))}
        />
        <Control
          label={flags.camera ? 'Stop video' : 'Start video'}
          icon={flags.camera ? <CallIcon size={19} /> : <CamOffIcon size={19} />}
          warn={!flags.camera}
          pressed={!flags.camera}
          onClick={() => setFlags((f) => ({ ...f, camera: !f.camera }))}
        />
        <Control
          label={screen ? 'Stop sharing' : 'Share'}
          icon={<ScreenShareIcon size={19} />}
          live={Boolean(screen)}
          disabled={!canShare()}
          onClick={() => void present()}
        />
        <Control
          label={flags.hand ? 'Hand down' : 'Raise hand'}
          icon={<HandIcon size={19} />}
          live={flags.hand > 0}
          pressed={flags.hand > 0}
          onClick={() => setFlags((f) => ({ ...f, hand: f.hand > 0 ? 0 : Date.now() }))}
        />
        <Control
          label="Chat"
          icon={<ChatIcon size={19} />}
          live={panel === 'chat'}
          onClick={() => setPanel((p) => (p === 'chat' ? '' : 'chat'))}
        />
        <Control
          label={`People ${peers.length}`}
          icon={<Person size={19} />}
          live={panel === 'people'}
          onClick={() => setPanel((p) => (p === 'people' ? '' : 'people'))}
        />
        <Control
          label={view === 'gallery' ? 'Speaker' : 'Gallery'}
          icon={view === 'gallery' ? <SpotlightIcon size={19} /> : <GalleryIcon size={19} />}
          onClick={() => setView((v) => (v === 'gallery' ? 'speaker' : 'gallery'))}
        />
        <Control
          label="More"
          icon={<MoreIcon size={19} />}
          live={panel === 'more'}
          onClick={() => setPanel((p) => (p === 'more' ? '' : 'more'))}
        />
        <Control label="Leave" icon={<LeaveIcon size={19} />} danger onClick={onLeave} />
      </Bar>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-4)', paddingBlock: 'var(--sp-3)' }}>
        {MARKS.map((mark) => (
          <button
            key={mark}
            type="button"
            className="bare tappable"
            aria-label={`React with ${mark}`}
            onClick={() => {
              if (!session) return;
              const signal = { t: 'react' as const, from: me, at: Date.now(), mark };
              session.send(signal);
              setMarks((was) => reacted(was, signal, Date.now()));
            }}
            style={{ fontSize: 'var(--type-xl)', width: 'auto', paddingInline: 'var(--sp-2)' }}
          >
            {mark}
          </button>
        ))}
      </div>

      {panel === 'people' && (
        <div style={{ paddingInline: 'var(--sp-6)' }}>
          {/*
            * The door. Only the host is offered it, and `iHost` is computed
            * the same way in every tab, so the control appears in exactly one
            * of them. Somebody who is not the host is not shown a switch that
            * would do nothing — a disabled control here would imply the call
            * has an owner who could grant it, and it does not.
            */}
          {iHost && (
            <>
              <SectionLabel>The door</SectionLabel>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                  paddingBlock: 'var(--sp-5)',
                  fontSize: 'var(--type-md)',
                }}
              >
                <input type="checkbox" checked={holding} onChange={(e) => setHolding(e.target.checked)} />
                <span>Let people in one at a time</span>
              </label>
              <div
                style={{
                  fontSize: 'var(--type-xs)',
                  ...secondLine(),
                  marginBottom: 'var(--sp-5)',
                  lineHeight: 'var(--leading-normal)',
                  textWrap: 'pretty',
                }}
              >
                {holding
                  ? 'Nobody new gets audio or video until you let them in. They can still see who is here, because the room’s messages are open to anybody with the code.'
                  : 'Anybody with the code walks in, which is what a code is for.'}
              </div>

              {atDoor.length > 0 && (
                <>
                  <SectionLabel>Waiting</SectionLabel>
                  {atDoor.map((k) => (
                    <div
                      key={k.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-4)',
                        paddingBlock: 'var(--sp-5)',
                        borderBottom: '1px solid var(--app-line)',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}>
                        {k.name || 'Somebody'}
                        {/* Refused stays on the list rather than vanishing.
                            They are still in the call's roster — they can hear
                            nothing and see nobody, but they have not gone — and
                            a queue that dropped them would say they had. */}
                        {removed.includes(k.id) ? ' · not let in' : ''}
                      </span>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          const signal = { t: 'admit' as const, from: me, to: k.id };
                          session?.send(signal);
                          // Broadcast does not echo to the sender, so this
                          // device applies its own decision itself.
                          setAllowed((was) => admitted(was, signal, me));
                          setRemoved((was) => was.filter((id) => id !== k.id));
                        }}
                      >
                        Let in
                      </button>
                      {!removed.includes(k.id) && (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            session?.send({ t: 'deny', from: me, to: k.id });
                            setRemoved((was) => (was.includes(k.id) ? was : [...was, k.id]));
                          }}
                        >
                          Not now
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {/*
            * Captions, and the sentence that has to be next to the switch.
            *
            * Turning this on starts *this* browser's recogniser on *this*
            * microphone, and where a browser sends that audio to be recognised
            * is the browser's business — on Chrome it is Google's servers.
            * This app uploads nothing and cannot stop that, so the only honest
            * thing to do is say it where the switch is rather than in a
            * settings page nobody opens. The same sentence is why the switch
            * is per-device and not something the host can turn on for a room.
            */}
          <SectionLabel>Captions</SectionLabel>
          {canCaption ? (
            <>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                  paddingBlock: 'var(--sp-5)',
                  fontSize: 'var(--type-md)',
                }}
              >
                <input
                  type="checkbox"
                  checked={captionsOn}
                  onChange={(e) => setCaptionsOn(e.target.checked)}
                />
                <span>Show captions</span>
              </label>
              <div
                style={{
                  fontSize: 'var(--type-xs)',
                  ...secondLine(),
                  marginBottom: 'var(--sp-5)',
                  lineHeight: 'var(--leading-normal)',
                  textWrap: 'pretty',
                }}
              >
                This turns your own words into text on your device and sends the text to the call —
                and it is your browser that does the listening, which on Chrome means the audio goes
                to Google to be recognised. Semester uploads none of it and cannot stop that. You
                will see captions from anybody else who has switched this on, and only from them.
                Muting stops yours.
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: 'var(--type-xs)',
                ...secondLine(),
                paddingBlock: 'var(--sp-5)',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              This browser has no speech recognition, so it cannot make captions. Chrome and Safari
              do; Firefox does not. You will still see captions from anybody in the call whose
              browser can.
            </div>
          )}

          <SectionLabel>In this call</SectionLabel>
          {shown.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-4)',
                paddingBlock: 'var(--sp-5)',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)' }}>
                {p.name}
                {p.self ? ' (you)' : ''}
                {p.id === host ? ' · started it' : ''}
              </span>
              {p.hand > 0 ? <HandIcon size={15} /> : null}
              {p.muted ? <MicOffIcon size={15} /> : null}
              {!p.camera ? <CamOffIcon size={15} /> : null}
              {/*
                * Removing somebody is the one thing a host here can actually
                * do to another person, and it works for the same reason the
                * door does: every device closes its connection to them.
                * Muting them is not offered, and `hostOf`'s own comment says
                * why — nothing here can reach their microphone, and a button
                * that claimed to would be a lie somebody relied on.
                */}
              {iHost && !p.self && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const signal = { t: 'evict' as const, from: me, to: p.id };
                    session?.send(signal);
                    setAllowed((was) => admitted(was, signal, me));
                    setRemoved((was) => (was.includes(p.id) ? was : [...was, p.id]));
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
            {busy.total === 0
              ? 'Nobody else yet. Send the link.'
              : `Everybody sends their camera to everybody else — ${busy.each} out and ${busy.each} in, each. ${
                  busy.tight ? 'Past about six people that is more than a laptop enjoys, and it will show.' : ''
                }`}
          </div>
        </div>
      )}

      {panel === 'chat' && (
        <div style={{ paddingInline: 'var(--sp-6)' }}>
          <SectionLabel>Chat</SectionLabel>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {lines.length === 0 ? (
              <div style={{ fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-relaxed)' }}>
                Nothing said yet. This is only for the people in the call and only while it lasts —
                nothing here is saved unless you save it.
              </div>
            ) : (
              lines.map((l) => (
                <div key={l.id} style={{ paddingBlock: 'var(--sp-3)' }}>
                  <div style={{ fontSize: 'var(--type-xs)', ...secondLine() }}>{l.name}</div>
                  <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap' }}>
                    {l.body}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
            <input
              aria-label="Say something to the call"
              className="input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') say();
              }}
              placeholder="Say something"
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!draft.trim()}
              onClick={say}
              style={{ flex: 'none', paddingInline: 'var(--sp-6)', height: 44 }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {panel === 'more' && (
        <div style={{ paddingInline: 'var(--sp-6)' }}>
          <SectionLabel>The rest of it</SectionLabel>

          <label
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)', paddingBlock: 'var(--sp-5)' }}
          >
            <span style={{ fontSize: 'var(--type-sm)', flex: 'none' }}>Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              // The one native control in here. `accentColor` is what stops it
              // being the browser's blue on an app that is not blue.
              style={{ flex: 1, minWidth: 0, accentColor: 'var(--app-accent)' }}
            />
          </label>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              session?.send({ t: 'ask', from: me, what: 'mute' });
              setAsked(Date.now());
            }}
            style={{ height: 42, marginTop: 'var(--sp-4)' }}
          >
            Ask everybody to mute
          </button>
          <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            It asks. It cannot mute anybody: there is no server in this call and nothing here can
            reach into somebody else's microphone. A button that claimed otherwise would be a lie
            somebody relied on in a seminar.
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => {
              dispatch({
                type: 'keepNote',
                title: `${title || 'Call'} — ${elapsed(now - since)}`,
                body: [
                  `${code}, ${elapsed(now - since)} long.`,
                  `In it: ${shown.map((p) => p.name).join(', ')}.`,
                  '',
                  ...lines.map((l) => `${l.name}: ${l.body}`),
                ].join('\n'),
                courseId: catalog.courses[0]?.id ?? null,
              });
              setPanel('');
            }}
            style={{ height: 42, marginTop: 'var(--sp-6)' }}
          >
            Keep this call as a note
          </button>
          <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            Who was in it, how long it ran, and everything said in the chat — written to Notes on
            this device. The call itself is not recorded, here or anywhere.
          </div>
        </div>
      )}
    </Page>
  );
}

/**
 * Who is talking, from every stream in the call.
 *
 * One meter per stream, and the state written only when somebody's `speaking`
 * actually flips. The naive version — state on every sample — re-renders the
 * whole stage sixty times a second per person, which on a four-person call is
 * 240 renders a second to move one border.
 *
 * The map holds the *moment* somebody was last heard rather than a boolean,
 * because that is what `ordered` in `lib/call.ts` sorts on: "who spoke most
 * recently" cannot be answered by a set of flags.
 */
function useSpeaking(
  local: MediaStream,
  streams: Record<string, MediaStream>,
  muted: boolean,
): Record<string, number> {
  const [spoke, setSpoke] = useState<Record<string, number>>({});
  const states = useRef<Record<string, Talk>>({});

  useEffect(() => {
    const stops: (() => void)[] = [];
    const watch = (id: string, stream: MediaStream) => {
      stops.push(
        meter(stream, (level) => {
          const at = Date.now();
          const was = states.current[id] ?? SILENT;
          const next = talk(was, level, at);
          states.current[id] = next;
          if (next.speaking !== was.speaking || (next.speaking && at - (was.heard ?? 0) > 500)) {
            setSpoke((had) => ({ ...had, [id]: next.speaking ? at : (had[id] ?? 0) }));
          }
        }),
      );
    };

    if (!muted) watch('me', local);
    for (const [id, stream] of Object.entries(streams)) watch(id, stream);
    return () => {
      for (const stop of stops) stop();
    };
  }, [local, streams, muted]);

  return spoke;
}

/**
 * How much room the tiles have, measured rather than assumed.
 *
 * `grid` in `lib/call.ts` needs a box, and the whole reason it takes one is
 * that four tiles want two columns on a laptop and one on a phone. The height
 * is derived from the width rather than measured: the stage sits inside the
 * app's own scrolling shell, so there is no element whose height means "what
 * is left", and three quarters of the width — capped so it cannot push the
 * control bar off a laptop screen — is what a call looks right at.
 */
function useBox(): { ref: (node: HTMLDivElement | null) => void; width: number; height: number } {
  const [width, setWidth] = useState(0);
  const observed = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLDivElement | null) => {
    observed.current?.disconnect();
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    observed.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observed.current.observe(node);
  }, []);

  useEffect(() => () => observed.current?.disconnect(), []);

  const tall = typeof window === 'undefined' ? 600 : window.innerHeight;
  return { ref, width, height: Math.max(160, Math.min(width * 0.75, tall * 0.58)) };
}
