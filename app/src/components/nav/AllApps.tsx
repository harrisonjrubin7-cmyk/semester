/**
 * Every screen in the app, as icons, over whatever you were reading.
 *
 * Opened by the grid button in the header, which is on every screen — see the
 * note beside it in `App.tsx`, and `lib/apps.ts` for what decides the
 * contents and why there is no favourites row at the top of it.
 *
 * ## What is this file's, and what is not
 *
 * Almost nothing is this file's, which is the point. The wash, the heading,
 * the way out, the focus trap and the swipe-down are `TileSheet`'s — the same
 * overlay a launcher folder and the task index open, so the third thing that
 * opens over a grid in this app is the same object as the first two rather
 * than a fourth one drawn to nearly the same measurements. The icons and
 * names are `AppGrid`'s, which is the Tools tab's home screen. The membership
 * and the order are `lib/apps.ts`'s, which is the registry's.
 *
 * What is here is the arrangement: shelves, each named, in the order the
 * student left them.
 */

import { useStore } from '../../state/store';
import { currentLook } from '../../state/shape';
import { appCount, appShelves } from '../../lib/apps';
import { saysFor, shortFor } from '../../lib/nav';
import { Caps } from '../soft/Soft';
import { AppGrid } from './AppGrid';
import { TileSheet } from './TileSheet';

export function AllApps({ onClose }: { onClose: () => void }) {
  const { state, dispatch, school } = useStore();
  const caps = school.capabilities;
  const shelves = appShelves(caps, currentLook(state).groupOrder);
  const count = appCount(shelves);

  return (
    <TileSheet
      plain
      name="All apps"
      sub={count === 1 ? '1 screen' : `${count} screens`}
      onClose={onClose}
    >
      {shelves.map((shelf) => (
        <section key={shelf.group}>
          <Caps quiet>{shelf.group}</Caps>
          <AppGrid
            apps={shelf.apps}
            // The name this school uses, cut to the column when this school
            // has no name of its own for it. `shortFor` holds both halves.
            says={(d) => ({ label: shortFor(d, caps), blurb: saysFor(d, caps).blurb })}
            onOpen={(d) => {
              dispatch({ type: 'go', screen: d.screen });
              // The sheet is a way of getting somewhere, so arriving closes
              // it. Left open, the screen you just chose would be behind a
              // wash and the way out would be a Close button rather than the
              // thing you asked for.
              onClose();
            }}
          />
        </section>
      ))}
    </TileSheet>
  );
}
