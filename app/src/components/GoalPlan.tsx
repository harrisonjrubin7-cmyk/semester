import { useState } from 'react';
import { useNow } from '../state/store';
import { dateToIso, isoToDate } from '../lib/date';
import { formatDate } from '../lib/locale';
import {
  addAction,
  addMilestone,
  draftPlan,
  editMilestone,
  moveBlock,
  removeAction,
  removeBlock,
  removeMilestone,
  setProgressReview,
  toggleAction,
  type GoalPlan as Plan,
} from '../lib/goal-plan';

const shown = (iso: string) => formatDate(isoToDate(iso), { weekday: 'short', month: 'short', day: 'numeric' });

/**
 * A goal in the student's words, turned into a plan they can change.
 *
 * Everything in the plan is editable and removable through the edit helpers in
 * `lib/goal-plan.ts`; calendar blocks are proposals and this writes none of
 * them to a calendar. `onSave` receives the plan only when the student presses
 * Save plan.
 */
export function GoalPlan({
  now: nowProp,
  registrationDate = null,
  onSave,
}: {
  now?: Date;
  registrationDate?: string | null;
  onSave?: (plan: Plan) => void;
}) {
  const clock = useNow();
  const now = nowProp ?? clock;
  const [goal, setGoal] = useState('');
  const [by, setBy] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [newMilestone, setNewMilestone] = useState('');
  const [newAction, setNewAction] = useState('');
  const [saved, setSaved] = useState(false);

  const change = (next: Plan) => {
    setPlan(next);
    setSaved(false);
  };

  return (
    <section aria-label="Goal plan" className="today-why">
      <h2>Plan a goal</h2>
      <label>
        Your goal, in your own words
        <textarea className="input" rows={3} maxLength={200} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <label>
        Date to aim for (optional)
        <input className="input" type="date" value={by} onChange={(e) => setBy(e.target.value)} />
      </label>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setPlan(draftPlan({ goal, by: by || null, registrationDate, now }));
          setSaved(false);
        }}
      >
        Draft a plan
      </button>

      {plan && (
        <div>
          <h3>{plan.goal}</h3>
          <p>{plan.target ? `Aimed at ${shown(plan.target)}.` : 'No date to aim for. The milestones have no dates yet.'} Change anything below, or remove it.</p>

          <h3>Milestones</h3>
          <ul>
            {plan.milestones.map((m, i) => (
              <li key={m.id}>
                <input
                  className="input"
                  type="text"
                  aria-label={`Milestone ${i + 1} title`}
                  value={m.title}
                  onChange={(e) => change(editMilestone(plan, m.id, { title: e.target.value }))}
                />
                <input
                  className="input"
                  type="date"
                  aria-label={`Milestone ${i + 1} date`}
                  value={m.by ?? ''}
                  onChange={(e) => change(editMilestone(plan, m.id, { by: e.target.value || null }))}
                />
                <button type="button" className="btn workspace-text-button" aria-label={`Remove milestone ${i + 1}`} onClick={() => change(removeMilestone(plan, m.id))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <label>
            Add a milestone
            <input className="input" type="text" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn"
            disabled={!newMilestone.trim()}
            onClick={() => {
              change(addMilestone(plan, newMilestone.trim()));
              setNewMilestone('');
            }}
          >
            Add milestone
          </button>

          <h3>Actions</h3>
          <ul>
            {plan.actions.map((a) => (
              <li key={a.id}>
                <label>
                  <input type="checkbox" checked={a.done} onChange={() => change(toggleAction(plan, a.id))} />
                  {a.title}
                </label>
                <button type="button" className="btn workspace-text-button" aria-label={`Remove action ${a.title}`} onClick={() => change(removeAction(plan, a.id))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <label>
            Add an action
            <input className="input" type="text" value={newAction} onChange={(e) => setNewAction(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn"
            disabled={!newAction.trim()}
            onClick={() => {
              change(addAction(plan, newAction.trim()));
              setNewAction('');
            }}
          >
            Add action
          </button>

          <h3>Proposed calendar blocks</h3>
          {plan.calendarBlocks.length === 0 ? (
            <p>No blocks proposed.</p>
          ) : (
            <ul>
              {plan.calendarBlocks.map((b, i) => (
                <li key={b.id}>
                  <span>{`${b.title}, ${shown(b.day)}, ${b.minutes} minutes`}</span>
                  <input
                    className="input"
                    type="date"
                    aria-label={`Block ${i + 1} day`}
                    value={b.day}
                    min={dateToIso(now)}
                    onChange={(e) => change(moveBlock(plan, b.id, { day: e.target.value }))}
                  />
                  <button type="button" className="btn workspace-text-button" aria-label={`Remove block ${i + 1}`} onClick={() => change(removeBlock(plan, b.id))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p>These are proposals. Nothing is added to your calendar until you place it.</p>

          <label>
            Look at how it is going on
            <input
              className="input"
              type="date"
              value={plan.progressReview}
              onChange={(e) => change(setProgressReview(plan, e.target.value))}
            />
          </label>

          {plan.sourceLinks.length > 0 && (
            <div>
              <h3>Where to check</h3>
              <ul>
                {plan.sourceLinks.map((s) => (
                  <li key={s.label}>{`${s.label}: ${s.where}`}</li>
                ))}
              </ul>
            </div>
          )}

          <h3>A person to ask</h3>
          <p>
            <strong>{plan.humanRoute.label}</strong>. {plan.humanRoute.note}
          </p>

          {onSave && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onSave(plan);
                setSaved(true);
              }}
            >
              Save plan
            </button>
          )}
          <p role="status">{saved ? 'Plan saved.' : ''}</p>
        </div>
      )}
    </section>
  );
}
