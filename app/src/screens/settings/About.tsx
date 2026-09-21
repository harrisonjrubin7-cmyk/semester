import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group } from '../../components/shell/Rows';
import { useRowStyle } from '../../components/shell/useShell';
import { lights } from '../../lib/settings';
import { ActionButton, SectionLabel } from '../../components/ui';
import { SOURCES } from '../../data/misc';
import { SUPPORT } from '../../lib/privacy';
import { SaySomething } from '../../components/SaySomething';

/**
 * What this is, where its numbers come from, and how to get in touch.
 *
 * The sources list was at the bottom of the old settings screen, below
 * everything, which is a strange place for the answer to "where did this
 * figure come from". It is the last thing on the last page now, which is
 * still the bottom but is at least the bottom of the page it belongs to.
 */
export function SettingsAbout() {
  const { dispatch } = useStore();
  const row = useRowStyle(13);

  return (
    <SettingsPage
      screen="setAbout"
      blurb="Where the app's own figures come from, and how to say something is wrong."
    >
      {(lit) => (
        <>
          <Group
            header="Where the numbers come from"
            footer="The tag says what each one takes, not whether it is switched on — nothing here runs in the background. This app holds no university password and no Top Hat session."
            lit={lights('sources data where from figures citations top hat tophat sync connected', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ marginTop: 'calc(26px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(2px * var(--density, 1))' }}>Sources</SectionLabel>
              {SOURCES.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-6)',
                    ...row,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--type-md)' }}>{s.label}</div>
                    <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>{s.meta}</div>
                  </div>
                  <span className="tag tag-outline">{s.state}</span>
                </div>
              ))}
            </CustomRow>
          </Group>

          <Group
            header="Getting your bearings"
            footer="The tour is the four screens shown on a first run. Replaying it changes nothing and deletes nothing."
            lit={lights('tour onboarding replay restart walkthrough intro help', lit)}
          >
            <CustomRow>

              <ActionButton
                onClick={() => dispatch({ type: 'restartOnboarding' })}
                style={{ marginTop: 'calc(24px * var(--density, 1))' }}
              >
                Replay onboarding
              </ActionButton>
            </CustomRow>
          </Group>

          <Group
            header="Saying something is wrong"
            footer={`This goes to the person who builds the app, with the screen you were on and nothing you have not been shown. If you would rather write, the address is ${SUPPORT}.`}
            lit={lights('support contact email feedback bug report help problem', lit)}
          >
            <CustomRow>
              <SaySomething />
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
