/**
 * Cameras, peer connections, and the channel the introductions travel on.
 *
 * The half of a call that cannot be tested: it needs a browser with a webcam
 * in it, two of them, on two networks. Everything that *can* be decided
 * without one has been moved out — `lib/mesh.ts` decides who connects to whom
 * and what the messages are, `lib/call.ts` does the arithmetic — so what is
 * left here is plumbing, and it is written to stay plumbing.
 *
 * ## There is no server in the middle
 *
 * Every camera goes straight to every other person. A media server would be
 * better above six people and is a machine somebody rents by the hour, which
 * this project does not have and a student copying it will not have either.
 * The cost is stated on the screen rather than hidden: see `load` in
 * `lib/call.ts`.
 *
 * What *is* needed is a way for two browsers to find each other, and that is
 * two things. STUN tells a browser its own public address; it is a single
 * packet, it is free, and Google runs one. TURN relays the media when the
 * network refuses a direct path — roughly one connection in ten, and rather
 * more on a locked-down campus network — and there is no free one, because
 * relaying video costs bandwidth somebody pays for. So:
 *
 * - With no TURN configured, calls work on most networks and fail on some.
 *   The screen says that, in those words, rather than showing a spinner.
 * - `VITE_TURN_URL`, `VITE_TURN_USER` and `VITE_TURN_PASS` point at one if you
 *   have one. `SETUP.md` says where to get it.
 *
 * ## The signalling channel is Supabase's, not ours
 *
 * The room already has a realtime connection for the classmate rooms — see
 * `lib/classmates.ts` — so the offers ride on a broadcast channel of the same
 * project rather than on a second service. It carries nothing but SDP,
 * candidates and flags; the media never touches it.
 */

import { cloud, cloudConfigured } from './cloud';
import {
  BEAT,
  RESTING,
  addressed,
  greets,
  polite,
  reconcile,
  type Flags,
  type Roster,
  type Signal,
} from './mesh';

const env = import.meta.env as unknown as Record<string, string | undefined>;

/**
 * Where a browser goes to learn its own address, and where it relays when it
 * cannot get a direct one.
 *
 * The STUN default is Google's, which is the one every WebRTC tutorial uses
 * and the one nearly every browser already talks to. It sees that a connection
 * was attempted and nothing else — no media, no identity, no room code.
 */
export function iceServers(): RTCIceServer[] {
  const stun = (env.VITE_STUN_URLS ?? 'stun:stun.l.google.com:19302')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const servers: RTCIceServer[] = [{ urls: stun }];
  const turn = (env.VITE_TURN_URL ?? '').trim();
  if (turn) {
    servers.push({
      urls: turn.split(',').map((s) => s.trim()).filter(Boolean),
      username: env.VITE_TURN_USER ?? '',
      credential: env.VITE_TURN_PASS ?? '',
    });
  }
  return servers;
}

/** Whether a relay is configured, so the screen can say what it is promising. */
export const relayed = Boolean((env.VITE_TURN_URL ?? '').trim());

/** Whether this browser can do any of this at all. */
export function supported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof RTCPeerConnection !== 'undefined'
  );
}

/** Whether this browser can share a screen — phones mostly cannot. */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

/**
 * The cameras and microphones, by name.
 *
 * Labels are empty until permission has been granted once — that is the spec,
 * not a bug, and it is why the green room asks for the camera before it offers
 * the picker.
 */
export async function devices(): Promise<MediaDeviceInfo[]> {
  if (typeof navigator?.mediaDevices?.enumerateDevices !== 'function') return [];
  try {
    return await navigator.mediaDevices.enumerateDevices();
  } catch {
    return [];
  }
}

/** What a person chose in the green room. */
export interface Chosen {
  camera: string;
  mic: string;
}

/**
 * Ask for the camera and microphone.
 *
 * `ideal` rather than `exact` on the device ids: a saved choice for a webcam
 * that is no longer plugged in should get you the built-in one, not an
 * `OverconstrainedError` and a call you cannot join.
 */
export async function open(chosen: Partial<Chosen> = {}): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: chosen.camera ? { ideal: chosen.camera } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: {
      deviceId: chosen.mic ? { ideal: chosen.mic } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

/** The screen, the window or the tab somebody picks. */
export async function share(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
}

/** Every track stopped. The camera light going out is a promise being kept. */
export function shut(stream: MediaStream | null | undefined): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

/**
 * How loud a stream is, sampled on every frame.
 *
 * Root mean square of the waveform, which is the ordinary measure of loudness
 * and the one `talk` in `lib/call.ts` is calibrated against. The interesting
 * part — whether that number means somebody is talking — is not here, because
 * it can be tested and this cannot.
 *
 * Returns the stop. An `AudioContext` left running holds the microphone awake
 * and is one of the two ways a web app drains a battery after you have stopped
 * looking at it.
 */
export function meter(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const Ctx: typeof AudioContext | undefined =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx || stream.getAudioTracks().length === 0) return () => {};

  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  const buffer = new Float32Array(analyser.fftSize);
  let frame = 0;
  let stopped = false;

  const tick = () => {
    if (stopped) return;
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const v of buffer) sum += v * v;
    onLevel(Math.sqrt(sum / buffer.length));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    source.disconnect();
    void ctx.close().catch(() => {});
  };
}

/** What the screen wants to be told about. */
export interface Ears {
  /** Anything said on the channel, already filtered to what is for us. */
  onSignal: (signal: Signal) => void;
  /** A peer's video, or null when it goes away. */
  onStream: (id: string, stream: MediaStream | null) => void;
  /** Something a person should be told, in a sentence. */
  onTrouble: (said: string) => void;
}

/**
 * The channel the introductions travel on.
 *
 * An interface rather than the Supabase channel directly, and it is the one
 * seam in this file that is there for a reason beyond tidiness. Everything
 * hard about a call — perfect negotiation, glare, the order an answer and its
 * candidates arrive in — lives in `Link` below, and none of it has anything to
 * do with Supabase. With the transport named, the whole negotiation can be
 * driven between two peer connections in a single page over a
 * `BroadcastChannel`, which is how it was actually verified rather than
 * assumed. See `app/README.md`.
 */
export interface Wire {
  send: (signal: Signal) => void;
  close: () => void;
}

/** Opens one, and calls back with everything said on it. */
export type Opener = (
  code: string,
  onSignal: (signal: Signal) => void,
  onTrouble: (said: string) => void,
) => Promise<Wire>;

/**
 * The real one: a broadcast channel on the project this build is configured
 * with. It carries SDP, candidates and flags. The media never touches it.
 *
 * It resolves when the channel is actually subscribed, not when the object
 * exists. That distinction is the whole correctness of the first hello: sent
 * a moment early it goes nowhere, and the peer who was already in the call
 * sees an empty gallery until the next heartbeat five seconds later — which
 * reads, exactly once per call, as the app being broken.
 */
export const overCloud: Opener = async (code, onSignal, onTrouble) => {
  if (!cloudConfigured) {
    throw new Error(
      'A call needs the account service: two browsers cannot introduce themselves without something in the middle to carry the introduction.',
    );
  }
  const db = await cloud();
  const channel = db.channel(`call:${code}`, { config: { broadcast: { self: false } } });
  channel.on('broadcast', { event: 'signal' }, ({ payload }) => onSignal(payload as Signal));

  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Once, on the way in, this is the call failing to open; after that
        // it is a call that has lost its channel and can still be rejoined.
        reject(new Error('Could not reach the room. Check the connection and try again.'));
        onTrouble('Lost the connection to the room. Rejoin to try again.');
      }
    });
  });

  return {
    send: (signal) => void channel.send({ type: 'broadcast', event: 'signal', payload: signal }),
    close: () => void db.removeChannel(channel),
  };
};

/** A call this device is in. */
export interface Session {
  /** This tab's id, which is what `lib/mesh.ts` compares. */
  id: string;
  /** Say something to the room. */
  send: (signal: Signal) => void;
  /** Tell the room what you have muted, raised or started sharing. */
  announce: (flags: Flags) => void;
  /** Put a different video track on every connection — screen share, or back. */
  present: (track: MediaStreamTrack | null) => Promise<void>;
  /**
   * Hold a connection to exactly these peers, and to nobody else.
   *
   * The screen owns the roster — it is what it is drawing — so it is also
   * what decides which connections should exist. Called after every change
   * to it, including the one no message announces: a peer dropped for going
   * quiet. Without this, a laptop whose lid closed leaves a peer connection
   * open at both ends for the rest of the call.
   */
  keep: (them: Roster) => void;
  /** Say goodbye, close every connection, stop every timer. */
  leave: () => void;
}

/** A short id for this tab. Not a person, not an account — see `lib/mesh.ts`. */
function tabId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One connection to one other tab.
 *
 * The negotiation is the "perfect negotiation" pattern from the WebRTC spec,
 * with the roles decided by `polite` in `lib/mesh.ts` rather than by who
 * happened to press Join first. The whole of the difficulty is the four lines
 * around `collision`: two offers crossing has to end with one of them thrown
 * away, by the same side, both times.
 */
class Link {
  readonly pc: RTCPeerConnection;
  readonly them: string;
  private readonly me: string;
  private readonly local: MediaStream;
  private readonly wire: (signal: Signal) => void;
  private readonly ears: Ears;
  private offering = false;
  private ignoring = false;

  constructor(
    them: string,
    me: string,
    local: MediaStream,
    wire: (signal: Signal) => void,
    ears: Ears,
  ) {
    this.them = them;
    this.me = me;
    this.local = local;
    this.wire = wire;
    this.ears = ears;
    this.pc = new RTCPeerConnection({ iceServers: iceServers() });

    for (const track of local.getTracks()) this.pc.addTrack(track, local);

    this.pc.onnegotiationneeded = () => {
      void (async () => {
        try {
          this.offering = true;
          await this.pc.setLocalDescription();
          const sdp = JSON.stringify(this.pc.localDescription);
          this.wire({ t: 'offer', from: this.me, to: this.them, sdp });
        } catch {
          // A failed offer is not fatal: the state change below notices a
          // connection that never came up and restarts it.
        } finally {
          this.offering = false;
        }
      })();
    };

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.wire({ t: 'ice', from: this.me, to: this.them, candidate: candidate.toJSON() });
      }
    };

    this.pc.ontrack = ({ streams }) => {
      if (streams[0]) this.ears.onStream(this.them, streams[0]);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed') {
        // One attempt at a fresh set of candidates. Beyond that it is a
        // network that will not carry this call, and saying so beats a tile
        // that stays black for ever.
        this.pc.restartIce();
        this.ears.onTrouble(
          relayed
            ? 'Lost the connection to somebody in the call. Trying again.'
            : 'Could not reach somebody directly. This network probably needs a relay — see SETUP.md.',
        );
      }
    };
  }

  /** An offer or an answer from the other end. */
  async described(sdp: string): Promise<void> {
    const description = JSON.parse(sdp) as RTCSessionDescriptionInit;
    const collision =
      description.type === 'offer' && (this.offering || this.pc.signalingState !== 'stable');
    this.ignoring = !polite(this.me, this.them) && collision;
    if (this.ignoring) return;
    await this.pc.setRemoteDescription(description);
    if (description.type === 'offer') {
      await this.pc.setLocalDescription();
      this.wire({
        t: 'answer',
        from: this.me,
        to: this.them,
        sdp: JSON.stringify(this.pc.localDescription),
      });
    }
  }

  async candidate(candidate: unknown): Promise<void> {
    try {
      await this.pc.addIceCandidate(candidate as RTCIceCandidateInit);
    } catch (e) {
      // A candidate arriving for an offer we deliberately threw away is
      // expected, and the only one that may be swallowed.
      if (!this.ignoring) throw e;
    }
  }

  /** Swap what this connection is sending — the screen, or the camera back. */
  async present(track: MediaStreamTrack | null): Promise<void> {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (!sender) return;
    await sender.replaceTrack(track ?? this.local.getVideoTracks()[0] ?? null);
  }

  close(): void {
    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.close();
    this.ears.onStream(this.them, null);
  }
}

/**
 * Join a call.
 *
 * Opens the channel, says hello, and from then on keeps one `Link` per peer in
 * step with the roster the caller is maintaining out of the signals. The
 * caller drives that — `reconcile` in `lib/mesh.ts` is the one deciding which
 * connections should exist — because the roster is what the screen is drawing
 * anyway and two copies of it would drift.
 */
export async function join(
  code: string,
  local: MediaStream,
  flags: Flags,
  ears: Ears,
  opener: Opener = overCloud,
): Promise<Session> {
  const me = tabId();
  const links = new Map<string, Link>();
  let current: Flags = { ...RESTING, ...flags };
  let presenting: MediaStreamTrack | null = null;
  let closed = false;
  let channel: Wire | null = null;

  const wire = (signal: Signal) => {
    if (closed) return;
    channel?.send(signal);
  };

  const linkTo = (them: string): Link => {
    const had = links.get(them);
    if (had) return had;
    const link = new Link(them, me, local, wire, ears);
    links.set(them, link);
    if (presenting) void link.present(presenting);
    return link;
  };

  const arrived = (signal: Signal) => {
    if (!signal || typeof signal.t !== 'string' || !addressed(signal, me)) return;

    // The roster, the chat and the tiles are the caller's; this only has to
    // keep the connections true to what it is told.
    ears.onSignal(signal);

    switch (signal.t) {
      case 'here': {
        /*
         * Somebody arriving hears our hello and we hear theirs, so both ends
         * reach this line and both open a connection to the other. The
         * duplicate is not a duplicate: `linkTo` is idempotent per peer, and
         * which of the two crossing offers survives is `polite`'s answer.
         *
         * The reply is the part that is not obvious, and it was found by
         * driving two peers at each other rather than by reading this. The
         * hello is sent *once, on arrival*, so the person already in the call
         * hears the newcomer and the newcomer hears nobody: their video
         * arrives — `ontrack` does not wait for a roster — over a tile with
         * no name on it, for the five seconds until the next heartbeat. So a
         * hello from somebody new is answered with our own, which is how they
         * learn our name, our mute state and our hand in the same instant we
         * learn theirs.
         *
         * It terminates, and that is worth saying out loud for a rule that
         * makes a message send a message: the reply goes out only for a peer
         * we had no link to, and answering has just made one. The newcomer
         * replies to our reply — we are new to *them* — and we do not reply
         * again. Two extra messages per arrival, once.
         */
        const answer = greets(signal, [...links.keys()]);
        linkTo(signal.from);
        if (answer) wire({ t: 'here', from: me, at: Date.now(), flags: current });
        break;
      }
      case 'gone':
        links.get(signal.from)?.close();
        links.delete(signal.from);
        break;
      case 'offer':
      case 'answer':
        void linkTo(signal.from)
          .described(signal.sdp)
          .catch(() => ears.onTrouble('Could not agree a connection with somebody in the call.'));
        break;
      case 'ice':
        void linkTo(signal.from).candidate(signal.candidate).catch(() => {});
        break;
      default:
        break;
    }
  };

  channel = await opener(code, arrived, ears.onTrouble);
  // Said once the channel is up, never before: a hello sent into a channel
  // that has not finished subscribing is a hello nobody in the call hears,
  // and the peer sits there with an empty gallery until the next heartbeat.
  wire({ t: 'here', from: me, at: Date.now(), flags: current });

  // The heartbeat. `lib/mesh.ts` explains what it is for: most calls end with
  // a lid closing rather than with a goodbye.
  const beat = setInterval(() => wire({ t: 'here', from: me, at: Date.now(), flags: current }), BEAT);

  return {
    id: me,
    send: wire,
    announce(next: Flags) {
      current = next;
      wire({ t: 'state', from: me, flags: next });
    },
    keep(them: Roster) {
      const { start, stop } = reconcile(them, [...links.keys()]);
      for (const id of start) linkTo(id);
      for (const id of stop) {
        links.get(id)?.close();
        links.delete(id);
      }
    },
    async present(track: MediaStreamTrack | null) {
      presenting = track;
      await Promise.all([...links.values()].map((l) => l.present(track)));
    },
    leave() {
      if (closed) return;
      closed = true;
      clearInterval(beat);
      // Said before the channel goes, so everybody else's tile disappears now
      // rather than when the heartbeat runs out twenty seconds from now.
      channel?.send({ t: 'gone', from: me });
      for (const link of links.values()) link.close();
      links.clear();
      channel?.close();
    },
  };
}
