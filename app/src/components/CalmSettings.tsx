import { useDeviceLibrary } from '../lib/device-library';
import {
  CALM_KEY,
  CATEGORIES,
  DIGESTS,
  EMPTY_CALM,
  HORIZONS,
  calmOrDefault,
  clearMemory,
  type CalmSettings as Settings,
  type Category,
  type Digest,
  type Horizon,
} from '../lib/calm-controls';

/**
 * The student's editor for the Semester Guide's calm controls: what it may
 * say, when, and how much. Every change is written to this device straight
 * away; nothing is uploaded and nothing here changes a plan or a record.
 */

const CATEGORY_TEXT: Record<Category, string> = {
  deadlines: 'Dates somebody else set',
  plan: 'Plan decisions',
  study: 'Study',
  scenarios: 'Course outcome scenarios',
  career: 'Career',
  campus: 'Campus',
};
const DIGEST_TEXT: Record<Digest, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  minimal: 'Minimal',
};
const HORIZON_TEXT: Record<Horizon, string> = {
  day: 'One day',
  week: 'One week',
  term: 'This term',
};

const pad = (n: number) => String(n).padStart(2, '0');
const toClock = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const fromClock = (v: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins < 1440 ? mins : null;
};

export function CalmSettings() {
  const lib = useDeviceLibrary(CALM_KEY, calmOrDefault, EMPTY_CALM);
  const s = lib.value;
  const set = (patch: Partial<Settings>) => lib.update((old) => ({ ...old, ...patch }));

  const toggleCategory = (c: Category, on: boolean) =>
    lib.update((old) => ({
      ...old,
      categories: CATEGORIES.filter((x) => (x === c ? on : old.categories.includes(x))),
    }));

  return (
    <section aria-label="Guide settings" data-calm-settings>
      <h2>Guide settings</h2>
      <p className="today-why">These are yours. They are kept on this device and change only what the Guide shows.</p>
      {lib.error ? <p role="status">{lib.error}</p> : null}

      <fieldset>
        <legend>Morning briefing</legend>
        <label className="guide-setting-check">
          <input
            type="checkbox"
            checked={s.briefing.on}
            onChange={(e) => set({ briefing: { ...s.briefing, on: e.target.checked } })}
          />{' '}
          Send a morning briefing
        </label>
        <label className="guide-setting-field">
          <span>Briefing time</span>
          <input
            className="input"
            type="time"
            value={toClock(s.briefing.at)}
            onChange={(e) => {
              const at = fromClock(e.target.value);
              if (at !== null) set({ briefing: { ...s.briefing, at } });
            }}
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Quiet hours</legend>
        <label className="guide-setting-check">
          <input
            type="checkbox"
            checked={s.quiet !== null}
            onChange={(e) => set({ quiet: e.target.checked ? { from: 22 * 60, to: 8 * 60 } : null })}
          />{' '}
          Use quiet hours
        </label>
        {s.quiet ? (
          <>
            <label className="guide-setting-field">
              <span>Quiet hours start</span>
              <input
                className="input"
                type="time"
                value={toClock(s.quiet.from)}
                onChange={(e) => {
                  const from = fromClock(e.target.value);
                  if (from !== null && s.quiet) set({ quiet: { ...s.quiet, from } });
                }}
              />
            </label>
            <label className="guide-setting-field">
              <span>Quiet hours end</span>
              <input
                className="input"
                type="time"
                value={toClock(s.quiet.to)}
                onChange={(e) => {
                  const to = fromClock(e.target.value);
                  if (to !== null && s.quiet) set({ quiet: { ...s.quiet, to } });
                }}
              />
            </label>
          </>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>Digest</legend>
        {DIGESTS.map((d) => (
          <label key={d} className="guide-setting-check">
            <input type="radio" name="calm-digest" checked={s.digest === d} onChange={() => set({ digest: d })} />{' '}
            {DIGEST_TEXT[d]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Notify me about</legend>
        {CATEGORIES.map((c) => (
          <label key={c} className="guide-setting-check">
            <input
              type="checkbox"
              checked={s.categories.includes(c)}
              onChange={(e) => toggleCategory(c, e.target.checked)}
            />{' '}
            {CATEGORY_TEXT[c]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Pauses</legend>
        <label className="guide-setting-check">
          <input type="checkbox" checked={s.pauseScenarios} onChange={(e) => set({ pauseScenarios: e.target.checked })} />{' '}
          Pause course outcome scenarios
        </label>
        <label className="guide-setting-check">
          <input type="checkbox" checked={s.pauseCareer} onChange={(e) => set({ pauseCareer: e.target.checked })} /> Pause
          career suggestions
        </label>
        <label className="guide-setting-check">
          <input type="checkbox" checked={s.hideStudyBlocks} onChange={(e) => set({ hideStudyBlocks: e.target.checked })} />{' '}
          Hide suggested study blocks
        </label>
      </fieldset>

      <fieldset>
        <legend>How much the Guide shows</legend>
        <label className="guide-setting-check">
          <input type="checkbox" checked={s.minimalMode} onChange={(e) => set({ minimalMode: e.target.checked })} /> Minimal
          mode (one line everywhere)
        </label>
        <label className="guide-setting-field">
          <span>Planning horizon</span>
          <select className="input" value={s.horizon} onChange={(e) => set({ horizon: e.target.value as Horizon })}>
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {HORIZON_TEXT[h]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Assistant memory</legend>
        <p className="today-why">
          {s.memory.length === 0
            ? 'The assistant is not remembering anything.'
            : `The assistant remembers ${s.memory.length} ${s.memory.length === 1 ? 'note' : 'notes'}.`}
        </p>
        {s.memory.length > 0 ? (
          <ul aria-label="Remembered notes">
            {s.memory.map((m) => (
              <li key={m.id}>{m.text}</li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="btn" disabled={s.memory.length === 0} onClick={() => lib.update(clearMemory)}>
          Clear assistant memory
        </button>
      </fieldset>
    </section>
  );
}
