import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group } from '../../components/shell/Rows';
import { lights } from '../../lib/settings';
import { SectionLabel, Segmented, TickBox, Toggle } from '../../components/ui';
import { countHidden, revealLine } from '../../lib/reveal';
import { TabChooser } from '../../components/TabChooser';
import { SECTIONS, move, ordered } from '../../lib/feed';

/**
 * How you get around, and what Today opens on.
 *
 * The two halves of the same question — which structure the app has, and what
 * the first screen shows — sat forty sections apart. They belong together:
 * changing one is usually why somebody came to change the other.
 */
export function SettingsNav() {
  const { state, dispatch, facts } = useStore();

  return (
    <SettingsPage
      screen="setNav"
      title="Navigation"
      blurb="Two structures, the same screens. Nothing here hides anything — every screen stays reachable whichever you pick."
    >
      {(lit) => (
        <>
          <Group
            header="Structure"
            footer="The tab bar gives every thing a fixed home. One feed interleaves classes and deadlines in a single scroll. The home screen is three pages of icons."
            lit={lights('tabs tab bar navigation nav feed home screen springboard icons layout structure', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Navigation</SectionLabel>
              <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
                Two structures, the same screens. The tab bar gives every thing a fixed home. The feed
                interleaves classes and deadlines in one scroll and slices it with a filter row.
              </div>
              <Segmented
                options={[
                  { id: 'tabs', label: 'Tab bar' },
                  { id: 'feed', label: 'One feed' },
                  { id: 'springboard', label: 'Home screen' },
                ]}
                value={state.nav}
                onChange={(nav) => dispatch({ type: 'setNav', nav })}
              />

              {/* Only in tab-bar mode: in feed mode there is no bar to arrange, and
                  offering the setting anyway would be a control that does nothing. */}
              {state.nav === 'springboard' && (
                <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 8, lineHeight: 1.45, textWrap: 'pretty' }}>
                  Three pages of icons with a dock that does not move, folders that open in place, and a
                  search that filters to everything at once. Every icon goes to the same screen the tab bar
                  would have — it is a way in, not a different app.
                </div>
              )}
              {state.nav === 'tabs' && <TabChooser />}
            </CustomRow>
          </Group>

          <Group
            header="What Today shows"
            footer="Turn a section off and it is gone from Today, not from the app — everything it held is still on the screen it belongs to."
            lit={lights('today sections order rearrange move up down feed hide show', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>Your Today</SectionLabel>
              <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
                The right order is not the same for everyone. Somebody with a job and one class wants the
                rail first; somebody with a paper due wants the checklist and would rather not scroll past
                a countdown to a lecture they are already walking to.
              </div>
              {ordered(state.feedOrder).map((id, i, all) => {
                const on = !state.feedHidden[id];
                const section = SECTIONS.find((sx) => sx.id === id);
                return (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      borderBottom: '1px solid var(--app-line)',
                    }}
                  >
                    <button
                      type="button"
                      className="bare tappable"
                      onClick={() => dispatch({ type: 'toggleFeedSection', id })}
                      aria-label={on ? `Hide ${section?.label}` : `Show ${section?.label}`}
                      style={{ flex: 'none', width: 30, padding: '12px 2px 12px 0' }}
                    >
                      <TickBox on={on} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0, padding: '11px 0', opacity: on ? 1 : 0.5 }}>
                      <div style={{ fontSize: 'calc(14px * var(--text-scale, 1))' }}>{section?.label ?? id}</div>
                      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 2 }}>{section?.blurb}</div>
                    </div>
                    <button
                      type="button"
                      className="bare"
                      disabled={i === 0}
                      onClick={() => dispatch({ type: 'setFeedOrder', order: move(state.feedOrder, id, -1) })}
                      aria-label={`Move ${section?.label} up`}
                      style={{ width: 26, flex: 'none', opacity: i === 0 ? 0.2 : 0.6, fontSize: 'calc(15px * var(--text-scale, 1))' }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="bare"
                      disabled={i === all.length - 1}
                      onClick={() => dispatch({ type: 'setFeedOrder', order: move(state.feedOrder, id, 1) })}
                      aria-label={`Move ${section?.label} down`}
                      style={{
                        width: 26,
                        flex: 'none',
                        opacity: i === all.length - 1 ? 0.2 : 0.6,
                        fontSize: 'calc(15px * var(--text-scale, 1))',
                      }}
                    >
                      ↓
                    </button>
                  </div>
                );
              })}
            </CustomRow>
          </Group>

          <Group
            header="The directory"
            lit={lights('directory everything list screens hidden show all', lit)}
          >
            <CustomRow>
              <SectionLabel style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}>The directory</SectionLabel>
              <Toggle
                label="Show every screen straight away"
                on={state.showAll}
                onChange={() => dispatch({ type: 'showEverything', on: !state.showAll })}
              />
              <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45, textWrap: 'pretty' }}>
                {revealLine(countHidden(facts, state.visited, state.showAll), state.showAll)}
              </div>
            </CustomRow>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
