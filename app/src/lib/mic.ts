/**
 * The microphone, for two different jobs.
 *
 * **Recording a lecture** captures audio and hands back a file. That is all it
 * does, and the limit is worth stating: a browser cannot transcribe an hour of
 * recorded audio on its own, so what you get is a recording you can play back
 * and attach to a course, not a transcript. Anything claiming otherwise would
 * be sending an hour of a professor's voice somewhere.
 *
 * **Dictating a note** is the opposite shape — live speech, transcribed as you
 * talk, by the browser's own recogniser. That is a real feature in Chrome and
 * Safari and absent in Firefox, and the screen says which you have rather than
 * showing a button that does nothing.
 *
 * Both ask for the same permission, and the app asks for it at the moment you
 * press record, never on load.
 */

export type MicState = 'idle' | 'recording' | 'paused';

export interface Recording {
  blob: Blob;
  /** Seconds, measured rather than estimated. */
  seconds: number;
  /** The container the browser actually gave us — webm on Chrome, mp4 on iOS. */
  mime: string;
}

/** Codecs in the order we would like them, which is not the order we get them. */
const WANTED = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

export function micSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

function bestMime(): string {
  for (const m of WANTED) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

/**
 * A recorder you start and stop.
 *
 * Deliberately a small object rather than a hook: the same thing is used from a
 * screen that records a lecture and from one that records a voice memo on a
 * note, and neither should own the lifetime of a MediaStream.
 */
export class Recorder {
  private rec: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private accumulated = 0;

  state: MicState = 'idle';

  async start(): Promise<void> {
    if (!micSupported()) {
      throw new Error(
        'This browser will not give the app a microphone. Safari and Chrome both will; a page ' +
          'served over plain http never does, which is why this needs https.',
      );
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new Error(explainMicError(e));
    }
    const mime = bestMime();
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    // A timeslice means a crash or a closed tab loses seconds rather than the
    // whole lecture — the chunks already collected are still a valid file.
    this.rec.start(5000);
    this.startedAt = Date.now();
    this.accumulated = 0;
    this.state = 'recording';
  }

  pause(): void {
    if (this.state !== 'recording' || !this.rec) return;
    this.rec.pause();
    this.accumulated += Date.now() - this.startedAt;
    this.state = 'paused';
  }

  resume(): void {
    if (this.state !== 'paused' || !this.rec) return;
    this.rec.resume();
    this.startedAt = Date.now();
    this.state = 'recording';
  }

  /** Seconds so far, live — for the counter on screen. */
  elapsed(): number {
    const running = this.state === 'recording' ? Date.now() - this.startedAt : 0;
    return Math.round((this.accumulated + running) / 1000);
  }

  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      const rec = this.rec;
      if (!rec) {
        reject(new Error('Nothing was recording.'));
        return;
      }
      const seconds = this.elapsed();
      rec.onstop = () => {
        const mime = rec.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mime });
        this.release();
        resolve({ blob, seconds, mime });
      };
      rec.stop();
    });
  }

  /** Give the microphone back. The browser's recording indicator stays on otherwise. */
  release(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.rec = null;
    this.state = 'idle';
  }
}

export function explainMicError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError') {
    return (
      'The microphone was refused. The app cannot ask twice — turn it back on in the browser’s ' +
      'settings for this site, then try again.'
    );
  }
  if (name === 'NotFoundError') return 'No microphone on this device.';
  if (name === 'NotReadableError') {
    return 'Something else is using the microphone. Close it and try again.';
  }
  return e instanceof Error ? e.message : String(e);
}

/** "1:04:22" for an hour of lecture, "4:31" for a memo. */
export function clockOf(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** A sensible filename, since these end up in a list beside uploaded PDFs. */
export function recordingName(label: string, at = new Date()): string {
  const stamp = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(
    at.getDate(),
  ).padStart(2, '0')}`;
  const clean = label.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 40);
  return `${clean || 'recording'}-${stamp}`;
}

// ── Dictation ─────────────────────────────────────────────────────────────

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

function recogniser(): SpeechRecognitionLike | null {
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => SpeechRecognitionLike)
    | undefined;
  return Ctor ? new Ctor() : null;
}

export function dictationSupported(): boolean {
  return recogniser() !== null;
}

/**
 * Speech to text, while you talk.
 *
 * `onText` receives the transcript so far — finalised words plus whatever the
 * recogniser currently thinks you are saying — so a screen can show the
 * sentence forming rather than nothing until you stop.
 *
 * Returns a stop function. Nothing is uploaded by the app; where the audio goes
 * to be recognised is the browser's business and differs between them, which is
 * worth knowing and is said on the screen.
 */
export function dictate(
  onText: (text: string, final: boolean) => void,
  onError: (message: string) => void,
): () => void {
  const rec = recogniser();
  if (!rec) {
    onError('This browser has no speech recognition. Chrome and Safari do; Firefox does not.');
    return () => {};
  }

  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = navigator.language || 'en-US';

  let settled = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) settled += text;
      else interim += text;
    }
    onText((settled + interim).trimStart(), interim === '');
  };
  rec.onerror = (e) => {
    onError(
      e.error === 'not-allowed'
        ? 'The microphone was refused. Turn it back on for this site in the browser’s settings.'
        : e.error === 'no-speech'
          ? 'Nothing was heard.'
          : `Dictation stopped: ${e.error ?? 'unknown'}.`,
    );
  };

  try {
    rec.start();
  } catch {
    onError('Dictation would not start. It may already be running in another tab.');
  }

  return () => {
    rec.onresult = null;
    rec.onerror = null;
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}
