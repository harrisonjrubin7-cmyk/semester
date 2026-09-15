import { useMemo, useState } from 'react';
import { DIMMED_ROW, secondLine } from '../lib/dim';
import { useNow, useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { Group, ItemRow } from '../components/shell/Rows';
import { CloseTerm } from '../components/CloseTerm';
import { TermSwitch } from '../components/TermSwitch';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import {
  ahead,
  fromCalendar,
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
  const { state, dispatch, school } = useStore();
  const now = useNow();
  const rowEleven = useRowStyle(11);
  const [tab, setTab] = useState<'dates' | 'paste' | 'school'>('dates');
  const [text, setText] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [taken, setTaken] = useState<Record<number, boolean>>({});
  const [year, setYear] = useState(SEMESTER_YEAR);

  const rows = useMemo(() => sheet(state.registrar), [state.registrar]);
  /*
   * The terms your school publishes, if it publishes any.
   *
   * `SchoolData.academicCalendar` was written down and read by nothing until
   * this line. Empty is the ordinary case — Vanderbilt's profile carries no
   * calendar, and a school that has not been asked for one carries none
   * either — and an empty list takes the whole door off the screen rather
   * than leaving a tab that apologises.
   */
  const published = school.data.academicCalendar ?? [];
  const done = progress(rows);
  const coming = ahead(rows, now);

  /** Propose a set of rows, whichever door found them, all ticked to start. */
  const propose = (hits: Found[]) => {
    setFound(hits);
    setTaken(Object.fromEntries(hits.map((_, i) => [i, true])));
  };

  const read = () => propose(parse(text, year));

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
    // A date already behind you dims as a whole row. Everything inside it then
    // says nothing more about being dim — see `lib/dim.ts` on why the two
    // multiplying is how "to" ended up at 0.225.
    const past = where === 'past';
    return (
      <div
        key={d.id}
        style={{
          ...rowEleven,
          opacity: past ? DIMMED_ROW : 1,
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'baseline' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>{d.label}</span>
          {set && (
            <span
              style={{
                flex: 'none',
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                ...secondLine(past),
                ...(where === 'soon' || where === 'today' ? { color: 'var(--app-warn)' } : {}),
              }}
            >
              {line(d, now)}
            </span>
          )}
        </div>

        {d.cost ? (
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', ...secondLine(past), marginTop: 3, lineHeight: 'var(--leading-normal)' }}>
            {d.cost}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 7, alignItems: 'center' }}>
          <input
            className="input"
            type="date"
            value={d.iso}
            aria-label={d.label}
            onChange={(e) =>
              dispatch({ type: 'setTermDate', id: d.id, iso: e.target.value, until: d.until })
            }
            style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
          />
          {(d.kind === 'break' || d.kind === 'exams' || d.kind === 'window' || d.until) && (
            <>
              <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', ...secondLine(past), flex: 'none' }}>to</span>
              <input
                className="input"
                type="date"
                value={d.until}
                aria-label={`${d.label}, last day`}
                onChange={(e) =>
                  dispatch({ type: 'setTermDate', id: d.id, iso: d.iso, until: e.target.value })
                }
                style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
              />
            </>
          )}
          {set && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'dropTermDate', id: d.id })}
              style={{ flex: 'none', height: 36, fontSize: 'var(--type-sm)' }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  };

  /*
   * The confirmation list, drawn by whichever door filled it.
   *
   * Two doors propose dates now — a pasted page and a school's published
   * calendar — and both have to end at the same tick-every-row-yourself
   * step. Holding it here rather than inside one branch is what stops the
   * second door from growing its own slightly different copy.
   */
  const confirmRows = found && (
          <>
            <SectionLabel>
              {found.length} {found.length === 1 ? 'date' : 'dates'} found
            </SectionLabel>
            {found.length === 0 ? (
              <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)' }}>
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
                    gap: 'var(--sp-5)',
                    width: '100%',
                    textAlign: 'left',
                    alignItems: 'baseline',
                    padding: '10px 11px',
                    marginBottom: 'var(--sp-3)',
                    borderRadius: 'var(--r-md)',
                    border: `1px solid ${taken[i] ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                    background: taken[i] ? 'var(--app-accent-wash)' : 'transparent',
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                    {f.label}
                    {f.id ? '' : ' — kept in your words'}
                  </span>
                  <span style={{ flex: 'none', fontSize: 'calc(11.5px * var(--text-scale, 1))', color: 'var(--app-dim)' }}>
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
                style={{ height: 46, marginTop: 'var(--sp-5)' }}
              >
                Keep the {Object.values(taken).filter(Boolean).length} ticked
              </button>
            )}
          </>
  );

  return (
    <Page
    >
        <>
      <Blueprint style={{ padding: '14px 15px' }}>
        <div className="kicker">
          {done.done} of {done.of} filled in
        </div>
        <div style={{ fontSize: 'var(--type-base)', opacity: 0.75, marginTop: 7, lineHeight: 'var(--leading-relaxed)' }}>
          Every other date in this app came off a syllabus. These come from your registrar, and
          they are the ones that cost money rather than points — a withdrawal deadline missed is a
          course you are graded on whatever happens next.
        </div>
        <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', ...secondLine(), marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
          The app ships none of them. It cannot read a registrar, these dates differ by university
          and by year, and a wrong one that looks confident is worse than a blank one that asks.
        </div>
      </Blueprint>

      {coming.length > 0 && (
        // Through the shared row rather than a hand-drawn one, so this list
        // follows the layout setting. See `components/shell/Rows.tsx`.
        <Group header="Still to come" framed={false}>
          {coming.slice(0, 4).map((d) => (
            <ItemRow
              key={`up-${d.id}`}
              title={d.label}
              meta={longLabel(isoToDate(d.iso))}
              trailing={
                <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.8 }}>
                  {line(d, now)}
                </span>
              }
            />
          ))}
        </Group>
      )}

      <Segmented
        options={[
          { id: 'dates', label: 'Fill them in' },
          { id: 'paste', label: 'Paste the page' },
          // Only where a school actually publishes one. A third tab that
          // opens on "your university has not given us this" is worse than
          // two tabs.
          ...(published.length > 0 ? [{ id: 'school' as const, label: 'From your school' }] : []),
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginTop: 18 }}
      />

      {tab === 'dates' ? (
        <>
          <SectionLabel>The dates worth knowing</SectionLabel>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', ...secondLine(), marginBottom: 'var(--sp-2)', lineHeight: 'var(--leading-normal)' }}>
            Leave anything your university does not do. A blank row is a normal row.
          </div>
          {rows.map(row)}
          <YourOwn />
        </>
      ) : tab === 'school' ? (
        <>
          <SectionLabel>What {school.shortName || school.name} publishes</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm)', ...secondLine(), marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            Your school's profile carries its own calendar. Open a term and every date in it comes
            back for you to confirm — the same step a pasted page goes through, because a profile
            can be a year out of date and a withdrawal deadline nobody checked is the one mistake
            this screen exists to prevent.
          </div>
          {published.map((t) => {
            const dates = fromCalendar(t);
            return (
              <button
                key={t.termName}
                type="button"
                className="bare tappable"
                onClick={() => propose(dates)}
                disabled={dates.length === 0}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-5)',
                  width: '100%',
                  textAlign: 'left',
                  alignItems: 'baseline',
                  paddingBlock: 'var(--sp-5)',
                  paddingInline: 'var(--sp-5)',
                  marginBottom: 'var(--sp-3)',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--app-line)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 'var(--leading-tight)' }}>
                  {t.termName}
                </span>
                <span style={{ flex: 'none', fontSize: 'var(--type-xs)', ...secondLine() }}>
                  {dates.length === 0
                    ? 'no dates'
                    : `${dates.length} ${dates.length === 1 ? 'date' : 'dates'}`}
                </span>
              </button>
            );
          })}
          {confirmRows}
        </>
      ) : (
        <>
          <SectionLabel>Paste your registrar's calendar</SectionLabel>
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)' }}>
            Copy the academic calendar page and paste it here. Every row comes back for you to
            confirm — nothing is saved until you say so.
          </div>
          <textarea
            aria-label="Your registrar’s calendar, pasted"
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'August 26 (Wednesday)  Classes begin\nOctober 23  Last day to drop a course without a W'}
            style={{ width: '100%', minHeight: 140, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
          />

          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', flex: 'none' }}>Year</span>
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
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', ...secondLine(), marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            A registrar's page usually runs across two years. The app never guesses which — set it
            here, and paste a spring page separately.
          </div>

          {confirmRows}
        </>
      )}
      <div style={{ height: 26 }} />
      {/* Beside the close-out, so a term filed by mistake is one tap back
          rather than a hunt through another screen. Absent until there is
          more than one term. */}
      <TermSwitch />
      {/* The end-of-term five minutes. See `lib/rollover.ts`. */}
      <CloseTerm />

    </>
    </Page>
  );
}

/**
 * A date of your own, which the sheet had no way to add.
 *
 * `addTermDate` was in the reducer, unreachable. The evidence that it was
 * meant to be reachable is one line down in the same file: `dropTermDate`
 * says "a landmark is emptied rather than removed — it is part of the sheet
 * and will be asked for again. **One of your own goes for good.**" There were
 * none of your own, because nothing could make one.
 *
 * It matters more here than the sheet suggests. `LANDMARKS` is the list of
 * dates most American registrars publish, and the note at the top of this
 * screen already concedes that these "differ by university and by year" — a
 * thesis filing deadline, a study-abroad application, a co-op registration
 * window, a conservatory jury. The screen asked people to fill in a fixed
 * list and then told them their own dates were not worth keeping.
 *
 * Two fields and a range that appears once a start is set, because that is
 * how `addTermDate` reads it: a date with an `until` is stored as a break,
 * without as a deadline, and the row above draws the second field for exactly
 * those kinds.
 */
function YourOwn() {
  const { dispatch } = useStore();
  const row = useRowStyle(11);
  const [label, setLabel] = useState('');
  const [iso, setIso] = useState('');
  const [until, setUntil] = useState('');

  const add = () => {
    if (!label.trim() || !iso) return;
    dispatch({ type: 'addTermDate', label: label.trim(), iso, until: until || undefined });
    setLabel('');
    setIso('');
    setUntil('');
  };

  return (
    <div style={{ ...row }}>
      <SectionLabel style={{ margin: '0 0 var(--sp-3)' }}>One of your own</SectionLabel>
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
        Anything your registrar publishes that is not above — a filing deadline, an audition, a
        window that opens and closes. It sits in the list with the rest and counts down the same.
      </div>
      <input
        className="input"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
        placeholder="Thesis filing deadline"
        aria-label="What the date is"
        style={{ width: '100%', height: 36, fontSize: 'var(--type-base)' }}
      />
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)', alignItems: 'center' }}>
        <input
          className="input"
          type="date"
          value={iso}
          onChange={(e) => setIso(e.target.value)}
          aria-label="The day it falls on"
          style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
        />
        {iso ? (
          <>
            <span style={{ fontSize: 'var(--type-xs)', ...secondLine(), flex: 'none' }}>to</span>
            <input
              className="input"
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              aria-label="Its last day, if it is a window"
              style={{ flex: 1, minWidth: 0, height: 36, fontSize: 'var(--type-base)' }}
            />
          </>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={add}
        disabled={!label.trim() || !iso}
        style={{ width: 'auto', height: 36, marginTop: 'var(--sp-3)', fontSize: 'var(--type-sm)', paddingInline: 'var(--sp-6)' }}
      >
        Add it
      </button>
    </div>
  );
}
