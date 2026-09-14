/**
 * The one player, and what it is playing.
 *
 * A module store rather than a context, for the same reason the strip is one
 * (`lib/browser.hook.ts`): what is playing is a fact about this visit, not
 * about whatever happens to be rendering, and the component that started a
 * sound is unmounted a second later when you look at another tab. A ref or a
 * provider would lose it exactly then.
 *
 * Two kinds of state live here and they are deliberately separate:
 *
 * - **What is playing** — `Sound`, changed by a screen claiming the player.
 *   Rare, and every tab in the strip watches it.
 * - **Where it has got to** — `time`, changed several times a second by the
 *   element. Only the screen showing the lesson watches that, because a strip
 *   that re-rendered four times a second would be a strip that could not be
 *   dragged.
 *
 * Hence two subscriber sets. One store with both in it would re-render the
 * whole strip on every tick of the clock.
 */

import { useSyncExternalStore } from 'react';
import { survives, type Sound } from './sound';
import { here, strip } from './browser.hook';

let playing: Sound | null = null;
let at = 0;
let span = 0;
let going = false;
let rate = 1;

const watchers = new Set<() => void>();
const tickers = new Set<() => void>();

const told = (who: Set<() => void>) => {
  for (const listener of who) listener();
};

/**
 * What is playing, checked against the strip as it now is.
 *
 * The check happens on the way out rather than on every change to the strip,
 * because the strip changes on every keystroke of a navigation and this is
 * two comparisons. `survives` is where the rule is written.
 */
export function sound(): Sound | null {
  const live = survives(playing, strip().tabs);
  if (live !== playing) {
    playing = live;
    at = 0;
    span = 0;
    going = false;
  }
  return playing;
}

function subscribe(listener: () => void): () => void {
  watchers.add(listener);
  return () => watchers.delete(listener);
}

function subscribeTick(listener: () => void): () => void {
  tickers.add(listener);
  return () => tickers.delete(listener);
}

/** What is playing. Null is silence. */
export function useSound(): Sound | null {
  return useSyncExternalStore(subscribe, sound, sound);
}

/** Where the player has got to. For the screen that is showing it. */
export function usePlayback(): { time: number; duration: number; going: boolean; rate: number } {
  return useSyncExternalStore(subscribeTick, playbackNow, playbackNow);
}

let last = { time: 0, duration: 0, going: false, rate: 1 };
/*
 * Cached and compared, because `useSyncExternalStore` calls this during
 * render and a fresh object every time is an infinite loop.
 */
function playbackNow(): { time: number; duration: number; going: boolean; rate: number } {
  if (last.time !== at || last.duration !== span || last.going !== going || last.rate !== rate) {
    last = { time: at, duration: span, going, rate };
  }
  return last;
}

/**
 * Take the player, for this tab, with this file.
 *
 * Claiming with the same tab and the same file is a no-op, so a screen may
 * call it from an effect on every render without restarting the audio it is
 * already playing.
 */
export function play(next: Sound): void {
  if (playing && playing.tab === next.tab && playing.src === next.src) return;
  playing = next;
  at = 0;
  span = 0;
  going = false;
  told(watchers);
  told(tickers);
}

/**
 * Take the player for whatever tab is on, playing this.
 *
 * The screen asking does not name a tab, and must not have to: no screen in
 * this app imports the strip, because a screen is drawn the same whether the
 * tab bar exists or not. The tab it belongs to is simply the one that is on —
 * the screen doing the asking is the foreground one, by construction — so the
 * question is answered here, in the one module that already has to know about
 * both.
 */
export function playHere(what: Omit<Sound, 'tab' | 'place'>): void {
  const tab = here();
  play({ ...what, tab: tab.id, place: tab.place });
}

/**
 * Is the player already playing this, for this tab?
 *
 * Asked by a screen deciding whether Play means "start" or "resume", and by
 * one deciding whether the clock on screen is its own. A different tab
 * playing the same file is not this tab's sound.
 */
export function mine(src: string): boolean {
  return Boolean(playing && playing.src === src && playing.tab === here().id);
}

/** Give the player up. Silence. */
export function stop(): void {
  if (!playing) return;
  playing = null;
  at = 0;
  span = 0;
  going = false;
  told(watchers);
  told(tickers);
}

/** The element reporting in. Not for callers outside `components/Sound.tsx`. */
export function heard(next: { time?: number; duration?: number; going?: boolean }): void {
  const before = `${at}|${span}|${going}`;
  if (next.time !== undefined) at = next.time;
  if (next.duration !== undefined && Number.isFinite(next.duration)) span = next.duration;
  if (next.going !== undefined) going = next.going;
  if (`${at}|${span}|${going}` !== before) told(tickers);
}

/** Where to jump to. The element picks it up and clears it. */
let wanted: number | null = null;
export function seekTo(seconds: number): void {
  wanted = Math.max(0, seconds);
  told(tickers);
}
export function takeSeek(): number | null {
  const out = wanted;
  wanted = null;
  return out;
}

/** Play or pause, whichever this is not. The element reads it and clears it. */
let asked: 'play' | 'pause' | null = null;
export function ask(what: 'play' | 'pause'): void {
  asked = what;
  told(tickers);
}
export function takeAsk(): 'play' | 'pause' | null {
  const out = asked;
  asked = null;
  return out;
}

/** How fast. A player setting, so it outlives the file being played. */
export function setRate(next: number): void {
  if (rate === next) return;
  rate = next;
  told(tickers);
}

/** For tests: forget the player. */
export function forgetSound(): void {
  playing = null;
  at = 0;
  span = 0;
  going = false;
  rate = 1;
  wanted = null;
  asked = null;
  last = { time: 0, duration: 0, going: false, rate: 1 };
}
