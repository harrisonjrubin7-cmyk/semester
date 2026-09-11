/**
 * Which glyph a screen draws itself with.
 *
 * Split out of `TabIcon.tsx` because two callers now need the answer and only
 * one of them wants a rendered element: the launcher's tiles carry a cluster
 * of glyphs and have to tell two apart, since most of the fifty-five screens
 * have no drawing of their own and fall back to their shelf's — a cluster
 * taken naively is the same little drawing three times.
 *
 * A module of its own rather than another export beside the component, so
 * fast refresh keeps working on the file that draws things.
 */

import {
  AccountIcon,
  ActivitiesIcon,
  AheadIcon,
  AnalyseIcon,
  AnnounceIcon,
  ApplyingIcon,
  AskIcon,
  BehindIcon,
  Bell,
  BriefIcon,
  CalendarIcon,
  CallIcon,
  CampusIcon,
  ClassmatesIcon,
  ClocksIcon,
  ConnectIcon,
  CostsIcon,
  CoursesIcon,
  DataIcon,
  DeckIcon,
  DegreeIcon,
  DrawIcon,
  EditIcon,
  EquationsIcon,
  EssayIcon,
  ExamIcon,
  ExportIcon,
  GroupworkIcon,
  HelpIcon,
  HousingIcon,
  ImportIcon,
  LinksIcon,
  MailIcon,
  MakeIcon,
  MapIcon,
  MealsIcon,
  MeetIcon,
  NotesIcon,
  PeopleIcon,
  Person,
  PrivacyIcon,
  ProfileIcon,
  ProofIcon,
  RegistrarIcon,
  RunwayIcon,
  SettingsIcon,
  SheetIcon,
  SolveIcon,
  SourcesIcon,
  StudyIcon,
  TodayIcon,
  TonightIcon,
  UpdateIcon,
  UpkeepIcon,
  WorkIcon,
  WriteIcon,
  YesIcon,
} from './Icons';
import { destination, type Group } from '../lib/nav';
import type { Screen } from '../lib/types';

type Glyph = typeof TodayIcon;

/**
 * Screens with an icon of their own.
 *
 * The first nine shipped in the bar. The thirteen after them are the tools,
 * drawn when the Tools tab became a home screen: a grid of icons and names is
 * only worth having if the icons differ, and thirteen screens falling back to
 * a book and a pen nib would have been the same picture over and over. They
 * are listed here rather than in that tab because the answer belongs to the
 * screen — the bar and the launcher draw them now too.
 */
const OWN: Partial<Record<Screen, Glyph>> = {
  home: TodayIcon,
  courses: CoursesIcon,
  study: StudyIcon,
  calendar: CalendarIcon,
  maps: MapIcon,
  mine: NotesIcon,
  me: Person,
  // The ringed figure, so the two never read as the same screen in the bar:
  // `me` is the progress report and the directory, this is you.
  profile: ProfileIcon,
  notifs: Bell,

  ask: AskIcon,
  work: WorkIcon,
  update: UpdateIcon,
  analyse: AnalyseIcon,
  draw: DrawIcon,
  solve: SolveIcon,
  exam: ExamIcon,
  deck: DeckIcon,
  write: WriteIcon,
  sheet: SheetIcon,
  equations: EquationsIcon,
  sources: SourcesIcon,
  essay: EssayIcon,
  runway: RunwayIcon,
  mail: MailIcon,
  proof: ProofIcon,

  /*
   * And the rest of the app, drawn when the header launcher put every screen
   * on one grid — see the note in `icons.data.ts`. `SHELF` below is now what
   * it was always described as: the answer for a screen nobody has drawn
   * yet, which is currently none of them.
   */
  brief: BriefIcon,
  ahead: AheadIcon,
  behind: BehindIcon,
  tonight: TonightIcon,
  degree: DegreeIcon,
  import: ImportIcon,
  edit: EditIcon,
  registrar: RegistrarIcon,
  announce: AnnounceIcon,
  meet: MeetIcon,
  call: CallIcon,
  groupwork: GroupworkIcon,
  meals: MealsIcon,
  housing: HousingIcon,
  yes: YesIcon,
  classmates: ClassmatesIcon,
  costs: CostsIcon,
  people: PeopleIcon,
  applying: ApplyingIcon,
  clocks: ClocksIcon,
  links: LinksIcon,
  account: AccountIcon,
  connect: ConnectIcon,
  data: DataIcon,
  privacy: PrivacyIcon,
  export: ExportIcon,
  settings: SettingsIcon,
  help: HelpIcon,
  activities: ActivitiesIcon,
};

const SHELF: Record<Group, Glyph> = {
  Semester: CalendarIcon,
  Courses: CoursesIcon,
  Study: StudyIcon,
  Make: MakeIcon,
  Campus: CampusIcon,
  // Life is the term around the coursework, and Mine is the largest thing on
  // it, so it lends its glyph the way Study and Make do.
  Life: NotesIcon,
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

/**
 * Up to `limit` screens whose glyphs differ, for a tile that stands for many.
 *
 * Twenty-two of the fifty-five screens have a glyph of their own; the rest
 * fall back to their shelf's. So the first three screens on a shelf — or
 * under an intention — are often the same drawing three times, which reads as
 * a decorative flourish rather than as a cluster of what is inside. One glyph
 * is a truer answer than three copies of it.
 *
 * It was the launcher's, privately, until the task index grew tiles of its
 * own. Two clusters drawn by two rules would differ in exactly the way nobody
 * could name, so there is one rule and it lives beside the glyphs.
 */
export function distinctGlyphs(screens: Screen[], limit = 3): Screen[] {
  const out: Screen[] = [];
  const seen = new Set<Glyph>();
  for (const screen of screens) {
    const glyph = glyphFor(screen);
    if (seen.has(glyph)) continue;
    seen.add(glyph);
    out.push(screen);
    if (out.length === limit) break;
  }
  return out;
}
