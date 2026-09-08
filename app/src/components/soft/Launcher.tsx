/**
 * The soft shell's launcher: nine dark tiles, one per shelf.
 *
 * The directory it stands in for is a good directory — grouped, every row
 * saying what it is for — and it is a column of fifty-five rows. That is the
 * right shape for reading and the wrong one for a place you come back to
 * every day, because a column has no positions: the thing you want is
 * somewhere between the second and the fortieth row, and it is somewhere
 * different next week when a shelf grows.
 *
 * Nine tiles have positions. Bottom-left is Data whether or not Data has
 * anything in it this week, which is the property a directory cannot have and
 * the reason this exists.
 *
 * The directory is not replaced. `shell: 'plain'` and `'grouped'` render it
 * exactly as before, and search still reaches every screen from anywhere.
 */

import { useState } from 'react';
import { useStore } from '../../state/store';
import { GROUPS, destinationsFor, saysFor, type Destination, type Group } from '../../lib/nav';
import { readOrder, tilesFor } from '../../lib/launcher';
import { softTop } from '../../lib/softtop';
import { currentLook } from '../../state/shape';
import { TabGlyph } from '../TabIcon';
import { glyphFor } from '../icons.pick';
import { DarkTile } from './Soft';
import { Folder } from './Folder';

/**
 * What the tile says, under the glyphs.
 *
 * The first hero figure on the shelf, which is already computed and already
 * the thing worth reading first about that screen — Semester shows the next
 * class, Courses the term's progress, Study the cards due. Reusing it means
 * the launcher and the screen it opens can never disagree, and it means no
 * nine bespoke derivations were written for a grid of tiles.
 *
 * A shelf whose screens are all tools has no figure anywhere on it. Those get
 * how many screens are on the shelf, which is at least true.
 */
function valueFor(group: Group, store: ReturnType<typeof useStore>): string {
  const { state, catalog, now, school } = store;
  const caps = school.capabilities;
  const on = destinationsFor(group, caps);
  for (const d of on) {
    const figure = softTop(d.screen, { state, catalog, now, caps }).hero?.figure;
    if (figure) return figure;
  }
  return String(on.length);
}

/**
 * Up to three screens whose glyphs differ.
 *
 * Ten of the fifty-five screens have a glyph of their own; the rest fall back
 * to their shelf's. So the first three screens on a shelf are usually the
 * same drawing three times, which reads as a decorative flourish rather than
 * as a cluster of what is inside. One glyph is a truer answer than three
 * copies of it.
 */
function distinct(on: Destination[]): Destination[] {
  const out: Destination[] = [];
  const seen = new Set<unknown>();
  for (const d of on) {
    const glyph = glyphFor(d.screen);
    if (seen.has(glyph)) continue;
    seen.add(glyph);
    out.push(d);
    if (out.length === 3) break;
  }
  return out;
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
                glyphs={distinct(on).map((d) => (
                  <TabGlyph key={d.screen} screen={d.screen} size={15} />
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
