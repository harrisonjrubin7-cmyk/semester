import { describe, expect, it } from 'vitest';
import { MAKE } from './Create';
import { DESTINATIONS } from '../lib/nav';

/**
 * A tile that borrows a registry name opens the screen that owns it.
 *
 * Create draws nine tiles, and three of them navigate rather than making
 * something here. Those three carry a title and nothing else — no screen id
 * a reader can check against — so a tile could name one screen and go to
 * another and still read perfectly on the page. One did: *Maths* went to
 * Draw It, while All Apps sent the same name to Equations, whose registry
 * `short` is literally `Maths`. Two screens draw a curve, the wrong one was
 * wired, and the only way to notice was to open both.
 *
 * So the rule rather than the instance: when a tile's title is a name the
 * registry has already given a screen, that is the screen the tile opens.
 * A tile is free to invent a name the registry does not use — *Study guide*
 * and *Notes* do, and are not constrained here — but it may not take a name
 * the registry has spent and point it somewhere else, because a name that
 * opens two different screens depending on where it was tapped is worse
 * than either route being wrong.
 */
describe('the Create tiles', () => {
  const named = MAKE.flatMap((tile) => {
    if (!tile.go) return [];
    const owner = DESTINATIONS.find((d) => d.short === tile.title || d.label === tile.title);
    return owner ? [{ title: tile.title, go: tile.go, owns: owner.screen }] : [];
  });

  it('has at least one tile the registry has named, or this guard proves nothing', () => {
    expect(named.map((n) => n.title)).toContain('Maths');
  });

  it.each(named)('sends $title to $owns, the screen the registry gives that name', (tile) => {
    expect(tile.go).toBe(tile.owns);
  });
});
