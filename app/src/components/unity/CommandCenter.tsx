import { useMemo, useState } from 'react';
import { standing } from '../../lib/apply';
import { GOALS, goalOf } from '../../lib/goals';
import { upcomingItems } from '../../lib/select';
import { pathSnapshot } from '../../lib/today-decision';
import { MAX_PINS, WIDGETS, movePin, readPins, togglePin, widgetOf, writePins, type WidgetId } from '../../lib/widgets';
import { currentLook } from '../../state/shape';
import { useNow, useStore } from '../../state/store';

/**
 * The student's command centre — the widgets they pinned to Today.
 *
 * Each widget is one line of real data and a way in, never a chart for its
 * own sake. "Arrange" discloses the controls: pin or unpin, Move up, Move
 * down. No dragging, so a keyboard and a switch reach every arrangement the
 * pointer does (WCAG 2.5.7).
 */
export function CommandCenter() {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const [arranging, setArranging] = useState(false);
  const pins = readPins(currentLook(state).pinned);
  const save = (ids: WidgetId[]) => dispatch({ type: 'setLook', look: { pinned: writePins(ids) } });

  const upcoming = useMemo(() => upcomingItems(catalog, now).filter((i) => !state.done[i.id]), [catalog, now, state.done]);
  const path = useMemo(() => pathSnapshot(state.requirements, state.taken), [state.requirements, state.taken]);

  const said: Record<WidgetId, string> = {
    week: (() => {
      const n = upcoming.filter((i) => i.daysAway <= 7).length;
      return n === 0 ? 'Nothing due in the next seven days' : `${n} due in the next seven days`;
    })(),
    assignment: upcoming[0] ? `${upcoming[0].title} · ${upcoming[0].dueShort}` : 'No upcoming assignment',
    degree: path.total === 0 ? 'No requirements added yet' : `${path.covered} of ${path.total} requirements covered`,
    study: (() => {
      const due = Object.values(state.reviews).filter((r) => r.due <= now.getTime()).length;
      return due === 0 ? 'No review cards due' : `${due} review card${due === 1 ? '' : 's'} due`;
    })(),
    opportunity: (() => {
      // Live applications only, and only deadlines still ahead: `standing`
      // already drops closed ones and sorts soonest first.
      const next = standing(state.applications, now).find((s) => s.what === 'due' && s.daysAway >= 0);
      return next ? `${next.application.org} · due ${next.date}` : 'No upcoming application deadlines';
    })(),
  };

  return (
    <section className="command-center hides-in-focus" aria-labelledby="command-center-title">
      <div className="command-center-head">
        <h2 id="command-center-title" className="kicker">
          Pinned
        </h2>
        <button type="button" className="bare link-quiet tap-y" aria-expanded={arranging} onClick={() => setArranging((a) => !a)}>
          {arranging ? 'Done arranging' : 'Arrange'}
        </button>
      </div>
      <ul className="command-center-grid">
        {pins.map((id, i) => {
          const w = widgetOf(id);
          return (
            <li key={id} className="command-widget">
              <button type="button" className="command-widget-open" onClick={() => dispatch({ type: 'go', screen: w.screen })}>
                <span className="command-widget-label">{w.label}</span>
                <span className="command-widget-value nums">{said[id]}</span>
              </button>
              {arranging && (
                <div className="command-widget-arrange" role="group" aria-label={`Arrange ${w.label}`}>
                  <button type="button" className="btn btn-ghost" disabled={i === 0} onClick={() => save(movePin(pins, id, -1))}>
                    Move up
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={i === pins.length - 1}
                    onClick={() => save(movePin(pins, id, 1))}
                  >
                    Move down
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => save(togglePin(pins, id))}>
                    Unpin
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {arranging && (
        <div className="command-center-add" role="group" aria-label="Pin a widget">
          {WIDGETS.filter((w) => !pins.includes(w.id)).map((w) => (
            <button
              key={w.id}
              type="button"
              className="pill-soft tap-y"
              disabled={pins.length >= MAX_PINS}
              onClick={() => save(togglePin(pins, w.id))}
            >
              Pin {w.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * First-session setup — "What would help most today?"
 *
 * Shown on Today until a goal is chosen, then folded into one line with a
 * Change beside it. Choosing takes the student straight into that workflow;
 * nothing is asked for first — no account, no profile.
 */
export function FirstGoal() {
  const { state, dispatch } = useStore();
  const goal = goalOf(currentLook(state).goal);
  const [changing, setChanging] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (goal && !changing) {
    return (
      <section className="first-goal-said hides-in-focus" aria-label="Your focus">
        <div className="first-goal-summary-copy"><span className="kicker">Your focus</span><span>{goal.label}</span></div>
        <div className="first-goal-summary-actions">
        <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'go', screen: goal.screen })}>
          {goal.first}
        </button>
        <button type="button" className="bare link-quiet tap-y" onClick={() => setChanging(true)}>
          Change
        </button>
        </div>
      </section>
    );
  }

  return (
    <section className="first-goal hides-in-focus" aria-labelledby="first-goal-title">
      <h2 id="first-goal-title" className="first-goal-title">
        What would help most today?
      </h2>
      <div className="first-goal-choices">
        {(showAll ? GOALS : GOALS.slice(0, 4)).map((g) => (
          <button
            key={g.id}
            type="button"
            className="pill-soft tap-y"
            aria-pressed={goal?.id === g.id}
            onClick={() => {
              setChanging(false);
              dispatch({ type: 'setLook', look: { goal: g.id } });
              dispatch({ type: 'go', screen: g.screen });
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="first-goal-foot">
        <p className="visibility-about">You can change this any time.</p>
        <button
          type="button"
          className="bare link-quiet tap-y"
          aria-expanded={showAll}
          onClick={() => setShowAll((shown) => !shown)}
        >
          {showAll ? 'Fewer options' : 'More options'}
        </button>
      </div>
    </section>
  );
}
