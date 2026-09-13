/**
 * The launcher: one dark tile per shelf, eight of them.
 *
 * The directory it stands in for is a good directory — grouped, every row
 * saying what it is for — and it is a column of fifty-five rows. That is the
 * right shape for reading and the wrong one for a place you come back to
 * every day, because a column has no positions: the thing you want is
 * somewhere between the second and the fortieth row, and it is somewhere
 * different next week when a shelf grows.
 *
 * Tiles have positions. Data is last whether or not Data has anything in it
 * this week, which is the property a directory cannot have and the reason this
 * exists.
 *
 * The directory is not replaced — it is the other half of a setting. This is
 * `directory: 'tiles'` and the list is `'list'`, chosen on **Layout and
 * navigation**, and search still reaches every screen from anywhere whichever
 * is on.
 *
 * It lives beside `ShelfNav` rather than in `soft/` because it used to be
 * drawn by `shell === 'soft'` and is not any more: a layout decides how a
 * screen is drawn, never what it contains. It still borrows the soft parts
 * below — `DarkTile` is a good tile in every layout, and a second one drawn
 * to look almost the same would be the duplication this release is about.
 *
 * The tile, the cluster of glyphs and the sheet that opens over the grid are
 * shared with Progress → By task, which files the same screens under what
 * somebody is trying to do rather than where the thing lives. Two grids drawn
 * to almost the same measurements would be that duplication again.
 */

import { useState } from 'react';
import { useStore } from '../../state/store';
import { GROUPS, destinationsFor, saysFor, type Group } from '../../lib/nav';
import { readOrder, tilesFor } from '../../lib/launcher';
import { currentLook } from '../../state/shape';
import { TabGlyph } from '../TabIcon';
import { distinctGlyphs } from '../icons.pick';
import { firstFigure } from '../../lib/softtop';
import { DarkTile } from '../soft/Soft';
import { Folder } from './Folder';

/**
 * What the tile says, under the glyphs.
 *
 * The first hero figure on the shelf, which is already computed and already
 * the thing worth reading first about that screen — Semester shows the next
 * class, Courses the term's progress, Study the cards due. Reusing it means
 * the launcher and the screen it opens can never disagree, and it means no
 * eight bespoke derivations were written for a grid of tiles.
 *
 * A shelf whose screens are all tools has no figure anywhere on it. Those get
 * how many screens are on the shelf, which is at least true.
 */
function valueFor(group: Group, store: ReturnType<typeof useStore>): string {
  const { state, catalog, now, school } = store;
  const on = destinationsFor(group, school.capabilities, state.role);
  return (
    firstFigure(on.map((d) => d.screen), { state, catalog, now, caps: school.capabilities }) ??
    String(on.length)
  );
}

export function Launcher() {
  const store = useStore();
  const { state, school } = store;
  const caps = school.capabilities;
  const order = readOrder(currentLook(state).groupOrder);
  const [open, setOpen] = useState<Group | null>(null);

  return (
    <>
      <div className="soft-grid" role="list">
        {GROUPS.map((group) => {
          const on = tilesFor(group, caps, order);
          if (on.length === 0) return null;
          return (
            <div key={group} className="soft-grid-cell" role="listitem">
              <DarkTile
                label={`${group} — ${on.length === 1 ? '1 screen' : `${on.length} screens`}`}
                glyphs={distinctGlyphs(on.map((d) => d.screen)).map((screen) => (
                  <TabGlyph key={screen} screen={screen} size={15} />
                ))}
                value={valueFor(group, store)}
                onClick={() => setOpen(group)}
              />
              {/* Outside the tile, on the ground: see `DarkTile`'s note. */}
              <div className="soft-caps soft-grid-name">{group}</div>
              <div className="soft-tile-sub">
                {on.length === 1 ? '1 screen' : `${on.length} screens`}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <Folder
          group={open}
          onClose={() => setOpen(null)}
          says={(d) => saysFor(d, caps)}
          tiles={tilesFor(open, caps, order)}
        />
      )}
    </>
  );
}
