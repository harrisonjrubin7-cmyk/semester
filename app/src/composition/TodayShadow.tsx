import { useEffect, useRef } from 'react';
import { rank, type Action, type Choice } from '../lib/actions';
import type { OfficeAction } from '../lib/office-actions';
import { diffToday, domainSide, legacyDay, type ShadowDiff } from './shadow';
import { useDomains } from './react';

/**
 * Phase 2 of the Today migration: runs the domain layer beside the Action
 * Center and reports where they differ. Draws nothing and changes nothing.
 *
 * Mounted only when `shadowEnabled()` — a build that sets
 * `VITE_TODAY_SHADOW=on` — and loaded lazily, so a build without the flag
 * carries none of it.
 *
 * It is given what the Action Center *already computed* (its candidate list,
 * the student's choices, the day's rows) rather than recomputing them, so the
 * legacy side is exactly what is on screen, including the registration and
 * office actions the domain layer does not yet source. Those show up as
 * `explained` differences; anything else is `unexplained` and is warned once.
 */
export interface TodayShadowProps {
  readonly actions: readonly Action[];
  readonly choices: Record<string, Choice>;
  /** The Action Center's commitment rows; only today's are compared. */
  readonly rows: readonly { id: string; at: number }[];
  readonly now: Date;
  /** Registration Day Mode as the Action Center surfaces it. */
  readonly registrationDay?: boolean;
  /** The office feed the Action Center already fetched, so shadowing makes no second request. */
  readonly officeList?: readonly OfficeAction[] | null;
}

const DAY = 86_400_000;

/** The legacy answer for today, reduced to ids. Exported so the mounted test builds it the same way. */
export function legacySide({ actions, choices, rows, now }: TodayShadowProps) {
  const at = now.getTime();
  const ranked = rank([...actions], choices, at);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return {
    ranked: [...(ranked.mostImportant ? [ranked.mostImportant.action.id] : []), ...ranked.next.map((s) => s.action.id)],
    day: legacyDay(rows.filter((r) => r.at >= midnight && r.at < midnight + DAY)),
  };
}

export default function TodayShadow(props: TodayShadowProps) {
  const domains = useDomains(undefined, { registrationDay: props.registrationDay, officeList: props.officeList ?? null });
  const reported = useRef(new Set<string>());
  const { actions, choices, rows, now } = props;

  useEffect(() => {
    let live = true;
    void domains.today.view().then((result) => {
      if (!live) return;
      if (!result.ok) {
        console.warn('[today-shadow] the domain Today refused', result.error);
        return;
      }
      const v = result.value;
      const ranked = [...(v.mostImportant ? [v.mostImportant.id] : []), ...v.next.map((n) => n.id)];
      const diff: ShadowDiff = diffToday(domainSide(v, ranked), legacySide({ actions, choices, rows, now }));
      // Once per distinct finding: the clock ticks every minute and a standing difference is one finding.
      const side = domainSide(v, ranked);
      const signature = `${diff.unexplained.join('|')}#${diff.explained.join('|')}#${side.day.join('|')}`;
      if (reported.current.has(signature)) return;
      reported.current.add(signature);
      if (diff.unexplained.length === 0) console.debug('[today-shadow] agrees with the Action Center', { explained: diff.explained, day: side.day, ranked });
      else console.warn('[today-shadow] unexplained differences', diff.unexplained, { explained: diff.explained });
    });
    return () => {
      live = false;
    };
  }, [domains, actions, choices, rows, now]);

  return null;
}
