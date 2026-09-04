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
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { TabGlyph } from './TabIcon';
import { destinationsFor, type Group } from '../lib/nav';
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

const SHELVES: Group[] = ['Semester', 'Study', 'Make', 'Campus', 'Upkeep', 'Yours'];

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
  const tabs = state.tabs;
  const chosen = tabs.filter((s) => s !== PINNED);
  const [refused, setRefused] = useState('');

  const set = (next: Screen[]) => dispatch({ type: 'setTabs', tabs: next });

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
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
        Which screens are one tap away. Up to {MOST}, because that is what fits across a phone —
        everything else stays here in Me, which is why Me itself does not move.
      </div>

      <Preview tabs={tabs} />

      <div style={{ marginTop: 12 }}>
        {chosen.map((id, i) => (
          <div
            key={id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              borderBottom: '1px solid var(--app-line)',
            }}
          >
            <div style={{ flex: 'none', width: 26, opacity: 0.5, display: 'flex' }}>
              <TabGlyph screen={id} size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0, padding: '11px 0', fontSize: 'calc(14px * var(--text-scale, 1))' }}>
              {tabLabel(id)}
            </div>
            <button
              type="button"
              className="bare"
              disabled={i === 0}
              onClick={() => set(moveTab(tabs, id, -1))}
              aria-label={`Move ${tabLabel(id)} left`}
              style={{ width: 26, flex: 'none', opacity: i === 0 ? 0.2 : 0.6, fontSize: 'calc(15px * var(--text-scale, 1))' }}
            >
              ↑
            </button>
            <button
              type="button"
              className="bare"
              disabled={i === chosen.length - 1}
              onClick={() => set(moveTab(tabs, id, 1))}
              aria-label={`Move ${tabLabel(id)} right`}
              style={{
                width: 26,
                flex: 'none',
                opacity: i === chosen.length - 1 ? 0.2 : 0.6,
                fontSize: 'calc(15px * var(--text-scale, 1))',
              }}
            >
              ↓
            </button>
            <button
              type="button"
              className="bare"
              onClick={() => tryToggle(id)}
              aria-label={`Take ${tabLabel(id)} out of the bar`}
              style={{ width: 28, flex: 'none', opacity: 0.5, fontSize: 'calc(15px * var(--text-scale, 1))' }}
            >
              ×
            </button>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            gap: 8,
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
            marginTop: 4,
            color: 'var(--app-warn)',
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          {refused}
        </div>
      ) : null}

      <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.5, marginTop: 12 }}>
        {chosen.length} of {MOST_CHOSEN} chosen
      </div>

      {hasRoom(tabs) ? (
        <>
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, margin: '14px 0 4px', textWrap: 'pretty' }}>
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
                    title={d.blurb}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
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
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, marginTop: 12, textWrap: 'pretty' }}>
          The bar is full. Take one out to put another in.
        </div>
      )}
    </>
  );
}
