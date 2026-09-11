import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group, NavRow } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { SectionLabel, Toggle } from '../../components/ui';
import { YourCourses } from '../../components/YourCourses';
import { SchoolPicker } from '../../components/SchoolPicker';
import { SEED_SUMMARY } from '../../data/seed';
import { CourseRow } from '../Me';
import { DESTINATIONS } from '../../lib/nav';
import { hiddenFor } from '../../lib/school';
import { ROLES, hiddenFrom, pickable, roleOf, type Role } from '../../lib/role';

/**
 * Who you are to the app, and what it is holding.
 *
 * Your name used to be a field here, on the argument that it was the one fact
 * this page's other settings are about. It is on the profile screen now, where
 * the account and the counts are, and this page keeps a row pointing at it —
 * see the note beside that row.
 *
 * The role sits above that row because it is the widest of the four — it
 * decides which screens are addressed to this person at all, and the two
 * "Hidden:" lines on this page are the same sentence about two different
 * gates. See `lib/role.ts`, which is careful about which of them the app can
 * honestly serve.
 */
export function SettingsCourses() {
  const { state, dispatch, school } = useStore();
  const hidden = hiddenFor(school.capabilities);
  const byRole = hiddenFrom(state.role);

  return (
    <SettingsPage
      screen="setCourses"
      blurb="What the app is holding this term, and the university it reads the rest of the app against."
    >
      {(lit) => (
        <>
          <Group
            header="What you are here to do"
            footer="Not a permission. It is one device and one person, and this decides which screens are addressed to you — the same kind of thing as the university above deciding whether a meal-plan screen exists."
            lit={lights('role student faculty teaching professor instructor advisor administrator parent payer staff who am i', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: '0 0 6px' }}>You are here as</SectionLabel>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-4)', textWrap: 'pretty' }}>
                {roleOf(state.role).blurb}
              </div>
              <select
                className="input"
                value={state.role}
                aria-label="What you are here to do"
                onChange={(e) => dispatch({ type: 'setRole', role: e.target.value as Role })}
                style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
              >
                {pickable().map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>

              {byRole.length > 0 && (
                // Named rather than counted, for the same reason as the
                // school's list below it.
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
                  Hidden: {byRole.map((h) => DESTINATIONS.find((d) => d.screen === h)?.label ?? h).join(', ')}.
                  Nothing is deleted — switch back and every one of them returns with everything
                  in it.
                </div>
              )}

              {/*
                Shown rather than hidden. Somebody who came looking for the
                advising side deserves to know it is understood and missing;
                leaving it out entirely reads as an app that has never heard
                of advisors, and a role that is offered and then holds only
                what you typed into it would be the confident wrong thing
                this app refuses everywhere else.
              */}
              <SectionLabel style={{ margin: 'calc(22px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
                Not yet
              </SectionLabel>
              {ROLES.filter((r) => !r.ready).map((r) => (
                <div key={r.id} style={{ marginBottom: 'var(--sp-4)' }}>
                  <div style={{ fontSize: 'var(--type-base)' }}>{r.label}</div>
                  <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
                    {r.needs}
                  </div>
                </div>
              ))}
            </CustomRow>
          </Group>

          {/*
            The name moved to Profile, and this is the row that says where.

            It was a field here, and the note at the top of this file argued
            for it: the name was the fact the rest of this page's settings were
            about. That was true while the app had no screen about the person.
            It has one now — `screens/Profile.tsx` — and two boxes editing one
            string is the duplicate this codebase keeps deleting. A row rather
            than nothing at all, because somebody who learned where the name
            was must not come back to find it simply gone.
          */}
          <Group
            header="You"
            footer="Your name is only used to address you in the app. It is never sent anywhere and never guessed at from your email."
            lit={lights('name your name called address me profile avatar account', lit)}
          >
            <NavRow
              label="Your name"
              value={state.myName.trim() || 'Not set'}
              sub="On your profile, with your account and everything the app holds"
              onClick={() => dispatch({ type: 'go', screen: 'profile' })}
            />
          </Group>

          <Group
            header="Where you study"
            lit={lights('school university college campus where you study switch', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Where you study</SectionLabel>
              {/* Was a two-option toggle: this school, or "somewhere else". That is
                  fine for one student and useless for anyone whose university the app
                  has never heard of, which is everyone else. See
                  `components/SchoolPicker.tsx` — find it, add it, or skip. */}
              <SchoolPicker />
              {hidden.length > 0 && (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
                  {/* Named rather than counted. "3 screens are hidden" invites the
                      question this answers. */}
                  Hidden: {hidden.map((h) => DESTINATIONS.find((d) => d.screen === h)?.label ?? h).join(', ')}.
                  Everything else — your courses, deadlines, grades, cards, papers, essays, the weekly
                  report — works the same wherever you are.
                </div>
              )}
            </CustomRow>
          </Group>

          <Group
            header="This term"
            lit={lights('courses course remove delete order rearrange sample data demo example import', lit)}
          >
            <CustomRow>
              <YourCourses />
            </CustomRow>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(2px * var(--density, 1))' }}>Your courses</SectionLabel>
              <Toggle
                label={`Sample semester — ${SEED_SUMMARY.courses} courses, ${SEED_SUMMARY.cards} cards, ${SEED_SUMMARY.lessons} lessons`}
                on={state.sample}
                onChange={() => dispatch({ type: 'setSample', on: !state.sample })}
              />
              {state.courses.map((c) => (
                <CourseRow key={c.course.id} module={c} />
              ))}
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
