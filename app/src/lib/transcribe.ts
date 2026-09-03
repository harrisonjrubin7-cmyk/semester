/**
 * Turning a lecture into text.
 *
 * The honest situation, because it decides the whole design: a browser will
 * transcribe speech it is hearing right now, and it will not transcribe a file
 * you already have. There is no offline recogniser sitting in Chrome that you
 * can hand an hour of audio to. So there are two routes and they are not the
 * same feature.
 *
 * **As it happens.** The recogniser runs alongside the recorder, and you get a
 * running transcript with timestamps while the lecture is still going. This is
 * free, needs no account, and is what almost everyone actually wants. Its
 * limits are real and the screen states them: Chrome and Safari have it and
 * Firefox does not, it mishears technical vocabulary, it has no idea who is
 * speaking, and in Chrome the recognition happens on Google's servers rather
 * than on the device.
 *
 * **Afterwards.** A file you already recorded has to be sent somewhere. That
 * needs a key and it needs saying out loud, so it is opt-in, it names the
 * service, and it never happens on its own.
 *
 * The restart loop is the part that matters. Left alone, the browser's
 * recogniser stops after a stretch of silence — a professor pausing to write
 * on a board is enough — and a naive implementation goes quiet twenty minutes
 * into a fifty-minute class without ever saying so. This one starts it again
 * every time it ends, until you stop it.
 */

export interface Segment {
  /** Seconds from the start of the recording. */
  at: number;
  text: string;
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface ResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

function recogniser(): RecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => RecognitionLike)
    | undefined;
  return Ctor ? new Ctor() : null;
}

export function liveSupported(): boolean {
  return recogniser() !== null;
}

/** "12:04" — where in the recording a line was said. */
export function stamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(rest).padStart(2, '0')}`;
}

/**
 * The transcript as text.
 *
 * With timestamps it is something you scrub a recording against; without them
 * it is something you paste into a note or hand to Claude. Both are wanted, so
 * neither is the only option.
 */
export function asText(segments: Segment[], timestamps = true): string {
  return segments
    .map((s) => (timestamps ? `[${stamp(s.at)}] ${s.text}` : s.text))
    .join(timestamps ? '\n' : ' ')
    .trim();
}

export function words(segments: Segment[]): number {
  const all = segments.map((s) => s.text).join(' ').trim();
  return all ? all.split(/\s+/).length : 0;
}

/**
 * Group loose segments into paragraphs.
 *
 * The recogniser finalises in bursts of a few seconds, which makes a wall of
 * forty one-line entries out of what was one thought. Anything within `gap`
 * seconds of the line before it joins that line, so the shape on the page is
 * roughly the shape of the speaking.
 */
export function paragraphs(segments: Segment[], gap = 12): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && s.at - lastEnd(last) <= gap) {
      last.text = `${last.text} ${s.text}`.trim();
    } else {
      out.push({ at: s.at, text: s.text });
    }
  }
  return out;
}

/** Rough end of a segment, at a speaking rate of about 150 words a minute. */
function lastEnd(s: Segment): number {
  const n = s.text.trim() ? s.text.trim().split(/\s+/).length : 0;
  return s.at + (n / 150) * 60;
}

export type ScribeError =
  | 'unsupported'
  | 'not-allowed'
  | 'network'
  | 'audio'
  | 'other';

export function explainScribeError(kind: ScribeError): string {
  switch (kind) {
    case 'unsupported':
      return 'This browser has no speech recognition. Chrome and Safari do; Firefox does not. The recording itself still works.';
    case 'not-allowed':
      return 'The microphone was refused. Turn it back on for this site in the browser’s settings.';
    case 'network':
      return 'Recognition needs the network and lost it. The recording carries on regardless — the audio is safe.';
    case 'audio':
      return 'The microphone stopped giving audio. Check nothing else has taken it.';
    default:
      return 'Recognition stopped. The recording carries on — the audio is safe.';
  }
}

/**
 * A recogniser that keeps going.
 *
 * Deliberately mirrors {@link Recorder}: start, stop, and it owns nothing about
 * the screen. `onChange` fires with everything settled so far plus whatever is
 * being said right now, so a screen can show the sentence forming.
 */
export class Scribe {
  private rec: RecognitionLike | null = null;
  private wanted = false;
  private startedAt = 0;
  private segments: Segment[] = [];

  private onChange: (segments: Segment[], interim: string) => void;
  private onError: (kind: ScribeError) => void;

  constructor(
    onChange: (segments: Segment[], interim: string) => void,
    onError: (kind: ScribeError) => void,
  ) {
    this.onChange = onChange;
    this.onError = onError;
  }

  get running(): boolean {
    return this.wanted;
  }

  start(startedAt = Date.now()): boolean {
    const rec = recogniser();
    if (!rec) {
      this.onError('unsupported');
      return false;
    }
    this.rec = rec;
    this.wanted = true;
    this.startedAt = startedAt;
    this.segments = [];

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = (result[0]?.transcript ?? '').trim();
        if (!text) continue;
        if (result.isFinal) {
          this.segments.push({ at: (Date.now() - this.startedAt) / 1000, text });
        } else {
          interim += `${text} `;
        }
      }
      this.onChange([...this.segments], interim.trim());
    };

    rec.onerror = (e) => {
      const code = e.error ?? '';
      // Silence is not a failure. A professor writing on a board for thirty
      // seconds trips this, and the restart in onend handles it.
      if (code === 'no-speech' || code === 'aborted') return;
      this.onError(
        code === 'not-allowed' || code === 'service-not-allowed'
          ? 'not-allowed'
          : code === 'network'
            ? 'network'
            : code === 'audio-capture'
              ? 'audio'
              : 'other',
      );
      if (code === 'not-allowed' || code === 'service-not-allowed') this.wanted = false;
    };

    // The whole point. The recogniser gives up on its own; we do not.
    rec.onend = () => {
      if (!this.wanted) return;
      try {
        rec.start();
      } catch {
        // Already starting. The next onend will try again.
      }
    };

    try {
      rec.start();
      return true;
    } catch {
      this.wanted = false;
      this.onError('other');
      return false;
    }
  }

  stop(): Segment[] {
    this.wanted = false;
    try {
      this.rec?.stop();
    } catch {
      /* it was not running */
    }
    this.rec = null;
    return [...this.segments];
  }
}
