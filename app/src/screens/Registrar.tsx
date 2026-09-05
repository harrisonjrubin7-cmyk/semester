import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { CloseTerm } from '../components/CloseTerm';
import { TermSwitch } from '../components/TermSwitch';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import {
  ahead,
  line,
  parse,
  progress,
  sheet,
  standing,
  type Found,
  type TermDate,
} from '../lib/registrar';
import { SEMESTER_YEAR, isoToDate, longLabel } from '../lib/date';

/**
 * The dates the university sets, entered once.
 *
 * Two doors, because two kinds of person open this screen. Somebody with the
 * registrar's page already on screen pastes it and confirms what was found;
 * somebody who knows three of these off the top of their head types those
 * three and leaves the rest. Neither is made to do the other's work.
 *
 * Nothing is pre-filled. `lib/registrar.ts` explains at length why the app
 * ships the questions and not the answers, and the short version is on the
 * screen too: a wrong withdrawal deadline that looks confident is worse than
 * an empty field that asks.
 */
export function Registrar() {
  const { state, dispatch, now } = useStore();
  const [tab, setTab] = useState<'dates' | 'paste'>('dates');
  const [text, setText] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [taken, setTaken] = useState<Record<number, boolean>>({});
  const [year, setYear] = useState(SEMESTER_YEAR);

  const rows = useMemo(() => sheet(state.registrar), [state.registrar]);
  const done = progress(rows);
  const coming = ahead(rows, now);

  const read = () => {
    const hits = parse(text, year);
    setFound(hits);
    setTaken(Object.fromEntries(hits.map((_, i) => [i, true])));
  };

  const keep = () => {
    if (!found) return;
    dispatch({ type: 'applyRegistrar', found: found.filter((_, i) => taken[i]) });
    setFound(null);
    setText('');
    setTab('dates');
  };

  const row = (d: TermDate) => {
    const where = standing(d, now);
    const set = d.iso !== '';
    return (
      <div
        key={d.id}
        style={{
          padding: '11px 0',
          borderBottom: '1px solid var(--app-line)',
          opacity: where === 'past' ? 0.5 : 1,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(14px * var(--text-scale, 1))', lineHeight: 1.3 }}>{d.label}</span>
          {set && (
            <span
              style={{
                flex: 'none',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.6,
                color: where === 'soon' || where === 'today' ? 'var(--app-warn)' : undefined,
              }}
            >
              {line(d, now)}
            </span>
          )}
        </div>

        {d.cost ? (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 3, lineHeight: 1.45 }}>
            {d.cost}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 6, marginTop: 7, alignItems: 'center' }}>
          <input
            className="input"
            type="date"
            value={d.iso}
            aria-label={d.label}
            onChange={(e) =>
              dispatch({ type: 'setTermDate', id: d.id, iso: e.target.value, until: d.until })
            }
            style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'calc(13px * var(--text-scale, 1))' }}
          />
          {(d.kind === 'break' || d.kind === 'exams' || d.kind === 'window' || d.until) && (
            <>
              <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.45, flex: 'none' }}>to</span>
              <input
                className="input"
                type="date"
                value={d.until}
                aria-label={`${d.label}, last day`}
                onChange={(e) =>
                  dispatch({ type: 'setTermDate', id: d.id, iso: d.iso, until: e.target.value })
                }
                style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'calc(13px * var(--text-scale, 1))' }}
              />
            </>
          )}
          {set && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'dropTermDate', id: d.id })}
              style={{ flex: 'none', height: 36, fontSize: 'calc(12px * var(--text-scale, 1))' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 18 }}>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="kicker">
          {done.done} of {done.of} filled in
        </div>
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.75, marginTop: 7, lineHeight: 1.5 }}>
          Every other date in this app came off a syllabus. These come from your registrar, and
          they are the ones that cost money rather than points — a withdrawal deadline missed is a
          course you are graded on whatever happens next.
        </div>
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
          The app ships none of them. It cannot read a registrar, these dates differ by university
          and by year, and a wrong one that looks confident is worse than a blank one that asks.
        </div>
      </Blueprint>

      {coming.length > 0 && (
        <>
          <SectionLabel>Still to come</SectionLabel>
          {coming.slice(0, 4).map((d) => (
            <div
              key={`up-${d.id}`}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
                padding: '9px 0',
                borderBottom: '1px solid var(--app-line)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{d.label}</span>
              <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.6 }}>
                {longLabel(isoToDate(d.iso))}
              </span>
              <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.8, minWidth: 62, textAlign: 'right' }}>
                {line(d, now)}
              </span>
            </div>
          ))}
        </>
      )}

      <Segmented
        options={[
          { id: 'dates', label: 'Fill them in' },
          { id: 'paste', label: 'Paste the page' },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginTop: 18 }}
      />

      {tab === 'dates' ? (
        <>
          <SectionLabel>The dates worth knowing</SectionLabel>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginBottom: 4, lineHeight: 1.45 }}>
            Leave anything your university does not do. A blank row is a normal row.
          </div>
          {rows.map(row)}
        </>
      ) : (
        <>
          <SectionLabel>Paste your registrar's calendar</SectionLabel>
          <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 8, lineHeight: 1.5 }}>
            Copy the academic calendar page and paste it here. Every row comes back for you to
            confirm — nothing is saved until you say so.
          </div>
          <textarea
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'August 26 (Wednesday)  Classes begin\nOctober 23  Last day to drop a course without a W'}
            style={{ width: '100%', minHeight: 140, resize: 'vertical', lineHeight: 1.5 }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, flex: 'none' }}>Year</span>
            <input
              className="input"
              type="number"
              value={year}
              aria-label="The year these dates fall in"
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ width: 96, height: 38, flex: 'none' }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={read}
              disabled={!text.trim()}
              style={{ flex: 1, height: 38 }}
            >
              Read it
            </button>
          </div>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
            A registrar's page usually runs across two years. The app never guesses which — set it
            here, and paste a spring page separately.
          </div>

          {found && (
            <>
              <SectionLabel>
                {found.length} {found.length === 1 ? 'date' : 'dates'} found
              </SectionLabel>
              {found.length === 0 ? (
                <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5 }}>
                  Nothing in that had both a date and something to call it. Paste the rows
                  themselves rather than a link to them, or fill the dates in by hand.
                </div>
              ) : (
                found.map((f, i) => (
                  <button
                    key={`${f.iso}-${f.label}`}
                    type="button"
                    className="bare tappable"
                    aria-pressed={taken[i] ?? false}
                    onClick={() => setTaken((was) => ({ ...was, [i]: !was[i] }))}
                    style={{
                      display: 'flex',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      alignItems: 'baseline',
                      padding: '10px 11px',
                      marginBottom: 6,
                      borderRadius: 'var(--r-md)',
                      border: `1px solid ${taken[i] ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                      background: taken[i] ? 'var(--app-accent-wash)' : 'transparent',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                      {f.label}
                      {f.id ? '' : ' — kept in your words'}
                    </span>
                    <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.65 }}>
                      {longLabel(isoToDate(f.iso))}
                      {f.until ? ` – ${longLabel(isoToDate(f.until))}` : ''}
                    </span>
                  </button>
                ))
              )}
              {found.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={keep}
                  style={{ height: 46, marginTop: 10 }}
                >
                  Keep the {Object.values(taken).filter(Boolean).length} ticked
                </button>
              )}
            </>
          )}
        </>
      )}
      <div style={{ height: 26 }} />
      {/* Beside the close-out, so a term filed by mistake is one tap back
          rather than a hunt through another screen. Absent until there is
          more than one term. */}
      <TermSwitch />
      {/* The end-of-term five minutes. See `lib/rollover.ts`. */}
      <CloseTerm />

    </div>
  );
}
