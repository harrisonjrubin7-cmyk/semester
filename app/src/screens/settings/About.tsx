import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group, ValueRow } from '../../components/shell/Rows';
import { useRowStyle } from '../../components/shell/useShell';
import { lights } from '../../lib/settings';
import { SectionLabel } from '../../components/ui';
import { SOURCES } from '../../data/misc';
import { SUPPORT } from '../../lib/privacy';

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
      title="About"
      blurb="Where the app's own figures come from, and how to say something is wrong."
    >
      {(lit) => (
        <>
          <Group header="Where the numbers come from" lit={lights('sources data where from figures citations', lit)}>
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(2px * var(--density, 1))' }}>Sources</SectionLabel>
              {SOURCES.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    ...row,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))' }}>{s.label}</div>
                    <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.5 }}>{s.meta}</div>
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

              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => dispatch({ type: 'restartOnboarding' })}
                style={{
                  height: 44,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginTop: 24,
                }}
              >
                Replay onboarding
              </button>
            </CustomRow>
          </Group>

          <Group
            header="Saying something is wrong"
            footer={`Write to ${SUPPORT}. A bug report that names the screen and what you expected is worth ten that say it is broken.`}
            lit={lights('support contact email feedback bug report help problem', lit)}
          >
            <ValueRow label="Where to write" value={SUPPORT} />
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
