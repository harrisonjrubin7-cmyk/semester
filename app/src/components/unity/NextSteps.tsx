/** One next step: what to do, and optionally why now. */
export interface Step {
  label: string;
  why?: string;
  run: () => void;
}

/**
 * NEXT — the section a workflow ends on.
 *
 * Every page that finishes something should say what the useful thing after
 * it is, so the app reads as one journey rather than a set of tools that each
 * stop at their own edge. At most three: a list of seven next steps is a
 * to-do list, and the point of this is to pick.
 *
 * Renders nothing when there is nothing honest to suggest — an empty "Next"
 * heading is worse than none.
 */
export function NextSteps({ steps, title = 'Next' }: { steps: Step[]; title?: string }) {
  const shown = steps.slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <section className="next-steps hides-in-focus" aria-label={title}>
      <h2 className="kicker next-steps-title">{title}</h2>
      <ul>
        {shown.map((s) => (
          <li key={s.label}>
            <button type="button" className="next-step tap-y" onClick={s.run}>
              <span className="next-step-label">{s.label}</span>
              {s.why && <span className="next-step-why">{s.why}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
