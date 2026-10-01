/**
 * The student-facing operating contract for Semester Guide.
 *
 * Kept in one component so the assistant panel and its settings cannot drift
 * into promising different powers. This is explanatory; accepting it is not
 * a waiver and no capability depends on a checkbox.
 */
export function GuideOperatingContract({ compact = false }: { compact?: boolean }) {
  return (
    <details className={`guide-contract${compact ? ' is-compact' : ''}`}>
      <summary>How Semester Guide works</summary>
      <div className="guide-contract-body">
        <p>Semester Guide helps you organize your education. You remain in control, and suggestions are optional.</p>
        <section>
          <h3>It can</h3>
          <ul>
            <li>Explain authorized sources and show what a recommendation used.</li>
            <li>Organize deadlines, plans and selected calendar context.</li>
            <li>Compare options and prepare editable plans, questions, agendas and packets.</li>
            <li>Help recover from a change and route you to a person or official system.</li>
          </ul>
        </section>
        <section>
          <h3>It cannot</h3>
          <ul>
            <li>Make academic, financial, disciplinary, health or institutional decisions for you.</li>
            <li>Register, drop, pay, send, share, delete or change an official record without an authorized workflow and your exact confirmation.</li>
            <li>Promise grades, eligibility, seat availability or degree completion.</li>
            <li>Create hidden scores about ability, motivation, wellbeing or future outcomes.</li>
          </ul>
        </section>
        <p>
          Important information is source-labeled. When context is missing, stale, restricted or uncertain, Semester
          should stop, say what it cannot verify, and offer a safe source or human route instead of guessing.
        </p>
        <p>
          Every Guide flow is optional. You can choose Not now, leave the flow, or use Semester’s planning, study and
          campus-resource tools without guidance. Dismissing guidance never removes or penalizes your work.
        </p>
        <p className="guide-contract-boundary">
          Semester is not an emergency or counseling service. For immediate danger or urgent help, use local emergency
          services or your institution’s emergency resources.
        </p>
      </div>
    </details>
  );
}
