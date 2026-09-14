/**
 * The menu behind a tab and behind a group's name.
 *
 * Everything the strip can do that is not "go there" or "close it" lives
 * here — bookmark this tab, put it in a group, name the group, colour it,
 * fold it, close the lot. A menu rather than more buttons on the tab itself:
 * a tab is 190px at its widest and already carries a glyph, a name and a
 * cross, and a fourth control on it would be a row of tabs nobody can read
 * and a close somebody hits by accident.
 *
 * ## Opened two ways, because one of them is not available to everybody
 *
 * Right-click, which is what a browser has taught everyone, and the ⌄ on the
 * tab that is on, which is the same menu for a trackpad, a touchscreen and a
 * keyboard. The second is drawn only on the current tab: nine chevrons across
 * the strip would cost exactly the room the names need, and the menu for a tab
 * you are not on is one click further away than the tab itself.
 *
 * The panel itself — where it opens, what dismisses it, where focus goes — is
 * `components/Popover.tsx`, shared with the bookmarks bar's own menu. This is
 * only what the rows say and do.
 */

import { useEffect, useRef, useState } from 'react';
import { MenuLabel, MenuRow, MenuRule, MenuSaid, Popover, type Corner } from './Popover';
import { GROUP_NAME, GROUP_TONES, groupAt, tabsIn, type AppTab } from '../lib/browser';
import {
  colourGroup,
  dissolveGroup,
  foldGroup,
  groupTab,
  joinTabGroup,
  leaveTabGroup,
  nameGroup,
  openTab,
  openTabIn,
  shutGroup,
  useStrip,
} from '../lib/browser.hook';
import { savable } from '../lib/bookmarks';
import { isSaved, star, useMarks } from '../lib/bookmarks.hook';
import { toneAt, useTones } from './tones';
import { StarIcon } from './Icons';

/** What the menu was opened on. */
export type MenuOn = { kind: 'tab'; at: number } | { kind: 'group'; id: string };

export function StripMenu({
  on,
  corner,
  onClose,
  onLand,
  onCloseTab,
  onNewTab,
}: {
  on: MenuOn;
  corner: Corner;
  onClose: () => void;
  /** The app should now be showing this tab — the strip's own `land`. */
  onLand: (tab: AppTab) => void;
  /** Close the tab at this seat, and land wherever that reveals. */
  onCloseTab: (at: number) => void;
  /** A new tab's page is the search page, and only the strip knows how. */
  onNewTab: () => void;
}) {
  const strip = useStrip();
  const group =
    on.kind === 'group' ? strip.groups.find((g) => g.id === on.id) : groupAt(strip, on.at);
  const tab = on.kind === 'tab' ? strip.tabs[on.at] : undefined;

  // Nothing to point at any more — the tab was closed under the menu, or the
  // group was. Drawing nothing is better than drawing a menu about nothing;
  // the strip takes it away on the next click either way.
  if (on.kind === 'tab' ? !tab : !group) return null;

  return (
    <Popover
      label={on.kind === 'tab' ? `Tab — ${tab?.title}` : `Tab group — ${group?.name || 'unnamed'}`}
      corner={corner}
      onClose={onClose}
    >
      {on.kind === 'tab' && tab ? (
        <TabRows at={on.at} tab={tab} onClose={onClose} onCloseTab={onCloseTab} onNewTab={onNewTab} />
      ) : group ? (
        <GroupRows id={group.id} onClose={onClose} onLand={onLand} onNewTab={onNewTab} />
      ) : null}
    </Popover>
  );
}

function TabRows({
  at,
  tab,
  onClose,
  onCloseTab,
  onNewTab,
}: {
  at: number;
  tab: AppTab;
  onClose: () => void;
  onCloseTab: (at: number) => void;
  onNewTab: () => void;
}) {
  const strip = useStrip();
  const tones = useTones();
  // Subscribed rather than read once: the star's own row has to change under
  // the finger that pressed it, and this menu stays open while it does.
  useMarks();
  const saved = isSaved(tab.screen, tab.place);
  const mine = groupAt(strip, at);
  const others = strip.groups.filter((g) => g.id !== mine?.id);

  return (
    <>
      {savable(tab) ? (
        <MenuRow
          onPress={() => {
            star({ screen: tab.screen as NonNullable<AppTab['screen']>, title: tab.title, place: tab.place });
            onClose();
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <StarIcon on={saved} size={15} />
            {saved ? 'Remove bookmark' : 'Bookmark this tab'}
          </span>
        </MenuRow>
      ) : (
        // A new tab is not a page, so there is nothing to bookmark. Said
        // rather than hidden: a row that comes and goes is a row people stop
        // looking for.
        <MenuSaid>Nothing to bookmark yet</MenuSaid>
      )}

      <MenuRule />
      <MenuLabel>Group</MenuLabel>
      <MenuRow
        onPress={() => {
          groupTab(at);
          onClose();
        }}
      >
        New group
      </MenuRow>
      {others.map((g) => (
        <MenuRow
          key={g.id}
          tone={toneAt(tones, g.tone).fill}
          onPress={() => {
            joinTabGroup(at, g.id);
            onClose();
          }}
        >
          {g.name || 'Unnamed group'}
        </MenuRow>
      ))}
      {mine && (
        <MenuRow
          onPress={() => {
            leaveTabGroup(at);
            onClose();
          }}
        >
          Remove from {mine.name || 'the group'}
        </MenuRow>
      )}

      <MenuRule />
      <MenuRow
        onPress={() => {
          // Only go to the new tab's page when there is a new tab. Both of
          // these refuse at the cap, and landing on the search page anyway
          // would answer "no room for another" by discarding the page in the
          // tab you are on.
          const opened = mine ? openTabIn(mine.id) : openTab();
          onClose();
          if (opened) onNewTab();
        }}
      >
        New tab{mine ? ` in ${mine.name || 'this group'}` : ''}
      </MenuRow>
      <MenuRow
        onPress={() => {
          // Closing is the strip's own business: the tab it reveals has to be
          // opened, and only the strip knows how to land on one.
          onClose();
          onCloseTab(at);
        }}
      >
        Close this tab
      </MenuRow>
    </>
  );
}

function GroupRows({
  id,
  onClose,
  onLand,
  onNewTab,
}: {
  id: string;
  onClose: () => void;
  onLand: (tab: AppTab) => void;
  onNewTab: () => void;
}) {
  const strip = useStrip();
  const tones = useTones();
  const group = strip.groups.find((g) => g.id === id);
  /*
   * The name is typed here and committed on every keystroke.
   *
   * Held locally as well, because the strip is the source of it and a field
   * that reads back from a store it writes to on every keystroke loses a
   * character the moment anything else re-renders. The local copy is what is
   * drawn; the strip is what is kept.
   */
  const [name, setName] = useState(group?.name ?? '');
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  if (!group) return null;
  const held = tabsIn(strip, id).length;

  return (
    <>
      <input
        ref={field}
        className="input"
        value={name}
        maxLength={GROUP_NAME}
        placeholder="Name this group"
        aria-label="Name this group"
        onChange={(e) => {
          setName(e.target.value);
          nameGroup(id, e.target.value);
        }}
        onKeyDown={(e) => {
          // Enter is "done", which for a field that saves as you type means
          // putting the menu away rather than saving anything.
          if (e.key === 'Enter') {
            e.preventDefault();
            onClose();
          }
        }}
        style={{ width: '100%', marginBottom: 'var(--sp-2)', fontSize: 'var(--type-md)' }}
      />

      <div
        role="group"
        aria-label="Colour"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 'var(--sp-2)',
          padding: 'var(--sp-2) var(--sp-3) var(--sp-3)',
        }}
      >
        {Array.from({ length: GROUP_TONES }, (_, i) => {
          const tint = toneAt(tones, i);
          const on = group.tone === i;
          return (
            <button
              key={i}
              type="button"
              className="bare tappable"
              onClick={() => colourGroup(id, i)}
              aria-label={`Colour ${i + 1}`}
              aria-pressed={on}
              style={{
                width: 'auto',
                height: 'var(--sp-7)',
                borderRadius: 'var(--r-sm)',
                background: tint.fill,
                // The ring says which one is on. Drawn outside the swatch so
                // the twelve stay the same size as each other.
                boxShadow: on ? '0 0 0 2px var(--app-panel), 0 0 0 3px var(--app-ink)' : 'none',
              }}
            />
          );
        })}
      </div>

      <MenuRule />
      <MenuRow
        onPress={() => {
          const landed = foldGroup(id, !group.collapsed);
          if (landed) onLand(landed);
          onClose();
        }}
      >
        {group.collapsed ? 'Open this group' : `Fold ${held === 1 ? 'this tab' : `these ${held} tabs`} away`}
      </MenuRow>
      <MenuRow
        onPress={() => {
          const opened = openTabIn(id);
          onClose();
          if (opened) onNewTab();
        }}
      >
        New tab in this group
      </MenuRow>
      <MenuRow
        onPress={() => {
          dissolveGroup(id);
          onClose();
        }}
      >
        Ungroup, keeping the tabs
      </MenuRow>
      <MenuRow
        onPress={() => {
          const landed = shutGroup(id);
          if (landed) onLand(landed);
          onClose();
        }}
      >
        Close {held === 1 ? 'this tab' : `these ${held} tabs`}
      </MenuRow>
    </>
  );
}
