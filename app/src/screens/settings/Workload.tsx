import { SettingsPage } from './Page';
import { useStore } from '../../state/store';
import { Toggle } from '../../components/ui';
import { CustomRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { WorkWindows } from '../../components/WorkWindows';
import { Capacity } from '../../components/Capacity';
import { DayBudget } from '../../components/Clashes';

/** The hint under a toggle, in the audited token rather than a hand-written opacity. */
const HINT = {
  fontSize: 'var(--type-xs-plus)',
  color: 'var(--app-dim)',
  marginTop: 'var(--sp-3)',
  lineHeight: 'var(--leading-normal)',
} as const;

/**
 * How much of a day this app is allowed to assume it has.
 *
 * The three settings that change an arithmetic rather than a look. Everything
 * the app says about whether a week fits — the runway before an exam, what has
 * to start today, the warning that a Tuesday will not hold — is worked out
 * against these, and they were in three different places.
 */
export function SettingsWorkload() {
  const { state, dispatch } = useStore();
  return (
    <SettingsPage
      screen="setWorkload"
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

          {/*
            On this page rather than a page of its own, because a season is an
            arithmetic before it is anything else. Practice, training and
            travel are hours `lib/ahead.ts` subtracts from the week like any
            other promise — an away trip took a sample week from 112 spare
            hours to 64 — so this belongs beside the other three settings that
            change what the app assumes about a day.
          */}
          <Group
            header="On a team"
            // `Group`'s "footer" is drawn between the header and the frame in
            // this layout, not under it — so this reads as an opening line,
            // and the reassurance about switching it off belongs under the
            // control it is about rather than above it.
            footer="Practice, training and travel are hours the planner takes out of your week like any other promise."
            lit={lights('athlete athletics sport sports team varsity season practice training competition travel nil name image likeness deal compliance cara eligibility', lit)}
          >
            <CustomRow>
              <Toggle
                label="I'm a student-athlete"
                on={state.athlete}
                onChange={() => dispatch({ type: 'setAthlete', on: !state.athlete })}
              />
              <div style={HINT}>
                Adds Athletics and NIL to the directory — a season beside your
                coursework, the conflicts it creates, and a private record of
                any name, image and likeness deals. Neither is official, and
                neither is shared with anybody. Turning it off later takes
                nothing away: a screen you have opened stays, and search finds
                both either way.
              </div>
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
