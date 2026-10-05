/**
 * WebVTT caption tracks for the recordings the app plays, built from the text
 * the recordings were spoken from.
 *
 * Every word in a caption here already existed in this repository with a time
 * attached to it: a podcast episode is `audio/scripts/<stem>.json` (the words)
 * plus `<stem>.lines.json` (the second each line starts and ends, written by
 * `audio/synth.py` or recovered by `pipeline/align-audio.mjs`), and a lesson
 * is the cue list `pipeline/lessons.py` wrote into `lessons.json` as it
 * rendered the narration. Nothing is transcribed and nothing is apportioned
 * by character count — `video/src/captions.ts` has the measurement for why an
 * interpolated caption is worse than none.
 *
 * `scripts/captions.ts` writes the files; `webvtt.test.ts` fails if any
 * recording is missing one, if one has no cues, or if one has drifted from
 * the text it was built from.
 *
 * ## The four without
 *
 * The single-narrator "full read" editions (`UNCAPTIONED` below) have no line
 * times at all: the course data says their chapter marks are "approximate —
 * this recording has no pauses to lock them to". A track for them would have
 * to invent where each sentence falls, so they get none, and the list is
 * exact — the test fails if a recording gains source times and stays on it,
 * or if a new recording is added without either.
 */

export interface Cue {
  start: number;
  end: number;
  text: string;
  /** The speaker, written as a WebVTT voice span. */
  voice?: string;
}

/** `83.5` → `00:01:23.500`. */
export function stamp(seconds: number): string {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

/** Cue text cannot carry a raw `<`, `&` or `-->`; escaping `>` covers the last. */
function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function unescape(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function format(cues: readonly Cue[]): string {
  const body = cues.map((c, n) => {
    const said = escape(c.text.replace(/\s+/g, ' ').trim());
    const text = c.voice ? `<v ${escape(c.voice)}>${said}` : said;
    return `${n + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${text}`;
  });
  return `WEBVTT\n\n${body.join('\n\n')}\n`;
}

function seconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  return parts.reduce((total, p) => total * 60 + p, 0);
}

/**
 * The cues in a WebVTT file. Throws on anything that is not one, so a
 * truncated or hand-mangled file fails loudly rather than parsing as empty.
 */
export function parse(source: string): Cue[] {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!/^WEBVTT(?:[ \t].*)?(?:\n|$)/.test(text)) throw new Error('not a WebVTT file: no WEBVTT header');
  const cues: Cue[] = [];
  for (const block of text.split(/\n{2,}/).slice(1)) {
    const lines = block.split('\n').filter((l) => l !== '');
    if (lines.length === 0 || /^NOTE\b/.test(lines[0])) continue;
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at === -1) throw new Error(`a cue with no timing line: ${JSON.stringify(block.slice(0, 80))}`);
    const m = /^(\d{2,}:)?(\d{2}):(\d{2}\.\d{3})\s+-->\s+(\d{2,}:)?(\d{2}):(\d{2}\.\d{3})/.exec(lines[at]);
    if (!m) throw new Error(`a malformed timing line: ${lines[at]}`);
    const start = seconds(`${m[1] ?? '00:'}${m[2]}:${m[3]}`);
    const end = seconds(`${m[4] ?? '00:'}${m[5]}:${m[6]}`);
    let body = lines.slice(at + 1).join('\n');
    let voice: string | undefined;
    const v = /^<v(?:\.[\w.]+)? ([^>]+)>/.exec(body);
    if (v) {
      voice = unescape(v[1]);
      body = body.slice(v[0].length).replace(/<\/v>$/, '');
    }
    cues.push({ start, end, text: unescape(body), voice });
  }
  return cues;
}

/* ------------------------------------------------------------------------ */
/* The two sources.                                                          */

export interface EpisodeScript {
  id: string;
  lines: { v: string; t: string }[];
}

export interface EpisodeTimes {
  seconds: number;
  lines: { i: number; s: number; e: number }[];
}

const WHO: Record<string, string> = { host: 'Host', expert: 'Expert' };

/** A two-voice episode: one cue per line, at the times the audio has. */
export function episodeCues(script: EpisodeScript, times: EpisodeTimes): Cue[] {
  return times.lines.map((t) => {
    const line = script.lines[t.i];
    if (!line) throw new Error(`${script.id}: line ${t.i} has a time and no words`);
    return { start: t.s, end: t.e, text: line.t, voice: WHO[line.v] ?? line.v };
  });
}

export interface LessonSource {
  seconds: number;
  cues: { at: number; kind: string; text: string }[];
}

/**
 * A lesson: each cue runs until the next begins, the last until the file ends.
 *
 * The lesson screen already draws exactly this — `cueIndexAt` shows a cue
 * from its `at` until the next one's — so the track and the screen agree.
 */
export function lessonCues(lesson: LessonSource): Cue[] {
  const cues = lesson.cues;
  return cues.map((c, n) => {
    const next = cues[n + 1];
    const end = next ? next.at : Math.max(lesson.seconds, c.at + 1);
    return { start: c.at, end: Math.max(end, c.at + 0.001), text: c.text };
  });
}

/* ------------------------------------------------------------------------ */
/* Which recordings have one.                                                */

/**
 * Recordings with no line-level times anywhere in the repository, and so no
 * captions. Each is a single narrator reading a study guide, with chapter
 * marks the course data itself calls approximate.
 */
export const UNCAPTIONED: ReadonlySet<string> = new Set([
  '/audio/econ-guide.mp3',
  '/audio/core-full.mp3',
  '/audio/psci-full.mp3',
  '/audio/psci-condensed.mp3',
]);

/** `/audio/econ-podcast.mp3` → `/audio/econ-podcast.vtt`, or null for one of the four. */
export function captionsFor(src: string): string | null {
  if (UNCAPTIONED.has(src) || !/^\/audio\/.+\.mp3$/.test(src)) return null;
  return src.replace(/\.mp3$/, '.vtt');
}

/** One caption covering a clip's trimmed span, in the source file's own time. */
export function clipCaption(clip: { start: number; end: number; caption: string }): string | null {
  const text = clip.caption.trim();
  if (!text || !(clip.end > clip.start)) return null;
  return format([{ start: clip.start, end: clip.end, text }]);
}
