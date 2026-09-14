import { useCallback, useEffect, useRef, useState } from 'react';
import { hasOpenModal } from '../a11y/modal';
import { useStore } from '../state/store';
import {
  closeTab,
  colourGroup,
  dissolveGroup,
  foldGroup,
  groupTab,
  joinTabGroup,
  lastClosed,
  leaveTabGroup,
  nameGroup,
  openInNew,
  openTab,
  pickTab,
  reopenClosed,
  useStrip,
} from '../lib/browser.hook';
import { GROUP_NAME, GROUP_TONES, MAX_TABS, groupAt, lanes, type AppTab } from '../lib/browser';
import { savable } from '../lib/bookmarks';
import { dropMark, isSaved, star, useMarks } from '../lib/bookmarks.hook';
import { toneAt, useTones } from './tones';
import { TabGlyph } from './TabIcon';
import { Plus, Search, StarIcon } from './Icons';

/**
 * The browser shell's strip: its tabs, its groups, and the star.
 *
 * This used to keep all three of those itself, in `lib/taborganizer.ts` and a
 * localStorage key of its own — a second bookmark list and a second grouping
 * model sitting beside the app's, each with its own idea of what a saved place
 * is. Two answers to one question is the bug, not the duplication: a course
 * bookmarked here was not bookmarked in the workspace, and the same tab
 * belonged to two different groups depending on which navigation was drawing
 * it.
 *
 * So there is one of each now, and this draws them. Bookmarks are
 * `lib/bookmarks.ts`, shared with the workspace's bar. Groups are the strip's
 * own — a tab carries the id of its group and `lanes` returns the runs, which
 * is the same shape `components/Tabs.tsx` draws from. What is left here is a
 * browser's arrangement of them, which is the whole point of this navigation.
 */
export function GoogleTabs({
  onNavigate,
  menuOpen,
  onMenuChange,
}: {
  onNavigate: () => void;
  menuOpen?: boolean;
  onMenuChange?: (open: boolean) => void;
}) {
  const { dispatch } = useStore();
  const strip = useStrip();
  const marks = useMarks();
  const tones = useTones();
  const [localMenu, setLocalMenu] = useState(false);
  const menu = menuOpen ?? localMenu;
  const setMenu = useCallback(
    (open: boolean) => {
      if (onMenuChange) onMenuChange(open);
      else setLocalMenu(open);
    },
    [onMenuChange],
  );
  const [name, setName] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const tabRow = useRef<HTMLDivElement>(null);
  const current = strip.tabs[strip.at];
  const group = groupAt(strip, strip.at);
  const runs = lanes(strip);

  useEffect(() => {
    const reveal = () =>
      tabRow.current
        ?.querySelector('.g-browser-tab.active')
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    reveal();
    window.addEventListener('resize', reveal);
    return () => window.removeEventListener('resize', reveal);
  }, [strip.at, strip.tabs.length, strip.groups]);

  const closedTab = lastClosed();
  /* Both are the shared store's answers, so the star here and the star in the
     workspace are the same star. */
  const starred = isSaved(current?.screen ?? null, current?.place ?? []);
  const canSave = savable(current);

  const land = (tab: AppTab) => {
    onNavigate();
    setMenu(false);
    if (tab.screen && tab.place.length) for (const action of tab.place) dispatch(action);
    else dispatch({ type: 'go', screen: 'search' });
  };
  const restoreClosed = () => {
    const tab = reopenClosed();
    if (tab) land(tab);
  };
  const create = () => {
    if (strip.tabs.length >= MAX_TABS) return;
    openTab();
    setMenu(false);
    onNavigate();
    dispatch({ type: 'go', screen: 'search' });
  };
  const bookmark = () => {
    if (!canSave || !current.screen) return;
    star({ screen: current.screen, title: current.title, place: current.place });
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        hasOpenModal() ||
        (e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]')
      )
        return;
      if (e.altKey && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault();
        restoreClosed();
        return;
      }
      if (e.altKey && !e.shiftKey && (e.code === 'KeyT' || e.key.toLowerCase() === 't')) {
        e.preventDefault();
        create();
      }
      if (e.altKey && !e.shiftKey && (e.code === 'KeyB' || e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        setMenu(!menu);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setMenu(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc, true);
    };
  }, [menu, setMenu]);

  const tabNode = (tab: AppTab, i: number, colour?: string) => {
    const title = tab.screen === 'search' ? 'New tab' : tab.title || 'New tab';
    return (
      <div
        className={`g-browser-tab ${i === strip.at ? 'active' : ''}`}
        style={colour ? { borderBottom: `3px solid ${colour}` } : undefined}
        key={tab.id}
      >
        <button
          className="g-tab-select"
          aria-current={i === strip.at ? 'page' : undefined}
          onClick={() => land(pickTab(i))}
          title={title}
        >
          {tab.screen && tab.screen !== 'search' ? (
            <TabGlyph screen={tab.screen} size={16} />
          ) : (
            <Search size={16} />
          )}
          <span>{title}</span>
        </button>
        <button
          className="g-tab-close"
          aria-label={`Close tab: ${title}`}
          onClick={() => {
            const next = closeTab(i);
            if (i === strip.at) land(next);
          }}
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <>
      <nav className="g-browser-tabs" aria-label="Open app tabs">
        <div className="g-tab-scroll" ref={tabRow}>
          {/*
            One run at a time, from `lanes` — the same shape the workspace's
            strip draws from, so a group is one object on the row in both.
            A folded run keeps the tab you are on visible: losing the page you
            are reading because its group was folded is not a fold.
          */}
          {runs.map((lane) =>
            lane.group ? (
              <div className="g-tab-group" key={lane.group.id}>
                <button
                  className="g-group-label"
                  style={{ background: toneAt(tones, lane.group.tone).ink }}
                  aria-label={`${lane.group.collapsed ? 'Expand' : 'Collapse'} group ${lane.group.name || 'Untitled group'}`}
                  aria-expanded={!lane.group.collapsed}
                  onClick={() => {
                    const landed = foldGroup(lane.group!.id, !lane.group!.collapsed);
                    if (landed) land(landed);
                  }}
                >
                  {lane.group.name || 'Untitled group'} <small>{lane.seats.length}</small>
                </button>
                {lane.seats
                  .filter(({ at }) => !lane.group!.collapsed || at === strip.at)
                  .map(({ tab, at }) => tabNode(tab, at, toneAt(tones, lane.group!.tone).ink))}
              </div>
            ) : (
              lane.seats.map(({ tab, at }) => tabNode(tab, at))
            ),
          )}
        </div>
        <button
          className="g-add-tab"
          aria-label="Add new tab"
          title={
            strip.tabs.length >= MAX_TABS
              ? `Close a tab before opening another (${MAX_TABS} open)`
              : 'New tab (Alt+T)'
          }
          disabled={strip.tabs.length >= MAX_TABS}
          onClick={create}
        >
          <Plus size={20} />
        </button>

        <div className="g-tab-organizer" ref={panel}>
          <button
            className="g-add-tab"
            aria-label="Bookmarks and tab groups"
            aria-expanded={menu}
            title="Bookmarks and tab groups (Alt+B)"
            onClick={() => setMenu(!menu)}
          >
            <StarIcon size={19} on={starred} />
          </button>
          {menu && (
            <section className="g-organizer-panel" aria-label="Bookmarks and tab groups">
              <h2>Bookmarks &amp; tab groups</h2>
              <button className="g-organizer-save" disabled={!canSave} onClick={bookmark}>
                {starred ? '★ Remove this bookmark' : '☆ Bookmark this tab'}
              </button>
              {!canSave && <p>A new tab has no place to save yet. Open something first.</p>}

              <label>
                Group for this tab
                <select
                  value={group?.id ?? ''}
                  onChange={(e) =>
                    e.target.value ? joinTabGroup(strip.at, e.target.value) : leaveTabGroup(strip.at)
                  }
                >
                  <option value="">Ungrouped</option>
                  {strip.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name || 'Untitled group'}
                    </option>
                  ))}
                </select>
              </label>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  /* The strip picks the colour — `freeTone` takes one nobody
                     is wearing, which is a better answer than a swatch row
                     that lets two groups be the same green. */
                  groupTab(strip.at, name.trim());
                  setName('');
                }}
              >
                <label>
                  New group
                  <input
                    aria-label="New tab group name"
                    maxLength={GROUP_NAME}
                    placeholder="e.g. Fall semester"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={!name.trim()}>
                  Create group
                </button>
              </form>

              {strip.groups.length > 0 && (
                <details>
                  <summary>Manage groups</summary>
                  {strip.groups.map((g) => (
                    <div className="g-bookmark-row" key={g.id}>
                      <input
                        aria-label={`Rename group ${g.name || 'Untitled group'}`}
                        value={g.name}
                        maxLength={GROUP_NAME}
                        onChange={(e) => nameGroup(g.id, e.target.value)}
                      />
                      {/* The same twelve, named the same way, as the
                          workspace's group menu — see `components/TabMenu`. */}
                      <div className="g-group-colors">
                        {Array.from({ length: GROUP_TONES }, (_, i) => (
                          <button
                            key={i}
                            type="button"
                            style={{ background: toneAt(tones, i).fill }}
                            aria-label={`Colour ${i + 1}`}
                            aria-pressed={g.tone === i}
                            onClick={() => colourGroup(g.id, i)}
                          />
                        ))}
                      </div>
                      <button
                        aria-label={`Ungroup ${g.name || 'Untitled group'}`}
                        onClick={() => dissolveGroup(g.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <p>Ungrouping keeps every tab open.</p>
                </details>
              )}

              <h3>Recently closed</h3>
              <button
                className="g-organizer-save"
                disabled={!closedTab || strip.tabs.length >= MAX_TABS}
                onClick={restoreClosed}
              >
                {closedTab ? `Reopen ${closedTab.title || 'New tab'}` : 'No closed tabs this visit'}
              </button>
              <p>Reopen last closed: Alt + Shift + T. New tab: Alt + T.</p>
              {strip.tabs.length >= MAX_TABS && (
                <p role="status">
                  All {MAX_TABS} tabs are in use. Close one to open or restore another.
                </p>
              )}

              <h3>Saved bookmarks</h3>
              {!marks.length && <p>Bookmark a course, document, or any screen to reopen it later.</p>}
              {marks.map((b) => (
                <div className="g-bookmark-row" key={b.id}>
                  <button
                    disabled={strip.tabs.length >= MAX_TABS}
                    onClick={() => {
                      if (openInNew(b.screen, b.title, b.place))
                        land({ id: b.id, title: b.title, screen: b.screen, place: b.place });
                    }}
                  >
                    {b.title} <small>↗</small>
                  </button>
                  <button aria-label={`Remove bookmark ${b.title}`} onClick={() => dropMark(b.id)}>
                    ×
                  </button>
                </div>
              ))}
              <p>
                Bookmarks are shared with the rest of the app. Groups arrange the tabs on this
                device.
              </p>
            </section>
          )}
        </div>
      </nav>
    </>
  );
}
