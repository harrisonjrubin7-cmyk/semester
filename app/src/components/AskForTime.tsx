/**
 * The extension email, opened from the deadline it is about.
 *
 * The drafting screen has been able to write this since it existed, and
 * getting to it meant going to Mail, picking the course, picking the purpose,
 * then finding this one deadline in a list of thirty-eight. Four steps between
 * realising you will not make something and doing the only thing that helps,
 * taken at the moment somebody has least appetite for four steps.
 *
 * This is the same screen, seeded. It does not write anything, offer wording,
 * or suggest a new date — `lib/mail.ts` needs the reason and the date from the
 * student, and inventing either would put a made-up excuse in their name.
 */

import { useStore } from '../state/store';
import { canAskForTime } from '../lib/mail';
import type { DatedItem } from '../lib/types';

export function AskForTime({ item }: { item: DatedItem }) {
  const { state, dispatch, catalog } = useStore();
  if (!canAskForTime(item, !!state.done[item.id])) return null;

  const course = catalog.byId[item.c];

  return (
    <button
      type="button"
      className="bare tappable"
      onClick={() =>
        dispatch({
          type: 'writeMail',
          purposeId: 'extension',
          courseId: item.c,
          itemId: item.id,
          to: course?.email ?? '',
        })
      }
      style={{
        width: 'auto',
        padding: '8px 0 2px',
        fontSize: 'calc(12px * var(--text-scale, 1))',
        opacity: 0.6,
        textAlign: 'left',
      }}
    >
      {item.isPast ? 'Write to ask about a late submission' : 'Write to ask for more time'}
    </button>
  );
}
