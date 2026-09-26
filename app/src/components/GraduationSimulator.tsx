import { useMemo, useState } from 'react';
import { Notice } from './ui';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import {
  EMPTY_GRADUATION,
  GRADUATION_KEY,
  MAX_SCENARIOS,
  PRESETS,
  SEASONS,
  addScenario,
  compareLine,
  project,
  readGraduation,
  removeScenario,
  summary,
  termLabel,
  type Plan,
  type Season,
} from '../lib/graduation';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const num = (v: string, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

/**
 * Graduation scenarios, inside The degree.
 *
 * `done` comes from the transcript the student already keeps on the Taken tab
 * (finished hours plus this term's), so the one number the student should not
 * have to type twice is not asked for again.
 */
export function GraduationSimulator({ done }: { done: number }) {
  const library = useDeviceLibrary(GRADUATION_KEY, readGraduation, EMPTY_GRADUATION);
  const data = library.value;
  const plan = data.plan;
  const [status, setStatus] = useState('');
  const base = useMemo(() => project(plan, done), [plan, done]);

  const setPlan = (patch: Partial<Plan>) => library.update((d) => ({ ...d, plan: { ...d.plan, ...patch } }));

  const add = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (data.scenarios.length >= MAX_SCENARIOS) {
      setStatus(`You can compare up to ${MAX_SCENARIOS} scenarios. Remove one first.`);
      return;
    }
    library.update((d) => addScenario(d, preset.build(d.plan), crypto.randomUUID()));
    setStatus(`Added “${preset.name}”.`);
  };

  const text = summary(data, done);

  return (
    <div className="portal-workspace graduation-simulator">
      {library.error ? (
        <Notice alert>
          {library.error}
          <button
            onClick={() =>
              download({ name: 'Semester graduation recovery.json', body: library.recovery(), mime: 'application/json' })
            }
          >
            Download recovery copy
          </button>
        </Notice>
      ) : null}

      <section className="portal-panel" aria-labelledby="grad-plan">
        <span className="portal-eyebrow">Estimate</span>
        <h3 id="grad-plan">Your current plan</h3>
        <p className="portal-muted">
          {done} hours finished, counted from your Taken tab. Every figure here is an estimate from numbers you enter —
          it does not know course sequencing, when classes are offered, or your financial aid.
        </p>
        <div className="portal-filter-row">
          <label className="portal-check">
            Hours your degree needs
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={400}
              value={plan.needed}
              onChange={(e) => setPlan({ needed: num(e.target.value, 1, 400) })}
            />
          </label>
          <label className="portal-check">
            Hours per fall or spring
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={30}
              value={plan.perTerm}
              onChange={(e) => setPlan({ perTerm: num(e.target.value, 0, 30) })}
            />
          </label>
          <label className="portal-check">
            Hours each summer
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              value={plan.summer}
              onChange={(e) => setPlan({ summer: num(e.target.value, 0, 20) })}
            />
          </label>
        </div>
        <div className="portal-filter-row">
          <label className="portal-check">
            Next term
            <select
              className="input"
              value={plan.next.season}
              onChange={(e) => setPlan({ next: { ...plan.next, season: e.target.value as Season } })}
            >
              {SEASONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="portal-check">
            Year
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={2000}
              max={2100}
              value={plan.next.year}
              onChange={(e) => setPlan({ next: { ...plan.next, year: Math.round(num(e.target.value, 2000, 2100)) } })}
            />
          </label>
          <label className="portal-check">
            Cost per fall or spring ($)
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={plan.costPerTerm}
              onChange={(e) => setPlan({ costPerTerm: num(e.target.value, 0, 1_000_000) })}
            />
          </label>
          <label className="portal-check">
            Cost per summer ($)
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={plan.summerCost}
              onChange={(e) => setPlan({ summerCost: num(e.target.value, 0, 1_000_000) })}
            />
          </label>
        </div>
        <div className="portal-stats" aria-label="Current plan estimate">
          <div>
            <strong>{base.finish ? termLabel(base.finish) : base.remaining === 0 ? 'Complete' : '—'}</strong>
            <span>Estimated finish</span>
          </div>
          <div>
            <strong>{base.remaining}</strong>
            <span>Hours remaining</span>
          </div>
          <div>
            <strong>{base.cost === null ? '—' : money(base.cost)}</strong>
            <span>{base.cost === null ? 'Add a cost per term to estimate' : 'Estimated remaining cost'}</span>
          </div>
        </div>
        {plan.costPerTerm > 0 ? (
          <p>
            <strong>Cost of one more semester: about {money(plan.costPerTerm)}.</strong>
          </p>
        ) : null}
        {!base.finish && base.remaining > 0 ? (
          <p className="portal-warning">At this pace the total is not reached. Add hours per term or a summer.</p>
        ) : null}
      </section>

      <section className="portal-panel" aria-labelledby="grad-what-if">
        <h3 id="grad-what-if">What if…</h3>
        <label className="portal-check">
          Add a scenario
          <select className="input" value="" onChange={(e) => add(e.target.value)}>
            <option value="">Choose a change…</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {data.scenarios.length === 0 ? (
          <p className="portal-muted">Pick a change to see how it moves your finish and cost. Adjust its numbers after.</p>
        ) : (
          data.scenarios.map((s) => {
            const p = project(plan, done, s);
            const edit = (patch: Partial<typeof s>) =>
              library.update((d) => ({ ...d, scenarios: d.scenarios.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) }));
            return (
              <article key={s.id} className="portal-panel">
                <h4>{s.name}</h4>
                <p>{compareLine(base, p)}</p>
                <div className="portal-filter-row">
                  <label className="portal-check">
                    Hours added or removed
                    <input
                      className="input"
                      type="number"
                      min={-200}
                      max={200}
                      value={s.extra}
                      onChange={(e) => edit({ extra: num(e.target.value, -200, 200) })}
                    />
                  </label>
                  <label className="portal-check">
                    Hours per fall or spring
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={30}
                      value={s.perTerm}
                      onChange={(e) => edit({ perTerm: num(e.target.value, 0, 30) })}
                    />
                  </label>
                  <label className="portal-check">
                    Hours each summer
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={20}
                      value={s.summer}
                      onChange={(e) => edit({ summer: num(e.target.value, 0, 20) })}
                    />
                  </label>
                </div>
                <div className="portal-actions">
                  <button aria-label={`Remove scenario ${s.name}`} onClick={() => library.update((d) => removeScenario(d, s.id))}>
                    Remove
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="portal-panel" aria-labelledby="grad-share">
        <h3 id="grad-share">Take it to your advisor</h3>
        <pre className="regday-list">{text}</pre>
        <div className="portal-actions">
          <button
            className="portal-primary"
            onClick={() => download({ name: 'Semester graduation scenarios.txt', body: text, mime: 'text/plain' })}
          >
            Download summary
          </button>
        </div>
        {status ? (
          <p className="portal-notice" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </div>
  );
}
