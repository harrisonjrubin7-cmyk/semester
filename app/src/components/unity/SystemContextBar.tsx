import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { screenName } from '../../lib/nav';
import { canonicalDestinationFor, FIVE_LABELS } from '../../lib/tabbar';
import { STUDENT_WORKFLOWS, workflowForScreen } from '../../lib/student-workflows';
import { statusOf, syncStatusKey } from '../../lib/status';
import { useOffline } from './Status';
import { currentLook } from '../../state/shape';
import { DecisionTrail } from './DecisionTrail';
import { AccessibilityTools } from './AccessibilityTools';
import type { Screen } from '../../lib/types';

/** Screens whose own full-canvas chrome already carries the working context. */
const QUIET_ON = new Set<Screen>(['onboarding', 'search', 'directory', 'ask', 'mail', 'call']);

/**
 * The persistent continuity strip: one term, one canonical location, one
 * workflow, one route back into unfinished work, and one visible health state.
 */
export function SystemContextBar() {
  const { state, dispatch, terms, sync } = useStore();
  const off = useOffline();
  const canonical = canonicalDestinationFor(state.screen);
  const canonicalLabel = FIVE_LABELS[canonical] ?? canonical;
  const currentTerm = terms.find((term) => term.id === state.term) ?? terms[0];
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const availableWorkflows = STUDENT_WORKFLOWS.filter(candidate => candidate.steps.some(step => step.screen === state.screen));
  const workflow = availableWorkflows.find(candidate => candidate.id === workflowId) ?? workflowForScreen(state.screen);
  const continuation = useMemo(() => {
    const recent = state.recent.find((screen) => screen !== state.screen && !QUIET_ON.has(screen));
    if (!recent) return null;
    return { screen: recent, label: screenName(recent) };
  }, [state.recent, state.screen]);
  const health = statusOf(syncStatusKey(sync.status, off));

  if (QUIET_ON.has(state.screen)) return <section className="system-context pane-strip" aria-label="Accessibility tools">
    <AccessibilityTools context={`${state.term}:${state.screen}:${state.itemId}:${state.courseId}:${state.guideId}:${state.eventId}:${state.documentId}:${state.noteId}:${state.sheetId}:${state.deckId}`} look={currentLook(state)} onChange={look => dispatch({type: 'setLook', look})} onSettings={() => dispatch({type: 'go', screen: 'setLook'})} />
  </section>;

  return (
    <section className="system-context pane-strip" aria-label="Semester context">
      <div className="system-context-location">
        {terms.length > 1 ? (
          <select
            className="system-context-term system-context-term-select"
            aria-label="Current semester"
            value={currentTerm?.id ?? state.term}
            onChange={(event) => dispatch({ type: 'setTerm', term: event.target.value })}
          >
            {terms.map((term) => (
              <option key={term.id} value={term.id}>{term.label}</option>
            ))}
          </select>
        ) : (
          <span className="system-context-term">{currentTerm?.label ?? state.term}</span>
        )}
        <span aria-hidden="true">/</span>
        <button type="button" className="bare system-context-link" onClick={() => dispatch({ type: 'go', screen: canonical })}>
          {canonicalLabel}
        </button>
        {state.screen !== canonical && (
          <>
            <span aria-hidden="true">/</span>
            <span role="status" aria-live="polite">{screenName(state.screen)}</span>
          </>
        )}
      </div>
      <div className="system-context-actions">
        <AccessibilityTools context={`${state.term}:${state.screen}:${state.itemId}:${state.courseId}:${state.guideId}:${state.eventId}:${state.documentId}:${state.noteId}:${state.sheetId}:${state.deckId}`} look={currentLook(state)} onChange={look => dispatch({type: 'setLook', look})} onSettings={() => dispatch({type: 'go', screen: 'setLook'})} />
        {workflow && <div className="system-context-workflow system-context-trail">{availableWorkflows.length > 1 && <select className="input" aria-label="Current workflow" value={workflow?.id} onChange={event => setWorkflowId(event.target.value)}>{availableWorkflows.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>}<DecisionTrail workflow={workflow} current={state.screen} onOpen={screen => { setWorkflowId(workflow.id); dispatch({type: 'go', screen}); }} /></div>}
        {continuation && (
          <button type="button" className="bare system-context-link" onClick={() => dispatch({ type: 'go', screen: continuation.screen })}>
            ← Back to {continuation.label}
          </button>
        )}
        <button
          type="button"
          className="bare system-health"
          data-tone={health.tone}
          title={health.about}
          onClick={() => dispatch({ type: 'go', screen: 'account' })}
          aria-label={`${health.label}. Open connection and account health.`}
        >
          <span aria-hidden="true">{health.glyph}</span>
          <span className="system-health-label">{health.label}</span>
        </button>
      </div>
    </section>
  );
}
