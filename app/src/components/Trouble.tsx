/**
 * Something failed, and the thing to press about it.
 *
 * The app's error messages were already unusually good: they carry the API's
 * own wording, or the parser's, rather than "something went wrong". And then
 * they stopped. There was not one retry button anywhere in the app, so a
 * course generation that failed on a flaky connection lost a two-minute upload
 * and left the student to work out for themselves that doing it again was the
 * answer.
 *
 * Which is nearly always the answer. The failures this app actually has are a
 * dropped connection, a rate limit, a model that returned something the parser
 * would not take — all transient, all worth one more go, and the app knows
 * exactly what it was about to do.
 *
 * ## What it does not do
 *
 * It never retries by itself. An automatic retry on a request that costs money
 * is a way to spend somebody's budget twice on one bad afternoon, and an
 * automatic retry on a request that partly succeeded is a way to get two of
 * something. The student presses it, or nothing happens.
 */
export function Trouble({
  said,
  onRetry,
  label = 'Try that again',
  busy = false,
}: {
  /** What went wrong, in the words the thing that failed used. */
  said: string;
  /**
   * Runs the same thing again. Null or omitted where there is nothing worth
   * repeating — `useTrouble` hands its `again` straight in, and that is null
   * whenever the failure was the input rather than the attempt.
   */
  onRetry?: (() => void) | null;
  label?: string;
  busy?: boolean;
}) {
  if (!said) return null;

  return (
    <div
      style={{
        marginTop: 14,
        padding: '11px 13px',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-warn-line)',
        background: 'var(--app-warn-wash)',
      }}
      // Announced to a screen reader when it appears, because a failure that
      // is only visible is a failure half the people using the app miss.
      role="alert"
    >
      <div
        style={{
          fontSize: 'calc(13px * var(--text-scale, 1))',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          textWrap: 'pretty',
        }}
      >
        {said}
      </div>

      {onRetry && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRetry}
          disabled={busy}
          style={{ height: 38, marginTop: 10, fontSize: 'calc(12.5px * var(--text-scale, 1))', paddingInline: 18 }}
        >
          {busy ? 'Trying…' : label}
        </button>
      )}
    </div>
  );
}
