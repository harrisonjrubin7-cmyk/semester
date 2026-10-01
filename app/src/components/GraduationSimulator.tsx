import { AssumptionEditor, useNativeAssumptions } from './AssumptionEditor';
import { graduationAssumptions, graduationOutcomes, scenarioAssumptions } from '../lib/graduation-assumptions';
import { useMemo, useRef, useState } from 'react';
import { SourceBadge } from './SourceBadge';
import { ConfirmDialog } from './ConfirmDialog';
import { CostPlanner } from './CostPlanner';
import { RecordLabel } from './RecordLabel';
import { ScenarioComparison } from './ScenarioComparison';
import { startItemising, totals, type CostLine } from '../lib/cost-plan';
import { MODULE_FLAGS, moduleOn } from '../lib/experience-flags';
import { deleteDraft, draftPreview, draftRow, saveDraft } from '../lib/graduation-cloud';
import { MORE_PRESETS, comparisonText } from '../lib/scenario-compare';
import { ErrorState } from './unity/States';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import {
  EMPTY_GRADUATION,
  graduationKey,
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
  type Scenario,
} from '../lib/graduation';

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Graduation scenarios, inside The degree.
 *
 * `done` comes from the transcript the student already keeps on the Taken tab
 * (finished hours plus this term's), so the one number the student should not
 * have to type twice is not asked for again.
 */
export function GraduationSimulator(props: Parameters<typeof GraduationWorkspace>[0]) {
  return <GraduationWorkspace key={props.accountId || 'device'} {...props} />;
}

function GraduationWorkspace({
  done,
  accountId = null,
  simulator = moduleOn(MODULE_FLAGS.graduation_simulator),
  costs = moduleOn(MODULE_FLAGS.cost_planner),
}: {
  done: number;
  /** The signed-in account, for saving drafts to it. Null: this device only. */
  accountId?: string | null;
  /** `graduation_simulator` (Phase D). Off, this is the #762 simulator exactly. */
  simulator?: boolean;
  /** `cost_planner` (Phase D). */
  costs?: boolean;
}) {
  const library = useDeviceLibrary(graduationKey(accountId), readGraduation, EMPTY_GRADUATION);
  const data = library.value;
  const plan = data.plan;
  const [status, setStatus] = useState('');
  const [compareId, setCompareId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: 'save'; scenario: Scenario }
    | { kind: 'unsave'; scenario: Scenario }
    | { kind: 'share'; text: string }
    | null
  >(null);
  const base = useMemo(() => project(plan, done), [plan, done]);
  const presets = simulator ? [...PRESETS, ...MORE_PRESETS] : PRESETS;
  const compared = data.scenarios.find((s) => s.id === compareId) ?? data.scenarios[0] ?? null;

  const setPlan = (patch: Partial<Plan>) => library.update((d) => ({ ...d, plan: { ...d.plan, ...patch } }));
  const setCostLines = (lines: CostLine[]) =>
    library.update((d) => {
      const kept = startItemising(d.plan.costLines ?? [], lines, { perTerm: d.plan.costPerTerm, summer: d.plan.summerCost });
      const t = totals(kept);
      return { ...d, plan: { ...d.plan, costLines: kept, costPerTerm: t.perTerm, summerCost: t.summer } };
    });
  const native = useNativeAssumptions([
    ...graduationAssumptions(plan, done, setPlan).map(a => ({ ...a, id: `plan:${a.id}` })),
    ...data.scenarios.flatMap(s => scenarioAssumptions(plan, done, s, patch => library.update(d => ({ ...d, scenarios: d.scenarios.map(x => x.id === s.id ? { ...x, ...patch } : x) }))).map(a => ({ ...a, id: `scenario:${s.id}:${a.id}` }))),
  ], accountId || 'device');
  const setCloudId = (id: string, cloudId: string | undefined, owner: string) =>
    library.update((d) => ({
      ...d,
      scenarios: d.scenarios.map((x) => {
        if (x.id !== id) return x;
        const ids = { ...x.cloudIds };
        if (cloudId) ids[owner] = cloudId;
        else delete ids[owner];
        const { cloudIds: _old, ...rest } = x;
        return Object.keys(ids).length ? { ...rest, cloudIds: ids } : rest;
      }),
    }));
  // A draft is in this account only if this account saved it.
  const inAccount = (s: Scenario): string | undefined => (accountId ? s.cloudIds?.[accountId] : undefined);

  const confirmed = async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    try {
      if (c.kind === 'save' && accountId) {
        const id = await saveDraft(accountId, draftRow(plan, done, c.scenario), inAccount(c.scenario));
        setCloudId(c.scenario.id, id, accountId);
        setStatus(`“${c.scenario.name}” saved to your account as an estimate.`);
      } else if (c.kind === 'unsave' && inAccount(c.scenario)) {
        await deleteDraft(inAccount(c.scenario)!);
        setCloudId(c.scenario.id, undefined, accountId!);
        setStatus(`“${c.scenario.name}” removed from your account. It is still on this device.`);
      } else if (c.kind === 'share') {
        try {
          await navigator.clipboard.writeText(c.text);
          setStatus('Copied. Paste it into an email or your advising notes — Semester did not send it anywhere.');
        } catch {
          download({ name: 'Semester graduation scenarios.txt', body: c.text, mime: 'text/plain' });
          setStatus('Your browser blocked copying, so the summary was downloaded instead. Nothing was sent.');
        }
      }
    } catch (e) {
      setStatus(`That did not save: ${e instanceof Error ? e.message : String(e)}. Your scenarios are still on this device.`);
    }
  };

  const add = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    if (data.scenarios.length >= MAX_SCENARIOS) {
      setStatus(`You can compare up to ${MAX_SCENARIOS} scenarios. Remove one first.`);
      return;
    }
    library.update((d) => addScenario(d, preset.build(d.plan), crypto.randomUUID()));
    setStatus(`Added “${preset.name}”.`);
  };

  const assumptions = useRef<HTMLInputElement>(null);
  const text = summary(data, done);

  return (
    <div className="portal-workspace graduation-simulator">
      {library.error ? (
        <ErrorState
          title="Could not save on this device"
          body={library.error}
          recover={{
            label: 'Download recovery copy',
            run: () =>
              download({ name: 'Semester graduation recovery.json', body: library.recovery(), mime: 'application/json' }),
          }}
        />
      ) : null}

      <section className="portal-panel" aria-labelledby="grad-plan">
        <span className="portal-eyebrow">Estimate</span>
        <h3 id="grad-plan">Your current plan</h3>
        <p className="portal-muted">
          <SourceBadge label="estimated" /> <strong>A planning estimate, not an official degree audit</strong> — confirm with your advisor or the
          registrar. {done} hours finished, counted from your Taken tab. Every figure here is an estimate from numbers
          you enter — it does not know course sequencing, when classes are offered, or your financial aid.
        </p>
        <RecordLabel kind="degree_audit" />
        <details>
          <summary>This plan assumes</summary>
          <ul>
            <li>{plan.needed} total credits needed, from the numbers you entered</li>
            <li>{plan.perTerm} credits per fall or spring</li>
            <li>{plan.summer} credits each summer</li>
            <li>Your next term is {termLabel(plan.next)}</li>
            <li>Course sequencing and financial aid are not included</li>
          </ul>
          <button type="button" className="btn btn-ghost" onClick={() => assumptions.current?.focus()}>Edit assumptions</button>
        </details>
        {native.editor}
        <AssumptionEditor key={accountId || 'device'} assumptions={graduationAssumptions(plan, done, setPlan)} />
        <div className="portal-filter-row">
          <label className="portal-check">
            Hours your degree needs
            <input
              className="input"
              type="number"
              inputMode="numeric"
              ref={assumptions}
              min={1}
              max={400}
              value={plan.needed}
              onChange={(e) => native.edit('plan:needed', e.target.value)}
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
              onChange={(e) => native.edit('plan:perTerm', e.target.value)}
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
              onChange={(e) => native.edit('plan:summer', e.target.value)}
            />
          </label>
        </div>
        <div className="portal-filter-row">
          <label className="portal-check">
            Next term
            <select
              className="input"
              value={plan.next.season}
              onChange={(e) => native.edit('plan:season', e.target.value)}
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
              onChange={(e) => native.edit('plan:year', e.target.value)}
            />
          </label>
          {costs && plan.costLines?.length ? null : (
          <>
          <label className="portal-check">
            Cost per fall or spring ($)
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              value={plan.costPerTerm}
              onChange={(e) => native.edit('plan:costPerTerm', e.target.value)}
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
              onChange={(e) => native.edit('plan:summerCost', e.target.value)}
            />
          </label>
          </>
          )}
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

      {costs ? <CostPlanner key={accountId || 'device'} lines={plan.costLines ?? []} onChange={setCostLines} dependents={lines => { const cost = totals(lines); return graduationOutcomes({ ...plan, costPerTerm: cost.perTerm, summerCost: cost.summer }, done); }} /> : null}

      <section className="portal-panel" aria-labelledby="grad-what-if">
        <h3 id="grad-what-if">What if…</h3>
        <label className="portal-check">
          Add a scenario
          <select className="input" value="" onChange={(e) => add(e.target.value)}>
            <option value="">Choose a change…</option>
            {presets.map((p) => (
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
                <AssumptionEditor key={`${accountId || 'device'}:${s.id}`} assumptions={scenarioAssumptions(plan, done, s, edit)} />
                <div className="portal-filter-row">
                  <label className="portal-check">
                    Hours added or removed
                    <input
                      className="input"
                      type="number"
                      min={-200}
                      max={200}
                      value={s.extra}
                      onChange={(e) => native.edit(`scenario:${s.id}:extra`, e.target.value)}
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
                      onChange={(e) => native.edit(`scenario:${s.id}:perTerm`, e.target.value)}
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
                      onChange={(e) => native.edit(`scenario:${s.id}:summer`, e.target.value)}
                    />
                  </label>
                </div>
                {simulator && s.abroad ? (
                  <div className="portal-filter-row">
                    <label className="portal-check">
                      Terms abroad
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={4}
                        value={s.abroad.terms}
                        onChange={(e) => native.edit(`scenario:${s.id}:terms`, e.target.value)}
                      />
                    </label>
                    <label className="portal-check">
                      Credits you expect to transfer each term
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={30}
                        value={s.abroad.credits}
                        onChange={(e) => native.edit(`scenario:${s.id}:credits`, e.target.value)}
                      />
                    </label>
                    <label className="portal-check">
                      Cost of a term abroad ($, blank if the same)
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={s.abroad.costPerTerm ?? ''}
                        onChange={(e) =>
                          native.edit(`scenario:${s.id}:costPerTerm`, e.target.value)
                        }
                      />
                    </label>
                  </div>
                ) : null}
                <div className="portal-actions">
                  {simulator ? (
                    <button aria-label={`Compare ${s.name} with your current plan`} onClick={() => setCompareId(s.id)}>
                      Compare
                    </button>
                  ) : null}
                  {simulator && accountId ? (
                    inAccount(s) ? (
                      <>
                        <button onClick={() => setConfirm({ kind: 'save', scenario: s })}>Update in your account</button>
                        <button onClick={() => setConfirm({ kind: 'unsave', scenario: s })}>Remove from account</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirm({ kind: 'save', scenario: s })}>Save draft to your account</button>
                    )
                  ) : null}
                  <button aria-label={`Remove scenario ${s.name}`} onClick={() => library.update((d) => removeScenario(d, s.id))}>
                    Remove
                  </button>
                </div>
                {simulator && inAccount(s) ? <p className="portal-muted">Saved to your account as an estimate.</p> : null}
              </article>
            );
          })
        )}
      </section>

      {simulator && compared ? <ScenarioComparison plan={plan} done={done} scenario={compared} /> : null}
      {simulator && !accountId ? (
        <p className="portal-muted">Scenarios are saved on this device as you type. Sign in to save drafts to your account too.</p>
      ) : null}

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
          {simulator ? (
            <button
              onClick={() =>
                setConfirm({
                  kind: 'share',
                  text: compared ? `${text}\n\n${comparisonText(plan, done, compared)}` : text,
                })
              }
            >
              Share with your advisor
            </button>
          ) : null}
        </div>
        {status ? (
          <p className="portal-notice" role="status">
            {status}
          </p>
        ) : null}
      </section>

      {confirm ? (
        <ConfirmDialog
          tone="default"
          title={
            confirm.kind === 'save'
              ? 'Save this draft to your account?'
              : confirm.kind === 'unsave'
                ? 'Remove this draft from your account?'
                : 'Share with your advisor?'
          }
          confirmLabel={confirm.kind === 'save' ? 'Save to account' : confirm.kind === 'unsave' ? 'Remove from account' : 'Copy to share'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void confirmed()}
          preview={
            confirm.kind === 'share' ? (
              <>
                <p>Semester does not send this to anyone. It copies this text so you can send it yourself:</p>
                <pre className="regday-list">{confirm.text}</pre>
              </>
            ) : confirm.kind === 'save' ? (
              <>
                <p>This row is stored in your account, visible only to you:</p>
                <ul>{draftPreview(draftRow(plan, done, confirm.scenario)).map((l) => <li key={l}>{l}</li>)}</ul>
                <p>It stays on this device too. Deleting your account deletes it.</p>
              </>
            ) : (
              <p>“{confirm.scenario.name}” will be deleted from your account. It stays on this device.</p>
            )
          }
        />
      ) : null}
    </div>
  );
}
