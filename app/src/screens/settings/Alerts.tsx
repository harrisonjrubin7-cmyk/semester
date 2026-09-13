import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { SectionLabel, Toggle } from '../../components/ui';
import { MyRules } from '../../components/MyRules';
import { PushSwitch } from '../../components/PushSwitch';
import { Reminders } from '../Me';
import { NOTIF_DEFS } from '../../data/misc';
import { clock } from '../../lib/date';

/** "22:30" as minutes from midnight. */
function minutesOf(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** The inverse, for `<input type="time">`, which wants 24-hour HH:MM. */
function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

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
  const quiet = state.quiet;

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
            header="Quiet hours"
            footer="One window, and it covers everything — a class fifteen minutes away included. An app that decides which of its own reminders are important enough to override this is one you stop trusting the setting on."
            lit={lights('quiet hours sleep night do not disturb silence mute overnight', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>
                Nothing between
              </SectionLabel>
              <div
                style={{
                  fontSize: 'calc(12.5px * var(--text-scale, 1))',
                  opacity: 0.65,
                  lineHeight: 'var(--leading-relaxed)',
                  marginBottom: 9,
                }}
              >
                {quiet
                  ? `Nothing fires between ${clock(quiet.from)} and ${clock(quiet.to)}. Anything whose rule is still true when the window lifts arrives then rather than being dropped.`
                  : 'Not set — reminders can fire at any hour the rules above allow.'}
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
                <input
                  className="input"
                  type="time"
                  value={hhmm(quiet?.from ?? 22 * 60)}
                  aria-label="Quiet hours start"
                  onChange={(e) =>
                    dispatch({
                      type: 'setQuiet',
                      quiet: { from: minutesOf(e.target.value), to: quiet?.to ?? 8 * 60 },
                    })
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
                <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, flex: 'none' }}>
                  and
                </span>
                <input
                  className="input"
                  type="time"
                  value={hhmm(quiet?.to ?? 8 * 60)}
                  aria-label="Quiet hours end"
                  onChange={(e) =>
                    dispatch({
                      type: 'setQuiet',
                      quiet: { from: quiet?.from ?? 22 * 60, to: minutesOf(e.target.value) },
                    })
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              {/* Said out loud rather than left to be worked out from two
                  times: a window that wraps midnight is the one everybody
                  sets, and "10:00p and 8:00a" reads as an error until
                  something confirms it is not. */}
              {quiet && quiet.from === quiet.to ? (
                <div
                  style={{
                    fontSize: 'calc(12.5px * var(--text-scale, 1))',
                    color: 'var(--app-warn)',
                    marginTop: 9,
                    lineHeight: 'var(--leading-normal)',
                  }}
                >
                  A window that starts when it ends is no window. Nothing is being held back.
                </div>
              ) : null}
              {quiet ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => dispatch({ type: 'setQuiet', quiet: null })}
                  style={{ marginTop: 11, height: 36, fontSize: 'var(--type-sm)' }}
                >
                  Turn quiet hours off
                </button>
              ) : (
                <div
                  style={{
                    fontSize: 'calc(12.5px * var(--text-scale, 1))',
                    opacity: 0.55,
                    marginTop: 9,
                    lineHeight: 'var(--leading-normal)',
                  }}
                >
                  {/* The fields show ten and eight as a suggestion, not as a
                      setting: nothing is held back until one of them is
                      actually changed, and saying "set both" would be a lie
                      about a control that switches on from either. */}
                  Change either time to switch it on. Ten at night to eight is what the fields are
                  showing.
                </div>
              )}
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
