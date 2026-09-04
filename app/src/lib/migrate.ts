/**
 * Moving stored data from the shape it was written in to the shape now.
 *
 * While this app had one user, a shape change was free: change the code, and if
 * something looked wrong, clear the storage. That stops being true the moment a
 * second person has a semester in it. Their data is written by whichever build
 * they last opened and read by whichever they open next, and those are not the
 * same build — a phone that has not been unlocked for three weeks is three
 * releases behind.
 *
 * ## Numbered steps, applied in order
 *
 * Each step takes the stored object one version forward and says what it did.
 * A payload at version 3 reaching a build that knows version 6 runs steps 4, 5
 * and 6, in that order. Nothing is skipped and nothing is applied twice.
 *
 * ## A payload from the future is left alone
 *
 * The obvious mistake here is to treat "not the current version" as "needs
 * migrating". Somebody who opens the app on a laptop running last month's
 * build, after their phone wrote this month's shape, would have their data
 * quietly walked *backwards* by steps written for an older format. So a version
 * higher than this build knows about is passed through untouched and the app
 * reads what it recognises — which is what `readLook`, `readStarted` and the
 * rest already do field by field.
 *
 * ## Version 1 is "no version at all"
 *
 * Everything written before this existed has no marker. That is not corruption,
 * it is the first version, and it is what almost every stored copy is right now.
 */

/** The shape this build writes. Bump it when you add a step below. */
export const SCHEMA = 2;

export interface Step {
  /** The version this step produces. */
  to: number;
  /** What it does, for the diagnostics dump and for whoever reads this next. */
  describe: string;
  run: (state: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * The steps, in order.
 *
 * Keep them small and keep them forever. A step that is deleted because "nobody
 * can still be on version 2" is a bet about a phone in a drawer.
 */
export const STEPS: Step[] = [
  {
    to: 2,
    describe: 'Give every stored copy a version marker of its own.',
    run: (s) => s,
  },
];

/** What version a stored object is. Missing means the first one. */
export function versionOf(state: unknown): number {
  if (!state || typeof state !== 'object') return SCHEMA;
  const v = (state as Record<string, unknown>).schemaVersion;
  return typeof v === 'number' && v >= 1 ? Math.floor(v) : 1;
}

export interface Migrated {
  state: Record<string, unknown>;
  from: number;
  to: number;
  /** What each step did, in order. Empty when nothing ran. */
  ran: string[];
  /**
   * True when the stored copy is newer than this build understands.
   *
   * Not an error — the app reads what it recognises and ignores the rest — but
   * worth saying out loud in the diagnostics, because it explains a setting
   * that appears to have been forgotten.
   */
  fromFuture: boolean;
}

export function migrate(raw: unknown): Migrated {
  const state =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const from = versionOf(raw);

  if (from > SCHEMA) {
    // Walked backwards is worse than left alone. See the note above.
    return { state, from, to: from, ran: [], fromFuture: true };
  }

  const ran: string[] = [];
  let out = state;
  for (const step of STEPS) {
    if (step.to <= from) continue;
    out = step.run(out);
    // The version is already in the sentence `migrationLine` builds, so the
    // step describes itself and nothing else.
    ran.push(step.describe);
  }
  out.schemaVersion = SCHEMA;
  return { state: out, from, to: SCHEMA, ran, fromFuture: false };
}

/** How the migration reads, for the diagnostics dump. */
export function migrationLine(m: Migrated): string {
  if (m.fromFuture) {
    return `Stored data is version ${m.from}; this build knows ${SCHEMA}. Left as it is — anything this build does not recognise is ignored rather than dropped.`;
  }
  if (m.ran.length === 0) return `Stored data is version ${m.from}. Nothing to do.`;
  return `Moved stored data from version ${m.from} to ${m.to}: ${m.ran.join(' · ')}`;
}
