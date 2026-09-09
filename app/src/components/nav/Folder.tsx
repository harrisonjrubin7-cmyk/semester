/**
 * A shelf, opened in place.
 *
 * The overlay itself — the wash, the title, the way out, the focus trap — is
 * `TileSheet`, which the task index opens too. What is this file's is the one
 * thing that is only true of a shelf: the tiles on it can be dragged into the
 * order somebody actually uses them in, and that order is remembered.
 *
 * ## Dragging, and the keyboard that has to do the same job
 *
 * Tiles are dragged with pointer events rather than HTML5 drag-and-drop,
 * which does not fire on touch at all — a phone-first app whose only
 * arrangement gesture works on a laptop has not shipped the feature.
 *
 * A drag is also not a thing everybody can do, so Alt with the arrow keys
 * moves the focused tile by one. Same operation, same look key, no pointer.
 */

import { useStore } from '../../state/store';
import { readOrder, writeOrder } from '../../lib/launcher';
import { MOVE_HINT, useMovable } from '../../lib/arrange';
import { currentLook } from '../../state/shape';
import type { Destination, Group } from '../../lib/nav';
import type { Screen } from '../../lib/types';
import { TabGlyph } from '../TabIcon';
import { Blueprint } from '../Blueprint';
import { Caps } from '../soft/Soft';
import { TileSheet } from './TileSheet';

export function Folder({
  group,
  tiles,
  says,
  onClose,
}: {
  group: Group;
  tiles: Destination[];
  says: (d: Destination) => { label: string; blurb: string };
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();

  /*
   * The gesture, and the keyboard that has to do the same job.
   *
   * Both are `lib/arrange.ts`'s now rather than this file's. What was here
   * was the app's first drag-to-arrange, and it had learned three things the
   * hard way — a press is a drag only once it is held, a drop ends in a click
   * that has to be told to stand down, and Alt with the arrow keys does the
   * same job without a pointer. Every list that has since become movable
   * would otherwise have had to learn all three again.
   *
   * `tiles` is the shelf as drawn, so the whole of it is written down on
   * every move rather than the pair that swapped: a partial order leaves the
   * rest at the mercy of a registry edit, which is the one thing somebody who
   * has arranged their tiles does not expect.
   */
  const shelf = useMovable<Screen>({
    items: tiles.map((d) => d.screen),
    onMove: (moved) => {
      const order = readOrder(currentLook(state).groupOrder);
      dispatch({
        type: 'setLook',
        look: { groupOrder: writeOrder({ ...order, [group]: moved }) },
      });
    },
  });

  return (
    <TileSheet
      name={group}
      sub={tiles.length === 1 ? '1 screen' : `${tiles.length} screens`}
      onClose={onClose}
    >
      {tiles.map((d) => {
        const said = says(d);
        return (
          <Blueprint
            plain
            as="button"
            key={d.screen}
            {...shelf.props(d.screen, { className: 'soft-tile surface soft-folder-tile' })}
            aria-label={`${said.label}. ${MOVE_HINT}`}
            onClick={() => {
              // A drop ends in a click on the tile it started from, so
              // without this the drag would open what it landed on.
              if (shelf.tookDrop()) return;
              dispatch({ type: 'go', screen: d.screen });
              onClose();
            }}
          >
            <div className="soft-tile-glyph">
              <TabGlyph screen={d.screen} size={18} />
            </div>
            <Caps>{said.label}</Caps>
            <div className="soft-tile-sub">{said.blurb}</div>
          </Blueprint>
        );
      })}
    </TileSheet>
  );
}
