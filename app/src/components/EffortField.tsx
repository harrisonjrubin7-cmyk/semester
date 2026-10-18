import { useId, useState } from 'react';
import { useStore } from '../state/store';
import { estimate } from '../lib/pace';
import { effortLine, MAX_EFFORT_MINUTES } from '../lib/effort';

/**
 * "How long do you expect this to take?" — §91's *Estimated effort*, on the
 * item itself, before the work is done.
 *
 * It sits beside the pace-based figure rather than replacing it, and the
 * sentence underneath names which is which. See `lib/effort.ts`.
 *
 * Blank clears the estimate. Commits on blur or Enter, so a half-typed number
 * is never written; a value that is not a number is discarded back to what was
 * stored. The input is keyed on the stored value, so a change made on another
 * device replaces what is shown rather than sitting stale beside it.
 */
export function EffortField({ id, courseId, kind }: { id: string; courseId: string; kind: string }) {
  const { state } = useStore();
  const stated = state.effort[id];
  const paced = estimate(state.spent, courseId, kind).minutes;
  return (
    <EffortInput
      key={stated === undefined ? 'none' : String(stated)}
      id={id}
      stated={stated}
      paced={paced > 0 ? paced : null}
    />
  );
}

function EffortInput({ id, stated, paced }: { id: string; stated: number | undefined; paced: number | null }) {
  const { dispatch } = useStore();
  const fieldId = useId();
  const [draft, setDraft] = useState(stated === undefined ? '' : String(stated));

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (stated !== undefined) dispatch({ type: 'setEffort', id, minutes: null });
      return;
    }
    const minutes = Number(trimmed);
    if (!Number.isFinite(minutes)) {
      setDraft(stated === undefined ? '' : String(stated));
      return;
    }
    dispatch({ type: 'setEffort', id, minutes });
  };

  const line = effortLine(stated, paced);

  return (
    <div style={{ marginTop: 'var(--sp-5)' }}>
      <label
        htmlFor={fieldId}
        style={{ display: 'block', fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', marginBottom: 'var(--sp-3)' }}
      >
        Your estimate, in minutes
      </label>
      <input
        id={fieldId}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_EFFORT_MINUTES}
        step={5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        style={{ width: '100%' }}
      />
      {line && (
        <div
          style={{
            fontSize: 'var(--type-xs-plus)',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-3)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {line}
        </div>
      )}
    </div>
  );
}
