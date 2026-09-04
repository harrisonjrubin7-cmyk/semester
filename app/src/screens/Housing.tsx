import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { TermSwitch } from '../components/TermSwitch';
import { CAMPUS_LINKS } from '../data/campus';
import { readTerm } from '../lib/term';
import { datedItems, railFor } from '../lib/select';
import { clock } from '../lib/date';
import { matchPlace } from '../lib/rooms';
import {
  current,
  homeLine,
  homeWalk,
  moveOutAt,
  moveOutLine,
  morningLine,
  packLine,
} from '../lib/housing';

/**
 * Where you live, and the two sums the housing portal never does.
 *
 * StarRez holds a room assignment, a selection timeslot and a move-out rule.
 * It states each of them and stops — the same omission as the balance page:
 * the facts are there and the arithmetic on them is left to a student at
 * eleven at night.
 *
 * The app does two things with them that the portal cannot. It is the only
 * thing on the phone that knows when your last exam is, so "24 hours after
 * your last final" becomes a date and then a count of what still stands
 * before it. And it is the only thing that knows where your nine o'clock is,
 * so a hall on the map becomes a time to leave.
 *
 * Nothing is fetched. The portal is behind single sign-on and publishes no
 * interface a student can use, so reading it would mean holding your
 * university credentials — which this app will never do.
 */
export function Housing() {
  const { state, dispatch, now, catalog } = useStore();

  const mine = useMemo(() => current(state.residences, state.term), [state.residences, state.term]);

  const [hall, setHall] = useState(mine?.hall ?? '');
  const [room, setRoom] = useState(mine?.room ?? '');
  const [out, setOut] = useState(mine?.moveOut ?? '');
  const [hours, setHours] = useState(String(mine?.hoursAfterLastExam || ''));
  const [bad, setBad] = useState('');

  const exams = useMemo(
    () => datedItems(catalog, now).filter((i) => i.kind === 'Exam'),
    [catalog, now],
  );
  const lastExam = useMemo(() => {
    const sorted = [...exams].sort((a, b) => b.date.getTime() - a.date.getTime());
    return sorted[0] ? { title: sorted[0].title, date: sorted[0].date } : null;
  }, [exams]);

  const moveOut = useMemo(() => moveOutAt(mine, lastExam), [mine, lastExam]);

  // The first class of today, which is the one you leave the building for.
  // Not `nextClass` from select.ts — that is whatever is next, which by two
  // in the afternoon is a walk from another building rather than from home.
  const firstToday = useMemo(() => {
    const first = railFor(catalog, now, state.appointments, state.commitments).find(
      (b) => !b.optional && !b.canceled && b.c !== null,
    );
    if (!first) return null;
    const course = first.c ? catalog.byId[first.c] : null;
    return { title: first.title, room: course?.room ?? first.meta, at: first.at };
  }, [catalog, now, state.appointments, state.commitments]);

  const walk = useMemo(
    () => homeWalk(mine, firstToday?.room ?? '', state.places),
    [mine, firstToday, state.places],
  );

  const link = state.linkUrls.starrez || CAMPUS_LINKS.find((l) => l.id === 'starrez')?.url || '';
  const hallSaved = mine ? Boolean(matchPlace(mine.hall, state.places)) : false;

  const save = () => {
    if (!hall.trim()) {
      setBad('The building is the one field this needs — everything else is optional.');
      return;
    }
    const n = hours.trim() ? Number(hours) : 0;
    if (!Number.isFinite(n) || n < 0 || n > 168) {
      setBad('Hours after your last exam has to be a number of hours, or left blank.');
      return;
    }
    dispatch({
      type: 'setResidence',
      residence: {
        hall: hall.trim(),
        room: room.trim(),
        term: state.term,
        moveOut: out.trim(),
        hoursAfterLastExam: Math.round(n),
      },
    });
    setBad('');
  };

  return (
    <div style={{ padding: 18 }}>
      <TermSwitch />

      <Blueprint style={{ padding: '15px 16px', marginTop: 12 }}>
        <div className="kicker">{readTerm(state.term).label}</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(21px * var(--text-scale, 1))', lineHeight: 1.25, marginTop: 6, textWrap: 'pretty' }}
        >
          {mine ? homeLine(mine) : 'No room on file yet.'}
        </div>
        <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.8, marginTop: 8, lineHeight: 1.5 }}>
          {moveOutLine(moveOut, now)}
        </div>
        {packLine(exams, moveOut, now) ? (
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, marginTop: 6, lineHeight: 1.5 }}>
            {packLine(exams, moveOut, now)}
          </div>
        ) : null}
      </Blueprint>

      {mine && firstToday ? (
        <Blueprint plain style={{ padding: '13px 14px', marginTop: 10 }}>
          <div className="kicker">The first walk of the day</div>
          <div style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', marginTop: 6, lineHeight: 1.5, textWrap: 'pretty' }}>
            {walk.known && walk.minutes > 0
              ? morningLine(mine, firstToday, state.places, clock)
              : hallSaved
                ? `${firstToday.title} is in a building the app cannot place. Save it on the map and it will say what time to leave.`
                : `Save ${mine.hall} on the map and the app can say what time to leave for your first class.`}
          </div>
          {!walk.known ? (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => dispatch({ type: 'go', screen: 'maps' })}
              style={{ height: 38, marginTop: 9, fontSize: 'calc(12.5px * var(--text-scale, 1))' }}
            >
              Open the map
            </button>
          ) : null}
        </Blueprint>
      ) : null}

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-block"
          style={{
            height: 46,
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Open the housing portal →
        </a>
      ) : null}

      <SectionLabel>What it says</SectionLabel>
      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 9, lineHeight: 1.5 }}>
        The building is the only field that matters. Give it a move-out date if housing named one,
        or the hours after your last exam if that is how they put it — the app will not do both.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          className="input"
          value={hall}
          aria-label="Residence hall"
          placeholder="Building"
          onChange={(e) => setHall(e.target.value)}
          style={{ flex: 2, minWidth: 0 }}
        />
        <input
          className="input"
          value={room}
          aria-label="Room number"
          placeholder="Room"
          onChange={(e) => setRoom(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          className="input"
          value={out}
          aria-label="Move-out date"
          placeholder="Move-out (2026-12-19)"
          onChange={(e) => setOut(e.target.value)}
          style={{ flex: 2, minWidth: 0 }}
        />
        <input
          className="input"
          value={hours}
          aria-label="Hours after your last exam"
          placeholder="or hrs"
          inputMode="numeric"
          onChange={(e) => setHours(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      {bad ? (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-warn)', marginBottom: 8, lineHeight: 1.45 }}>
          {bad}
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={save}
        style={{ height: 42 }}
      >
        {mine ? 'Update it' : 'Save it'}
      </button>

      {!lastExam && (
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 10, lineHeight: 1.45 }}>
          No exams on any syllabus yet, so a move-out counted from your last one stays a rule
          rather than a date. Import a syllabus with a final on it and the app will do the sum.
        </div>
      )}

      {mine && (
        <>
          <SectionLabel>On file</SectionLabel>
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'baseline',
              padding: '9px 0',
              borderBottom: '1px solid var(--app-line)',
            }}
          >
            <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13px * var(--text-scale, 1))' }}>
              {homeLine(mine)}
              {mine.moveOut ? ` · out ${mine.moveOut}` : ''}
              {mine.hoursAfterLastExam ? ` · ${mine.hoursAfterLastExam} hrs after the last exam` : ''}
            </span>
            <button
              type="button"
              className="bare"
              aria-label="Remove this room"
              onClick={() => dispatch({ type: 'dropResidence', id: mine.id })}
              style={{ flex: 'none', width: 24, opacity: 0.4, fontSize: 'calc(14px * var(--text-scale, 1))' }}
            >
              ×
            </button>
          </div>
        </>
      )}

      <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 14, lineHeight: 1.45 }}>
        Nothing is fetched. The housing portal is behind single sign-on and publishes no interface a
        student can use, so reading it would mean holding your university credentials — which this
        app will not do. The address the portal hands you carries your own session token in it;
        the app keeps only the portal root, because a link with your token in it is a link that
        signs somebody else in as you.
      </div>
      <div style={{ height: 26 }} />
    </div>
  );
}
