import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { Page } from '../../components/Page';
import { Blueprint } from '../../components/Blueprint';
import { ActionButton, SectionLabel } from '../../components/ui';
import { CallIcon, CamOffIcon, MicIcon, MicOffIcon } from '../../components/Icons';
import { secondLine } from '../../lib/dim';
import { named } from '../../lib/profile';
import { LOUD, SILENT, talk, type Talk } from '../../lib/call';
import { cloudConfigured } from '../../lib/cloud';
import { devices, meter, open, relayed, shut, supported, type Chosen } from '../../lib/rtc';
import { shareLink, copy } from './link';

/**
 * The green room: see yourself, hear yourself, then arrive.
 *
 * This is Google Meet's one genuinely great idea and it is worth copying
 * exactly. The alternative — the way every call app worked for a decade — is
 * that you join, and *then* find out that the camera is the wrong one, that
 * you are muted, that the microphone is the laptop's rather than the headset's.
 * Every one of those is discovered in front of the people you are meeting,
 * which is the worst possible moment, and fixing it takes the first ninety
 * seconds of the call.
 *
 * So nothing here is in the call yet. The camera is on, the level meter moves
 * when you talk, both pickers work, and the two toggles decide the state you
 * walk in with. Pressing Join is the first thing anybody else sees.
 */
export function Green({
  code,
  title,
  onJoin,
  onBack,
}: {
  code: string;
  title: string;
  onJoin: (stream: MediaStream, flags: { muted: boolean; camera: boolean }, name: string) => void;
  onBack: () => void;
}) {
  const { account, state } = useStore();
  const video = useRef<HTMLVideoElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [trouble, setTrouble] = useState('');
  const [kit, setKit] = useState<MediaDeviceInfo[]>([]);
  const [chosen, setChosen] = useState<Chosen>({ camera: '', mic: '' });
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState<Talk>(SILENT);
  const [copied, setCopied] = useState(false);
  /*
   * The name you already told the app, not a fourth place to type one.
   *
   * `myName` is set on the profile screen and is the app's one answer to
   * "what are you called" — see `screens/Profile.tsx`. Editable here because
   * a call is the one place the answer might reasonably differ, and because
   * an account that has never opened the profile still has to arrive as
   * somebody rather than as a blank tile.
   */
  const [name, setName] = useState(
    () => (named(state.myName) ? state.myName.trim() : '') || account?.email?.split('@')[0] || 'Me',
  );

  /*
   * The camera, opened once and reopened when somebody picks a different one.
   *
   * The old stream is stopped before the new one is asked for. Two open
   * streams on one webcam is a device-busy error on Windows and a second
   * camera light on a Mac, and the second light is the part people write in
   * about.
   */
  const start = useCallback(async (want: Chosen) => {
    setTrouble('');
    try {
      const got = await open(want);
      setStream((was) => {
        shut(was);
        return got;
      });
      // Labels arrive only once permission has been granted, which is why the
      // pickers are populated here rather than on mount.
      setKit(await devices());
    } catch (e) {
      setStream((was) => {
        shut(was);
        return null;
      });
      setTrouble(
        e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
          ? 'The browser refused the camera and microphone. Allow them for this site and try again — on iOS that is Settings → Safari → Camera.'
          : e instanceof DOMException && e.name === 'NotFoundError'
            ? 'No camera or microphone on this device. You can still join to listen.'
            : e instanceof Error
              ? e.message
              : String(e),
      );
    }
  }, []);

  useEffect(() => {
    if (!supported()) return;
    void start(chosen);
  }, [start, chosen]);

  // The preview never plays its own sound. A green room that echoes is a
  // green room nobody can hear themselves think in.
  useEffect(() => {
    if (video.current) video.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    for (const track of stream?.getAudioTracks() ?? []) track.enabled = !muted;
  }, [stream, muted]);

  useEffect(() => {
    for (const track of stream?.getVideoTracks() ?? []) track.enabled = camera;
  }, [stream, camera]);

  useEffect(() => {
    if (!stream || muted) {
      setLevel(0);
      return;
    }
    return meter(stream, (loud) => {
      setLevel(loud);
      setHeard((was) => talk(was, loud, Date.now()));
    });
  }, [stream, muted]);

  /*
   * Whatever is still open when this unmounts, closed.
   *
   * Separate from the effect that opens it, and keyed on nothing, because it
   * must run exactly once — at unmount. The joining path deliberately does
   * *not* stop the stream: it is handed to the call, which goes on using it.
   */
  const carried = useRef(false);
  const held = useRef<MediaStream | null>(null);
  held.current = stream;
  useEffect(
    () => () => {
      if (!carried.current) shut(held.current);
    },
    [],
  );

  const cameras = kit.filter((d) => d.kind === 'videoinput');
  const mics = kit.filter((d) => d.kind === 'audioinput');

  return (
    <Page blurb={title || 'Check the camera and the microphone, then join.'} bottom={26}>
      <Blueprint style={{ padding: 0, overflow: 'hidden', background: '#000' }}>
        <div style={{ position: 'relative', aspectRatio: '16 / 9', width: '100%' }}>
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            aria-label="What your camera is showing"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              // Mirrored, like every green room: you are looking at yourself,
              // not at what the call sees, and an unmirrored self-view makes
              // people feel they are moving the wrong way.
              transform: 'scaleX(-1)',
              display: stream && camera ? 'block' : 'none',
            }}
          />
          {(!stream || !camera) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontSize: 'var(--type-md)',
              }}
            >
              {camera ? 'No camera' : 'Camera off'}
            </div>
          )}
          {heard.speaking && !muted && (
            <div
              aria-hidden="true"
              style={{ position: 'absolute', inset: 0, border: '2px solid var(--app-accent)' }}
            />
          )}
        </div>
      </Blueprint>

      <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <Toggle
          on={!muted}
          onLabel="Microphone on"
          offLabel="Microphone off"
          icon={muted ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
          onClick={() => setMuted((m) => !m)}
        />
        <Toggle
          on={camera}
          onLabel="Camera on"
          offLabel="Camera off"
          icon={camera ? <CallIcon size={18} /> : <CamOffIcon size={18} />}
          onClick={() => setCamera((c) => !c)}
        />
      </div>

      <div
        aria-hidden="true"
        style={{ height: 4, background: 'var(--app-line)', marginTop: 'var(--sp-5)' }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.round((level / (LOUD * 3)) * 100))}%`,
            background: 'var(--app-accent)',
            transition: 'width 90ms linear',
          }}
        />
      </div>
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)' }}>
        {muted
          ? 'Muted. Nobody will hear you until you turn it back on.'
          : heard.speaking
            ? 'That is what the call will hear.'
            : 'Say something — the bar should move.'}
      </div>

      {trouble ? (
        <div
          role="alert"
          style={{
            fontSize: 'var(--type-sm)',
            color: 'var(--app-warn)',
            marginTop: 'var(--sp-5)',
            lineHeight: 'var(--leading-normal)',
          }}
        >
          {trouble}
        </div>
      ) : null}

      <SectionLabel>What they will call you</SectionLabel>
      <input
        aria-label="What the call shows as your name"
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Me"
        style={{ width: '100%' }}
      />

      {cameras.length > 1 || mics.length > 1 ? (
        <>
          <SectionLabel>Which camera, which microphone</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {cameras.length > 1 && (
              <select
                aria-label="Which camera"
                className="input"
                value={chosen.camera}
                onChange={(e) => setChosen((c) => ({ ...c, camera: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">Whichever the browser picks</option>
                {cameras.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
            {mics.length > 1 && (
              <select
                aria-label="Which microphone"
                className="input"
                value={chosen.mic}
                onChange={(e) => setChosen((c) => ({ ...c, mic: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">Whichever the browser picks</option>
                {mics.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </>
      ) : null}

      {/*
        Joinable without the account service, deliberately.

        The call will have nobody else in it — `join` in `lib/rtc.ts` refuses,
        and the stage says so in a sentence. That is still worth being able to
        reach: it is how somebody checks their camera, their microphone and
        their screen share on a build that has no project configured, and a
        dead button with an explanation beside it teaches nobody anything.
      */}
      <ActionButton
        tone="primary"
        disabled={!stream}
        onClick={() => {
          if (!stream) return;
          carried.current = true;
          onJoin(stream, { muted, camera }, name.trim() || 'Me');
        }}
        style={{ marginTop: 'var(--sp-7)' }}
      >
        Join the call
      </ActionButton>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => {
          void copy(shareLink(code)).then(setCopied);
        }}
        style={{ height: 42, marginTop: 'var(--sp-5)' }}
      >
        {copied ? 'Link copied' : 'Copy the link first'}
      </button>

      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        The code is {code}.{' '}
        {cloudConfigured
          ? relayed
            ? 'A relay is configured, so this should hold up on a network that refuses direct connections.'
            : 'No relay is configured: on a network that refuses direct connections — some campus ones do — the call will not connect, and it will say so rather than spin.'
          : 'This build has no account service, so nobody else can join. Everything above still works, which is most of what a green room is for.'}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={onBack}
        style={{ height: 42, marginTop: 'var(--sp-6)' }}
      >
        Back
      </button>
    </Page>
  );
}

/** One of the two round toggles under the preview. */
function Toggle({
  on,
  onLabel,
  offLabel,
  icon,
  onClick,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary"
      aria-pressed={on}
      aria-label={on ? onLabel : offLabel}
      onClick={onClick}
      style={{
        flex: 1,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-4)',
        fontSize: 'var(--type-sm)',
        color: on ? undefined : 'var(--app-warn)',
      }}
    >
      {icon}
      {on ? onLabel : offLabel}
    </button>
  );
}
