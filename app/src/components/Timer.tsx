/**
 * Start, pause, stop — and what happens to the minutes.
 *
 * The app already asks how long something took, once, when you tick it off.
 * That is a guess, and a good one. This is the same number measured, and it
 * feeds the same `spent` record, so a term with some timed sessions and some
 * tapped buckets gives better estimates than either would alone.
 *
 * ## Stopping is where the care is
 *
 * A timer that quietly wrote whatever number it held would be worse than no
 * timer, because the wrong number is invisible: it goes into a median and
 * comes back out weeks later as a forecast nobody can explain. So the three
 * outcomes are separated at the point of stopping. An ordinary session is
 * recorded and says so. A session under two minutes is dropped, because it was
 * a mis-tap. A session past eight hours is *not* recorded — the buckets are
 * offered instead, and the student says what it really was.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { useSitting } from '../lib/sitting.hook';
import {
  LONGEST,
  abandoned,
  begin,
  carryOn,
  clockLine,
  elapsed,
  finish,
  hold,
  running,
} from '../lib/session';
import { BUCKETS, askAbout } from '../lib/pace';

/** What to show once a session has ended. */
type Ended =
  | { kind: 'none' }
  | { kind: 'kept'; minutes: number }
  | { kind: 'dropped' }
  | { kind: 'ask'; minutes: number };

export function Timer({
  id,
  courseId,
  kind,
  title,
}: {
  id: string;
  courseId: string;
  kind: string;
  title: string;
}) {
  // The store's clock, not `Date.now()`: it is already re-rendered every
  // thirty seconds with the seconds zeroed, which is the granularity the whole
  // app counts in — so the display follows it for free and there is no second
  // interval running alongside the first. Stopping uses the real moment,
  // because that is a click and not a render.
  const { state, dispatch, now } = useStore();
  const [sitting, setSitting] = useSitting();
  const [ended, setEnded] = useState<Ended>({ kind: 'none' });

  const mine = sitting && sitting.id === id ? sitting : null;
  const elsewhere = sitting && sitting.id !== id ? sitting : null;

  const stop = () => {
    if (!mine) return;
    // The store's clock again, not the real moment — because this has to
    // record the number the student is looking at. The store zeroes seconds,
    // so a session showing "46 min" is 46 min 55 s of wall time, and taking
    // the real moment here would file 47 against a screen that said 46. A
    // minute either way is nothing; a figure that disagrees with the display
    // is a thing nobody can explain to themselves later.
    const out = finish(mine, now.getTime());
    setSitting(null);
    if (out.tooShort) {
      setEnded({ kind: 'dropped' });
      return;
    }
    if (out.tooLong) {
      // Not recorded. Eight hours on one problem set is nearly always a laptop
      // that was closed rather than a session that was worked.
      setEnded({ kind: 'ask', minutes: out.minutes });
      return;
    }
    dispatch({ type: 'timeSpent', id, courseId, kind, minutes: out.minutes });
    setEnded({ kind: 'kept', minutes: out.minutes });
  };

  // Nothing to offer once this piece of work already has a time against it,
  // whether it was timed or tapped — the same rule the bucket row follows.
  const worthAsking = askAbout(state.spent, id, courseId, kind);

  if (ended.kind === 'kept') {
    return (
      <div style={{ fontSize: 12.5, opacity: 0.7, padding: '9px 0', lineHeight: 1.45 }}>
        {clockLine(ended.minutes)} on this, recorded. The week ahead knows your pace a little
        better than it did.
      </div>
    );
  }

  if (ended.kind === 'dropped') {
    return (
      <div style={{ fontSize: 12.5, opacity: 0.55, padding: '9px 0' }}>
        Under two minutes — not counted.
      </div>
    );
  }

  if (ended.kind === 'ask') {
    return (
      <div style={{ padding: '9px 0 4px' }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 7, lineHeight: 1.45 }}>
          That ran for {clockLine(ended.minutes)}, which is longer than the app will take on
          trust — a timer left running looks exactly like this. What was it really?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                dispatch({ type: 'timeSpent', id, courseId, kind, bucketId: b.id });
                setEnded({ kind: 'none' });
              }}
              style={{ height: 32, fontSize: 12, padding: '0 10px', flex: 'none' }}
            >
              {b.label}
            </button>
          ))}
          <button
            type="button"
            className="bare"
            onClick={() => setEnded({ kind: 'none' })}
            style={{ height: 32, fontSize: 12, opacity: 0.5, width: 'auto', padding: '0 8px' }}
          >
            Forget it
          </button>
        </div>
      </div>
    );
  }

  if (!mine) {
    if (!worthAsking) return null;
    return (
      <div style={{ padding: '9px 0 4px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSitting(begin({ id, courseId, kind, title }, Date.now()))}
          // `Date.now()` for the start and the pauses, which are moments
          // rather than displayed figures: banking the store's stale minute
          // would lose up to thirty seconds on every pause.
          style={{ height: 36, fontSize: 12.5, paddingInline: 16 }}
        >
          Start working on this
        </button>
        {elsewhere ? (
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6, lineHeight: 1.4 }}>
            {/* Said rather than prevented: the student may well have moved on
                to this and forgotten the other one, and starting here should
                not be blocked by a timer they have already abandoned. */}
            A timer is running on {elsewhere.title || 'something else'}. Starting this one stops
            counting that one where it stands.
          </div>
        ) : null}
      </div>
    );
  }

  const spent = elapsed(mine, now.getTime());
  const lost = abandoned(mine, now.getTime());

  return (
    <div
      style={{
        padding: '10px 12px',
        marginTop: 9,
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line-top)',
        background: 'var(--app-hero)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          className="chrome-text"
          style={{ fontSize: 20, flex: 1, fontVariantNumeric: 'tabular-nums' }}
        >
          {clockLine(spent)}
        </div>
        <button
          type="button"
          className="bare tappable"
          onClick={() =>
            setSitting(running(mine) ? hold(mine, Date.now()) : carryOn(mine, Date.now()))
          }
          style={{ width: 'auto', padding: '0 10px', height: 32, fontSize: 12, opacity: 0.75 }}
        >
          {running(mine) ? 'Pause' : 'Carry on'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={stop}
          style={{ height: 32, fontSize: 12, paddingInline: 14, flex: 'none' }}
        >
          Stop
        </button>
      </div>
      {lost ? (
        <div style={{ fontSize: 11.5, opacity: 0.7, marginTop: 7, lineHeight: 1.4 }}>
          This has been running over {LONGEST / 60} hours. Stop it and the app will ask what it
          really was rather than recording this.
        </div>
      ) : null}
      {!running(mine) ? (
        <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 7 }}>Paused. Nothing is counting.</div>
      ) : null}
    </div>
  );
}
