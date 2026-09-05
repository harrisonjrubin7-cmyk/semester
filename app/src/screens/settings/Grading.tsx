import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, NavRow, SettingsGroup } from '../../components/settings/Rows';
import { lights } from '../../lib/settings';
import { Cutoffs } from '../../components/Cutoffs';
import { Attendance } from '../../components/Attendance';
import { FirstRun } from '../FirstRun';

/**
 * What each course counts as an A, and what it forgives.
 *
 * Per course, because these are facts about a syllabus rather than
 * preferences — two courses at the same university routinely disagree about
 * where a B+ starts, and an app that made you pick one answer for all of them
 * would be wrong about at least one.
 *
 * ## What is not here, and why
 *
 * Dropped pieces live on the grade rows themselves, in `PiecesRow`, and stay
 * there. "The lowest two problem sets are dropped" is only answerable next to
 * the problem sets — moving it here would mean scrolling between two screens
 * to type one number, and the row is where somebody already is when they
 * learn it. The link below goes to it rather than pretending otherwise.
 */
export function SettingsGrading() {
  const { dispatch, catalog } = useStore();
  if (catalog.empty) return <FirstRun where="to set up grading" />;

  return (
    <SettingsPage
      screen="setGrading"
      title="Grading"
      blurb="Per course, because syllabi disagree. Nothing here changes a grade — it changes what the app reads one as."
    >
      {(lit) => (
        <>
          {catalog.courses.map((c) => (
            <SettingsGroup
              key={c.id}
              header={c.code}
              lit={lights(`grades grading scale cutoffs letter gpa attendance absences ${c.code} ${c.name}`, lit)}
            >
              <CustomRow>
                <Cutoffs courseId={c.id} code={c.code} />
              </CustomRow>
              <CustomRow>
                <Attendance courseId={c.id} />
              </CustomRow>
            </SettingsGroup>
          ))}

          <SettingsGroup
            header="Dropped pieces"
            footer="These stay on the grade rows themselves, next to the category they belong to. Which two problem sets are dropped is only answerable beside the problem sets."
            lit={lights('drop dropped lowest pieces individual scores', lit)}
          >
            <NavRow
              label="Where you stand"
              sub="Type scores, and set drops per category"
              onClick={() => dispatch({ type: 'go', screen: 'grades' })}
            />
          </SettingsGroup>
        </>
      )}
    </SettingsPage>
  );
}
