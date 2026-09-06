import { cardKey } from '../lib/review';
import type { Catalog } from '../data/catalog';
import type { State } from '../state/shape';
import type { Facts } from './types';

/**
 * The one place state becomes what an insight is allowed to read.
 *
 * Insights take `Facts` and not the store, so that each is a pure function of
 * a small, named input — testable without a provider, identical offline, and
 * unable to quietly start reading something nobody expected it to.
 *
 * `unitOf` is the only thing here that is more than a rename. An answer
 * records the card it was about, and a card's key is a hash of the question,
 * so finding the unit means walking the guide once. Built as a lookup rather
 * than searched per answer: a term of drilling is a few thousand answers, and
 * this is called on a screen somebody expects to open instantly.
 */
export function factsFrom(state: State, catalog: Catalog, now: Date): Facts {
  const units = new Map<string, string>();
  for (const module of catalog.modules) {
    for (const unit of module.guide.units) {
      for (const card of unit.cards) {
        units.set(`${module.course.id}::${cardKey(module.course.id, card.q)}`, unit.name);
      }
    }
  }
  for (const update of state.updates) {
    const module = catalog.moduleById[update.courseId];
    const name =
      update.unit !== null ? (module?.guide.units[update.unit]?.name ?? update.title) : update.title;
    for (const card of update.cards) {
      units.set(`${update.courseId}::${cardKey(update.courseId, card.q)}`, name);
    }
  }

  return {
    now,
    courses: catalog.courses,
    items: catalog.items,
    scores: state.grades,
    pieces: state.pieces,
    drops: state.drops,
    attendance: state.attendance,
    attendPolicy: state.attendPolicy,
    answers: state.answers,
    spent: state.spent,
    unitOf: (courseId, key) => units.get(`${courseId}::${key}`) ?? '',
    codeOf: (courseId) => catalog.byId[courseId]?.code ?? courseId,
  };
}
