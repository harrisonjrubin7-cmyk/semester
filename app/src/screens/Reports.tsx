import { Page } from '../components/Page';
import { PrintButton } from '../components/PrintButton';
import { Segmented } from '../components/ui';
import { useStore } from '../state/store';
import { DayReport } from './report/Day';
import { WeekReport } from './report/Week';
import { TermReport } from './report/Term';

/**
 * The same report, at three grains.
 *
 * There were three screens here: Brief, for the two ends of a day; Weekly, for
 * the week that happened; Worked, for the term. Three destinations, three
 * entries in the directory, three things to find — and one object underneath.
 * `lib/brief.ts` and `lib/weekly.ts` are the same file written twice: an input
 * interface, a counted struct, a system prompt, a report string. `lib/worked.ts`
 * is the third, with the paragraph left off.
 *
 * So this is one screen with a grain switch, and the choice a student makes is
 * the one they actually have — *how far back am I looking* — rather than which
 * of three names on a list meant the week.
 *
 * ## Why the grain lives in the store
 *
 * A reminder on a Sunday evening is about the week, and a link from the day
 * report to "this week" has to arrive somewhere specific. Local state cannot
 * be addressed from outside the component, so the grain is a field like
 * `calView` next door, set by the same kind of action, and not persisted —
 * coming back to the app tomorrow should open today.
 */
const GRAINS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'term', label: 'Term' },
] as const;

const PRINT: Record<string, string> = {
  day: 'Print this report',
  week: 'Print the week',
  term: 'Print the term',
};

export function Reports({ bare = false }: { bare?: boolean } = {}) {
  const { state, dispatch } = useStore();
  const grain = state.report;

  const body = (
    <>
      <Segmented
        options={GRAINS}
        value={grain}
        onChange={(next) => dispatch({ type: 'setReport', grain: next })}
        style={{ marginBottom: 'var(--sp-7)' }}
      />

      {grain === 'day' ? (
        <DayReport onGrain={(next) => dispatch({ type: 'setReport', grain: next })} />
      ) : grain === 'week' ? (
        <WeekReport />
      ) : (
        <TermReport />
      )}

      <PrintButton label={PRINT[grain] ?? 'Print this report'} style={{ marginTop: 'var(--sp-6)' }} />
    </>
  );

  /*
   * Two callers, one body.
   *
   * Standalone this is a screen and takes the app's frame: the padding, the
   * search box, the space above the tab bar. On Today it is the "Report" tab
   * inside somebody else's `<Page>`, and a second frame there would mean a
   * second search box on the same screen, filtering nothing. See the note at
   * the top of `components/Page.tsx`.
   *
   * The trailing spacer goes with the frame, so it is written by hand only on
   * the embedded path.
   */
  if (bare) {
    return (
      <div>
        {body}
        <div style={{ height: 26 }} />
      </div>
    );
  }
  return <Page bottom={26}>{body}</Page>;
}
