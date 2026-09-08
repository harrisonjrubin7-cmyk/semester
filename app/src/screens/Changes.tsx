import { Page } from '../components/Page';
import { Segmented } from '../components/ui';
import { useStore } from '../state/store';
import { FromText } from './changes/FromText';
import { AgainstCalendar } from './changes/AgainstCalendar';

/**
 * Something outside the app says a date moved.
 *
 * There were two screens for this, listed next to each other in the directory:
 * "Fold in an announcement", which read the email that moved a deadline, and
 * "Check the dates", which compared the app against an LMS calendar. Two names
 * for one job — an outside statement that a date changed, taken one row at a
 * time, applied through `replaceCourse`, never automatically.
 *
 * What differs is only the post it arrives in. So that is the switch, and it
 * is a switch rather than a second place to look for the same thing: you know
 * whether you are holding an email or a calendar, and you should not also have
 * to know which of two screen names the app filed that under.
 *
 * ## Both halves keep their caution
 *
 * The prose side quotes the sentence every proposed change rests on and drops
 * anything it cannot quote. The calendar side shows both dates in full and
 * reports an uncertain pairing as two separate lines rather than one confident
 * wrong match. Neither of those is a detail — a change you cannot check is a
 * change you should not take — and the merge does not touch either.
 */
const SOURCES = [
  { id: 'told', label: 'An email or post' },
  { id: 'feed', label: 'A calendar' },
] as const;

export function Changes() {
  const { state, dispatch } = useStore();
  const source = state.changes;

  return (
    <Page
      bottom={26}
      blurb={
        <>
          A calendar feed carries dates. The email that <em>changes</em> a date never reaches the
          app, so the app can be a week out and say nothing. Both go through here.
        </>
      }
    >
      <Segmented
        options={SOURCES}
        value={source}
        onChange={(next) => dispatch({ type: 'setChanges', source: next })}
        style={{ marginBottom: 'var(--sp-7)' }}
      />

      {source === 'told' ? <FromText /> : <AgainstCalendar />}
    </Page>
  );
}
