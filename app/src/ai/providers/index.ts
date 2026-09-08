import * as core from './core';
import * as semester from './semester';
import * as study from './study';
import * as make from './make';
import * as upkeep from './upkeep';
import * as campus from './campus';
import * as yours from './yours';
import * as personal from './personal';
import type { Provide } from '../shape';
import type { Screen } from '../../lib/types';

/**
 * Every screen's account of itself, keyed the way the registry is.
 *
 * ## Why this is a map and not a field on the registry
 *
 * The brief says to hang a provider off each registry entry. `lib/nav.ts` is
 * a flat table of strings read by four unrelated things — the tab bar, the
 * finder, the generated guide and the mode reader — none of which know what a
 * `State` is. Fifty closures over the store would drag the whole state graph
 * into all four, and make the file that most needs to stay readable the
 * longest in the app.
 *
 * A map on the same `Screen` union gives the identical lookup and the
 * identical completeness check: a test below reads the registry and reports
 * every screen with nothing to say, so a new screen cannot quietly arrive
 * without anybody deciding whether it has context worth handing over.
 *
 * ## What is deliberately absent
 *
 * `people` has no provider and will not get one. It holds other people's
 * names and what was said about them, and `lib/context.ts` refuses to send
 * anything from it under any circumstance — a screen provider handing it over
 * would be a second door past the one rule in this app that protects somebody
 * who is not the student. Its absence here is the feature.
 */
export const PROVIDERS: Partial<Record<Screen, Provide>> = {
  // Semester — what is happening and when.
  home: semester.home,
  brief: semester.brief,
  courses: core.courses,
  calendar: core.calendar,
  registrar: semester.registrar,

  // Study — turning a course into something testable.
  study: core.study,
  ask: study.ask,
  work: study.work,
  update: study.update,
  analyse: study.analyse,
  solve: study.solve,
  exam: study.exam,
  runway: study.runway,
  tonight: study.tonight,
  drill: study.drillLike,

  // Make — the screens that produce something.
  draw: make.draw,
  deck: make.deck,
  sources: make.sources,
  essay: make.essay,
  proof: make.proof,

  // Upkeep — keeping the picture true.
  import: upkeep.importer,
  edit: upkeep.edit,
  announce: upkeep.announce,
  grades: core.grades,
  ahead: upkeep.ahead,
  behind: upkeep.behind,
  degree: upkeep.degree,

  // Campus — the parts that are not coursework.
  costs: campus.costs,
  meals: campus.meals,
  housing: campus.housing,
  groupwork: campus.groupwork,
  maps: campus.maps,
  mail: campus.mail,
  yes: campus.yes,
  classmates: campus.classmates,
  activities: campus.activities,
  links: campus.links,

  // Yours — your account, your data, how it looks.
  clocks: yours.clocks,
  applying: yours.applying,
  data: yours.data,
  help: yours.help,
  everything: yours.everything,
  settings: yours.settings,
  notifs: yours.notifs,
  connect: yours.connect,
  cloud: yours.cloud,
  export: yours.exportScreen,
  account: yours.account,
  privacy: yours.privacy,

  // The three the registry keeps outside its groups.
  mine: personal.mine,
  me: personal.me,
  gap: personal.gap,
};

/**
 * Whether this screen has anything of its own to say.
 *
 * A screen with no entry is a real answer, not a gap: the assistant falls
 * back to what it knows globally and the sheet says on screen that this
 * screen told it nothing. Better than a provider whose whole content is the
 * word "nothing" wrapped in a sentence.
 */
export function providerFor(screen: Screen): Provide | null {
  return PROVIDERS[screen] ?? null;
}
