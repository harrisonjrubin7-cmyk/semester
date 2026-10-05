import { CAUTION, scenarios, type Scenarios } from '../lib/outcome-scenarios';
import { SourceBadge } from './SourceBadge';
import type { Standing } from '../lib/grades';

/**
 * Course Outcome Scenarios, closed until the student opens it.
 *
 * Named for what it is: a planning tool, not a grade predictor. Everything it
 * says comes from `lib/outcome-scenarios.ts`, which refuses rather than
 * computing on weights that do not total 100. Nothing here is coloured by
 * how good or bad a number is; a scenario is a number and a sentence.
 *
 * `paused` is the student's own switch (calm settings): the whole card
 * disappears, with no placeholder nagging them to turn it back on.
 */
export function OutcomeScenarios({
  standing,
  code,
  paused = false,
  result = scenarios(standing),
}: {
  standing: Standing;
  code: string;
  paused?: boolean;
  result?: Scenarios;
}) {
  if (paused) return null;
  return (
    <details className="today-why" style={{ marginTop: 'var(--sp-5)' }}>
      <summary>{code} · Course outcome scenarios</summary>
      {result.ok ? (
        <div>
          <p>
            {result.confirmedShare}% of the weighted work has posted scores. Current weighted result:{' '}
            {result.confirmed}%.
          </p>
          <ul>
            {result.rows.map((r) => (
              <li key={r.average}>
                If the remaining work averages {r.average}%, the estimated course outcome is {r.outcome}%.
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>{result.text}</p>
      )}
      <p>{CAUTION}</p>
      <SourceBadge label="student_entered" />
    </details>
  );
}
