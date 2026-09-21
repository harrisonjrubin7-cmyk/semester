/**
 * Where each line of a two-voice episode starts, recovered from the MP3.
 *
 * `audio/synth.py` records where a *chapter* starts and throws the rest away.
 * It has the number: it concatenates the episode piece by piece and keeps a
 * running `position`, which is the exact second every line begins at. It
 * writes that down only when a line opens a chapter. For the four episodes
 * that already shipped, there is nothing left to read but the audio.
 *
 * This recovers it, and it is not a forced aligner in the usual sense —
 * nothing here listens to speech or matches phonemes. It does not need to.
 * The silences between lines were not recorded, they were *inserted*, at
 * three lengths this file knows exactly, in an order the script determines.
 * Finding them is a structural problem, not an acoustic one, which is the
 * same move `pipeline/chapters.py` already makes to recover chapter marks.
 *
 * The parts that decide anything live here, pure, so that
 * `app/src/lib/align.test.ts` can build a synthetic episode with known line
 * times and check that they come back. Reading an MP3 is
 * `pipeline/align-audio.mjs`.
 */

/*
 * The three beats, copied from `audio/synth.py`.
 *
 * Copied, not imported, because that file is Python. If one of them moves
 * there and not here, every recovered time after the first changed gap is
 * wrong by a fraction of a second that accumulates — so `align.test.ts`
 * asserts the arithmetic these produce against a whole synthetic episode,
 * and a number edited in one place and not the other fails it.
 */
export const GAP_SAME_SPEAKER = 0.32;
export const GAP_TURN = 0.55;
export const GAP_CHAPTER = 1.15;

/**
 * The silence before each line, in script order. Index 0 is the gap before
 * line 1 — line 0 opens the file and has nothing in front of it.
 *
 * `synth.py` adds the beat *before* a line based on that line, and the line's
 * own `pause` *after* it, so a pause and the next line's beat land in the
 * audio as one run of silence. They are added together here for the same
 * reason: they are one silence, and nothing can tell them apart afterwards.
 */
export function expectedGaps(lines) {
  const gaps = [];
  for (let i = 1; i < lines.length; i += 1) {
    const beat = lines[i].chapter
      ? GAP_CHAPTER
      : lines[i].v !== lines[i - 1].v
        ? GAP_TURN
        : GAP_SAME_SPEAKER;
    gaps.push(beat + Number(lines[i - 1].pause ?? 0));
  }
  return gaps;
}

/**
 * Every stretch of the track that is quiet for at least `minSeconds`.
 *
 * The inserted silences are literal zeros in the WAV `synth.py` wrote, but
 * the MP3 encoder does not keep them that way — it smears a little energy
 * into the edges — so this asks for quiet rather than for silence.
 */
export function quietRuns(samples, rate, { threshold = 0.005, minSeconds = 0.2 } = {}) {
  const need = Math.round(minSeconds * rate);
  const runs = [];
  let start = 0;
  let quiet = true;
  for (let i = 0; i <= samples.length; i += 1) {
    const loud = i < samples.length && Math.abs(samples[i]) > threshold;
    if (quiet && loud) {
      if (i - start >= need) runs.push({ from: start / rate, to: i / rate });
      quiet = false;
    } else if (!quiet && !loud) {
      start = i;
      quiet = true;
    }
  }
  if (quiet && samples.length - start >= need) {
    runs.push({ from: start / rate, to: samples.length / rate });
  }
  return runs;
}

/** Runs shorter than this are not looked for; see `alignGaps`. */
export const FLOOR = 0.5;

/**
 * Which detected run stands for which expected gap.
 *
 * Counting is not enough. Three of the four shipped episodes turn up one or
 * two more quiet runs than there are gaps — Piper leaves a long enough breath
 * inside a line often enough that a strict one-to-one match refuses on them,
 * and a match that just takes the runs in order is worse than refusing: it
 * slips by one line and every time after it is four to nine seconds late.
 *
 * So both signals are used. A run should be about as long as the gap it
 * stands for, and the speech between two runs should be about as long as the
 * lines between them need. The second is the one that catches a slip, and it
 * costs nothing to know: the episode's speaking rate falls out of arithmetic,
 * because the gaps are known exactly and everything that is not a gap is
 * somebody talking.
 *
 * `spans[j]` is what should sit between gap `j-1` and gap `j`; `spans[0]` is
 * ignored. Returns one run index per gap, strictly increasing.
 */
export function alignGaps(gaps, spans, runs, { spanWeight = 1 } = {}) {
  const G = gaps.length;
  const R = runs.length;
  if (G === 0) return [];
  if (R < G) return null;

  const length = runs.map((r) => r.to - r.from);
  const cost = Array.from({ length: G }, () => new Float64Array(R).fill(Infinity));
  const from = Array.from({ length: G }, () => new Int32Array(R));
  for (let r = 0; r < R; r += 1) cost[0][r] = Math.abs(length[r] - gaps[0]);

  for (let j = 1; j < G; j += 1) {
    // A run cannot be used for gap j unless j runs precede it and G-1-j follow.
    for (let r = j; r < R - (G - 1 - j); r += 1) {
      const fit = Math.abs(length[r] - gaps[j]);
      for (let p = j - 1; p < r; p += 1) {
        if (!Number.isFinite(cost[j - 1][p])) continue;
        const said = runs[r].from - runs[p].to;
        const c = cost[j - 1][p] + fit + spanWeight * Math.abs(said - spans[j]);
        if (c < cost[j][r]) {
          cost[j][r] = c;
          from[j][r] = p;
        }
      }
    }
  }

  let r = 0;
  for (let k = 1; k < R; k += 1) if (cost[G - 1][k] < cost[G - 1][r]) r = k;
  if (!Number.isFinite(cost[G - 1][r])) return null;
  const pick = new Array(G);
  for (let j = G - 1; j >= 0; j -= 1) {
    pick[j] = r;
    r = from[j][r];
  }
  return pick;
}

/**
 * Start and end seconds for every line, or a reason there are none.
 *
 * A detected run is the previous line's trailing silence, the inserted gap,
 * and the next line's leading silence, all as one. Only the middle of those
 * is known, so the overhang is split evenly between the two lines either
 * side. Measured against the chapter marks `synth.py` wrote from its own
 * counter — the only exact times that exist — that leaves the recovered
 * start about a tenth of a second early on average, and every one of the 55
 * marks across the four episodes inside the second it was recorded in.
 */
export function lineTimes(lines, runs, totalSeconds, options = {}) {
  const gaps = expectedGaps(lines);
  const chars = lines.map((l) => l.t.length);
  const big = [];
  for (let i = 0; i < gaps.length; i += 1) if (gaps[i] >= FLOOR) big.push(i);

  const usable = runs.filter((r) => r.to - r.from >= FLOOR);
  if (usable.length < big.length) {
    return { why: `${usable.length} quiet runs for ${big.length} gaps that should be audible` };
  }

  const speech = totalSeconds - gaps.reduce((a, b) => a + b, 0);
  if (speech <= 0) return { why: 'the gaps alone are longer than the episode' };
  const perSecond = chars.reduce((a, b) => a + b, 0) / speech;

  const spans = big.map((_, j) => {
    if (j === 0) return 0;
    const a = big[j - 1];
    const b = big[j];
    let want = 0;
    for (let i = a + 1; i <= b; i += 1) want += chars[i] / perSecond;
    for (let i = a + 1; i < b; i += 1) want += gaps[i];
    return want;
  });

  const pick = alignGaps(big.map((i) => gaps[i]), spans, usable, options);
  if (!pick) return { why: 'no arrangement of the quiet runs fits the script' };

  const runFor = new Map(big.map((gi, j) => [gi, usable[pick[j]]]));
  const times = lines.map(() => ({ s: 0, e: 0 }));
  for (let gi = 0; gi < gaps.length; gi += 1) {
    const run = runFor.get(gi);
    if (run) {
      const overhang = (run.to - run.from - gaps[gi]) / 2;
      times[gi].e = run.from + overhang;
      times[gi + 1].s = run.to - overhang;
    } else {
      // A gap too short to find on its own — one same-speaker beat in four
      // episodes. Place the line by its text and carry on; the next run resets
      // the clock, so the estimate cannot travel.
      times[gi].e = times[gi].s + chars[gi] / perSecond;
      times[gi + 1].s = times[gi].e + gaps[gi];
    }
  }
  times[lines.length - 1].e = totalSeconds;
  return { times, perSecond, runs: usable.length, gaps: big.length };
}

/**
 * How far the recovered times fall from the chapter marks — the only exact
 * times anybody wrote down.
 *
 * `synth.py` stored them as `int(position)`, so a mark of 35 means the line
 * began somewhere in [35, 36). That is the whole resolution available, and
 * this reports the miss against it rather than pretending to more.
 */
export function checkAgainstChapters(lines, times, chapters) {
  const opens = [];
  for (let i = 0; i < lines.length; i += 1) if (lines[i].chapter) opens.push(i);
  if (opens.length !== chapters.length) {
    return { ok: false, why: `${opens.length} chapter lines against ${chapters.length} marks` };
  }
  const misses = [];
  let worst = 0;
  for (let k = 0; k < opens.length; k += 1) {
    const got = times[opens[k]].s;
    const want = chapters[k].s;
    /*
     * The mark was stored as `int(position)`, so the line began somewhere in
     * [want, want + 1) and anywhere in there is as right as the record gets.
     * The miss is measured from the near edge, and the near edge of a late
     * one is `want + 1` — which is a miss of zero at exactly `want + 1`, so
     * how far off it is cannot double as whether it is off at all.
     */
    const inside = got >= want && got < want + 1;
    if (!inside) misses.push({ name: chapters[k].name, want, got });
    worst = Math.max(worst, inside ? 0 : got < want ? want - got : got - (want + 1));
  }
  return { ok: misses.length === 0, checked: opens.length, misses, worst };
}
