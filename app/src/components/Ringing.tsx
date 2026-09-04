/**
 * What happens when a timer or an alarm goes off.
 *
 * Mounted once at the top of the app, like `Keys`, so a timer set on the
 * kitchen screen still rings while you are three screens away reading a
 * syllabus. Renders nothing at all until something is due.
 *
 * ## The tick is local, and only while something is counting
 *
 * The store re-renders every thirty seconds, which is right for "in 1 hr 19
 * min" and useless for a countdown that has to show 0:09. So this keeps its
 * own one-second interval — and starts it only when there is a running timer
 * or an alarm switched on, so a student with neither pays nothing for the
 * feature existing.
 *
 * ## The sound is made, not fetched
 *
 * See `lib/chime.ts`. It lives there rather than here because it is not a
 * component and the screen that starts a timer needs it too — the first sound
 * a browser makes has to follow a gesture, and starting a timer is the gesture.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { chime } from '../lib/chime';
import {
  alarmDue,
  clockFace,
  gaveUp,
  lengthLine,
  rang,
  silence,
  startRing,
  timeLine,
  whatIsRinging,
} from '../lib/clocks';

/** A system notification, if and only if it has already been permitted. */
function notify(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    new Notification(title, { body, tag: 'semester-clock' });
  } catch {
    // Some browsers throw on a constructed Notification outside a service
    // worker. The overlay does not care.
  }
}

export function Ringing() {
  const { state, dispatch } = useStore();
  const [, tick] = useState(0);
  const sounded = useRef<Set<string>>(new Set());

  const counting = state.timers.some((t) => t.endsAt !== null);
  const watching = counting || state.alarms.some((a) => a.on || a.ringingAt > 0);

  useEffect(() => {
    if (!watching) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [watching]);

  const now = new Date();
  const going = whatIsRinging(state.timers, state.alarms, now);
  const all = [...going.timers, ...going.alarms];

  /*
   * An alarm's minute starts it ringing; only Stop ends it.
   *
   * Before this, the overlay was drawn straight from "is it this alarm's
   * minute", which meant being on another tab for ninety seconds missed it
   * completely — the one thing an alarm may not do. The trigger is still a
   * single minute, so a tab opened at lunchtime does not fire the 7am alarm it
   * slept through, but what the trigger does now is set a flag rather than be
   * the whole state.
   */
  useEffect(() => {
    for (const a of state.alarms) {
      if (alarmDue(a, new Date())) {
        dispatch({ type: 'patchAlarm', id: a.id, patch: startRing(a, new Date()) });
      } else if (gaveUp(a, new Date())) {
        // Rang into an empty room. Marked as rung so it does not greet you
        // hours later claiming to be this morning.
        dispatch({ type: 'patchAlarm', id: a.id, patch: rang(a, new Date()) });
      }
    }
  });

  // Sound once per thing, not once per second. The ref is the right place for
  // this: it is not state anybody renders, and making it state would restart
  // the effect below every time it changed.
  useEffect(() => {
    for (const t of going.timers) {
      if (sounded.current.has(t.id)) continue;
      sounded.current.add(t.id);
      chime();
      notify(t.label || 'Timer', `${lengthLine(t.seconds)} is up.`);
    }
    for (const a of going.alarms) {
      const key = `${a.id}:${now.toDateString()}`;
      if (sounded.current.has(key)) continue;
      sounded.current.add(key);
      chime();
      notify(a.label || 'Alarm', timeLine(a.at));
    }
  });

  if (all.length === 0) return null;

  const stop = () => {
    for (const t of going.timers) {
      dispatch({ type: 'patchTimer', id: t.id, timer: silence(t) });
    }
    for (const a of going.alarms) {
      dispatch({ type: 'patchAlarm', id: a.id, patch: rang(a, now) });
    }
  };

  return (
    <div
      role="alertdialog"
      aria-label="Something is going off"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 90,
        background: 'var(--app-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div className="kicker">
        {going.timers.length > 0 && going.alarms.length > 0
          ? 'Timer and alarm'
          : going.timers.length > 0
            ? going.timers.length === 1
              ? 'Timer'
              : `${going.timers.length} timers`
            : going.alarms.length === 1
              ? 'Alarm'
              : `${going.alarms.length} alarms`}
      </div>

      {going.timers.map((t) => (
        <div key={t.id}>
          <div style={{ fontSize: 'calc(38px * var(--text-scale, 1))', fontVariantNumeric: 'tabular-nums' }}>
            {clockFace(0)}
          </div>
          <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.7 }}>
            {t.label || lengthLine(t.seconds)}
          </div>
        </div>
      ))}

      {going.alarms.map((a) => (
        <div key={a.id}>
          <div style={{ fontSize: 'calc(38px * var(--text-scale, 1))', fontVariantNumeric: 'tabular-nums' }}>
            {timeLine(a.at)}
          </div>
          <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))', opacity: 0.7 }}>
            {a.label || 'Alarm'}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn btn-primary"
        onClick={stop}
        autoFocus
        style={{ marginTop: 18, minWidth: 180, height: 48, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        Stop
      </button>
    </div>
  );
}
