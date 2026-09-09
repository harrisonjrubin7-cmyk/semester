import { useState } from 'react';
import { useStore } from '../../state/store';
import { NavRow, Group } from '../../components/shell/Rows';
import { SETTINGS, SEARCH_PLACEHOLDER, findSetting, markLooking, nothingFound } from '../../lib/settings';
import type { Screen } from '../../lib/types';

/**
 * Settings, as an index.
 *
 * Nothing lives at this level but rows. That is the whole change: the screen
 * used to be thirty sections in one scroll, and finding one of them meant
 * going past all the others with nothing telling you when you had gone too
 * far. Now each row names a page and says what is on it, and the list fits on
 * a phone without scrolling past About.
 *
 * The rows come from `lib/settings.ts`, which is also what the search below
 * matches against and what decides which pages a link may open — one list, so
 * a page cannot be findable and unreachable at the same time.
 */
export function SettingsIndex() {
  const { state, dispatch, account, sync, school } = useStore();
  const [query, setQuery] = useState('');

  const found = findSetting(query);
  const searching = query.trim().length >= 2;

  // The word that matched travels with the jump, so the page that opens can
  // light the group it was found in rather than making somebody look again.
  const go = (screen: Screen, matched: string) => {
    markLooking(matched);
    dispatch({ type: 'go', screen });
    setQuery('');
  };

  const standing =
    sync.status === 'synced'
      ? 'Synced'
      : sync.status === 'signed-out'
        ? 'Not signed in'
        : sync.status === 'syncing'
          ? 'Syncing'
          : sync.status === 'error'
            ? 'Sync trouble'
            : 'On this device only';

  return (
    // In whichever layout the app is set to, for the reason in `Page.tsx`:
    // the rows are the same rows in all three, and a settings screen that does
    // not look like the app it configures is the one screen that cannot afford
    // to be an exception.
    <div>
      <div style={{ padding: '0 16px calc(14px * var(--density, 1))' }}>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={SEARCH_PLACEHOLDER}
          style={{ width: '100%', height: 40, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
        />
      </div>

      {searching ? (
        <nav aria-label="Settings search results" style={{ padding: '0 16px' }}>
          {found.length === 0 ? (
            <div
              style={{
                fontSize: 'calc(12.5px * var(--text-scale, 1))',
                opacity: 0.6,
                lineHeight: 'var(--leading-relaxed)',
                textWrap: 'pretty',
              }}
            >
              {nothingFound(query)}
            </div>
          ) : (
            /* Not foldable: a section is named by what its heading says, and
               this one says a count that changes on every keystroke. There is
               nothing here to come back to anyway — it is the answer to a
               question being typed. */
            <Group folds={false} header={`${found.length} ${found.length === 1 ? 'match' : 'matches'}`}>
              {found.map((f) => (
                <NavRow
                  key={f.row.screen}
                  label={f.row.label}
                  sub={f.section}
                  value={f.matched === f.row.label ? undefined : f.matched}
                  onClick={() => go(f.row.screen, f.matched)}
                />
              ))}
            </Group>
          )}
        </nav>
      ) : (
        <nav aria-label="Settings" style={{ padding: '0 16px' }}>
          <Group>
            <NavRow
              tall
              label={state.myName.trim() || 'Your account'}
              sub={school.name}
              value={standing}
              onClick={() => dispatch({ type: 'go', screen: 'account' })}
            />
          </Group>

          {SETTINGS.map((section) => (
            <Group
              key={section.header}
              header={section.header}
              footer={
                section.header === 'Privacy and data'
                  ? account
                    ? 'Everything here is per device except what syncs, which Your data lists.'
                    : 'Everything here stays on this device. Signing in is optional.'
                  : section.footer
              }
            >
              {section.rows.map((row) => (
                // One line each. What a page holds is in `lib/settings.ts`
                // and is what search matches on, but printing it under every
                // row is what pushed About off the bottom of a phone — and an
                // index that scrolls is the screen this replaced with an
                // extra tap in front of it.
                <NavRow
                  key={row.screen}
                  label={row.label}
                  onClick={() => dispatch({ type: 'go', screen: row.screen })}
                />
              ))}
            </Group>
          ))}
        </nav>
      )}
    </div>
  );
}

/**
 * Settings, as a screen.
 *
 * The router's entry point, and now the only one: this used to live in
 * `screens/Me.tsx` because Me rendered the same index as a tab of itself, so
 * loading the settings screen dragged the whole Progress screen in with it.
 * The tab is gone — there is one Settings, and it is here.
 */
export function Settings() {
  return (
    <div style={{ paddingTop: 'var(--sp-7)' }}>
      <SettingsIndex />
    </div>
  );
}
