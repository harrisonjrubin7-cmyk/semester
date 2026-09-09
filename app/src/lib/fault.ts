/**
 * Why a screen did not draw — which decides what to say about it.
 *
 * Every screen but Today is fetched when it is opened, so the failure a person
 * actually meets is a dynamic import that did not arrive. There are two quite
 * different reasons for that, and until this the app told the same story about
 * both:
 *
 *   - **The app was updated.** Every deploy renames the files and Pages stops
 *     serving the old ones, so an installed app open since before a deploy
 *     asks for a chunk that is gone. A reload is the whole fix, and saying so
 *     turns a dead end into a button.
 *   - **There is no connection**, and this part of the app was never
 *     downloaded. Nothing was updated, nothing is broken, and a reload fixes
 *     nothing until there is a signal.
 *
 * Measured in a browser with the network switched off: opening any screen not
 * already fetched showed "This app was updated — a new version was published
 * while this was open… a reload is the whole fix." Nothing had been published,
 * and reloading returned to the same message. The app told a confident, false
 * story and prescribed the one action that could not work — to somebody whose
 * app is sold on working with no signal.
 */

/** What kind of failure a screen met. */
export type Fault =
  /** The file was never downloaded and cannot be now. */
  | 'absent'
  /** The file is gone from the server because the app moved on. */
  | 'stale'
  /** Something in the screen itself threw. */
  | 'broken';

/**
 * Did a dynamic import fail, rather than the screen's own code throwing?
 *
 * Every engine words it differently and none of them has a code: Chrome says
 * "Failed to fetch dynamically imported module", Safari "Importing a module
 * script failed", Firefox "error loading dynamically imported module". Vite's
 * own preload helper throws with a `name` of ChunkLoadError in some setups.
 *
 * Matching loosely is right: mistaking a real bug for a missing file offers a
 * reload that does not help, and mistaking a missing file for a real bug tells
 * somebody their app is broken when it is merely old, or merely offline.
 */
export function isChunk(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return /dynamically imported module|importing a module script|ChunkLoadError|Failed to fetch module/i.test(
    text,
  );
}

/**
 * Which of the three this is.
 *
 * `online` is passed in rather than read here so the decision is a pure one —
 * and because the only honest source for it is a one-way signal. See
 * `lib/offline.ts`: a browser saying it is offline is worth believing, and a
 * browser saying it is online means only that a network interface exists.
 * That asymmetry is exactly the right shape for this: being sure of the
 * offline case is what matters, and everything else keeps the old story.
 */
export function faultOf(error: Error, online: boolean): Fault {
  if (!isChunk(error)) return 'broken';
  return online ? 'stale' : 'absent';
}
