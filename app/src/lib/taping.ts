/**
 * Recording a call to the recorder's own disk, and nowhere else.
 *
 * Named `taping` rather than `recording` because `mesh.ts` already exports a
 * `recording` function for the consent state, and two things one letter apart
 * in the same import list is how somebody eventually calls the wrong one.
 *
 * ## What this module is, and the one thing it is not
 *
 * It is a `MediaRecorder` and a download. **It has no network call of any
 * kind**, and `taping.test.ts` asserts that by reading this file's own source:
 * no `fetch`, no `cloud`, no Supabase, no upload. The rule chosen for this
 * feature was that the file stays on the device of whoever recorded it and
 * Semester never receives it, and the honest way to hold a module to that is
 * to check that it cannot.
 *
 * The consent is **not here**. It lives in `mesh.ts` as a state machine every
 * peer computes for itself, and the call screen will not construct a `Taping`
 * until `mayRecord` is true. That separation is deliberate and is the same one
 * `lib/invite.ts` has from the invite gate: a check that lives beside the
 * thing it guards is a check somebody removes along with it.
 *
 * ## Why `stop` is idempotent and why that matters
 *
 * The recorder is stopped from three places — the person pressing stop,
 * somebody refusing, and somebody new joining the call — and two of those can
 * happen in the same tick. A second `stop()` on a `MediaRecorder` that has
 * already stopped throws `InvalidStateError`, and an exception thrown from a
 * refusal handler is a refusal that did not take effect. So it checks.
 */

/* ── Mixing the call into one stream ────────────────────────────────────── */

/**
 * Where each tile goes, for `n` of them in a `w` by `h` canvas.
 *
 * The smallest square grid that holds them, which is what every call in this
 * app already draws. Pure and exported because it is the only part of the
 * compositing that can be tested without a browser — the drawing itself needs
 * a real canvas and two real peers, and this container has neither.
 */
export function grid(n: number, w: number, h: number): { x: number; y: number; w: number; h: number }[] {
  if (n <= 0) return [];
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = Math.floor(w / cols);
  const ch = Math.floor(h / rows);
  return Array.from({ length: n }, (_, i) => ({
    x: (i % cols) * cw,
    y: Math.floor(i / cols) * ch,
    w: cw,
    h: ch,
  }));
}

/** A composite of the call, and the things that have to be torn down with it. */
export interface Mixed {
  stream: MediaStream;
  stop(): void;
}

/**
 * One stream carrying everybody, made from the call's own streams.
 *
 * Video is composited onto a canvas at 25fps and audio is summed through a
 * `WebAudio` graph. Both are necessary and for different reasons: a
 * `MediaStream` can hold only one video track, and adding several audio tracks
 * to one stream records only the first.
 *
 * **The local audio is deliberately not mixed in.** What this person's own
 * microphone is picking up is already reaching the others, and a recorder that
 * added it would capture the room twice — once from the microphone and once
 * back through the speakers. What it would sound like is an echo nobody in the
 * call heard.
 */
export function mix(
  own: MediaStream,
  theirs: MediaStream[],
  size = { w: 1280, h: 720 },
): Mixed {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const brush = canvas.getContext('2d');

  const videos = [own, ...theirs].map((s) => {
    const v = document.createElement('video');
    v.srcObject = s;
    v.muted = true;
    v.playsInline = true;
    void v.play().catch(() => {});
    return v;
  });

  const draw = () => {
    if (!brush) return;
    brush.fillStyle = '#000';
    brush.fillRect(0, 0, canvas.width, canvas.height);
    const cells = grid(videos.length, canvas.width, canvas.height);
    videos.forEach((v, i) => {
      const c = cells[i];
      if (c && v.videoWidth > 0) brush.drawImage(v, c.x, c.y, c.w, c.h);
    });
  };
  const painting = setInterval(draw, 40);

  const audio = new AudioContext();
  const into = audio.createMediaStreamDestination();
  // Theirs only — see the header on why our own microphone is left out.
  for (const s of theirs) {
    if (s.getAudioTracks().length) audio.createMediaStreamSource(s).connect(into);
  }

  const stream = new MediaStream([
    ...(canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(25).getVideoTracks(),
    ...into.stream.getAudioTracks(),
  ]);

  return {
    stream,
    stop() {
      clearInterval(painting);
      for (const v of videos) v.srcObject = null;
      for (const t of stream.getTracks()) t.stop();
      void audio.close().catch(() => {});
    },
  };
}

/** What a finished recording hands back. */
export interface Tape {
  blob: Blob;
  /** What it would be saved as. Dated, because a call is not a document. */
  name: string;
  /** How long it ran, in milliseconds. */
  ms: number;
}

/** The types to try, best first. Whatever the browser will actually give us. */
const KINDS = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

/**
 * The first type this browser supports, or the empty string.
 *
 * An empty string is a legitimate argument to `MediaRecorder` — it means "you
 * choose" — so a browser that claims to support none of these still records.
 * Returning a type it rejected would not.
 */
export function kind(supported: (type: string) => boolean = (t) => MediaRecorder.isTypeSupported(t)): string {
  return KINDS.find((t) => supported(t)) ?? '';
}

/** The name a file is offered under. */
export function named(at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
  return `Semester call ${stamp}.webm`;
}

export interface Taping {
  /** Stop, and hand back what was captured. Safe to call more than once. */
  stop(): Promise<Tape | null>;
  /** Whether it is still going. */
  running(): boolean;
}

/**
 * Start recording a stream to memory.
 *
 * `start(1000)` so the chunks arrive every second rather than only at the end:
 * a call that crashes the tab after forty minutes should not lose forty
 * minutes, and a recorder that only ever fires `dataavailable` on stop loses
 * exactly that.
 */
export function tape(stream: MediaStream, now: () => Date = () => new Date()): Taping {
  const began = now();
  const type = kind();
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(1000);

  let done: Promise<Tape | null> | null = null;

  return {
    running: () => recorder.state === 'recording',
    stop() {
      // Idempotent, and the header says why: two of the three callers can fire
      // in the same tick, and the second must not throw.
      if (done) return done;
      done = new Promise<Tape | null>((settle) => {
        if (recorder.state === 'inactive') {
          settle(null);
          return;
        }
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: type || 'video/webm' });
          settle(
            blob.size > 0
              ? { blob, name: named(began), ms: now().getTime() - began.getTime() }
              : null,
          );
        };
        recorder.stop();
      });
      return done;
    },
  };
}

/**
 * Hand the file to the person, through the browser's own download.
 *
 * An anchor and an object URL, which is the only route that does not involve a
 * server. The URL is revoked on the next tick rather than immediately —
 * revoking before the browser has started reading it cancels the download in
 * Safari, which looks exactly like the recording having failed.
 */
export function keep(tape: Tape, doc: Document = document): void {
  const url = URL.createObjectURL(tape.blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = tape.name;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
