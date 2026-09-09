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

export function Reports() {
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
   * One caller, one frame.
   *
   * There were two: this screen, and a "Report" tab on Today that rendered the
   * same body bare inside Today's own `<Page>`. That put the whole report in
   * two places — a grain switcher nested inside Today's tab switcher — and
   * made Today's bar five wide, which is where "This week" started wrapping.
   * The report is not a view of today: "what is on now" and "how did it go"
   * are asked on different days. So the tab went and the screen stayed.
   */
  return <Page bottom={26}>{body}</Page>;
}
