import type { CourseId, Guide } from '../../lib/types';
import { ECON_GUIDE } from './econ';
import { PSCI_GUIDE } from './psci';
import { CORE_GUIDE } from './core';
import { BUS_GUIDE } from './bus';

export const GUIDES: Record<CourseId, Guide> = {
  econ: ECON_GUIDE,
  psci: PSCI_GUIDE,
  core: CORE_GUIDE,
  bus: BUS_GUIDE,
};

/** What the Cram screen calls the guide's list of exam frames. */
export const FRAME_LABELS: Record<CourseId, string> = {
  econ: 'The traps that cost the most points',
  psci: 'The five questions that keep coming back',
  core: 'The habits that decide the grade',
  bus: 'The case write-up, section by section',
};

/** Time-boxes for "Tonight's 25 minutes". */
export const PLAN_MIN: Record<CourseId, string> = {
  econ: '10 min',
  psci: '8 min',
  core: '5 min',
  bus: '2 min',
};

/** Every card in a guide, flattened, with its unit index — the drill and quiz pool. */
export function allCards(guide: Guide) {
  const out: { q: string; a: string; unit: string; ui: number }[] = [];
  guide.units.forEach((u, ui) => {
    u.cards.forEach((c) => out.push({ q: c.q, a: c.a, unit: u.name, ui }));
  });
  guide.selfTest?.forEach((c) => {
    out.push({ q: c.q, a: c.a, unit: 'Self-test', ui: -1 });
  });
  return out;
}

export function weakestUnit(guide: Guide) {
  let worst = 0;
  guide.units.forEach((u, i) => {
    if (u.mastery < guide.units[worst].mastery) worst = i;
  });
  return { index: worst, unit: guide.units[worst] };
}

export { ECON_GUIDE, PSCI_GUIDE, CORE_GUIDE, BUS_GUIDE };
