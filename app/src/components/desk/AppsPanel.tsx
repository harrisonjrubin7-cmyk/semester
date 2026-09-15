/**
 * The nine-dot launcher: your shortcuts, then everything else.
 *
 * The same contents as `components/nav/AllApps.tsx` — it is the same registry,
 * gated the same way, arranged by the same saved order — drawn as a panel
 * hanging off the button that opened it rather than as a sheet over the whole
 * window. Which is the difference the workspace is: the strip, the bar and
 * this panel are *chrome*, and chrome that blacks out the page you were
 * reading is chrome that costs you the page.
 *
 * It is a second drawing of one grid rather than a second grid. `AppGrid`
 * draws the icons, `appShelves` decides what is in them, `saysFor` decides
 * what they are called. What is this file's is the favourites block at the
 * top and the way out.
 *
 * ## The favourites row is here and not on the other launcher
 *
 * `lib/apps.ts` argues at length that a row on top whose length changes with
 * the week moves every icon under it, and that is right — about a row that
 * changes by itself. This one does not: it is exactly what the student
 * pinned, it holds still until they change it, and the pencil that edits it
 * is the one route to doing so. A fixed row of five you chose is the opposite
 * of a row of "most used".
 */

import { useStore } from '../../state/store';
import { currentLook } from '../../state/shape';
import { appShelves } from '../../lib/apps';
import { isFavourite, readFavourites, toggleFavourite } from '../../lib/desk';
import { saysFor, shortFor } from '../../lib/nav';
import { useModal } from '../../a11y/modal';
import { Caps } from '../soft/Soft';
import { AppGrid } from '../nav/AppGrid';
import { EditIcon, StarIcon } from '../Icons';
import { useRef, useState } from 'react';

export function AppsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch, school } = useStore();
  const caps = school.capabilities;
  const look = currentLook(state);
  const shelves = appShelves(caps, look.groupOrder, state.role);
  const favourites = readFavourites(look.favourites, caps, state.role);
  /** Whether the panel is in the state where tapping an icon pins it. */
  const [editing, setEditing] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  // Escape, the focus ring and the return of focus to the nine dots — every
  // dialog in this app uses the same one so this cannot drift from the rest.
  const { ref: modalRef, onKeyDown } = useModal<HTMLDivElement>({ onClose, initial: first });

  const pin = (screen: Parameters<typeof isFavourite>[1]) =>
    dispatch({
      type: 'setLook',
      look: { favourites: toggleFavourite(look.favourites, screen, caps, state.role) },
    });

  return (
    <div
      className="desk-panel"
      role="dialog"
      aria-modal="true"
      aria-label="All apps"
      ref={modalRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="desk-panel-fav">
        <div className="desk-panel-head">
          <div className="desk-panel-name chrome-text">Your favourites</div>
          <button
            type="button"
            className="bare desk-panel-edit"
            ref={first}
            onClick={() => setEditing((on) => !on)}
            aria-pressed={editing}
            aria-label={editing ? 'Stop choosing favourites' : 'Choose favourites'}
          >
            <EditIcon size={17} />
          </button>
        </div>
        {editing ? (
          <p className="desk-panel-note">
            Tap an app below to pin or unpin it. Up to six.
          </p>
        ) : favourites.length === 0 ? (
          <p className="desk-panel-note">Nothing pinned yet.</p>
        ) : (
          <AppGrid
            apps={favourites}
            says={(d) => ({ label: shortFor(d, caps), blurb: saysFor(d, caps).blurb })}
            onOpen={(d) => {
              dispatch({ type: 'go', screen: d.screen });
              onClose();
            }}
          />
        )}
      </div>

      <div className="desk-panel-all">
        <Caps quiet>More from Semester</Caps>
        {shelves.map((shelf) => (
          <section key={shelf.group}>
            <Caps quiet>{shelf.group}</Caps>
            <AppGrid
              apps={shelf.apps}
              says={(d) => ({
                // A pinned app says so in the grid while the pencil is down,
                // so "which of these am I already carrying" is answerable
                // without closing the panel and looking at the row.
                label: `${editing && isFavourite(look.favourites, d.screen, caps, state.role) ? '★ ' : ''}${shortFor(d, caps)}`,
                blurb: saysFor(d, caps).blurb,
              })}
              onOpen={(d) => {
                if (editing) {
                  pin(d.screen);
                  return;
                }
                dispatch({ type: 'go', screen: d.screen });
                onClose();
              }}
            />
          </section>
        ))}
      </div>

      <div className="desk-panel-foot">
        <button
          type="button"
          className="bare desk-panel-link"
          onClick={() => {
            dispatch({ type: 'go', screen: 'directory' });
            onClose();
          }}
        >
          <StarIcon size={15} />
          <span>Open the app directory</span>
        </button>
        <button type="button" className="bare pill-soft" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
