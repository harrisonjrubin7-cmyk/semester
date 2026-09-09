/**
 * Arranging the bottom bar.
 *
 * The bar is the app's whole navigation on a phone, and it held seven screens
 * picked in a source file. Somebody with no classes across campus never opens
 * the map; somebody drafting a thesis wants Draft it in the bar rather than
 * three taps down a directory. Both were stuck with the same seven.
 *
 * ## A preview, because a bar is a shape
 *
 * The choosing happens against a live drawing of the bar rather than a list
 * of ticks. Seven names in a column tells you nothing about whether seven
 * names fit; the drawing does, at the width the phone actually has, and it is
 * the same components the real bar uses so it cannot lie about the fit.
 */

import { useState } from 'react';
import { Reorder } from './Reorder';
import { MOVE_HINT, useMovable } from '../lib/arrange';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { TabGlyph } from './TabIcon';
import { GROUPS, destinationsFor, saysFor } from '../lib/nav';
import {
  MOST,
  MOST_CHOSEN,
  PINNED,
  hasRoom,
  moveTab,
  tabLabel,
  toggleTab,
  whyNot,
} from '../lib/tabbar';
import type { Screen } from '../lib/types';
import { useRowStyle } from './shell/useShell';

// The shelves, from the one list in lib/nav.ts rather than a fourth copy.
const SHELVES = GROUPS;

/**
 * The bar as it will look.
 *
 * Not to the pixel: this sits inside the page's padding, so it is about 36px
 * narrower than the bar it draws, and an early version clipped names with an
 * ellipsis to show overflow — which reported "CALEND…" for a tab that renders
 * "CALENDAR" perfectly well an inch below. A preview that says a valid choice
 * will not fit is worse than one that is a little generous, so the names are
 * drawn in full and the fit is guaranteed elsewhere: every name comes from
 * `tabLabel`, and a test holds all forty-two of them to nine characters.
 */
function Preview({ tabs }: { tabs: Screen[] }) {
  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--app-panel)',
        overflow: 'hidden',
      }}
      // Decorative: everything in it is listed again below as real controls,
      // and a screen reader announcing seven unlabelled names twice is worse
      // than not announcing the drawing at all.
      aria-hidden="true"
    >
      {tabs.map((id) => {
        return (
          <div
            key={id}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '9px 0 7px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              color: 'var(--app-faint)',
            }}
          >
            <TabGlyph screen={id} />
            <span
              style={{
                fontSize: 'calc(9px * var(--text-scale, 1))',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {tabLabel(id)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function TabChooser() {
  const { state, dispatch, school } = useStore();
  const row = useRowStyle(0);
  const tabs = state.tabs;
  const chosen = tabs.filter((s) => s !== PINNED);
  const [refused, setRefused] = useState('');

  const set = (next: Screen[]) => dispatch({ type: 'setTabs', tabs: next });

  /*
   * Dragging a tab into place.
   *
   * Me is not in `chosen` and so cannot be dragged or dragged onto — it is
   * the one tab that stays, and it is put back on the end of every write. The
   * arrows below do exactly the same thing one step at a time, and both are
   * here because a bar of seven is five taps from the order somebody wants.
   */
  const bar = useMovable<Screen>({
    items: chosen,
    onMove: (next) => set([...next, PINNED]),
  });

  const tryToggle = (screen: Screen) => {
    const why = whyNot(tabs, screen);
    // The list comes back unchanged when it refuses, so saying why is the
    // only thing that distinguishes a refusal from a tap that missed.
    setRefused(why);
    if (!why) set(toggleTab(tabs, screen));
  };

  const spare = SHELVES.map((group) => ({
    group,
    // A screen this school has no equivalent of cannot be put in the bar
    // either — otherwise the one place that lists everything would be the one
    // place the gating leaked.
    items: destinationsFor(group, school.capabilities).filter(
      (d) => d.screen !== PINNED && !chosen.includes(d.screen),
    ),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      <SectionLabel
        style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}
      >
        The bar
      </SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, marginBottom: 'var(--sp-5)', textWrap: 'pretty' }}>
        Which screens are one tap away. Up to {MOST}, because that is what fits across a phone —
        everything else stays here in Me, which is why Me itself does not move.
      </div>

      <Preview tabs={tabs} />

      <div style={{ marginTop: 'var(--sp-6)' }}>
        {chosen.map((id, i) => (
          <div
            key={id}
            {...bar.props(id, {
              style: {
                display: 'flex',
                gap: 'var(--sp-4)',
                alignItems: 'center',
                ...row,
              },
            })}
          >
            <div style={{ flex: 'none', width: 26, opacity: 0.5, display: 'flex' }}>
              <TabGlyph screen={id} size={16} />
            </div>
            {/* The name is the handle a keyboard lands on: a row that can be
                moved has to be focusable to be moved without a pointer, and
                the two arrows beside it are buttons rather than the row. */}
            <div
              tabIndex={0}
              aria-label={`${tabLabel(id)}. ${MOVE_HINT}`}
              style={{ flex: 1, minWidth: 0, padding: '11px 0', fontSize: 'var(--type-md)' }}
            >
              {tabLabel(id)}
            </div>
            {/* Drawn as ↑ and ↓, read as left and right: the bar is a row on
                screen and this is a column on the page. `ways` is what keeps
                the two honest without a second copy of the control. */}
            <Reorder
              label={tabLabel(id)}
              ways={['left', 'right']}
              atStart={i === 0}
              atEnd={i === chosen.length - 1}
              onUp={() => set(moveTab(tabs, id, -1))}
              onDown={() => set(moveTab(tabs, id, 1))}
            />
            <button
              type="button"
              // The third control on this row, after the two arrows, and the
              // same argument: up and down is where the room is.
              className="bare tap-y"
              onClick={() => tryToggle(id)}
              aria-label={`Take ${tabLabel(id)} out of the bar`}
              style={{ width: 28, flex: 'none', opacity: 0.5, fontSize: 'var(--type-lg)' }}
            >
              ×
            </button>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            gap: 'var(--sp-4)',
            alignItems: 'center',
            padding: '11px 0',
            opacity: 0.5,
            fontSize: 'calc(13.5px * var(--text-scale, 1))',
          }}
        >
          <div style={{ flex: 'none', width: 26, display: 'flex' }}>
            <TabGlyph screen={PINNED} size={16} />
          </div>
          <span style={{ flex: 1 }}>Me — stays, and stays last</span>
        </div>
      </div>

      {refused ? (
        <div
          role="status"
          style={{
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            marginTop: 'var(--sp-2)',
            color: 'var(--app-warn)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {refused}
        </div>
      ) : null}

      <div style={{ fontSize: 'var(--type-sm)', opacity: 0.5, marginTop: 'var(--sp-6)' }}>
        {chosen.length} of {MOST_CHOSEN} chosen
      </div>

      {hasRoom(tabs) ? (
        <>
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.65, margin: '14px 0 4px', textWrap: 'pretty' }}>
            Add one:
          </div>
          {spare.map(({ group, items }) => (
            <div key={group}>
              <SectionLabel
                style={{ margin: 'calc(14px * var(--density, 1)) 0 calc(2px * var(--density, 1))' }}
              >
                {group}
              </SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {items.map((d) => (
                  <button
                    key={d.screen}
                    type="button"
                    className="bare tappable"
                    onClick={() => tryToggle(d.screen)}
                    title={saysFor(d, school.capabilities).blurb}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-3)',
                      padding: '8px 11px',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--app-line)',
                      fontSize: 'calc(12.5px * var(--text-scale, 1))',
                    }}
                  >
                    <span style={{ opacity: 0.55, display: 'flex' }}>
                      <TabGlyph screen={d.screen} size={14} />
                    </span>
                    {/* The directory's own label, not the short one: there is
                        room for it here, and "Fold in an announcement" is what
                        tells you what "Notices" will be. */}
                    {saysFor(d, school.capabilities).label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 'var(--sp-6)', textWrap: 'pretty' }}>
          The bar is full. Take one out to put another in.
        </div>
      )}
    </>
  );
}
