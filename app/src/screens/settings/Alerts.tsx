import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { SectionLabel, Toggle } from '../../components/ui';
import { MyRules } from '../../components/MyRules';
import { PushSwitch } from '../../components/PushSwitch';
import { Reminders } from '../Me';
import { NOTIF_DEFS } from '../../data/misc';

/**
 * What the app tells you about, and how far ahead.
 *
 * Every one of these is off by default and stays off until it is turned on
 * here. An app that decides on its own what is worth interrupting somebody
 * for is one they turn off entirely, and then it cannot tell them the one
 * thing that mattered.
 */
export function SettingsAlerts() {
  const { state, dispatch } = useStore();

  return (
    <SettingsPage
      screen="setAlerts"
      blurb="Nothing here is on until you turn it on. Everything is worked out on this device."
    >
      {(lit) => (
        <>
          <Group
            header="How far ahead"
            lit={lights('lead days ahead early warning notice registration access', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
                Testing-centre lead time
              </SectionLabel>
              <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', marginBottom: 9 }}>
                If you book exams through Student Access, its lead time is stated in business days and
                counting those backwards over a weekend is easy to get wrong. Set it here and the exam
                runway does it. Leave it at zero if you do not use one.
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={30}
                  value={state.accessLeadDays}
                  aria-label="Business days before an exam"
                  onChange={(e) => dispatch({ type: 'setAccessLead', days: Number(e.target.value) })}
                  style={{ width: 90, flex: 'none' }}
                />
                <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6 }}>
                  {state.accessLeadDays === 0
                    ? 'not used'
                    : `business days before an exam`}
                </span>
              </div>
            </CustomRow>
          </Group>

          <Group
            header="Tell me when"
            footer="These are checked while the app is open. Reminders that arrive with it closed need the switch below."
            lit={lights('notifications alerts tell me when reminders notify due', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(2px * var(--density, 1))' }}>Tell me when</SectionLabel>
              <Reminders />
              {NOTIF_DEFS.map((n) => (
                <Toggle
                  key={n.k}
                  label={n.label}
                  on={state.notifs[n.k]}
                  onChange={() => dispatch({ type: 'toggleNotif', k: n.k })}
                />
              ))}

              <MyRules />

              <PushSwitch />
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
