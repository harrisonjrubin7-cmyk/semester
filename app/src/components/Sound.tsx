/**
 * The app's one audio element, mounted above everything that can unmount.
 *
 * Mounted once at the top of the app, like `Ringing` and `Keys`, and for the
 * same reason: a lesson is forty minutes long and checking tomorrow's
 * deadline halfway through should not end it. Every screen is drawn under a
 * `key={state.screen}` (`App.tsx`), so an element owned by a screen dies the
 * moment you look at something else — which is exactly what used to happen,
 * and why a tab in this app could never make a noise you were not watching.
 *
 * It renders no controls and takes no space. The screen that started the
 * sound draws the controls and asks this through `lib/sound.hook.ts`; the
 * strip draws a speaker on the tab that owns it. Both are views on one
 * element, which is what makes them agree.
 *
 * ## Muting is here, and stopping is not
 *
 * `muted` is read off the owning *tab* (`mutedTab`), so silencing a tab from
 * the strip leaves the lesson running and keeps its place — turning a tab
 * down rather than closing it, which is the distinction a browser draws and
 * the reason it offers both. When the tab that owns the sound goes away or
 * navigates elsewhere, `survives` in `lib/sound.ts` answers null and this
 * unmounts the element, which is what actually stops the audio.
 */

import { useEffect, useRef } from 'react';
import { nowPlaying, playbackIs } from '../lib/device';
import { useKeepAwake } from '../lib/awake';
import { asset } from '../lib/asset';
import { mutedTab } from '../lib/browser';
import { useStrip } from '../lib/browser.hook';
import {
  ask,
  heard,
  seekTo,
  takeAsk,
  takeSeek,
  usePlayback,
  useSound,
} from '../lib/sound.hook';

export function Sound() {
  const sound = useSound();
  const strip = useStrip();
  const { going, rate } = usePlayback();
  const el = useRef<HTMLAudioElement>(null);
  const muted = sound ? mutedTab(strip, sound.tab) : false;

  // A lesson is minutes of audio. The screen locking halfway through is the
  // reason people give up on one, and it is no less true now that the screen
  // showing it may be a different tab's.
  useKeepAwake(going);

  /*
   * The lock screen, the headphone button and the car stereo. This moved up
   * here with the element: the handlers have to outlive the screen, or pausing
   * a lesson from a pocket would work only while you happened to be looking
   * at it.
   */
  useEffect(() => {
    if (!sound) {
      nowPlaying(null);
      return;
    }
    nowPlaying(
      { title: sound.title, course: sound.course, album: sound.album },
      {
        play: () => ask('play'),
        pause: () => ask('pause'),
        seekbackward: () => seekTo((el.current?.currentTime ?? 0) - 15),
        seekforward: () => seekTo((el.current?.currentTime ?? 0) + 15),
      },
    );
    return () => nowPlaying(null);
  }, [sound]);

  useEffect(() => {
    playbackIs(going ? 'playing' : 'paused');
  }, [going]);

  // Speed is a player setting rather than a per-file one, so it is re-applied
  // whenever the element is handed a different source.
  useEffect(() => {
    if (el.current) el.current.playbackRate = rate;
  }, [rate, sound?.src]);

  /*
   * The two things a screen can ask for, taken rather than watched: a seek to
   * the same second twice, or a second press of Play, has to reach the
   * element both times, and a value held in the store would compare equal and
   * be dropped.
   */
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const to = takeSeek();
    if (to !== null) {
      node.currentTime = to;
      void node.play().catch(() => {});
    }
    const wants = takeAsk();
    if (wants === 'play') void node.play().catch(() => {});
    if (wants === 'pause') node.pause();
  });

  if (!sound) return null;

  return (
    <audio
      ref={el}
      preload="metadata"
      src={asset(sound.src)}
      muted={muted}
      onLoadedMetadata={(e) => heard({ duration: e.currentTarget.duration })}
      onTimeUpdate={(e) => heard({ time: e.currentTarget.currentTime })}
      onPlay={() => heard({ going: true })}
      onPause={() => heard({ going: false })}
      onEnded={() => heard({ going: false })}
      style={{ display: 'none' }}
    >
      <track kind="captions" />
    </audio>
  );
}
