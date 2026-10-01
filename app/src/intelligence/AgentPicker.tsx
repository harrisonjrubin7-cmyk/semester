import { useId } from 'react';
import { AGENTS, type SemesterAgent } from '../../../packages/institution/src/agents';
import { newThread, setLive, useLive } from '../ai/live';
import { useStore } from '../state/store';

/** Both assistant surfaces use the same choice. A role change starts a clean context. */
export function AgentPicker() {
  const live = useLive();
  const { state, catalog, dispatch } = useStore();
  const name = useId();
  const helpId = `${name}-help`;
  const change = (agent: SemesterAgent) => {
    if (live.busy || agent === live.agent) return;
    newThread();
    setLive('agent', agent);
    setLive('integrityMode', agent === 'tutor' ? 'hint' : 'explain');
  };
  return (
    <fieldset className="mode-picker" aria-describedby={helpId} disabled={live.busy}>
      <legend className="mode-picker-legend">Who helps</legend>
      <div className="mode-picker-row">
        {(Object.keys(AGENTS) as SemesterAgent[]).map((agent) => (
          <label key={agent} className="mode-picker-option">
            <input className="sr-only" type="radio" name={name} value={agent}
              checked={live.agent === agent} onChange={() => change(agent)} />
            <span>{AGENTS[agent].label}</span>
          </label>
        ))}
      </div>
      <p id={helpId} className="mode-picker-help" aria-live="polite">
        {AGENTS[live.agent].question} Changing roles starts a new conversation; your previous conversation stays in history.
      </p>
      {(live.agent === 'tutor' || live.agent === 'course-guide') && (
        <label>
          <span>Course context</span>
          <select className="input" value={state.guideId} disabled={live.busy}
            onChange={(event) => {
              newThread();
              dispatch({ type: 'settleCourse', guideId: event.target.value });
            }}>
            {catalog.courses.map((course) => <option key={course.id} value={course.id}>{course.code}</option>)}
          </select>
        </label>
      )}
    </fieldset>
  );
}
