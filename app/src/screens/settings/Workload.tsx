import { SettingsPage } from './Page';
import { CustomRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { WorkWindows } from '../../components/WorkWindows';
import { Capacity } from '../../components/Capacity';
import { DayBudget } from '../../components/Clashes';

/**
 * How much of a day this app is allowed to assume it has.
 *
 * The three settings that change an arithmetic rather than a look. Everything
 * the app says about whether a week fits — the runway before an exam, what has
 * to start today, the warning that a Tuesday will not hold — is worked out
 * against these, and they were in three different places.
 */
export function SettingsWorkload() {
  return (
    <SettingsPage
      screen="setWorkload"
      title="Workload"
      blurb="What the app assumes about your time. Get these wrong and every estimate it gives you is wrong in the same direction."
    >
      {(lit) => (
        <>
          <Group
            header="When you work"
            footer="Used to work backwards from a deadline. Hours you have not claimed are hours the app will not plan into."
            lit={lights('work windows hours when you work morning evening night schedule', lit)}
          >
            <CustomRow>
              <WorkWindows />
            </CustomRow>
          </Group>

          <Group
            header="How much a day holds"
            lit={lights('day budget hours a day workload capacity how long time', lit)}
          >
            <CustomRow>
              <DayBudget />
            </CustomRow>
          </Group>

          <Group
            header="What the term is worth"
            lit={lights('contract term credits load capacity week busy', lit)}
          >
            <CustomRow>
              <Capacity />
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
