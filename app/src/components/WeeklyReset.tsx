import { useState } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import { clock, dateToIso, isoToDate } from '../lib/date';
import { formatDate } from '../lib/locale';
import { weekStart } from '../lib/weekly';
import { useNow } from '../state/store';
import {
  EMPTY_RESETS,
  HELP_OPTIONS,
  HELP_TEXT,
  RESET_KEY,
  STEPS,
  STEP_TEXT,
  advance,
  back,
  busyDays,
  chooseHelp,
  choosePicks,
  currentStep,
  placeStudyBlocks,
  readResets,
  resume,
  rollForward,
  skip,
  startReset,
  summary,
  type BlockProposal,
  type Commitment,
  type DayDeadline,
  type HelpOption,
  type Picks,
  type ResetRecord,
  type Unfinished,
} from '../lib/weekly-reset';

const blockKey = (b: BlockProposal) => `${b.day}@${b.startMin}`;
const dayName = (iso: string) => formatDate(isoToDate(iso), { weekday: 'long', month: 'short', day: 'numeric' });

/**
 * The Weekly Reset, drawn: the five steps from `lib/weekly-reset.ts`.
 *
 * Optional by construction. "Skip for now" is on screen at every step and
 * after the last one, it changes only the record's skipped flag, and the copy
 * around it never says what skipping costs, because it costs nothing. Study
 * blocks are proposals: the student accepts each one, and this component only
 * reports the acceptance (`onAcceptBlock`); it writes no calendar itself.
 */
export function WeeklyReset({
  now: suppliedNow,
  commitments = [],
  deadlines = [],
  unfinished = [],
  onAcceptBlock,
}: {
  now?: Date;
  /** What is already fixed this week, so blocks go around it. */
  commitments?: readonly Commitment[];
  /** Deadlines this week, for the busy-day line. */
  deadlines?: readonly DayDeadline[];
  /** Work not finished last week. */
  unfinished?: readonly Unfinished[];
  /** Called with a proposal when the student accepts it, and again with `false` if they take it back. */
  onAcceptBlock?: (block: BlockProposal, accepted: boolean) => void;
}) {
  const currentTime = useNow();
  const now = suppliedNow ?? currentTime;
  const week = dateToIso(weekStart(now));
  const lib = useDeviceLibrary(RESET_KEY, readResets, EMPTY_RESETS);
  const record = lib.value.resets.find((r) => r.weekStart === week) ?? startReset(week);
  const [draft, setDraft] = useState<Picks>(record.picks);
  const [accepted, setAccepted] = useState<ReadonlySet<string>>(new Set());

  const save = (next: ResetRecord) =>
    lib.update((old) => ({ ...old, resets: [...old.resets.filter((r) => r.weekStart !== week), next].slice(-60) }));
  const withDraft = (r: ResetRecord) => choosePicks(r, draft);

  const step = currentStep(record);
  const proposals = placeStudyBlocks(week, commitments, { blocks: 3, minutes: 60 });
  const busy = busyDays(deadlines);
  const carried = rollForward(unfinished, week);

  const toggleBlock = (b: BlockProposal, on: boolean) => {
    const next = new Set(accepted);
    if (on) next.add(blockKey(b));
    else next.delete(blockKey(b));
    setAccepted(next);
    onAcceptBlock?.(b, on);
  };

  return (
    <section aria-label="Weekly Reset" className="today-why">
      <h2>Weekly Reset</h2>
      <p>
        Week of {dayName(week)}. Five short steps. Stop whenever you like; nothing here is counted.
      </p>
      {lib.error && <p role="status">{lib.error}</p>}

      {record.skipped ? (
        <div>
          {summary(record).map((l) => (
            <p key={l}>{l}</p>
          ))}
          <button type="button" className="btn workspace-text-button" onClick={() => save(resume(record))}>
            Pick this up again
          </button>
        </div>
      ) : (
        <div>
          <p>
            {step ? `Step ${record.step + 1} of ${STEPS.length}: ${STEP_TEXT[step].title}` : 'All five steps are done for this week.'}
          </p>
          {step && <p>{STEP_TEXT[step].prompt}</p>}

          {step === 'review' && (
            <div>
              <p>{carried.line}</p>
              {unfinished.length > 0 && (
                <ul>
                  {unfinished.map((u) => (
                    <li key={u.id}>{u.title}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 'priorities' && (
            <div>
              <label>
                Academic priority
                <input
                  className="input"
                  type="text"
                  maxLength={500}
                  value={draft.academic}
                  onChange={(e) => setDraft({ ...draft, academic: e.target.value })}
                  onBlur={() => save(withDraft(record))}
                />
              </label>
              <label>
                Practical priority
                <input
                  className="input"
                  type="text"
                  maxLength={500}
                  value={draft.practical}
                  onChange={(e) => setDraft({ ...draft, practical: e.target.value })}
                  onBlur={() => save(withDraft(record))}
                />
              </label>
              <label>
                Personal support priority
                <input
                  className="input"
                  type="text"
                  maxLength={500}
                  value={draft.support}
                  onChange={(e) => setDraft({ ...draft, support: e.target.value })}
                  onBlur={() => save(withDraft(record))}
                />
              </label>
            </div>
          )}

          {step === 'plan' && (
            <div>
              {proposals.length === 0 ? (
                <p>There is no free gap this week for a study block. That is fine.</p>
              ) : (
                <ul>
                  {proposals.map((b) => (
                    <li key={blockKey(b)}>
                      <label>
                        <input type="checkbox" checked={accepted.has(blockKey(b))} onChange={(e) => toggleBlock(b, e.target.checked)} />
                        {`Accept: ${b.label}, ${dayName(b.day)} at ${clock(b.startMin)} for ${b.minutes} minutes`}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p>These are proposals. Nothing is placed until you accept it.</p>
            </div>
          )}

          {step === 'conflicts' && (
            <div>
              {busy.length === 0 ? (
                <p>No day this week holds three or more deadlines.</p>
              ) : (
                <ul>
                  {busy.map((d) => (
                    <li key={d.day}>{d.line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 'help' && (
            <fieldset>
              <legend>Help to ask for</legend>
              {HELP_OPTIONS.map((h: HelpOption) => (
                <label key={h}>
                  <input type="radio" name="reset-help" checked={record.help === h} onChange={() => save(chooseHelp(record, h))} />
                  {`${HELP_TEXT[h].label}. ${HELP_TEXT[h].note}`}
                </label>
              ))}
              <label>
                <input type="radio" name="reset-help" checked={record.help === null} onChange={() => save(chooseHelp(record, null))} />
                No help needed this week
              </label>
            </fieldset>
          )}

          {!step && summary(record).map((l) => <p key={l}>{l}</p>)}

          <div>
            <button type="button" className="btn" disabled={record.step === 0} onClick={() => save(back(withDraft(record)))}>
              Back
            </button>
            {step && (
              <button type="button" className="btn btn-primary" onClick={() => save(advance(withDraft(record)))}>
                {record.step === STEPS.length - 1 ? 'Finish' : 'Next'}
              </button>
            )}
          </div>
        </div>
      )}
      <button type="button" className="btn workspace-text-button" onClick={() => save(skip(record))}>
        Skip for now
      </button>
    </section>
  );
}
