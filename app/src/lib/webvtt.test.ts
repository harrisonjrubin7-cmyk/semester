/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  UNCAPTIONED,
  captionsFor,
  clipCaption,
  episodeCues,
  format,
  lessonCues,
  parse,
  stamp,
  type EpisodeScript,
  type EpisodeTimes,
  type LessonSource,
} from './webvtt';

/**
 * Every recording the app plays has a caption track with the words in it, and
 * every media element the app draws either carries one or has nothing to say.
 *
 * The audit finding this guards was two `<track kind="captions" />` elements
 * with no `src` — one on the app's only `<audio>`, one on a silent camera
 * preview — and no WebVTT file anywhere in the repository. An empty track is
 * worse than none: it tells assistive technology captions exist.
 */

const SRC = fileURLToPath(new URL('..', import.meta.url));
const APP = join(SRC, '..');
const PUBLIC = join(APP, 'public');
const SCRIPTS = join(APP, '..', 'audio', 'scripts');

function walk(dir: string, match: RegExp, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const at = join(dir, entry);
    if (statSync(at).isDirectory()) walk(at, match, found);
    else if (match.test(entry)) found.push(at);
  }
  return found;
}

/** `public/audio/econ-podcast.mp3` → `/audio/econ-podcast.mp3`, as the app names it. */
const served = (path: string) => `/${relative(PUBLIC, path).split('\\').join('/')}`;

const recordings = walk(join(PUBLIC, 'audio'), /\.(mp3|mp4|webm)$/).map(served).sort();
const made = (JSON.parse(readFileSync(join(APP, '..', 'audio', 'manifest.json'), 'utf8')) as {
  made: Record<string, { seconds: number }>;
}).made;

/** The recording's length as the pipeline measured it when it rendered it. */
function lengthOf(src: string): number {
  const key = src.replace(/^\/audio\/(lessons\/)?/, '').replace(/\.\w+$/, '');
  const entry = made[key];
  if (!entry) throw new Error(`${src}: not in audio/manifest.json, so its length is unknown`);
  return entry.seconds;
}

describe('the format', () => {
  it('writes timestamps WebVTT can read, past the hour', () => {
    expect(stamp(0)).toBe('00:00:00.000');
    expect(stamp(83.5)).toBe('00:01:23.500');
    expect(stamp(2103.456)).toBe('00:35:03.456');
    expect(stamp(3723.0004)).toBe('01:02:03.000');
  });

  it('reads back what it writes, voice and awkward characters included', () => {
    const cues = [
      { start: 0, end: 4.2, text: 'P < MC & MR > 0 --> profit', voice: 'Host' },
      { start: 4.75, end: 9, text: 'Plain.' },
    ];
    expect(parse(format(cues))).toEqual([cues[0], { ...cues[1], voice: undefined }]);
  });

  it('refuses a file that is not WebVTT, rather than reading it as empty', () => {
    expect(() => parse('')).toThrow(/WEBVTT/);
    expect(() => parse('1\n00:00:00.000 --> 00:00:01.000\nhi\n')).toThrow(/WEBVTT/);
    expect(() => parse('WEBVTT\n\n1\n00:00 -> 00:01\nhi\n')).toThrow();
  });

  it('a header alone parses to no cues — which the checks below then reject', () => {
    expect(parse('WEBVTT\n')).toEqual([]);
  });
});

describe('every recording the app ships', () => {
  it('found the recordings — an empty walk would pass everything below', () => {
    // 4 podcasts + 4 single-narrator reads + 44 lessons, when this was written.
    expect(recordings.length).toBeGreaterThanOrEqual(52);
  });

  it('has a caption file beside it, unless it is one of the four with no line times', () => {
    const missing = recordings.filter(
      (src) => !UNCAPTIONED.has(src) && !existsSync(join(PUBLIC, src.replace(/\.\w+$/, '.vtt'))),
    );
    expect(missing).toEqual([]);
  });

  it('the uncaptioned list is exact: each exists, has no track and no timed source', () => {
    for (const src of UNCAPTIONED) {
      expect(recordings, src).toContain(src);
      expect(existsSync(join(PUBLIC, src.replace(/\.mp3$/, '.vtt'))), `${src} has a .vtt now — take it off the list`).toBe(false);
      const key = src.replace(/^\/audio\//, '').replace(/\.mp3$/, '');
      expect(made[key], `${src} was rendered by the pipeline, so it has times`).toBeUndefined();
      expect(captionsFor(src)).toBeNull();
    }
  });

  for (const src of recordings.filter((s) => !UNCAPTIONED.has(s))) {
    it(`${src}: cues from the start to the end of the recording, in order`, () => {
      const cues = parse(readFileSync(join(PUBLIC, src.replace(/\.\w+$/, '.vtt')), 'utf8'));
      expect(cues.length).toBeGreaterThan(0);
      for (const c of cues) {
        expect(c.text.trim(), `an empty cue at ${c.start}`).not.toBe('');
        expect(c.end).toBeGreaterThan(c.start);
      }
      for (let n = 1; n < cues.length; n++) {
        expect(cues[n].start, `cue ${n + 1} starts before cue ${n}`).toBeGreaterThanOrEqual(cues[n - 1].start);
        // The longest silence either format leaves is the self-test pause:
        // seven seconds to answer out loud, plus the turn gaps either side.
        expect(cues[n].start - cues[n - 1].end, `a ${(cues[n].start - cues[n - 1].end).toFixed(1)}s hole before cue ${n + 1}`).toBeLessThanOrEqual(10);
      }
      const length = lengthOf(src);
      expect(cues[0].start).toBeLessThanOrEqual(1);
      expect(cues[cues.length - 1].end).toBeGreaterThanOrEqual(length - 2);
      expect(cues[cues.length - 1].end).toBeLessThanOrEqual(length + 2);
    });
  }
});

describe('the words are the words the recording was made from', () => {
  const episodes = readdirSync(SCRIPTS).filter((f) => /^[^.]+\.json$/.test(f));

  it('found the four episode scripts', () => {
    expect(episodes.length).toBeGreaterThanOrEqual(4);
  });

  for (const file of episodes) {
    it(`${file}: every line, once, in order, with who says it — and the file is current`, () => {
      const script = JSON.parse(readFileSync(join(SCRIPTS, file), 'utf8')) as EpisodeScript;
      const times = JSON.parse(readFileSync(join(SCRIPTS, file.replace('.json', '.lines.json')), 'utf8')) as EpisodeTimes;
      const on = readFileSync(join(PUBLIC, 'audio', `${script.id}.vtt`), 'utf8');
      const cues = parse(on);
      expect(cues.map((c) => c.text)).toEqual(script.lines.map((l) => l.t.replace(/\s+/g, ' ').trim()));
      expect(new Set(cues.map((c) => c.voice))).toEqual(new Set(['Host', 'Expert']));
      expect(on, 'stale — run `npm run captions` in app/').toBe(format(episodeCues(script, times)));
    });
  }

  const courses = readdirSync(join(PUBLIC, 'audio', 'lessons'));
  for (const course of courses) {
    it(`lessons/${course}: every cue the lesson screen shows, in order — and the files are current`, () => {
      const units = JSON.parse(readFileSync(join(PUBLIC, 'audio', 'lessons', course, 'lessons.json'), 'utf8')) as Record<
        string,
        LessonSource & { file: string }
      >;
      expect(Object.keys(units).length).toBeGreaterThan(0);
      for (const unit of Object.values(units)) {
        const on = readFileSync(join(PUBLIC, unit.file.replace(/\.mp3$/, '.vtt')), 'utf8');
        expect(parse(on).map((c) => c.text), unit.file).toEqual(unit.cues.map((c) => c.text.replace(/\s+/g, ' ').trim()));
        expect(on, `${unit.file}: stale — run \`npm run captions\` in app/`).toBe(format(lessonCues(unit)));
      }
    });
  }
});

describe('what the app hands the player', () => {
  it('every audio file the course data names resolves to a caption file that exists, or is one of the four', () => {
    const named = new Set<string>();
    for (const file of walk(join(SRC, 'data', 'courses'), /\.ts$/)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/["'](\/audio\/[^"']+\.mp3)["']/g)) named.add(m[1]);
    }
    expect(named.size).toBeGreaterThanOrEqual(52);
    for (const src of named) {
      const vtt = captionsFor(src);
      if (UNCAPTIONED.has(src)) expect(vtt, src).toBeNull();
      else expect(vtt && existsSync(join(PUBLIC, vtt)), `${src} → ${vtt}`).toBe(true);
    }
  });

  it('a clip caption covers the trimmed span, and no caption means no track', () => {
    const vtt = clipCaption({ start: 2, end: 7.5, caption: ' Interview, take two ' });
    expect(vtt && parse(vtt)).toEqual([{ start: 2, end: 7.5, text: 'Interview, take two', voice: undefined }]);
    expect(clipCaption({ start: 2, end: 7.5, caption: '   ' })).toBeNull();
    expect(clipCaption({ start: 3, end: 3, caption: 'x' })).toBeNull();
  });
});

/**
 * Every `<video>` and `<audio>` the app draws, read from source.
 *
 * A live camera has no prerecorded words and cannot have a .vtt. Each is named
 * here with why, and must be showing a `srcObject` — the moment one of them
 * plays a file, it is prerecorded media and has to carry a track like the rest.
 * Off-screen elements made with `createElement` (the export and recording
 * pipelines, which only ever draw frames onto a canvas) are not drawn and are
 * not counted.
 */
const LIVE: Record<string, string> = {
  'components/ScanIsbn.tsx': 'the rear camera, requested with video only and muted: no sound at all',
  'screens/call/Green.tsx': 'your own camera before you join, muted: you are not captioned to yourself',
  'screens/call/Tile.tsx': 'a live participant; the call has live captions of its own (lib/mesh.ts)',
};

/** Source with its comments blanked, so prose about `<audio controls>` is not an element. */
const code = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('every media element in the app', () => {
  const sources = walk(SRC, /\.tsx$/).filter((f) => !/\.test\.tsx$/.test(f));
  const elements: { file: string; tag: string; body: string }[] = [];
  for (const file of sources) {
    const text = code(file);
    for (const m of text.matchAll(/<(video|audio)\b[\s\S]*?(?:\/>|<\/\1>)/g)) {
      elements.push({ file: relative(SRC, file).split('\\').join('/'), tag: m[1], body: m[0] });
    }
  }

  it('found them — the walk is not empty', () => {
    expect(elements.length).toBeGreaterThanOrEqual(5);
  });

  it('no track anywhere is empty: each names a file, a language and a label', () => {
    for (const file of sources) {
      for (const m of code(file).matchAll(/<track\b[^>]*>/g)) {
        const where = `${relative(SRC, file)}: ${m[0]}`;
        expect(m[0], where).toMatch(/\bkind="captions"/);
        expect(m[0], where).toMatch(/\bsrc=\{/);
        expect(m[0], where).toMatch(/\bsrcLang="\w+"/);
        expect(m[0], where).toMatch(/\blabel="[^"]+"/);
      }
    }
  });

  it('each carries a captions track, or is a live camera named above', () => {
    const bare = elements.filter((e) => !/<track\b[^>]*kind="captions"[^>]*\bsrc=/.test(e.body) && !LIVE[e.file]);
    expect(bare.map((e) => `${e.file} <${e.tag}>`)).toEqual([]);
  });

  it('the live ones really are live', () => {
    for (const file of Object.keys(LIVE)) {
      const text = readFileSync(join(SRC, file), 'utf8');
      expect(text, file).toMatch(/srcObject/);
      const mine = elements.filter((e) => e.file === file);
      expect(mine.length, file).toBeGreaterThan(0);
      for (const e of mine) expect(e.body, file).not.toMatch(/\bsrc=/);
    }
  });
});
