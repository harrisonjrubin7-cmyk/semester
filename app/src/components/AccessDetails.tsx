import type { AccessDetails as Details } from '../lib/access-details';

/**
 * "Access details" on a protected place: why it is open, or why it is not.
 *
 * A native disclosure, so it works without script and keyboards reach it like
 * any other button. A closed place says what the person lacks and who decides,
 * and names nothing inside the place it protects.
 */
export function AccessDetailsPanel({ details, owner }: { details: Details; owner?: string }) {
  return (
    <details className="access-details">
      <summary>Access details</summary>
      {details.allowed ? (
        <ul>
          {details.because.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="state-body">
          You do not hold {details.capability} for this {details.scope.kind}.
          {owner ? ` Ask ${owner} for access.` : ''}
        </p>
      )}
      {details.elsewhere.length > 0 && (
        <p className="state-note">
          You hold {details.capability} at other places. Those do not open this one.
        </p>
      )}
      <ul className="state-note">
        {details.limits.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
