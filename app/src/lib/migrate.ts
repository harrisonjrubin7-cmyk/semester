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
export const SCHEMA = 5;

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
  {
    to: 3,
    describe: 'Let the layout answer for a directory nobody chose.',
    /*
     * `directory` shipped with `list` as its initial value, and the state is
     * written whole on every save, so every stored copy has a literal `list`
     * in it whether or not anybody opened the setting. That made the unchosen
     * state unreachable and `directoryOf`'s soft fallback dead: switching to
     * the soft layout left the fifty-five-row column in place.
     *
     * Emptying it puts those copies back into "nobody has chosen", where the
     * layout answers. Only where the shell is not soft, because that is where
     * a stored `list` says nothing: it is what the resolver would return
     * anyway, so nothing on screen moves, and the answer only starts
     * differing if they switch to soft — which is the point. A `list` stored
     * against a soft shell is the opposite: soft's own answer is the tiles,
     * so somebody had to ask for that, and it is kept.
     *
     * `tiles` is never touched, under any shell. It is only ever a choice.
     */
    run: (s) => (s.directory === 'list' && s.shell !== 'soft' ? { ...s, directory: '' } : s),
  },
  {
    to: 4,
    describe: 'Open the workspace, for everybody rather than for new installs.',
    /*
     * The workspace is the app's layout now — the tab strip, the one search
     * bar under it, the launcher — and `DEFAULT_PERSISTED` alone could not
     * deliver it: `nav` has always been a persisted field, so every copy ever
     * written carries a literal `tabs` in it whether or not anybody opened
     * the setting. The default only ever reached a device that had never
     * saved anything, which is nobody who has used this app.
     *
     * So the step rewrites it, once, for everybody. That is the same argument
     * step 3 makes about `directory`: a value that is in every stored copy
     * because the app wrote it there, rather than because somebody chose it.
     *
     * ## It is not a permanent opinion
     *
     * The version marker is what makes this a change rather than a policy. It
     * runs on the way from 3 to 4 and never again, so somebody who reads the
     * new layout and goes back to the tab bar — on Layout and navigation, or
     * the last row of Customize Semester — keeps the tab bar on every device
     * and every reopening after. A step with no marker behind it would be an
     * app that overrules the setting it offers, every morning.
     *
     * ## Unconditional, and that is the part to be sure about
     *
     * Four navigations go in and one comes out, so a shelves or springboard
     * reader who chose that on purpose loses the choice they made. It is one
     * setting, it is named on the first screen they will see, and both routes
     * back are one click — which is the trade this step is, stated rather
     * than hidden. Nothing else about their account moves: not a course, not
     * a tick, not a look key, not the layout their screens are drawn in.
     */
    run: (s) => ({ ...s, nav: 'workspace' }),
  },
  {
    to: 5,
    describe: 'Open the guides, so the app starts at the courses rather than at a search bar.',
    /*
     * The same argument step 4 makes, for the same reason, one layout later.
     *
     * `nav` is persisted, so every stored copy now carries a literal
     * `workspace` that step 4 wrote rather than anybody chose. Moving
     * `DEFAULT_PERSISTED` alone would reach only a device that had never
     * saved anything, which is nobody who has used this app — so the step
     * rewrites it once.
     *
     * ## Why the app opens here now
     *
     * The workspace put a tab strip and a search field above every screen, on
     * the model of a browser. That is the right shape for sixty screens you
     * move between and the wrong one for the thing this app is mostly used
     * for: four courses, and eleven ways through each. The guides make the
     * course the top level and the study modes the navigation — see
     * `lib/chrome.ts` and `screens/Guides.tsx`.
     *
     * ## What it costs
     *
     * The persistent top search field and the app-tab strip stop being the
     * first thing anybody sees. That is a real loss and it is the reason this
     * step is worth reading twice: the Screen and Implementation Guide asks
     * for both to be kept. Nothing is removed — the workspace keeps its tabs,
     * bookmarks and named groups, and is one row away on Layout and
     * navigation — but it is no longer where the app opens.
     *
     * ## Same two guarantees as step 4
     *
     * The version marker makes this a change rather than a policy: it runs on
     * the way from 4 to 5 and never again, so somebody who reads it and goes
     * back to the workspace, or to the tab bar, keeps that on every device
     * and every reopening after. And nothing else moves — not a course, not a
     * tick, not a look key, not the layout screens are drawn in. All five
     * older navigations still work and are all still one click away.
     */
    run: (s) => ({ ...s, nav: 'guides' }),
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
