import { useStore } from '../state/store';
import { BUCKETS, askAbout } from '../lib/pace';

/**
 * "How long did that take?", asked once, at the only moment you know.
 *
 * It appears under a deadline the instant it is ticked and nowhere else. Three
 * rules keep it from becoming furniture, and all three are in `lib/pace.ts`
 * rather than here: it is never asked twice about the same thing, it stops
 * asking once five reports of that kind in that course make a stable median,
 * and there is no "skip" to press because ignoring it *is* skipping it — the
 * row simply goes when the item does.
 *
 * The answer is the only number the app cannot work out for itself, and it is
 * what turns "nine hours spare" and "five assignments" from two facts that
 * refuse to be compared into one sentence.
 */
export function HowLong({
  id,
  courseId,
  kind,
}: {
  id: string;
  courseId: string;
  /** The item's kind, as the syllabus words it. Normalised on the way in. */
  kind: string;
}) {
  const { state, dispatch } = useStore();
  if (!askAbout(state.spent, id, courseId, kind)) return null;

  return (
    <div style={{ padding: '9px 0 4px' }}>
      <div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 6, lineHeight: 1.4 }}>
        How long did that take? It teaches the week ahead your own pace.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            className="btn btn-secondary"
            onClick={() => dispatch({ type: 'timeSpent', id, courseId, kind, bucketId: b.id })}
            style={{ height: 32, fontSize: 12, padding: '0 10px', flex: 'none' }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
