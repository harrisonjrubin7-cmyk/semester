import { useStore } from '../../state/store';
import { SettingsPage } from './Page';
import { CustomRow, Group, NavRow } from '../../components/shell/Rows';
import { useRowStyle } from '../../components/shell/useShell';
import { lights } from '../../lib/settings';
import { SectionLabel, Segmented, TickBox, Toggle } from '../../components/ui';
import { countHidden, revealLine } from '../../lib/reveal';
import { TabChooser } from '../../components/TabChooser';
import { Reorder } from '../../components/Reorder';
import { LayoutPicker, NavPicker } from '../../components/Appearance';
import { BADGES, DIRECTORIES, FEEDS, LABELS, directoryOf } from '../../lib/look';
import { SECTIONS, move, ordered } from '../../lib/feed';

const HINT = {
  fontSize: 'calc(11.5px * var(--text-scale, 1))',
  opacity: 0.5,
  marginTop: 'var(--sp-3)',
  lineHeight: 'var(--leading-normal)',
  textWrap: 'pretty',
} as const;

const LABEL_STYLE = {
  margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))',
} as const;

/**
 * The shape of the app: which navigation is drawn, and how a screen is drawn.
 *
 * ## Why these are one page
 *
 * They were three. The navigation was here; the layout was under Appearance;
 * the tab bar's labels, the badges and the shape of Today's feed were under
 * Appearance's "Shape and spacing", forty sections away from the setting that
 * decides whether there is a tab bar at all. Three places to answer one
 * question — *what shape is this app* — and changing one usually meant going
 * to find another.
 *
 * Worse than scattered, they overlapped: the soft layout drew its own
 * navigation, so choosing it put two navigations on screen at once, and
 * nothing on either page said so. That is fixed underneath this screen (see
 * `lib/types.ts`, `NavMode`) and this page is what makes it visible: one
 * navigation, chosen here, and a layout that only ever changes how a screen
 * is drawn.
 *
 * Order is the order somebody decides in: what shape it is, then how it is
 * drawn, then what the first screen holds.
 */
export function SettingsNav() {
  const { state, dispatch, facts } = useStore();
  const row = useRowStyle(0);
  const drawn = directoryOf(state.directory, state.shell);

  return (
    <SettingsPage
      screen="setNav"
      blurb="Four navigations and three layouts, in every combination. Nothing here hides anything — every screen stays reachable whichever you pick."
    >
      {(lit) => (
        <>
          <Group
            header="How you move"
            footer="Only one navigation is ever drawn. Whichever you pick, the search in the header reaches every screen, and Everything lists them all."
            lit={lights(
              'tabs tab bar navigation nav feed home screen springboard icons shelves pills structure move around',
              lit,
            )}
          >
            <CustomRow>
              <NavPicker />
              {/* Only where there is a bar to arrange. Offering it in the
                  other three would be a control that does nothing. */}
              {state.nav === 'tabs' && <TabChooser />}
            </CustomRow>
          </Group>

          <Group
            header="How a screen is drawn"
            footer="The layout changes arrangement and nothing else: the same screen shows the same controls and the same content in all three. It adds no navigation of its own."
            lit={lights('layout shell grouped drawn soft inset list rows panel cards arrangement presentation', lit)}
          >
            <CustomRow>
              <LayoutPicker />
            </CustomRow>
          </Group>

          <Group
            header="The bar itself"
            footer="Both of these are about the bar and the rail, which is why they sit under the setting that decides whether you have one."
            lit={lights('tab bar labels names icons badges counts numbers dot', lit)}
          >
            <CustomRow>
              <SectionLabel style={LABEL_STYLE}>Tab labels</SectionLabel>
              <Segmented
                options={LABELS.map((l) => ({ id: l.id, label: l.label }))}
                value={state.labels}
                onChange={(labels) => dispatch({ type: 'setLook', look: { labels } })}
              />
              <div style={HINT}>
                {LABELS.find((l) => l.id === state.labels)?.blurb} The names stay for a screen reader
                either way.
              </div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={LABEL_STYLE}>Badges</SectionLabel>
              <Segmented
                options={BADGES.map((b) => ({ id: b.id, label: b.label }))}
                value={state.badges}
                onChange={(badges) => dispatch({ type: 'setLook', look: { badges } })}
              />
              <div style={HINT}>
                {BADGES.find((b) => b.id === state.badges)?.blurb} A number is a claim on your
                attention, and an app that puts one on everything has made them all mean nothing.
              </div>
            </CustomRow>
          </Group>

          <Group
            header="What Today shows"
            footer="Turn a section off and it is gone from Today, not from the app — everything it held is still on the screen it belongs to."
            lit={lights('today sections order rearrange move up down feed hide show cards rows timeline', lit)}
          >
            <CustomRow>
              <SectionLabel style={LABEL_STYLE}>Today’s feed</SectionLabel>
              <Segmented
                options={FEEDS.map((f) => ({ id: f.id, label: f.label }))}
                value={state.feed}
                onChange={(feed) => dispatch({ type: 'setLook', look: { feed } })}
              />
              <div style={HINT}>{FEEDS.find((f) => f.id === state.feed)?.blurb}</div>
            </CustomRow>
            <CustomRow>
              <SectionLabel style={LABEL_STYLE}>Your Today</SectionLabel>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-5)', textWrap: 'pretty' }}>
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
                      gap: 'var(--sp-4)',
                      alignItems: 'center',
                      ...row,
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
                      <div style={{ fontSize: 'var(--type-md)' }}>{section?.label ?? id}</div>
                      <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 'var(--sp-1)' }}>{section?.blurb}</div>
                    </div>
                    <Reorder
                      label={section?.label ?? id}
                      atStart={i === 0}
                      atEnd={i === all.length - 1}
                      onUp={() => dispatch({ type: 'setFeedOrder', order: move(state.feedOrder, id, -1) })}
                      onDown={() => dispatch({ type: 'setFeedOrder', order: move(state.feedOrder, id, 1) })}
                    />
                  </div>
                );
              })}
            </CustomRow>
          </Group>

          <Group
            header="The directory"
            footer="Everything lists every screen the app has. These decide how it is drawn, and whether it starts full or fills up as you go."
            lit={lights('directory everything list tiles grid launcher shelves screens hidden show all reveal', lit)}
          >
            <CustomRow>
              <SectionLabel style={LABEL_STYLE}>Drawn as</SectionLabel>
              {/*
                Resolved, not raw. Somebody who has never touched this row has
                no stored answer, and the layout is answering for them — soft
                draws the tiles. Showing the empty string would light neither
                option and describe neither, which is a control claiming the
                app is in a state it is not in. See `directoryOf`.

                Touching it at all is a choice, including choosing what was
                already on screen: from here the layout has no further say.
              */}
              <Segmented
                options={DIRECTORIES.map((d) => ({ id: d.id, label: d.label }))}
                value={drawn}
                onChange={(directory) => dispatch({ type: 'setLook', look: { directory } })}
              />
              <div style={HINT}>{DIRECTORIES.find((d) => d.id === drawn)?.blurb}</div>
            </CustomRow>
            <CustomRow>
              <Toggle
                label="Show every screen straight away"
                on={state.showAll}
                onChange={() => dispatch({ type: 'showEverything', on: !state.showAll })}
              />
              <div style={HINT}>
                {revealLine(countHidden(facts, state.visited, state.showAll), state.showAll)}
              </div>
            </CustomRow>
            {/* The other half of the same question is a page away, so it is
                one tap rather than a hunt through the index. */}
            <NavRow
              label="Colour and type"
              sub="Ground, accent, fonts, text size, spacing"
              onClick={() => dispatch({ type: 'go', screen: 'setLook' })}
            />
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
