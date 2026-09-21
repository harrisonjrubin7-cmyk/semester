import { useState } from 'react';
import { secondLine } from '../lib/dim';
import { ActionButton, SectionLabel } from './ui';
import { NotOfficial } from './NotOfficial';
import {
  ATHLETICS_LIMITS,
  CARA_KINDS,
  type AthleticsLibrary,
  type CaraEntry,
  type CaraKind,
} from '../lib/athletics';
import { fromSeason, limitOf, logged, weekLine, weekOf, weeks } from '../lib/cara';

/**
 * The hours, written down where they can be added up.
 *
 * An athlete is usually told to keep a record of countable
 * athletically-related activity. The record they are given is a paper sheet or
 * a spreadsheet nobody reconciles, and the thing it is for — noticing in week
 * six that the weeks have been running long, while something can still be said
 * about it — is the one thing a sheet in a drawer cannot do.
 *
 * The arithmetic is `lib/cara.ts`, which says at length what this will not do:
 * no activity is judged countable, no limit is supplied, and no week is called
 * compliant or otherwise. The comparison is against a figure the student typed
 * in from whoever told them it, and the banner above it says the rest.
 *
 * ## Why it offers the season back
 *
 * Typing a practice twice — once as a calendar event, once as an hours entry —
 * is why a log stops being kept in week three. The season is already in this
 * workspace with its hours in it. `fromSeason` turns a week of it into draft
 * entries; the student presses, reads them, and edits or deletes what is
 * wrong. It is never written without the press, because only the athlete knows
 * which of two identical-looking sessions was required.
 */
export function CaraLog({
  value,
  update,
  blocked,
}: {
  value: AthleticsLibrary;
  update: (change: (old: AthleticsLibrary) => AthleticsLibrary) => boolean;
  blocked: boolean;
}) {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [date, setDate] = useState(iso);
  const [hours, setHours] = useState('');
  const [kind, setKind] = useState<CaraKind>('Practice');
  const [note, setNote] = useState('');
  const [said, setSaid] = useState('');

  const limit = limitOf(value.caraLimit);
  const rows = weeks(value.cara);

  const line = {
    fontSize: 'var(--type-sm)',
    ...secondLine(),
    lineHeight: 'var(--leading-normal)',
    textWrap: 'pretty',
  } as const;

  const add = () => {
    const n = Number(hours);
    if (!Number.isFinite(n) || n <= 0 || n > ATHLETICS_LIMITS.caraHours) {
      setSaid(`Enter hours between 0 and ${ATHLETICS_LIMITS.caraHours}.`);
      return;
    }
    const entry: CaraEntry = {
      id: crypto.randomUUID(),
      date,
      hours: Math.round(n * 10) / 10,
      kind,
      note: note.slice(0, ATHLETICS_LIMITS.caraNote),
    };
    if (update((old) => ({ ...old, cara: [...old.cara, entry] }))) {
      setHours('');
      setNote('');
      setSaid('Logged.');
    }
  };

  /** This week's sessions from the season, as drafts. */
  const pull = () => {
    const start = weekOf(iso);
    const end = new Date(`${start}T12:00`);
    end.setDate(end.getDate() + 6);
    const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const drafts = fromSeason(value.events, start, to);
    if (drafts.length === 0) {
      setSaid('Nothing in your schedule for this week to bring in.');
      return;
    }
    // Same day, same kind, same note already logged is the same session
    // offered twice. A student who presses this on Wednesday and again on
    // Friday should get Thursday's session, not a second Monday.
    const fresh = drafts.filter(
      (d) => !value.cara.some((c) => c.date === d.date && c.kind === d.kind && c.note === d.note),
    );
    if (fresh.length === 0) {
      setSaid('This week’s sessions are already in the log.');
      return;
    }
    if (update((old) => ({ ...old, cara: [...old.cara, ...fresh.map((d) => ({ ...d, id: crypto.randomUUID() }))] }))) {
      setSaid(
        `${fresh.length} brought in from your schedule as your own entries. Check the hours and delete anything that was not required.`,
      );
    }
  };

  return (
    <>
      <NotOfficial>
        These are hours you typed in, added up. Nothing here decides whether an activity is
        countable, what your limit is, or whether a week was within it.
      </NotOfficial>

      <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
        <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
          The weekly limit you were told, and who told you
        </span>
        <input
          className="input"
          value={value.caraLimit}
          maxLength={ATHLETICS_LIMITS.caraLimit}
          placeholder="e.g. 20"
          onChange={(e) => update((old) => ({ ...old, caraLimit: e.target.value }))}
          style={{ width: '100%', marginTop: 'var(--sp-2)' }}
        />
      </label>
      <p style={{ ...line, marginBlock: 'calc(-1 * var(--sp-3)) var(--sp-5)' }}>
        {limit === null
          ? 'No figure entered, so the weeks below are totals and nothing more. The limit that applies to you depends on your division, your sport, and whether it is in season — your compliance office is the place that knows it.'
          : `Weeks below are measured against ${limit}. That is your figure, not the app’s.`}
      </p>

      <SectionLabel
        aside={`${logged(value.cara)} h`}
        style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}
      >
        Add an entry
      </SectionLabel>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <fieldset disabled={blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <label style={{ flex: '1 1 140px' }}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Date</span>
              <input
                className="input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              />
            </label>
            <label style={{ flex: '1 1 100px' }}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Hours</span>
              <input
                className="input"
                type="number"
                required
                min="0"
                max={ATHLETICS_LIMITS.caraHours}
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                style={{ width: '100%', marginTop: 'var(--sp-2)' }}
              />
            </label>
          </div>
          <label style={{ display: 'block', marginTop: 'var(--sp-5)' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>What it was</span>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as CaraKind)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            >
              {CARA_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'block', marginBlock: 'var(--sp-5)' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Note</span>
            <input
              className="input"
              value={note}
              maxLength={ATHLETICS_LIMITS.caraNote}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: '1 1 auto' }}>
              Log it
            </button>
            <ActionButton onClick={pull} style={{ flex: '1 1 auto' }}>
              Bring in this week’s schedule
            </ActionButton>
          </div>
        </fieldset>
      </form>

      {said && (
        <p
          role="status"
          style={{
            fontSize: 'var(--type-base)',
            lineHeight: 'var(--leading-normal)',
            marginTop: 'var(--sp-4)',
            textWrap: 'pretty',
          }}
        >
          {said}
        </p>
      )}

      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>By week</SectionLabel>
      {rows.length === 0 ? (
        <p style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-normal)' }}>
          Nothing logged yet. A week takes about a minute, and six of them is the first time anybody
          can see a pattern.
        </p>
      ) : (
        rows.map((w) => (
          <details key={w.start} style={{ borderBottom: '1px solid var(--app-line)', paddingBlock: 'var(--sp-4)' }}>
            <summary style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)', cursor: 'pointer' }}>
              Week of {w.label} — {weekLine(w, limit)}
            </summary>
            <ul style={{ margin: 'var(--sp-3) 0 0', paddingLeft: 'var(--sp-7)' }}>
              {w.entries.map((e) => (
                <li
                  key={e.id}
                  style={{
                    fontSize: 'var(--type-sm)',
                    ...secondLine(),
                    lineHeight: 'var(--leading-normal)',
                    paddingBlock: 'var(--sp-2)',
                  }}
                >
                  {e.date} · {e.hours} h · {e.kind}
                  {e.note ? ` · ${e.note}` : ''}{' '}
                  <button
                    type="button"
                    className="bare tappable"
                    onClick={() => update((old) => ({ ...old, cara: old.cara.filter((x) => x.id !== e.id) }))}
                    style={{ textDecoration: 'underline', display: 'inline', width: 'auto' }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
    </>
  );
}
