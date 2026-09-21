import { describe, expect, it } from 'vitest';
import {
  clipKey,
  dollars,
  EMPTY,
  estimate,
  record,
  spentSoFar,
  unspent,
  type ClipJob,
  type SpendManifest,
} from '../../../video/src/clipspend';

/**
 * The guard that stands between a re-run and a second bill.
 *
 * `clipspend`, not `spend`: `lib/spend.ts` is already the meter for the
 * student's own API key — "a key typed into this app is billed to the
 * student's own card" — and that is a different pocket entirely. This one
 * counts what *the course author* spends buying video clips, once per course.
 * The first draft of this file was written as `spend.test.ts` and silently
 * replaced that module's guard; nine tests went missing and the suite still
 * went green, because a deleted test is not a failing one.
 *
 * Steps 1–3 of the video roadmap cost compute; step 4 is the first that costs
 * money per clip. The roadmap's §7 asks for a manifest "so a re-render only
 * touches units that actually changed — AI video is exactly the kind of cost
 * you don't want to accidentally re-spend on an unchanged unit", and this is
 * what makes that true rather than intended.
 *
 * The test that matters is the last one in the first block: run everything,
 * record it, run it again, and the second run must have nothing to buy.
 */

const job = (over: Partial<ClipJob> = {}): ClipJob => ({
  slot: 'econ/chapter-3',
  prompt: 'A lecture hall at dusk, empty, wide.',
  seconds: 6,
  provider: 'some-provider',
  model: 'some-model',
  ...over,
});

/** A manifest with every one of `jobs` already bought. */
const afterBuying = (jobs: ClipJob[]): SpendManifest =>
  jobs.reduce(
    (m, j) => record(m, j, { file: `${j.slot}.mp4`, at: 1_700_000_000_000, cents: 60 }),
    EMPTY,
  );

describe('not paying twice for the same clip', () => {
  it('has everything to buy when nothing has been bought', () => {
    expect(unspent(EMPTY, [job()])).toHaveLength(1);
  });

  it('has nothing to buy when the identical clip is already made', () => {
    expect(unspent(afterBuying([job()]), [job()])).toEqual([]);
  });

  it('buys again when the prompt changes, because the clip would differ', () => {
    const made = afterBuying([job()]);
    expect(unspent(made, [job({ prompt: 'A lecture hall at dawn.' })])).toHaveLength(1);
  });

  it('buys again when the length, provider or model changes', () => {
    const made = afterBuying([job()]);
    expect(unspent(made, [job({ seconds: 8 })])).toHaveLength(1);
    expect(unspent(made, [job({ provider: 'other' })])).toHaveLength(1);
    expect(unspent(made, [job({ model: 'other' })])).toHaveLength(1);
  });

  it('does not buy again just because the file moved', () => {
    const made = afterBuying([job()]);
    made.made['econ/chapter-3'].file = 'somewhere/else.mp4';
    expect(unspent(made, [job()])).toEqual([]);
  });

  it('does not buy again when a clip is carried to a renamed slot', () => {
    /*
     * The slot addresses a clip; it does not describe one. Rename
     * `econ/chapter-3` to `econ/ch-3`, carry its manifest entry across, and
     * the same six seconds of video must not be bought a second time.
     *
     * The first version of this test only moved the `file` field and left the
     * slot alone — which passes whether or not the slot is in the key, so it
     * was not testing anything. Adding `job.slot` to `clipKey` left all
     * fifteen green.
     */
    const made = afterBuying([job()]);
    const carried: SpendManifest = { made: { 'econ/ch-3': made.made['econ/chapter-3'] } };
    expect(unspent(carried, [job({ slot: 'econ/ch-3' })])).toEqual([]);
  });

  it('cannot be fooled by one field running into the next', () => {
    /*
     * Joined on a NUL rather than concatenated. Without a separator that
     * cannot occur in the text, two different clips hash to one and the second
     * is never bought — a silent wrong clip rather than a double charge.
     *
     * The fields have to be *adjacent* for this to bite, which the first
     * version of this test got wrong: it split a prompt against a provider
     * with the model and the duration sitting between them, so it passed under
     * plain concatenation too.
     */
    const a = clipKey(job({ provider: 'ab', model: 'c' }));
    const b = clipKey(job({ provider: 'a', model: 'bc' }));
    expect(a).not.toBe(b);
  });

  it('spends nothing on a second run of the same course', () => {
    /*
     * The whole point. Fourteen chapters, generated once, then the command run
     * again — because somebody changed a caption, or re-rendered the video, or
     * simply did not remember. The second run must cost nothing.
     */
    const jobs = Array.from({ length: 14 }, (_, i) =>
      job({ slot: `econ/chapter-${i}`, prompt: `Establishing shot ${i}.` }),
    );
    expect(unspent(EMPTY, jobs)).toHaveLength(14);

    const made = afterBuying(jobs);
    expect(unspent(made, jobs)).toEqual([]);
    expect(estimate(unspent(made, jobs), { centsPerSecond: 10 }).cents).toBe(0);
  });

  it('buys only the chapter whose prompt was edited', () => {
    const jobs = Array.from({ length: 14 }, (_, i) =>
      job({ slot: `econ/chapter-${i}`, prompt: `Establishing shot ${i}.` }),
    );
    const made = afterBuying(jobs);
    const edited = jobs.map((j, i) => (i === 5 ? { ...j, prompt: 'Something else.' } : j));
    expect(unspent(made, edited).map((j) => j.slot)).toEqual(['econ/chapter-5']);
  });
});

describe('what a run would cost', () => {
  it('is nothing for nothing', () => {
    expect(estimate([], { centsPerSecond: 10 })).toEqual({ clips: 0, seconds: 0, cents: 0 });
  });

  it('counts seconds across clips', () => {
    const jobs = [job({ seconds: 6 }), job({ slot: 'b', seconds: 8 })];
    expect(estimate(jobs, { centsPerSecond: 10 })).toEqual({ clips: 2, seconds: 14, cents: 140 });
  });

  it('rounds a part-cent up, never down', () => {
    // An estimate that reads low is the one that gets somebody in trouble.
    expect(estimate([job({ seconds: 1 })], { centsPerSecond: 0.5 }).cents).toBe(1);
    expect(estimate([job({ seconds: 3 })], { centsPerSecond: 3.4 }).cents).toBe(11);
  });

  it('prints cents as money', () => {
    expect(dollars(0)).toBe('$0.00');
    expect(dollars(5)).toBe('$0.05');
    expect(dollars(1234)).toBe('$12.34');
  });
});

describe('the manifest as a record of what was spent', () => {
  it('does not edit the manifest it was given', () => {
    // The caller writes the file after this returns. A manifest mutated before
    // a failed write is a manifest claiming to have paid for something it has
    // not — which is the one error this whole module exists to prevent, made
    // by the module itself.
    const before = JSON.stringify(EMPTY);
    record(EMPTY, job(), { file: 'a.mp4', at: 1, cents: 60 });
    expect(JSON.stringify(EMPTY)).toBe(before);
  });

  it('adds up everything bought so far', () => {
    const jobs = [job({ seconds: 6 }), job({ slot: 'b', seconds: 8 })];
    expect(spentSoFar(afterBuying(jobs))).toEqual({ clips: 2, seconds: 14, cents: 120 });
  });

  it('is empty before anything is bought', () => {
    expect(spentSoFar(EMPTY)).toEqual({ clips: 0, seconds: 0, cents: 0 });
  });
});
