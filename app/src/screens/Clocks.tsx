/**
 * Timers and alarms.
 *
 * The app already had a clock and it was the wrong one for most of a day. The
 * work-session timer counts *up*, belongs to an assignment, and what it
 * records goes into the estimate of how long that kind of work takes you —
 * exactly right for "how long did that problem set take", and no use at all
 * for "ten minutes for the pasta" or "wake me at 6:40".
 *
 * These belong to nothing. Nothing here touches your pace, your grades or your
 * deadlines, which is the point: a student is a person, and a person needs a
 * kitchen timer.
 *
 * ## It says what it cannot do
 *
 * A web page cannot wake a sleeping phone. The line saying so sits under the
 * alarm list where somebody would set one, not buried in a help screen, because
 * the alternative is finding out by sleeping through a lecture. Where the
 * browser can do better — a notification that survives the tab going to the
 * background — the screen offers it rather than assuming it.
 */

import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { chime } from '../lib/chime';
import {
  PRESETS,
  clockFace,
  daysLine,
  lengthLine,
  pause,
  readDuration,
  remaining,
  reset,
  resume,
  running,
  stretch,
  timeLine,
  untilLine,
  type Timer,
} from '../lib/clocks';

/**
 * The time, once a second, for as long as this screen is open.
 *
 * It returns the clock rather than a counter so that nothing has to read
 * `Date.now()` during a render — a render has to be a pure function of state,
 * and a clock read inside one is a value that changes without anybody saying
 * so. The reading is taken in the interval, which is an event, and handed down
 * as state.
 *
 * Not gated on anything counting. Gating it saved one interval on one screen
 * and cost a visibly wrong number for up to a second after Resume, drawn from
 * the reading the screen froze on when everything was paused.
 */
function useNow(): number {
  const [at, set] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => set(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return at;
}

export function Clocks() {
  const { state } = useStore();
  const [tab, setTab] = useState<'timers' | 'alarms'>('timers');

  return (
    <div style={{ padding: 18 }}>
      {/* No heading here: the app's own header already carries the kicker and
          the title for every screen, and a second copy read as a bug. */}
      <Segmented
        options={[
          { id: 'timers', label: `Timers${state.timers.length ? ` (${state.timers.length})` : ''}` },
          { id: 'alarms', label: `Alarms${state.alarms.length ? ` (${state.alarms.length})` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
        style={{ margin: '0 0 16px' }}
      />

      {tab === 'timers' ? <Timers /> : <Alarms />}
    </div>
  );
}

function Timers() {
  const { state, dispatch, say } = useStore();
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [refused, setRefused] = useState('');

  const at = useNow();

  const start = (seconds: number, name = label) => {
    dispatch({ type: 'addTimer', label: name, seconds, at: Date.now() });
    say(`${name.trim() || 'Timer'} started, ${Math.round(seconds / 60)} minutes.`);
    setText('');
    setLabel('');
    setRefused('');
    // The first sound a browser makes has to follow a gesture. Starting a
    // timer is a gesture, so the audio context is unlocked here rather than
    // at the moment the timer fires — by which point the tab may have been in
    // the background for twenty minutes and the tone would be refused.
    chime();
  };

  const startTyped = () => {
    const seconds = readDuration(text);
    if (seconds === null) {
      setRefused('Try 25, 1:30, 90s or 1h20.');
      return;
    }
    start(seconds);
  };

  return (
    <>
      <SectionLabel style={{ margin: '0 0 10px' }}>Set one</SectionLabel>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            className="bare tappable"
            onClick={() => start(m * 60)}
            style={{
              width: 'auto',
              padding: '9px 14px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
              fontSize: 'calc(13px * var(--text-scale, 1))',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {m} min
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRefused('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') startTyped();
          }}
          placeholder="25, 1:30, 90s, 1h20"
          aria-label="How long"
          inputMode="text"
          style={{ flex: 1, height: 42 }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={startTyped}
          style={{ width: 'auto', padding: '0 18px', height: 42, textTransform: 'uppercase', letterSpacing: '0.09em' }}
        >
          Start
        </button>
      </div>
      <input
        className="input"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="What it is for — optional"
        aria-label="What the timer is for"
        style={{ width: '100%', height: 40, marginTop: 8 }}
      />
      {refused ? (
        <div
          role="status"
          style={{
            fontSize: 'calc(12px * var(--text-scale, 1))',
            marginTop: 7,
            color: 'var(--app-warn-ink, var(--app-fg))',
            opacity: 0.85,
          }}
        >
          {refused}
        </div>
      ) : null}

      {state.timers.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 10px' }}>Running</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {state.timers.map((t) => (
              <TimerRow key={t.id} t={t} at={at} />
            ))}
          </div>
        </>
      ) : (
        <p
          style={{
            marginTop: 22,
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.6,
            lineHeight: 1.5,
            textWrap: 'pretty',
          }}
        >
          Nothing counting. These are ordinary timers — they belong to no course and
          nothing they do reaches your grades or your pace.
        </p>
      )}
    </>
  );
}

function TimerRow({ t, at }: { t: Timer; at: number }) {
  const { dispatch, say } = useStore();
  // Two clocks, deliberately. `at` is the reading this frame was drawn from,
  // handed down from `useNow`, and is only ever used to put a remainder on the
  // screen — safe, because a running timer redraws every second.
  //
  // A handler must not use it. A paused timer stops redrawing, so by the time
  // somebody taps Resume that reading can be minutes old, and resuming against
  // it hands back a countdown short by exactly how long the pause lasted.
  // Found by pausing one for thirty seconds and watching 1:28 come back as
  // 0:59.
  const left = remaining(t, at);
  const swap = (next: (now: number) => Timer) =>
    dispatch({ type: 'patchTimer', id: t.id, timer: next(Date.now()) });

  const pct = t.seconds > 0 ? Math.min(100, Math.max(0, ((t.seconds - left) / t.seconds) * 100)) : 0;

  return (
    <Blueprint style={{ padding: '13px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontSize: 'calc(28px * var(--text-scale, 1))',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.01em',
          }}
        >
          {clockFace(left)}
        </span>
        <span
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.65,
            textWrap: 'pretty',
          }}
        >
          {t.label || lengthLine(t.seconds)}
          {running(t) ? '' : ' · paused'}
        </span>
      </div>

      {/* A bar as well as a number: at a glance across a room the number is
          unreadable and the bar is not. */}
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'var(--app-line)',
          margin: '10px 0 11px',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--app-accent)' }} />
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <Small onClick={() => swap((now) => (running(t) ? pause(t, now) : resume(t, now)))}>
          {running(t) ? 'Pause' : 'Resume'}
        </Small>
        <Small onClick={() => swap((now) => stretch(t, 60, now))}>+1 min</Small>
        <Small onClick={() => swap(() => reset(t))}>Reset</Small>
        <Small
          onClick={() => {
            dispatch({ type: 'removeTimer', id: t.id });
            say(`${t.label || 'Timer'} cleared.`);
          }}
        >
          Clear
        </Small>
      </div>
    </Blueprint>
  );
}

function Small({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onClick}
      style={{
        width: 'auto',
        padding: '7px 12px',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--app-line)',
        fontSize: 'calc(12px * var(--text-scale, 1))',
      }}
    >
      {children}
    </button>
  );
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Alarms() {
  const { state, dispatch, now } = useStore();
  const [time, setTime] = useState('07:30');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [allowed, setAllowed] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const add = () => {
    const [h, m] = time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return;
    dispatch({ type: 'addAlarm', label, at: h * 60 + m, days });
    setLabel('');
  };

  const ask = () => {
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission().then(setAllowed);
  };

  return (
    <>
      <SectionLabel style={{ margin: '0 0 10px' }}>Set one</SectionLabel>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="What time"
          style={{ width: 132, height: 42, fontVariantNumeric: 'tabular-nums' }}
        />
        <input
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What for — optional"
          aria-label="What the alarm is for"
          style={{ flex: 1, height: 42 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '10px 0 0' }}>
        {DAY_LETTERS.map((letter, d) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              className="bare tappable"
              aria-pressed={on}
              aria-label={DAY_NAMES[d]}
              onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-fill)' : 'transparent',
                fontSize: 'calc(12px * var(--text-scale, 1))',
              }}
            >
              {letter}
            </button>
          );
        })}
      </div>
      <div
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          opacity: 0.55,
          margin: '7px 0 0',
        }}
      >
        {daysLine(days) === 'Once' ? 'No days chosen — it rings once, at the next one.' : daysLine(days)}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={add}
        style={{ height: 44, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.09em' }}
      >
        Add alarm
      </button>

      {state.alarms.length > 0 ? (
        <>
          <SectionLabel style={{ margin: '24px 0 10px' }}>Set</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {state.alarms.map((a) => (
              <Blueprint key={a.id} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'calc(21px * var(--text-scale, 1))',
                        fontVariantNumeric: 'tabular-nums',
                        opacity: a.on ? 1 : 0.45,
                      }}
                    >
                      {timeLine(a.at)}
                    </div>
                    <div
                      style={{
                        fontSize: 'calc(12px * var(--text-scale, 1))',
                        opacity: 0.62,
                        marginTop: 2,
                        textWrap: 'pretty',
                      }}
                    >
                      {[a.label, daysLine(a.days), untilLine(a, now)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="bare tappable"
                    aria-pressed={a.on}
                    aria-label={`${a.label || timeLine(a.at)} — ${a.on ? 'on' : 'off'}`}
                    onClick={() =>
                      dispatch({
                        type: 'patchAlarm',
                        id: a.id,
                        // Switching an alarm back on clears the mark saying it
                        // already rang today, or an alarm turned off and on
                        // again in the morning would stay silent until
                        // tomorrow.
                        patch: a.on
                          ? { on: false, ringingAt: 0 }
                          : { on: true, lastRang: '', ringingAt: 0 },
                      })
                    }
                    style={{
                      width: 'auto',
                      padding: '7px 12px',
                      borderRadius: 'var(--r-sm)',
                      border: `1px solid ${a.on ? 'var(--app-accent)' : 'var(--app-line)'}`,
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {a.on ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    className="bare tappable"
                    onClick={() => dispatch({ type: 'removeAlarm', id: a.id })}
                    aria-label={`Delete the ${timeLine(a.at)} alarm`}
                    style={{ width: 'auto', padding: '7px 10px', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5 }}
                  >
                    Delete
                  </button>
                </div>
              </Blueprint>
            ))}
          </div>
        </>
      ) : null}

      <SectionLabel style={{ margin: '24px 0 8px' }}>What this can and cannot do</SectionLabel>
      <p
        style={{
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          opacity: 0.68,
          lineHeight: 1.55,
          textWrap: 'pretty',
        }}
      >
        It rings while Semester is open. No web page can wake a phone that has gone to
        sleep or been closed, and this one will not pretend it can — for a lecture you
        cannot miss, set your phone&rsquo;s own alarm as well.
        {allowed === 'granted'
          ? ' Notifications are allowed, so it can also reach you with the tab in the background.'
          : allowed === 'denied'
            ? ' Notifications are blocked for this site, so it can only ring on this screen.'
            : ''}
      </p>
      {allowed === 'default' ? (
        <button
          type="button"
          className="bare tappable"
          onClick={ask}
          style={{
            width: 'auto',
            marginTop: 8,
            padding: '9px 14px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--app-line)',
            fontSize: 'calc(12px * var(--text-scale, 1))',
          }}
        >
          Let it notify me in the background
        </button>
      ) : null}
    </>
  );
}
