import { useEffect, useRef } from 'react';
import { compareToday, signatureOf, type Disagreement, type TodayFacts } from '../domains/today';
import type { AppError, Result } from '../domains/composition';
import type { TodayView } from '../domains/today';
import type { Catalog } from '../data/catalog';
import { dateToIso } from '../lib/date';
import { datedItems, tasksOn } from '../lib/select';
import type { PersonalTask } from '../lib/types';
import { DEADLINE_HORIZON_DAYS } from '../lib/today-actions';
import { useDomains } from './domains';
import { useNow, useStore } from './store';

/**
 * Step 3: Today, asked of the domain and of the legacy selectors, and compared.
 *
 * Mounted from `screens/Today.tsx` only when `domainToday` is on, so with the
 * flag off none of this runs and nothing is imported at runtime beyond the
 * module itself. It renders nothing and changes nothing: the screen still draws
 * what the legacy code derives. A disagreement is a `console.warn`, once per
 * distinct disagreement per mount, because the same one on every minute tick
 * would bury the next.
 *
 * Step 4 (the screen reads the domain) is gated on this reporting nothing across
 * the parity fixtures and a week of dogfood.
 */

/** The legacy answer to the three questions `compareToday` asks, from the same selectors Today draws with. */
export function legacyTodayFacts(catalog: Catalog, tasks: PersonalTask[], now: Date): TodayFacts {
  const dated = datedItems(catalog, now);
  return {
    deadlinesToday: dated.filter((i) => i.isToday).map((i) => i.id),
    tasksToday: tasksOn(tasks, now)
      .filter((t) => !t.done)
      .map((t) => t.id),
    deadlinesComingUp: dated
      .filter((i) => !i.isPast && i.daysAway > 0 && i.daysAway <= DEADLINE_HORIZON_DAYS)
      .map((i) => i.id),
  };
}

export interface ShadowReport {
  /** Stable for one disagreement, so a sink can say it once. */
  signature: string;
  summary: string;
}

/**
 * What to say about one comparison, or null when the two agree.
 *
 * A *refusal* is reported too: the domain serves Today to a student only, so on
 * any other role it answers `forbidden` while the legacy screen still draws.
 * That is a real difference between the two, and step 4 has to decide it.
 */
export function describeShadow(day: string, facts: TodayFacts, result: Result<TodayView, AppError>): ShadowReport | null {
  if (!result.ok) {
    return {
      signature: `${day}|refused:${result.error.code}`,
      summary: `the domain refused Today (${result.error.code}) where the screen draws it`,
    };
  }
  const found: Disagreement[] = compareToday(facts, result.value);
  if (found.length === 0) return null;
  return {
    signature: signatureOf(day, found),
    summary: found
      .map((d) => {
        const parts = [
          d.onlyLegacy.length ? `screen only: ${d.onlyLegacy.join(', ')}` : '',
          d.onlyDomain.length ? `domain only: ${d.onlyDomain.join(', ')}` : '',
          d.orderDiffers ? 'same ids, different order' : '',
        ].filter(Boolean);
        return `${d.fact} — ${parts.join('; ')}`;
      })
      .join(' | '),
  };
}

/** Renders nothing. Mount it to run the comparison. */
export function TodayShadow({ log = console.warn }: { log?: (message: string) => void }) {
  const domains = useDomains();
  const { state, catalog } = useStore();
  const now = useNow();
  const told = useRef(new Set<string>());

  useEffect(() => {
    let current = true;
    void domains.today().then((result) => {
      if (!current) return;
      const report = describeShadow(dateToIso(now), legacyTodayFacts(catalog, state.tasks, now), result);
      if (!report || told.current.has(report.signature)) return;
      told.current.add(report.signature);
      log(`[domainToday] shadow disagreement: ${report.summary}`);
    });
    return () => {
      current = false;
    };
  }, [domains, catalog, state.tasks, state.appointments, state.role, now, log]);

  return null;
}
