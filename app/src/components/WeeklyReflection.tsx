import { useState } from 'react';
import { useNow } from '../state/store';
import { useDeviceLibrary } from '../lib/device-library';
import { dateToIso, isoToDate } from '../lib/date';
import { formatDate } from '../lib/locale';
import { weekStart } from '../lib/weekly';
import {
  EMPTY_RESETS,
  PROMPT_IDS,
  PROMPT_TEXT,
  RESET_KEY,
  answerPrompt,
  readResets,
  setShared,
  shareable,
  startReflection,
  type PromptId,
  type Reflection,
  type ReflectionKind,
  type SharedReflection,
} from '../lib/weekly-reset';

export const PRIVATE_LINE = 'Private to you';

/**
 * The five reflection prompts, drawn.
 *
 * Answers are saved on this device and are private to the student. There is no
 * share control on screen until the student ticks the labelled checkbox; the
 * checkbox starts unticked, and what `onShare` receives is the copy from
 * `shareable`, which the student has just been shown.
 */
export function WeeklyReflection({
  now: nowProp,
  kind = 'week',
  onShare,
}: {
  now?: Date;
  kind?: ReflectionKind;
  /** Called with the shown copy when the student presses the share button. Omit it and nothing can leave. */
  onShare?: (copy: SharedReflection) => void;
}) {
  const clock = useNow();
  const now = nowProp ?? clock;
  const week = dateToIso(weekStart(now));
  const lib = useDeviceLibrary(RESET_KEY, readResets, EMPTY_RESETS);
  const saved = lib.value.reflections.find((r) => r.weekStart === week && r.kind === kind) ?? startReflection(week, kind);
  const [draft, setDraft] = useState<Record<PromptId, string>>(saved.answers);

  const save = (next: Reflection) =>
    lib.update((old) => ({
      ...old,
      reflections: [...old.reflections.filter((r) => !(r.weekStart === week && r.kind === kind)), next].slice(-120),
    }));
  const withDraft = (): Reflection => PROMPT_IDS.reduce((r, id) => answerPrompt(r, id, draft[id]), saved);
  const copy = shareable(saved);

  return (
    <section aria-label={kind === 'term' ? 'Term reflection' : 'Weekly reflection'} className="today-why">
      <h2>{kind === 'term' ? 'Term reflection' : 'Weekly reflection'}</h2>
      <p>
        <strong>{PRIVATE_LINE}</strong>. Week of {formatDate(isoToDate(week), { month: 'short', day: 'numeric' })}. Answer any of these, or none.
      </p>
      {lib.error && <p role="status">{lib.error}</p>}
      {PROMPT_IDS.map((id) => (
        <label key={id}>
          {PROMPT_TEXT[id]}
          <textarea
            className="input"
            rows={3}
            maxLength={500}
            value={draft[id]}
            onChange={(e) => setDraft({ ...draft, [id]: e.target.value })}
            onBlur={() => save(withDraft())}
          />
        </label>
      ))}
      <label>
        <input type="checkbox" checked={saved.shared} onChange={(e) => save(setShared(withDraft(), e.target.checked))} />
        I want to be able to share a copy of this reflection
      </label>
      {copy && (
        <div>
          <p>This is the copy that would be shared. Your saved answers stay private.</p>
          <ul>
            {PROMPT_IDS.filter((id) => copy.answers[id]).map((id) => (
              <li key={id}>{`${PROMPT_TEXT[id]} ${copy.answers[id]}`}</li>
            ))}
          </ul>
          {onShare && (
            <button type="button" className="btn" onClick={() => onShare(copy)}>
              Share this copy
            </button>
          )}
        </div>
      )}
    </section>
  );
}
