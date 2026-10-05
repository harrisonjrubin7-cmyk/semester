import { useState } from 'react';
import {
  SCENARIO_A,
  SCENARIO_B,
  choose,
  confirm,
  differences,
  keepCurrent,
  markConfirmed,
  type OptionId,
  type Plan,
  type Recovery,
} from '../lib/plan-recovery';

export const SAVED_AS_A = 'Your original plan is saved as Scenario A.';
export const CONFIRM_QUESTION = 'Save Scenario B as your plan?';

/**
 * Recovery Mode, drawn: the steps of a `Recovery` from `openRecovery`.
 *
 * Looking, choosing and reading never change the plan. The only road to a new
 * plan is the confirmation step: `onConfirm` is called from the confirm click
 * with what `confirm()` returns, and from nowhere else. "Keep current plan for
 * now" closes the recovery and calls `onKeep`; it hands back no plan.
 */
export function RecoveryMode({
  recovery,
  onConfirm,
  onKeep,
}: {
  recovery: Recovery;
  onConfirm: (newPlan: Plan) => void;
  onKeep: () => void;
}) {
  const [r, setR] = useState(recovery);
  const [asking, setAsking] = useState(false);
  const { steps } = r;
  const open = r.resolution === 'open';
  const option = steps.options.find((o) => o.id === r.chosen);
  const editing = !!option?.edit;

  const pick = (id: OptionId) => {
    setAsking(false);
    setR(choose(r, id));
  };
  const save = () => {
    const plan = confirm(r);
    if (!plan) return;
    onConfirm(plan);
    setR(markConfirmed(r));
    setAsking(false);
  };

  return (
    <section aria-label="Recovery" className="today-why">
      <p>{steps.acknowledge}</p>

      <h2>What changed</h2>
      <ul>
        {steps.impact.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <h2>What still works</h2>
      {steps.stillWorks.length === 0 ? (
        <p>Nothing else is in your plan yet.</p>
      ) : (
        <ul>
          {steps.stillWorks.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <h2>Your options</h2>
      <fieldset disabled={!open}>
        <legend>Choose one to look at. Nothing changes yet.</legend>
        {steps.options.map((o) => (
          <label key={o.id}>
            <input type="radio" name="recovery-option" checked={r.chosen === o.id} onChange={() => pick(o.id)} />
            {`${o.label}. ${o.detail}`}
          </label>
        ))}
      </fieldset>

      <p>{steps.uncertainty}</p>
      <p>
        <strong>{steps.humanRoute.label}</strong>. {steps.humanRoute.note}
      </p>

      <p>{SAVED_AS_A}</p>
      {r.chosen && (
        <div>
          <p>{SCENARIO_A}</p>
          <p>{SCENARIO_B}</p>
          <ul>
            {differences(r).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {open && editing && !asking && (
        <button type="button" className="btn" onClick={() => setAsking(true)}>
          Review Scenario B
        </button>
      )}
      {open && editing && asking && (
        <div role="group" aria-label="Confirm">
          <p>{CONFIRM_QUESTION}</p>
          <button type="button" className="btn btn-primary" onClick={save}>
            Yes, save Scenario B
          </button>
          <button type="button" className="btn workspace-text-button" onClick={() => setAsking(false)}>
            Not yet
          </button>
        </div>
      )}
      {open && (
        <button
          type="button"
          className="btn workspace-text-button"
          onClick={() => {
            setR(keepCurrent(r));
            setAsking(false);
            onKeep();
          }}
        >
          Keep current plan for now
        </button>
      )}
      <p role="status">
        {r.resolution === 'kept' ? 'Your plan stays as it is.' : r.resolution === 'confirmed' ? 'Scenario B is now your plan. Scenario A is still saved.' : ''}
      </p>
    </section>
  );
}
