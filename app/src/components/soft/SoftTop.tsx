/**
 * The hero, the stat row and the bottom bar, for whichever screen is open.
 *
 * One component in `App.tsx` rather than a block inside fifty-five screen
 * files. Which facts to show is `lib/softtop.ts`; this is only the wiring —
 * it reads the store, hands the registry the state, and renders what comes
 * back with the parts built in step 2.
 *
 * ## Why the bar is a sibling of the screen and not part of it
 *
 * The bar has to sit under the content and above the tab bar, and the element
 * that scrolls is `.scrollarea` in `ScrollArea`. A bar rendered inside a
 * screen is inside whatever that screen's own layout is — `Page` sets its own
 * padding and several screens set a width — so `position: sticky` measured
 * against the wrong box, which is exactly the failure step 2 recorded and
 * left open. Rendered here it is a direct child of the scrolling element, and
 * sticky means what it says.
 */

import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { softTop, type TopStat } from '../../lib/softtop';
import { useSoft } from '../shell/useShell';
import { Hero, Stat, StatRow, BottomBar } from './Soft';

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
  const soft = useSoft();
  const top = useTop();
  if (!soft) return null;
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

export function SoftBar() {
  const soft = useSoft();
  const { dispatch } = useStore();
  const top = useTop();
  if (!soft || !top.bar) return null;

  return (
    <BottomBar
      status={top.bar.status}
      primary={top.bar.primary.label}
      onPrimary={() => {
        // `also` first, so the screen paints with its switch already where the
        // action promised — "Check the dates" must not land on the half about
        // pasted emails. See `TopAction` in `lib/softtop.ts`.
        if (top.bar!.primary.also) dispatch(top.bar!.primary.also);
        dispatch({ type: 'go', screen: top.bar!.primary.screen });
      }}
    />
  );
}
