import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkAgainstChapters,
  expectedGaps,
  FLOOR,
  GAP_CHAPTER,
  GAP_SAME_SPEAKER,
  GAP_TURN,
  lineTimes,
  quietRuns,
  type LineTime,
  type ScriptLine,
} from '../../../pipeline/align.mjs';

/**
 * Recovering where each line of a podcast starts, from the podcast.
 *
 * `pipeline/align.mjs` reads the four episodes that shipped before
 * `audio/synth.py` wrote its line times down. It works because the silences
 * between lines were inserted at three known lengths rather than performed,
 * so finding them is arithmetic — and arithmetic is exactly what goes wrong
 * quietly. A recovery that slips by one line is four to nine seconds late
 * from there on and still looks like a list of plausible numbers.
 *
 * So this builds a whole episode whose line times it already knows, and
 * checks they come back. The guard lives here because this is where CI runs
 * and the module is pure — no audio, no ffmpeg, no filesystem. Same
 * arrangement as `restyle.test.ts`, `shorts.test.ts` and `slidefit.test.ts`.
 */

const RATE = 1000; // plenty: the shortest thing looked for is 0.5s long

interface Built {
  samples: Float32Array;
  /** Where each line really starts, which is what recovery has to find. */
  truth: number[];
  seconds: number;
}

/**
 * An episode, assembled the way `audio/synth.py` assembles one.
 *
 * Speech is noise; a gap is zeros, at the length the script implies. Each
 * line also gets a little near-silence at each end, because Piper leaves
 * some and the MP3 keeps it — that is what makes a detected quiet run longer
 * than the gap inside it, and it is the whole reason the recovered time is
 * not simply the end of the run.
 */
function build(
  lines: ScriptLine[],
  speech: number[],
  extras: { line: number; at: number; seconds: number }[] = [],
): Built {
  const gaps = expectedGaps(lines);
  const parts: number[] = [];
  const truth: number[] = [];
  const lead = 0.08;
  const trail = 0.12;
  const silence = (s: number) => {
    for (let i = Math.round(s * RATE); i > 0; i -= 1) parts.push(0);
  };
  const noise = (s: number) => {
    for (let i = Math.round(s * RATE); i > 0; i -= 1) parts.push(i % 2 ? 0.5 : -0.5);
  };
  lines.forEach((_, i) => {
    if (i > 0) silence(gaps[i - 1]);
    truth.push(parts.length / RATE);
    silence(lead);
    const body = speech[i] - lead - trail;
    const inside = extras.filter((e) => e.line === i);
    let done = 0;
    for (const e of inside) {
      noise(e.at - done);
      silence(e.seconds);
      done = e.at;
    }
    noise(body - done);
    silence(trail);
  });
  return { samples: Float32Array.from(parts), truth, seconds: parts.length / RATE };
}

/** A two-voice script: alternating speakers, a chapter every few lines. */
function script(count: number, over: Partial<ScriptLine>[] = []): ScriptLine[] {
  return Array.from({ length: count }, (_, i) => ({
    v: i % 2 ? 'expert' : 'host',
    t: 'x'.repeat(60 + ((i * 37) % 90)),
    ...(i % 7 === 0 ? { chapter: `Chapter ${i / 7 + 1}` } : {}),
    ...(over[i] ?? {}),
  }));
}

/** Seconds of speech for each line, at a steady rate with a little jitter. */
function paced(lines: ScriptLine[]): number[] {
  return lines.map((l, i) => l.t.length / 18 + ((i % 5) - 2) * 0.04);
}

describe('the three beats, which live in two languages', () => {
  /*
   * `align.mjs` copies the gap lengths out of `audio/synth.py` because that
   * file is Python and cannot be imported. Everything below builds its
   * synthetic episode from `expectedGaps`, so a constant changed in
   * `align.mjs` changes the question and the answer together and no amount
   * of arithmetic notices. This is the check that does: it reads the numbers
   * out of the Python and compares them.
   */
  const synth = readFileSync(new URL('../../../audio/synth.py', import.meta.url), 'utf8');
  const inPython = (name: string): number => {
    const m = synth.match(new RegExp(`^${name} = ([0-9.]+)$`, 'm'));
    expect(m, `${name} is not declared in audio/synth.py`).not.toBeNull();
    return Number(m![1]);
  };

  it('agrees with audio/synth.py about how long each one is', () => {
    expect(GAP_SAME_SPEAKER).toBe(inPython('GAP_SAME_SPEAKER'));
    expect(GAP_TURN).toBe(inPython('GAP_TURN'));
    expect(GAP_CHAPTER).toBe(inPython('GAP_CHAPTER'));
  });

  it('keeps the short one short enough to be missed and the others findable', () => {
    /*
     * `FLOOR` is where recovery stops looking. A same-speaker beat is under
     * it and gets estimated from the text instead; a turn and a chapter are
     * over it and get found. Moving a beat across that line without moving
     * `FLOOR` changes which lines are measured and which are guessed.
     */
    expect(GAP_SAME_SPEAKER).toBeLessThan(FLOOR);
    expect(GAP_TURN).toBeGreaterThan(FLOOR);
    expect(GAP_CHAPTER).toBeGreaterThan(FLOOR);
  });
});

describe('the silence the script implies', () => {
  it('uses the beat the next line asks for, not the one before it', () => {
    const lines: ScriptLine[] = [
      { v: 'host', t: 'a' },
      { v: 'host', t: 'b' },
      { v: 'expert', t: 'c' },
      { v: 'expert', t: 'd', chapter: 'Two' },
    ];
    expect(expectedGaps(lines)).toEqual([GAP_SAME_SPEAKER, GAP_TURN, GAP_CHAPTER]);
  });

  it('adds a line’s own pause to the beat in front of the next one', () => {
    /*
     * `synth.py` writes the pause after the line that asked for it and then
     * the next line's beat, with nothing in between. In the audio they are
     * one run of silence and nothing can separate them again, so they are
     * one number here. The self-test pauses are seven seconds; counting them
     * against the wrong line puts every later caption seven seconds out.
     */
    const lines: ScriptLine[] = [
      { v: 'host', t: 'q', pause: 7 },
      { v: 'expert', t: 'a' },
    ];
    expect(expectedGaps(lines)).toEqual([7 + GAP_TURN]);
  });

  it('has one gap fewer than there are lines', () => {
    expect(expectedGaps(script(20))).toHaveLength(19);
  });
});

describe('finding the quiet', () => {
  it('reports a run of silence and skips one too short to be a gap', () => {
    const s = new Float32Array(RATE * 3);
    for (let i = 0; i < s.length; i += 1) s[i] = 0.4;
    for (let i = RATE * 1; i < RATE * 1.1; i += 1) s[i] = 0; // 0.1s, too short
    for (let i = RATE * 2; i < RATE * 2.6; i += 1) s[i] = 0; // 0.6s
    const runs = quietRuns(s, RATE);
    expect(runs).toHaveLength(1);
    expect(runs[0].from).toBeCloseTo(2, 2);
    expect(runs[0].to).toBeCloseTo(2.6, 2);
  });

  it('asks for quiet rather than for silence, because the MP3 smears the edges', () => {
    const s = new Float32Array(RATE);
    for (let i = 0; i < s.length; i += 1) s[i] = 0.002; // below the threshold
    expect(quietRuns(s, RATE)).toHaveLength(1);
  });

  it('counts a run that ends the track', () => {
    const s = new Float32Array(RATE * 2);
    for (let i = 0; i < RATE; i += 1) s[i] = 0.4;
    expect(quietRuns(s, RATE)).toHaveLength(1);
  });
});

describe('recovering the line times', () => {
  it('puts every line within a tenth of a second of where it really is', () => {
    const lines = script(40);
    const { samples, truth, seconds } = build(lines, paced(lines));
    const got = lineTimes(lines, quietRuns(samples, RATE), seconds);
    expect(got.why).toBeUndefined();
    const off = got.times!.map((t: LineTime, i: number) => Math.abs(t.s - truth[i]));
    expect(Math.max(...off)).toBeLessThan(0.1);
  });

  it('ends a line before the beat that follows it', () => {
    const lines = script(20);
    const { samples, seconds } = build(lines, paced(lines));
    const times = lineTimes(lines, quietRuns(samples, RATE), seconds).times!;
    const gaps = expectedGaps(lines);
    for (let i = 0; i < lines.length - 1; i += 1) {
      expect(times[i].e).toBeLessThan(times[i + 1].s);
      expect(times[i + 1].s - times[i].e).toBeCloseTo(gaps[i], 1);
    }
  });

  it('holds its place through a seven-second self-test pause', () => {
    /*
     * The thing a pause breaks is the count, not the clock. A pause and the
     * next beat arrive as one long run; read as a plain turn gap it is seven
     * seconds of speech that never happened.
     */
    const lines = script(24, [{ pause: 7 }, {}, {}, {}, {}, {}, {}, {}, { pause: 7 }]);
    const { samples, truth, seconds } = build(lines, paced(lines));
    const got = lineTimes(lines, quietRuns(samples, RATE), seconds);
    expect(got.why).toBeUndefined();
    const off = got.times!.map((t: LineTime, i: number) => Math.abs(t.s - truth[i]));
    expect(Math.max(...off)).toBeLessThan(0.1);
  });

  it('steps over a breath inside a line instead of slipping a line behind', () => {
    /*
     * This is the failure, and it is not hypothetical: three of the four
     * shipped episodes turn up one or two quiet runs more than there are
     * gaps. Taking the runs in order puts every chapter after the extra one
     * four to nine seconds late — near enough to look like data and far
     * enough to be useless. What catches it is that the speech between two
     * gaps has to be about as long as the lines between them need, at a rate
     * the episode's own arithmetic gives for free.
     */
    const lines = script(40);
    const extras = [
      { line: 6, at: 1.4, seconds: 0.7 },
      { line: 23, at: 2.0, seconds: 0.9 },
    ];
    const { samples, truth, seconds } = build(lines, paced(lines), extras);
    const runs = quietRuns(samples, RATE);
    expect(runs.filter((r) => r.to - r.from >= FLOOR).length).toBe(lines.length - 1 + extras.length);

    const got = lineTimes(lines, runs, seconds);
    expect(got.why).toBeUndefined();
    const off = got.times!.map((t: LineTime, i: number) => Math.abs(t.s - truth[i]));
    expect(Math.max(...off)).toBeLessThan(0.1);
  });

  it('places a same-speaker beat too short to find, without letting it travel', () => {
    // 0.32s is under the floor, so there is no run to key on. The line after
    // it is estimated from its text; the next real gap puts the clock back.
    const lines = script(20, [{}, {}, {}, { v: 'host' }]);
    expect(expectedGaps(lines).some((g) => g < FLOOR)).toBe(true);
    const { samples, truth, seconds } = build(lines, paced(lines));
    const got = lineTimes(lines, quietRuns(samples, RATE), seconds);
    expect(got.why).toBeUndefined();
    const off = got.times!.map((t: LineTime, i: number) => Math.abs(t.s - truth[i]));
    expect(Math.max(...off)).toBeLessThan(0.35);
    // and the error does not survive into the rest of the episode
    expect(Math.max(...off.slice(5))).toBeLessThan(0.1);
  });

  it('refuses when there are fewer quiet runs than the script needs', () => {
    const lines = script(12);
    const { samples, seconds } = build(lines, paced(lines));
    const runs = quietRuns(samples, RATE).slice(0, 4);
    const got = lineTimes(lines, runs, seconds);
    expect(got.times).toBeUndefined();
    expect(got.why).toContain('quiet runs');
  });

  it('refuses a track that is shorter than its own silences', () => {
    const lines = script(12, [{ pause: 600 }]);
    const { samples } = build(lines, paced(lines));
    expect(lineTimes(lines, quietRuns(samples, RATE), 30).why).toContain('longer than the episode');
  });
});

describe('checking against the only exact times anybody wrote down', () => {
  const lines: ScriptLine[] = [
    { v: 'host', t: 'a', chapter: 'One' },
    { v: 'expert', t: 'b' },
    { v: 'host', t: 'c', chapter: 'Two' },
  ];
  const marks = [
    { s: 0, t: '0:00', name: 'One' },
    { s: 35, t: '0:35', name: 'Two' },
  ];
  const times = (second: number): LineTime[] => [
    { s: 0, e: 1 },
    { s: 2, e: 3 },
    { s: second, e: second + 1 },
  ];

  it('accepts anywhere inside the second the mark was stored in', () => {
    /*
     * `synth.py` wrote `int(position)`, so a mark of 35 means the line began
     * somewhere in [35, 36) and that is the whole resolution there is.
     * Demanding 35.00 would be demanding precision nobody recorded.
     */
    expect(checkAgainstChapters(lines, times(35), marks).ok).toBe(true);
    expect(checkAgainstChapters(lines, times(35.97), marks).ok).toBe(true);
  });

  it('rejects a second early and a second late', () => {
    expect(checkAgainstChapters(lines, times(34.9), marks).ok).toBe(false);
    expect(checkAgainstChapters(lines, times(36), marks).ok).toBe(false);
    expect(checkAgainstChapters(lines, times(36), marks).misses![0].name).toBe('Two');
  });

  it('rejects a script whose chapters do not match the marks at all', () => {
    const verdict = checkAgainstChapters(lines, times(35), marks.slice(0, 1));
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain('chapter lines');
  });
});
