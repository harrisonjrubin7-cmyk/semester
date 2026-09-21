/*
 * With the extension, because this module is imported by a plain Node script
 * as well as by vitest. `fnv.ts` documents the trap in its own header — "Node
 * strips types but does not resolve extensionless imports" — and this is the
 * third caller it was moved there to serve, walking into it anyway:
 * `render-documentary.mjs` died on ERR_MODULE_NOT_FOUND before it printed a
 * line. `fit.ts` and `shorts.ts` are not affected because their cross-root
 * imports are `import type`, erased before Node sees them.
 */
import { hashOf } from '../../app/src/lib/fnv.ts';

/**
 * What a paid generation run would cost, and what it must not pay for twice.
 *
 * Steps 1–3 of `docs/VIDEO_PODCAST_ROADMAP.md` cost compute. Step 4 is the
 * first that costs money per clip, and the roadmap's own §7 names the guardrail
 * it needs before the first one is bought: "a manifest, same pattern as
 * `audio/manifest.json` — hash the source material so a re-render only touches
 * units that actually changed. AI video is exactly the kind of cost you don't
 * want to accidentally re-spend on an unchanged unit."
 *
 * This is that manifest, built before anything is generated rather than after
 * the first duplicated bill. `audio/manifest.json` keys each artefact by its
 * slot — `bus/unit-0` — and stores a content hash beside it; the same shape is
 * used here, so a reader who knows one knows the other.
 *
 * Pure: no network, no provider, no filesystem. `app/src/lib/spend.test.ts`
 * reads it across the repo root so its guard runs in the suite CI already runs.
 */

/** One clip a provider would be asked to make. */
export interface ClipJob {
  /**
   * Where the clip goes — `econ/chapter-3`.
   *
   * Deliberately not part of the key. Moving a clip to a different filename is
   * not a reason to buy it again.
   */
  slot: string;
  /** Everything that decides what comes back. */
  prompt: string;
  seconds: number;
  provider: string;
  model: string;
}

/** A clip that was actually bought. */
export interface Made {
  key: string;
  file: string;
  /** Epoch millis, as `audio/manifest.json` records them. */
  at: number;
  seconds: number;
  /** Cents, not dollars: money is counted in integers. */
  cents: number;
}

export interface SpendManifest {
  made: Record<string, Made>;
}

export const EMPTY: SpendManifest = { made: {} };

/**
 * The hash of everything that decides what a clip looks like.
 *
 * Prompt, length, provider and model — and nothing else. A run that changes
 * where the file lands, or when it was made, or what it cost, is looking at
 * the same clip and must not buy a second one.
 *
 * The fields are joined with a separator that cannot appear in any of them, so
 * a prompt ending in the provider's name cannot collide with a shorter prompt
 * and a different provider.
 */
export function clipKey(job: ClipJob): string {
  return hashOf([job.provider, job.model, String(job.seconds), job.prompt].join('\u0000'));
}

/**
 * The jobs that have not already been paid for.
 *
 * The only function in this file the spending path is allowed to skip, and it
 * is not allowed to skip it.
 */
export function unspent(manifest: SpendManifest, jobs: readonly ClipJob[]): ClipJob[] {
  return jobs.filter((job) => manifest.made[job.slot]?.key !== clipKey(job));
}

/** Per-second price of a provider's clips, in cents. */
export interface Rate {
  /**
   * Cents per second of generated video.
   *
   * Supplied by the caller rather than tabulated here on purpose: these prices
   * change faster than this repository does, and a stale number written into
   * the code would be quoted in a `--dry-run` as though it were measured. Read
   * it off the provider's current pricing page when you configure a run.
   */
  centsPerSecond: number;
}

export interface Estimate {
  clips: number;
  seconds: number;
  cents: number;
}

/** What a set of jobs would cost at a given rate. */
export function estimate(jobs: readonly ClipJob[], rate: Rate): Estimate {
  const seconds = jobs.reduce((n, j) => n + j.seconds, 0);
  return {
    clips: jobs.length,
    seconds,
    // Rounded up: a cost estimate that reads low is worse than one that reads
    // high by a cent.
    cents: Math.ceil(seconds * rate.centsPerSecond),
  };
}

/** Cents as a string somebody can read in a terminal. */
export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * The manifest after a clip was bought.
 *
 * Returns a new manifest rather than editing the one it was given: the caller
 * writes the file, and a half-updated object that was mutated before a failed
 * write is a manifest claiming to have paid for something it has not.
 */
export function record(
  manifest: SpendManifest,
  job: ClipJob,
  made: { file: string; at: number; cents: number },
): SpendManifest {
  return {
    ...manifest,
    made: {
      ...manifest.made,
      [job.slot]: {
        key: clipKey(job),
        file: made.file,
        at: made.at,
        seconds: job.seconds,
        cents: made.cents,
      },
    },
  };
}

/** Everything spent so far, across every clip the manifest knows about. */
export function spentSoFar(manifest: SpendManifest): Estimate {
  const entries = Object.values(manifest.made);
  return {
    clips: entries.length,
    seconds: entries.reduce((n, m) => n + m.seconds, 0),
    cents: entries.reduce((n, m) => n + m.cents, 0),
  };
}
