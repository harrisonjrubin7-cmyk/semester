import { clock } from '../lib/date';
import { formatDate } from '../lib/locale';
import { useId, useMemo, useState } from 'react';
import { dateToIso, isoToDate } from '../lib/date';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  crunchAction,
  crunchForecast,
  suggestionAppointment,
  summarizeWeek,
  workloadPressure,
  type Category,
  type Crunch,
  type Suggestion,
  type WorkloadPressureDay,
} from '../lib/life-balance';
import { useLifeBalance } from '../lib/life-balance.hook';
import { useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceBadge } from './SourceBadge';
import { CONFIDENCE_TEXT, confidenceFromSource } from '../lib/assistant-confidence';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hours = (n: number) => `${Math.round(n * 10) / 10} h`;
const dayLabel = (iso: string) =>
  formatDate(new Date(`${iso}T00:00:00`), { weekday: 'short', month: 'short', day: 'numeric' });
const range = (from: number, to: number) => `${clock(from)}–${clock(to)}`;

/**
 * Academic life balance in Plan (`academic_life_balance`, Phase E), under
 * the calendar's week view (`start` is the week's first day, YYYY-MM-DD) — and, with `crunch_week_forecast` on, the Crunch
 * Week Forecast beneath it.
 *
 * Progressive: the week's hours by category first, then each day's shape,
 * then the detail (long stretches, overlaps, open blocks, deadlines) folded
 * away. Every figure is hours or a count, with where it came from. Nothing
 * here judges the week or the student; a suggested study block reaches the
 * calendar only after a preview and a confirmation.
 */
export function LifeBalance({ start, crunch = false }: { start: string; crunch?: boolean }) {
  const { dispatch } = useStore();
  const { input, now, settings, saveSettings, error } = useLifeBalance();
  const headingId = useId();
  const week = useMemo(() => summarizeWeek(input, isoToDate(start)), [input, start]);
  const pressure = useMemo(() => workloadPressure(input, isoToDate(start)), [input, start]);
  const crunches = useMemo(() => (crunch ? crunchForecast(input, now) : []), [crunch, input, now]);
  const [adding, setAdding] = useState<Suggestion | null>(null);
  const [said, setSaid] = useState('');
  const [showForecast, setShowForecast] = useState(true);

  const committed = CATEGORIES.filter((c) => c !== 'open');
  const total = CATEGORIES.reduce((n, c) => n + week.hours[c], 0) || 1;
  const nothing = week.days.every((d) => d.spans.length === 0 && d.deadlines.length === 0) && week.stated === 0;
  const runs = week.days.flatMap((d) => d.runs.map((r) => ({ iso: d.iso, ...r })));
  const overlaps = week.days.flatMap((d) => d.conflicts.map((c) => ({ iso: d.iso, ...c })));
  const deadlines = week.days.flatMap((d) => d.deadlines);

  const confirmAdd = () => {
    const appointment = adding ? suggestionAppointment(adding) : null;
    if (!appointment) return;
    dispatch({ type: 'addAppointment', appointment });
    setSaid(`Added “${appointment.title}” to your calendar on ${dayLabel(appointment.date)} at ${appointment.time}. Move or delete it like any event.`);
    setAdding(null);
  };

  return (
    <section className="balance" aria-labelledby={headingId}>
      <h2 id={headingId} className="balance-title">Your week, in hours</h2>
      <p className="balance-muted">
        {dayLabel(dateToIso(week.days[0].date))} to {dayLabel(dateToIso(week.days[6].date))}. Counted from your timetable,
        commitments, calendar and deadlines — <SourceBadge label="estimated" /> totals, not a measure of you.
      </p>
      {error ? <p role="alert" className="balance-muted">{error}</p> : null}

      {nothing ? (
        <p className="balance-muted">
          Nothing on this week yet. Add classes, commitments or events and this fills in.
        </p>
      ) : (
        <>
          <ul className="balance-categories" aria-label="Hours this week by category">
            {CATEGORIES.filter((c) => c === 'open' || week.hours[c] > 0).map((c: Category) => (
              <li key={c} data-category={c}>
                <span className="balance-cat-name">{CATEGORY_LABEL[c]}</span>
                <span className="balance-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round((week.hours[c] / total) * 100)}%` }} />
                </span>
                <span className="balance-cat-hours">{hours(week.hours[c])}</span>
              </li>
            ))}
          </ul>
          {week.stated > 0 ? (
            <p className="balance-muted">
              {hours(week.stated)} of that has no set time — commitments you gave as hours a week, and your commute — so it
              is counted but not placed on the clock.
            </p>
          ) : null}

          <h3 className="balance-heading">Each day</h3>
          <ol className="balance-days">
            {week.days.map((d) => {
              const busy = committed.reduce((n, c) => n + d.hours[c], 0);
              return (
                <li key={d.iso}>
                  <span className="balance-day-name">{DAYS[d.date.getDay()]}</span>
                  <span className="balance-density" aria-hidden="true">
                    {committed.filter((c) => d.hours[c] > 0).map((c) => (
                      <span key={c} data-category={c} style={{ flexGrow: d.hours[c] }} />
                    ))}
                    <span data-category="open" style={{ flexGrow: d.hours.open }} />
                  </span>
                  <span className="balance-day-text">
                    {hours(busy)} committed · {hours(d.hours.open)} open
                    {d.deadlines.length ? ` · ${d.deadlines.length} due` : ''}
                  </span>
                </li>
              );
            })}
          </ol>

          <details className="balance-more">
            <summary>Long stretches, overlaps and open blocks</summary>
            <h3 className="balance-heading">Long stretches without a break</h3>
            {runs.length ? (
              <ul className="balance-list">
                {runs.map((r) => (
                  <li key={`${r.iso}:${r.from}`}>
                    {dayLabel(r.iso)}, {range(r.from, r.to)} ({hours((r.to - r.from) / 60)}): {r.titles.join(', ')}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="balance-muted">No stretch of four hours or more without a gap of at least 15 minutes.</p>
            )}

            <h3 className="balance-heading">Overlaps</h3>
            {overlaps.length ? (
              <ul className="balance-list">
                {overlaps.map((c) => (
                  <li key={`${c.iso}:${c.a.id}:${c.b.id}`}>
                    {dayLabel(c.iso)}: {c.a.title} and {c.b.title} overlap by {c.minutes} min.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="balance-muted">Nothing on the clock at the same time.</p>
            )}

            <h3 className="balance-heading">Open blocks of an hour or more</h3>
            <ul className="balance-list">
              {week.days.map((d) => (
                <li key={d.iso}>
                  {dayLabel(d.iso)}:{' '}
                  {d.open.length ? d.open.slice(0, 3).map((b) => range(b.from, b.to)).join(', ') : 'none'}
                  {d.open.length ? (
                    <>
                      {' '}
                      <SourceBadge label={d.open[0].source} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="balance-muted">
              Student entered means inside the work windows you set; Estimated means inside a default day of 7a to 11p.
              Hours with no set time are not placed, so an open block may already be spoken for.
            </p>
          </details>

          <h3 className="balance-heading">Due this week</h3>
          {deadlines.length ? (
            <ul className="balance-list">
              {deadlines.map((d) => (
                <li key={d.id}>
                  {dayLabel(d.iso)}: {d.code} {d.title}
                  {d.major ? ' (major)' : ''} <SourceBadge label={d.source} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="balance-muted">No deadlines this week.</p>
          )}

          <WorkloadForecast rows={pressure} visible={showForecast} onVisibleChange={setShowForecast} />
        </>
      )}

      {crunch ? <CrunchForecast crunches={crunches} now={now} onAdd={setAdding} /> : null}
      {said ? <p role="status" className="balance-said">{said}</p> : null}

      <CommuteForm
        key={JSON.stringify(settings.commute)}
        days={settings.commute?.days ?? []}
        minutes={settings.commute?.minutesEachWay ?? 0}
        onSave={(days, minutes) =>
          saveSettings({ commute: days.length && minutes > 0 ? { days, minutesEachWay: minutes } : null })
        }
      />

      <p className="balance-muted">
        This counts hours. It does not rate a week, and it cannot see sleep, health or anything you have not entered.
      </p>

      {adding?.slot ? (
        <ConfirmDialog
          title="Add a study block to your calendar?"
          preview={
            <>
              <p>
                <strong>Start {adding.code} {adding.title}</strong>
              </p>
              <p>
                {dayLabel(adding.slot.iso)}, {range(adding.slot.from, adding.slot.from + adding.slot.minutes)} ({adding.slot.minutes} min),
                as a Study event on your Semester calendar.
              </p>
              <p>It does not change the due date ({dayLabel(adding.due)}). You can move or delete it like any event.</p>
            </>
          }
          confirmLabel="Add to calendar"
          onConfirm={confirmAdd}
          onCancel={() => setAdding(null)}
        />
      ) : null}
    </section>
  );
}

const PRESSURE_LABEL: Record<WorkloadPressureDay['state'], string> = {
  clear: 'No due work recorded',
  manageable: 'Fits the open time shown',
  tight: 'Little open time remains',
  more_than_open: 'More estimated work than open time',
  unknown: 'Effort not known yet',
};

/**
 * Due-work pressure in plain minutes, not a score and not a prediction.
 * Hidden on request for the visit; the underlying deadlines and calendar are
 * unchanged. The tenant can disable the parent module entirely.
 */
function WorkloadForecast({
  rows,
  visible,
  onVisibleChange,
}: {
  rows: WorkloadPressureDay[];
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
}) {
  const due = rows.filter((row) => row.state !== 'clear');
  if (!visible) {
    return (
      <p className="balance-muted">
        Workload forecast hidden for this visit.{' '}
        <button type="button" className="workspace-text-button" onClick={() => onVisibleChange(true)}>
          Show it
        </button>
      </p>
    );
  }
  return (
    <section className="balance-workload" aria-labelledby="balance-workload-heading">
      <div className="balance-workload-head">
        <h3 id="balance-workload-heading" className="balance-heading">Workload forecast</h3>
        <button type="button" className="workspace-text-button" onClick={() => onVisibleChange(false)}>Hide</button>
      </div>
      <p className="balance-muted">
        Planned work pressure from deadlines, your own past time estimates and the open time above. It does not predict
        grades, ability or wellbeing.
      </p>
      {due.length === 0 ? (
        <p className="balance-muted">No due work with a time estimate is recorded for this week.</p>
      ) : (
        <ol className="balance-workload-days">
          {due.map((row) => (
            <li key={row.iso} data-pressure={row.state}>
              <span>
                <strong>{dayLabel(row.iso)}</strong>
                <small>{PRESSURE_LABEL[row.state]}</small>
              </span>
              <span className="nums">
                {row.known > 0 ? `${row.estimatedMinutes} min estimated · ${row.openMinutes} min open` : 'No effort estimate yet'}
                {row.unknown > 0 ? ` · ${row.unknown} unknown` : ''}
              </span>
              <span>
                {CONFIDENCE_TEXT[confidenceFromSource(row.known > 0 ? 'estimated' : 'needs_review')]} ·{' '}
                <SourceBadge label={row.confirmed ? 'imported' : 'needs_review'} />
              </span>
            </li>
          ))}
        </ol>
      )}
      <details className="balance-more">
        <summary>How this forecast works</summary>
        <p className="balance-muted">
          Semester compares work due that day with time left open that day. Estimates come only from similar work you
          timed before; unknown work stays unknown. A study block is never added or moved without your confirmation.
        </p>
      </details>
    </section>
  );
}

function CrunchForecast({ crunches, now, onAdd }: { crunches: Crunch[]; now: Date; onAdd: (s: Suggestion) => void }) {
  const headingId = useId();
  return (
    <section className="balance-crunch" aria-labelledby={headingId}>
      <h3 id={headingId} className="balance-heading">Crunch week forecast</h3>
      {crunches.length === 0 ? (
        <p className="balance-muted">
          No stretch in the next one to four weeks has three or more major deadlines within six days.
        </p>
      ) : (
        crunches.map((c) => {
          const e = crunchAction(c, now).explanation;
          return (
            <article key={c.id} className="balance-crunch-item">
              <p className="balance-crunch-line">
                {c.line} {c.ask}
              </p>
              <ul className="balance-list">
                {c.deadlines.map((d) => (
                  <li key={d.id}>
                    {dayLabel(d.iso)}: {d.code} {d.title} <SourceBadge label={d.source} />
                  </li>
                ))}
              </ul>
              <h4 className="balance-heading">Suggested earlier starts</h4>
              <ul className="balance-list">
                {c.suggestions.map((s) => (
                  <li key={s.itemId}>
                    <span>
                      {s.code} {s.title}: {s.slot ? `${dayLabel(s.slot.iso)}, ${range(s.slot.from, s.slot.from + s.slot.minutes)}` : 'no open block of that length in the week before — pick a time yourself'}.{' '}
                      {s.because}
                    </span>{' '}
                    {s.slot ? (
                      <>
                        <SourceBadge label="estimated" />{' '}
                        <button type="button" className="balance-button" onClick={() => onAdd(s)}>
                          Add to calendar…
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              <details className="balance-more">
                <summary>Why this?</summary>
                <p>{e.trigger}</p>
                <p>{e.expectedImpact}</p>
                <ul className="balance-list">{e.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
                <p>Other options: {e.alternatives.join(' ')}</p>
              </details>
            </article>
          );
        })
      )}
    </section>
  );
}

function CommuteForm({ days, minutes, onSave }: { days: number[]; minutes: number; onSave: (days: number[], minutes: number) => boolean }) {
  const [on, setOn] = useState<number[]>(days);
  const [each, setEach] = useState(String(minutes || ''));
  const [said, setSaid] = useState('');
  const n = Number(each);
  const valid = each === '' || (Number.isFinite(n) && n >= 0 && n <= 240);
  return (
    <details className="balance-more">
      <summary>Commute{days.length && minutes ? ` — ${minutes} min each way, ${days.length} days` : ''}</summary>
      <fieldset className="balance-commute">
        <legend>Days you travel</legend>
        {DAYS.map((d, i) => (
          <label key={d}>
            <input
              type="checkbox"
              checked={on.includes(i)}
              onChange={(e) => setOn(e.target.checked ? [...on, i].sort() : on.filter((x) => x !== i))}
            />{' '}
            {d}
          </label>
        ))}
      </fieldset>
      <label className="balance-commute-minutes">
        Minutes each way
        <input className="input" type="number" inputMode="numeric" min={0} max={240} value={each} onChange={(e) => setEach(e.target.value)} />
      </label>
      {!valid ? <p role="alert" className="balance-muted">Enter 0 to 240 minutes.</p> : null}
      <button
        type="button"
        className="balance-button"
        disabled={!valid}
        onClick={() => setSaid(onSave(on, each === '' ? 0 : n) ? 'Saved on this device.' : 'Could not save.')}
      >
        Save commute
      </button>
      {said ? <span role="status"> {said}</span> : null}
      <p className="balance-muted">Kept on this device only, and counted as hours — Semester does not know when you leave.</p>
    </details>
  );
}
