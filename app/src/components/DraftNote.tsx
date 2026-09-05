import { KEPT_LINE } from '../lib/draft';
import type { DraftField } from '../lib/draft.hook';

/**
 * The one line under a long field that says its text is being kept.
 *
 * Two things, and both are worth saying out loud rather than being left to be
 * discovered. That the field autosaves — otherwise nobody trusts it and the
 * careful ones paste into Notes first. And, when something was put back, that
 * the app put it there: text on a screen somebody thought was blank is
 * unsettling in a way one sentence avoids.
 *
 * It says nothing at all until something has been typed, so a screen opened
 * and not used stays quiet.
 */
export function DraftNote({ field }: { field: DraftField }) {
  if (!field.said && !field.value) return null;
  return (
    <div
      style={{
        fontSize: 'calc(11px * var(--text-scale, 1))',
        opacity: field.said ? 0.75 : 0.45,
        marginTop: 6,
        lineHeight: 1.45,
        textWrap: 'pretty',
      }}
    >
      {field.said || KEPT_LINE}
    </div>
  );
}
