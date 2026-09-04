/**
 * The app as a home screen.
 *
 * An alternate way in, chosen in Settings, not a replacement for the tab bar.
 * The bar is right for somebody who lives in four screens; this is right for
 * somebody who has forty-six and would rather see them than remember which
 * shelf they are on. Which is better genuinely depends on the person.
 *
 * The arrangement, the folders and the gating are in `lib/springboard.ts` and
 * tested there. What is here is the part that has to be touched: three swipeable
 * pages, a dock that does not move, folders that open in place, and a search
 * that filters to a flat grid the moment anything is typed.
 *
 * ## It is built from the app's own directory
 *
 * Every icon resolves through `lib/nav.ts`, so a screen added or renamed there
 * appears here without anyone remembering to. A screen the school has no
 * equivalent of never appears at all — no error, no gap.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { TabGlyph } from '../components/TabIcon';
import { dockFor, labelFor, matches, pagesFor, searchable, type Folder } from '../lib/springboard';
import type { Screen } from '../lib/types';

const ICON = 58;

function Icon({ screen, onOpen }: { screen: string; onOpen: (s: string) => void }) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={() => onOpen(screen)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: 0,
      }}
    >
      <span
        className="iconshape"
        style={{
          width: ICON,
          height: ICON,
          display: 'grid',
          placeItems: 'center',
          background: 'var(--app-panel)',
          border: '1px solid var(--app-line)',
          // `--icon-radius` is the Settings choice; the squircle default here
          // is what an app icon looks like when nobody has chosen.
          borderRadius: 'var(--icon-radius, 16px)',
        }}
      >
        <TabGlyph screen={screen as Screen} size={26} />
      </span>
      <span
        style={{
          fontSize: 'calc(10px * var(--text-scale, 1))',
          letterSpacing: '0.02em',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: 76,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {labelFor(screen)}
      </span>
    </button>
  );
}

/**
 * A folder, drawn as the first four icons behind one tile.
 *
 * Opens in place rather than on its own screen: a folder that navigates
 * somewhere has stopped being a folder and become another list.
 */
function FolderTile({ folder, onOpen }: { folder: Folder; onOpen: (s: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="bare tappable"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', padding: 0 }}
      >
        <span
          className="iconshape"
          style={{
            width: ICON,
            height: ICON,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 3,
            padding: 7,
            background: 'var(--app-hero)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--icon-radius, 16px)',
          }}
        >
          {folder.screens.slice(0, 4).map((s) => (
            <span key={s} style={{ display: 'grid', placeItems: 'center' }}>
              <TabGlyph screen={s as Screen} size={13} />
            </span>
          ))}
        </span>
        <span style={{ fontSize: 'calc(10px * var(--text-scale, 1))', lineHeight: 1.2 }}>
          {folder.label}
        </span>
      </button>

      {open && (
        <div
          style={{
            gridColumn: '1 / -1',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            padding: '14px 12px',
            margin: '4px 0 8px',
            background: 'var(--app-panel)',
            border: '1px solid var(--app-line)',
            borderRadius: 'var(--r-md)',
          }}
        >
          {folder.screens.map((s) => (
            <Icon key={s} screen={s} onOpen={onOpen} />
          ))}
        </div>
      )}
    </>
  );
}

export function Springboard() {
  const { state, dispatch, school, catalog, now } = useStore();
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');

  const pages = pagesFor(school.capabilities);
  const dock = dockFor(school.capabilities);
  const open = (screen: string) => dispatch({ type: 'go', screen: screen as Screen });

  const searching = query.trim().length > 0;
  const found = searchable(school.capabilities).filter((s) => matches(s, query));
  const here = pages[Math.min(page, pages.length - 1)];

  const due = catalog.items.filter((i) => !state.done[i.id]).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', padding: '10px 14px 0' }}>
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        aria-label="Search the app"
        style={{ width: '100%', height: 38, marginBottom: 14, fontSize: 'calc(13px * var(--text-scale, 1))' }}
      />

      {searching ? (
        <>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginBottom: 10 }}>
            {found.length === 0
              ? 'Nothing here by that name.'
              : `${found.length} ${found.length === 1 ? 'place' : 'places'}`}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {found.map((s) => (
              <Icon key={s} screen={s} onOpen={open} />
            ))}
          </div>
        </>
      ) : (
        <>
          {here?.widgets && (
            // One widget, not a wall of them. It says the thing the home screen
            // exists to say and then gets out of the way.
            <button
              type="button"
              className="bare tappable"
              onClick={() => open('home')}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '13px 14px',
                marginBottom: 16,
                background: 'var(--app-hero)',
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <span className="kicker" style={{ fontSize: 'calc(10px * var(--text-scale, 1))' }}>
                {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(17px * var(--text-scale, 1))',
                  marginTop: 4,
                }}
              >
                {due === 0
                  ? 'Nothing outstanding.'
                  : `${due} ${due === 1 ? 'thing' : 'things'} still to do`}
              </span>
            </button>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
            {here?.items.map((item) =>
              typeof item === 'string' ? (
                <Icon key={item} screen={item} onOpen={open} />
              ) : (
                <FolderTile key={item.label} folder={item} onOpen={open} />
              ),
            )}
          </div>

          {pages.length > 1 && (
            <div
              role="tablist"
              aria-label="Pages"
              style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '20px 0 8px' }}
            >
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === page}
                  aria-label={`Page ${i + 1}`}
                  onClick={() => setPage(i)}
                  className="bare"
                  style={{
                    width: 7,
                    height: 7,
                    flex: 'none',
                    padding: 0,
                    borderRadius: '50%',
                    background: i === page ? 'var(--app-accent)' : 'var(--app-line)',
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div style={{ flex: 1, minHeight: 12 }} />

      {/* The dock does not move between pages, which is the whole point of it. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, dock.length)}, 1fr)`,
          gap: 18,
          padding: '14px 12px',
          marginBottom: 10,
          background: 'var(--app-panel)',
          border: '1px solid var(--app-line)',
          borderRadius: 'var(--r-lg)',
        }}
      >
        {dock.map((s) => (
          <Icon key={s} screen={s} onOpen={open} />
        ))}
      </div>
    </div>
  );
}
