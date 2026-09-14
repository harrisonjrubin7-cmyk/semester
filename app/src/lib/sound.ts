/**
 * What is making a noise, and which tab is making it.
 *
 * Before this, nothing could. `App.tsx` renders one screen — `switch
 * (state.screen)` — under a `key={state.screen}`, so leaving a screen unmounts
 * it, and the lesson player's `<audio>` element went with it. A tab in this
 * app is a saved place rather than a running document, so a tab you were not
 * looking at had no DOM at all and could not have been playing anything.
 *
 * That is a reasonable way to build an app and a poor way to listen to a
 * forty-minute narration. The lesson player's own comment says what it is
 * for — "walking across campus with the phone in a pocket" — and checking
 * tomorrow's deadline halfway through meant starting again. So the element
 * moves out of the screen and up to the shell, beside `Ringing`, and this
 * module is the small amount of state that says whose it is.
 *
 * ## The tab owns the sound
 *
 * Not the screen, which is gone the moment you look at something else, and
 * not the app, which would leave a lesson playing under a tab that had been
 * closed. The rule is the browser's, and `survives` below is all of it: a
 * sound lasts while the tab that started it is still open and still in the
 * place it was started from. Close that tab and it stops. Navigate it
 * somewhere else — within the tab, which is what a browser calls leaving the
 * page — and it stops. Switch to another tab and it plays on, which is the
 * whole point.
 *
 * ## One at a time
 *
 * There is one element, so starting something else takes it over. A browser
 * would let two tabs talk at once; this is a place to study, and two
 * narrations over each other is not a feature anybody asked for. It also
 * keeps the strip honest — the speaker is on the tab that is making the
 * noise, singular, and there is never a second one to go hunting for.
 *
 * ## Nothing here is persisted
 *
 * A reload is silence, the way it is in a browser. What survives a reload is
 * the tab's `muted` flag, which lives on the tab in `lib/browser.ts` where
 * the rest of a tab's settings live.
 */

import { sameplace } from './browser';
import type { AppTab } from './browser';
import type { Action } from '../state/shape';

/** A sound, and the tab it belongs to. */
export interface Sound {
  /**
   * The tab that started it.
   *
   * An id rather than the tab itself: the tab is rewritten on every
   * navigation, reordered by a drag and renamed by whatever it lands on, and
   * a copy held here would be stale within a minute. `survives` looks it up.
   */
  tab: string;
  /**
   * The place that tab was in when the sound started.
   *
   * This is what "leaving the page" means in an app whose pages are places.
   * Held as the actions rather than a screen name because two lessons in two
   * different courses are the same screen: leaving one for the other has to
   * stop the first, and a screen comparison would not notice.
   */
  place: Action[];
  /** The file being played. */
  src: string;
  /** What it is — the lock screen's title, and the strip's tooltip. */
  title: string;
  /**
   * The course it belongs to — the lock screen's "artist" line.
   *
   * Required rather than optional, because `NowPlaying` in `lib/device.ts`
   * requires it and everything this app can play belongs to a course. An
   * optional here would only have meant a fallback string invented at the
   * call to satisfy a type.
   */
  course: string;
  /** The thing the course's audio is collected under, for the lock screen. */
  album?: string;
}

/**
 * The sound, given the strip as it now is — or silence.
 *
 * Called on every change to the strip, which is every navigation anywhere in
 * the app, so it has to be cheap and it has to return the sound it was given
 * by reference when nothing is wrong. Two ways to lose it, and they are the
 * two a browser has:
 *
 * 1. **The tab is gone.** Closed, or aged out of a strip read back off a
 *    device that had been edited. Nothing is playing for a tab that is not
 *    there, and leaving the sound would be a speaker on the strip with no tab
 *    under it.
 * 2. **The tab has moved on.** The tab is open but is somewhere else now,
 *    which within a tab is exactly what leaving a page is. A lesson you
 *    navigated away from does not follow you around.
 *
 * Note what is *not* here: being the tab you are looking at. That is the
 * condition this whole module exists to remove.
 */
export function survives(sound: Sound | null, tabs: AppTab[]): Sound | null {
  if (!sound) return null;
  const owner = tabs.find((t) => t.id === sound.tab);
  if (!owner) return null;
  return sameplace(owner.place, sound.place) ? sound : null;
}

/**
 * Is this tab the one making the noise?
 *
 * The strip asks it of every tab it draws, so it is an id comparison and
 * nothing more.
 */
export function sounding(sound: Sound | null, id: string): boolean {
  return Boolean(sound && sound.tab === id);
}

/** How far through, as a fraction, for a progress line. Zero before metadata. */
export function through(time: number, duration: number): number {
  if (!(duration > 0)) return 0;
  return Math.min(1, Math.max(0, time / duration));
}

/**
 * A player's clock: `7:04`, counted in whole seconds.
 *
 * Here rather than in either player, because there are two of them now and a
 * second copy is how two clocks in one app come to round differently.
 */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
