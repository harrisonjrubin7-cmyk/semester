/**
 * Which glyph a screen draws itself with.
 *
 * Split out of `TabIcon.tsx` because two callers now need the answer and only
 * one of them wants a rendered element: the launcher's tiles carry a cluster
 * of glyphs and have to tell two apart, since only ten of the fifty-five
 * screens have one of their own and the rest fall back to their shelf's — a
 * cluster taken naively is the same little drawing three times.
 *
 * A module of its own rather than another export beside the component, so
 * fast refresh keeps working on the file that draws things.
 */

import {
  Bell,
  CalendarIcon,
  CampusIcon,
  Check,
  CoursesIcon,
  MakeIcon,
  MapIcon,
  NotesIcon,
  Person,
  Search,
  StudyIcon,
  TodayIcon,
  UpkeepIcon,
} from './Icons';
import { destination, type Group } from '../lib/nav';
import type { Screen } from '../lib/types';

type Glyph = typeof TodayIcon;

/** Screens with an icon of their own, mostly because they shipped in the bar. */
const OWN: Partial<Record<Screen, Glyph>> = {
  home: TodayIcon,
  courses: CoursesIcon,
  study: StudyIcon,
  calendar: CalendarIcon,
  maps: MapIcon,
  mine: NotesIcon,
  me: Person,
  notifs: Bell,
  search: Search,
};

const SHELF: Record<Group, Glyph> = {
  Semester: CalendarIcon,
  Courses: CoursesIcon,
  Study: StudyIcon,
  Make: MakeIcon,
  // Standing is where you find out how it is going, and the tick is the mark
  // the app uses for a thing settled — a grade in, a week worked.
  Standing: Check,
  Campus: CampusIcon,
  // Life is the term around the coursework, and Mine is the largest thing on
  // it, so it lends its glyph the way Study and Make do.
  Life: NotesIcon,
  You: Person,
  // Upkeep's glyph outlived Upkeep. Data is what that shelf actually held —
  // the accounts, the copies, the export — so it keeps the wrench.
  Data: UpkeepIcon,
};

/**
 * The glyph component for a screen. Stable per screen, so two compare.
 *
 * The drawn icon where one exists, and otherwise the icon of the shelf the
 * screen sits on. A screen that is in the bar but not in the directory should
 * be impossible — `readTabs` drops those — so the last fallback is for a
 * caller that got here another way, not for a state the app can reach.
 */
export function glyphFor(screen: Screen): Glyph {
  const own = OWN[screen];
  if (own) return own;
  const group = destination(screen)?.group;
  return group ? SHELF[group] : NotesIcon;
}
