/**
 * The hero and the stat row, for whichever screen is open.
 *
 * One component in `App.tsx` rather than a block inside fifty-five screen
 * files. Which facts to show is `lib/softtop.ts`; this is only the wiring —
 * it reads the store, hands the registry the state, and renders what comes
 * back.
 *
 * ## There was a `SoftBar` here
 *
 * It drew the registry's bar as a sticky pill at the foot of the scroller,
 * and it is gone with the bar itself — the reasoning is in `lib/softtop.ts`,
 * where the facts live. What it leaves behind is worth stating: this file no
 * longer touches `dispatch`, because the registry describes what a screen is
 * about and never anywhere to go. Navigation is the navigation's job.
 */

import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { softTop, type TopStat } from '../../lib/softtop';
import { useSoft } from '../shell/useShell';
import { fills } from '../shell/exempt';
import { Hero, Stat, StatRow } from './Soft';

/*
 * What each sync state is called on a stat card.
 *
 * One word each, because the slot is a stat's value and set at the size of
 * one: "Signed out" wrapped to two lines and made the card taller than the
 * two beside it. "None" for a signed-out account says the same thing in the
 * space there is — there is no account — and the card's label already
 * supplies the noun.
 */
const SYNC_SAID: Record<string, string> = {
  synced: 'Synced',
  syncing: 'Syncing',
  'signed-out': 'None',
  error: 'Trouble',
};

/**
 * This screen's spec.
 *
 * Memoised because the hero and the bar are two elements in two places in the
 * tree, so the hook runs twice per render — and the spec walks the term's
 * deadlines to build it. Keyed on the store's own identities, so it is
 * recomputed when something changes and not when something re-renders.
 */
function useTop() {
  const { state, catalog, now, school, sync } = useStore();
  const caps = school.capabilities;
  // The word Settings shows, not the whole status object: the spec holds
  // strings, and a shape with a timestamp in it would recompute every tick.
  const said = SYNC_SAID[sync.status] ?? 'Local';
  return useMemo(
    () => softTop(state.screen, { state, catalog, now, caps, sync: said }),
    [state, catalog, now, caps, said],
  );
}

export function SoftTop() {
  const { state } = useStore();
  const soft = useSoft();
  const top = useTop();
  if (!soft) return null;
  /*
   * Not above a screen that is already the full height of the window.
   *
   * A hero is the top of a column you scroll: it introduces the screen and
   * then goes away as you read past it. The chat has no such column — it is a
   * log that scrolls inside itself and a composer on the bottom edge, sized to
   * the box it is given. So 200px of hero above it is not an introduction, it
   * is 200px taken off the conversation, and because the chat cannot scroll
   * out of the way of it the composer was pushed clean off the bottom of the
   * phone and clipped. The one place the hero and the screen disagreed about
   * who owns the height.
   *
   * The registry keeps its entry for `ask` — it is data, and the same facts
   * would be right if this screen ever became a column. This is the wiring
   * declining to draw them here.
   */
  if (fills(state.screen)) return null;
  if (!top.hero && top.stats.length === 0) return null;

  return (
    <div className="soft-top">
      {top.hero ? (
        <Hero
          label={top.hero.label}
          meta={top.hero.meta}
          figure={top.hero.figure}
          said={top.hero.said}
          foot={top.hero.foot ? <div className="soft-tile-sub">{top.hero.foot}</div> : undefined}
        />
      ) : null}
      {top.stats.length > 0 ? (
        <StatRow cols={top.stats.length === 2 ? 2 : 3}>
          {top.stats.slice(0, 3).map((s: TopStat) => (
            <Stat key={s.label} label={s.label} value={s.value} fraction={s.fraction} />
          ))}
        </StatRow>
      ) : null}
    </div>
  );
}
