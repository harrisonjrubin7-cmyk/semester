import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { SectionLabel, Toggle } from '../../components/ui';
import { YourCourses } from '../../components/YourCourses';
import { SchoolPicker } from '../../components/SchoolPicker';
import { SEED_SUMMARY } from '../../data/seed';
import { CourseRow } from '../Me';
import { DESTINATIONS } from '../../lib/nav';
import { hiddenFor } from '../../lib/school';

/**
 * Who you are to the app, and what it is holding.
 *
 * Your name is here rather than on a page of its own because it is the one
 * fact this page's other two settings are about: what this person is called,
 * where they study, and which courses they are taking.
 */
export function SettingsCourses() {
  const { state, dispatch, school } = useStore();
  const hidden = hiddenFor(school.capabilities);

  return (
    <SettingsPage
      screen="setCourses"
      title="Courses"
      blurb="What the app is holding this term, and the university it reads the rest of the app against."
    >
      {(lit) => (
        <>
          <Group
            header="You"
            footer="Your name is only used to address you in the app. It is never sent anywhere and never guessed at from your email."
            lit={lights('name your name called address me', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: '0 0 6px' }}>Your name</SectionLabel>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-4)', textWrap: 'pretty' }}>
                Only used to address you in the app. Never sent anywhere, never guessed at from your
                email, and leaving it blank costs nothing — the app just says "you".
              </div>
              <input
                className="input"
                value={state.myName}
                maxLength={40}
                placeholder="What should the app call you?"
                aria-label="Your name"
                onChange={(e) => dispatch({ type: 'setMyName', name: e.target.value })}
                style={{ width: '100%', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
              />
            </CustomRow>
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
