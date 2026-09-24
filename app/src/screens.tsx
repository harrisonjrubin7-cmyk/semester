import { lazy, type ComponentType } from 'react';
import type { Screen } from './lib/types';

/**
 * Every screen, and the one place a new one is named.
 *
 * `App.tsx` held these as eighty-two `lazy()` consts and an eighty-three-case
 * switch, sixty lines apart, and adding a screen meant remembering both. This
 * is the two of them joined: the import and the render are one row, and a
 * screen that is in the `Screen` union and not in this table does not compile.
 *
 * That last part is the reason this is a `Record` and not a `Map` or a switch.
 * The switch ended `default: return <Today />`, so a screen added to the union
 * and forgotten here rendered Today — silently, on a screen somebody had just
 * built, with nothing failing anywhere. `Record<Exclude<Screen, …>, …>` is
 * exhaustive by construction, so the same mistake is now a type error with the
 * missing id in it.
 *
 * ## The two that are not in the table, and why
 *
 * `home` is not a screen in the sense the others are: which component draws it
 * is a function of the *navigation*, not of `state.screen`, and `App.tsx`
 * resolves that with `homeShape` before it looks here. The springboard and the
 * guides are ways in rather than different apps — every icon goes where the
 * tab bar would have gone — and `Today` reads the same `homeShape` to choose
 * between its two readings of the day, so the three cannot disagree.
 *
 * `onboarding` is drawn above the router rather than inside it: it is what
 * there is instead of the app, not a place in it.
 *
 * ## Why they are still lazy here
 *
 * Every row below is a chunk of its own, exactly as it was in `App.tsx` —
 * moving the declarations did not gather them into one bundle. `Today` is not
 * among them: it is the screen the app opens on, `App.tsx` imports it
 * statically for that reason, and a lazy boundary in front of it would be a
 * spinner on every cold start.
 *
 * See `ENGINEERING-AUDIT.md` §4.
 */

const SearchHome = lazy(() => import('./screens/Search').then((m) => ({ default: m.SearchHome })));
const Directory = lazy(() => import('./screens/Directory').then((m) => ({ default: m.Directory })));
const University = lazy(() => import('./screens/University').then((m) => ({ default: m.University })));
const Athletics = lazy(() => import('./screens/Athletics').then((m) => ({ default: m.Athletics })));
const Nil = lazy(() => import('./screens/Nil').then((m) => ({ default: m.Nil })));
const Career = lazy(() => import('./screens/Career').then((m) => ({ default: m.Career })));
const Family = lazy(() => import('./screens/Family').then((m) => ({ default: m.Family })));
const Pathway = lazy(() => import('./screens/Pathway').then((m) => ({ default: m.Pathway })));
const Create = lazy(() => import('./screens/Create').then((m) => ({ default: m.Create })));
const Privacy = lazy(() => import('./screens/Privacy').then((m) => ({ default: m.Privacy })));
const DataScreen = lazy(() => import('./screens/Data').then((m) => ({ default: m.DataScreen })));
const Help = lazy(() => import('./screens/Help').then((m) => ({ default: m.Help })));
const Courses = lazy(() => import('./screens/Courses').then((m) => ({ default: m.Courses })));
const CourseDetail = lazy(() => import('./screens/Courses').then((m) => ({ default: m.CourseDetail })));
const ItemDetail = lazy(() => import('./screens/Courses').then((m) => ({ default: m.ItemDetail })));
const Calendar = lazy(() => import('./screens/Calendar').then((m) => ({ default: m.Calendar })));
const EventDetail = lazy(() => import('./screens/Calendar').then((m) => ({ default: m.EventDetail })));
const Me = lazy(() => import('./screens/Me').then((m) => ({ default: m.Me })));
const Profile = lazy(() => import('./screens/Profile').then((m) => ({ default: m.Profile })));
const Notifications = lazy(() => import('./screens/Me').then((m) => ({ default: m.Notifications })));
const Settings = lazy(() => import('./screens/settings/Index').then((m) => ({ default: m.Settings })));
const SettingsLook = lazy(() => import('./screens/settings/Look').then((m) => ({ default: m.SettingsLook })));
const SettingsNav = lazy(() => import('./screens/settings/Nav').then((m) => ({ default: m.SettingsNav })));
const SettingsAlerts = lazy(() => import('./screens/settings/Alerts').then((m) => ({ default: m.SettingsAlerts })));
const SettingsCourses = lazy(() => import('./screens/settings/Courses').then((m) => ({ default: m.SettingsCourses })));
const SettingsGrading = lazy(() => import('./screens/settings/Grading').then((m) => ({ default: m.SettingsGrading })));
const SettingsWorkload = lazy(() => import('./screens/settings/Workload').then((m) => ({ default: m.SettingsWorkload })));
const SettingsAbout = lazy(() => import('./screens/settings/About').then((m) => ({ default: m.SettingsAbout })));
const SettingsAssistant = lazy(() => import('./screens/settings/Assistant').then((m) => ({ default: m.SettingsAssistant })));
const Mine = lazy(() => import('./screens/Mine').then((m) => ({ default: m.Mine })));
const NoteEditor = lazy(() => import('./screens/Mine').then((m) => ({ default: m.NoteEditor })));
const Import = lazy(() => import('./screens/Import').then((m) => ({ default: m.Import })));
const Study = lazy(() => import('./screens/Study').then((m) => ({ default: m.Study })));
const Guide = lazy(() => import('./screens/Guide').then((m) => ({ default: m.Guide })));
const Drill = lazy(() => import('./screens/Drill').then((m) => ({ default: m.Drill })));
const Guess = lazy(() => import('./screens/Guess').then((m) => ({ default: m.Guess })));
const Quiz = lazy(() => import('./screens/Drill').then((m) => ({ default: m.Quiz })));
const LessonPlayer = lazy(() => import('./screens/Lesson').then((m) => ({ default: m.LessonPlayer })));
const AddMaterial = lazy(() => import('./screens/Update').then((m) => ({ default: m.AddMaterial })));
const Connect = lazy(() => import('./screens/Connect').then((m) => ({ default: m.Connect })));
const Links = lazy(() => import('./screens/Links').then((m) => ({ default: m.Links })));
const Ask = lazy(() => import('./ai/Chat').then((m) => ({ default: m.Chat })));
const Work = lazy(() => import('./screens/Work').then((m) => ({ default: m.Work })));
const Maps = lazy(() => import('./screens/Maps').then((m) => ({ default: m.Maps })));
const Mail = lazy(() => import('./screens/Mail').then((m) => ({ default: m.Mail })));
const Export = lazy(() => import('./screens/Export').then((m) => ({ default: m.Export })));
const Yes = lazy(() => import('./screens/Yes').then((m) => ({ default: m.Yes })));
const Draw = lazy(() => import('./screens/Draw').then((m) => ({ default: m.Draw })));
const Solve = lazy(() => import('./screens/Solve').then((m) => ({ default: m.Solve })));
const EditCourse = lazy(() => import('./screens/EditCourse').then((m) => ({ default: m.EditCourse })));
const Analyse = lazy(() => import('./screens/Analyse').then((m) => ({ default: m.Analyse })));
const Classmates = lazy(() => import('./screens/Classmates').then((m) => ({ default: m.Classmates })));
const Activities = lazy(() => import('./screens/Activities').then((m) => ({ default: m.Activities })));
const Clocks = lazy(() => import('./screens/Clocks').then((m) => ({ default: m.Clocks })));
const Proof = lazy(() => import('./screens/Proof').then((m) => ({ default: m.Proof })));
const Applying = lazy(() => import('./screens/Applying').then((m) => ({ default: m.Applying })));
const Behind = lazy(() => import('./screens/Behind').then((m) => ({ default: m.Behind })));
const Degree = lazy(() => import('./screens/Degree').then((m) => ({ default: m.Degree })));
const Meet = lazy(() => import('./screens/Meet').then((m) => ({ default: m.Meet })));
const People = lazy(() => import('./screens/People').then((m) => ({ default: m.People })));
const Reports = lazy(() => import('./screens/Reports').then((m) => ({ default: m.Reports })));
const Essay = lazy(() => import('./screens/Essay').then((m) => ({ default: m.Essay })));
const Deck = lazy(() => import('./screens/Deck').then((m) => ({ default: m.Deck })));
const Write = lazy(() => import('./screens/Write').then((m) => ({ default: m.Write })));
const SheetScreen = lazy(() => import('./screens/Sheet').then((m) => ({ default: m.Sheet })));
const Equations = lazy(() => import('./screens/Equations').then((m) => ({ default: m.Equations })));
const Exam = lazy(() => import('./screens/Exam').then((m) => ({ default: m.Exam })));
const Changes = lazy(() => import('./screens/Changes').then((m) => ({ default: m.Changes })));
const Costs = lazy(() => import('./screens/Costs').then((m) => ({ default: m.Costs })));
const Gap = lazy(() => import('./screens/Gap').then((m) => ({ default: m.Gap })));
const Groupwork = lazy(() => import('./screens/Groupwork').then((m) => ({ default: m.Groupwork })));
const Call = lazy(() => import('./screens/call/Index').then((m) => ({ default: m.Call })));
const Meals = lazy(() => import('./screens/Meals').then((m) => ({ default: m.Meals })));
const Housing = lazy(() => import('./screens/Housing').then((m) => ({ default: m.Housing })));
const Runway = lazy(() => import('./screens/Runway').then((m) => ({ default: m.Runway })));
const Registrar = lazy(() => import('./screens/Registrar').then((m) => ({ default: m.Registrar })));
const Sources = lazy(() => import('./screens/Sources').then((m) => ({ default: m.Sources })));
const AccountScreen = lazy(() => import('./screens/Account').then((m) => ({ default: m.AccountScreen })));
const SlideDeck = lazy(() => import('./screens/Slides').then((m) => ({ default: m.SlideDeck })));
export const Springboard = lazy(() => import('./screens/Springboard').then((m) => ({ default: m.Springboard })));
export const Guides = lazy(() => import('./screens/Guides').then((m) => ({ default: m.Guides })));
export const InstitutionalPreviewBar = lazy(() =>
  import('./components/InstitutionalPreviewBar').then((m) => ({ default: m.InstitutionalPreviewBar })),
);

/**
 * The component for a screen, keyed by the id the router holds.
 *
 * Exhaustive over the union minus the two above, so this table and
 * `lib/types.ts` cannot drift apart without `tsc` saying which id is missing.
 */
export const SCREENS: Record<Exclude<Screen, 'home' | 'onboarding'>, ComponentType> = {
  search: SearchHome,
  directory: Directory,
  university: University,
  athletics: Athletics,
  nil: Nil,
  career: Career,
  family: Family,
  pathway: Pathway,
  create: Create,
  privacy: Privacy,
  data: DataScreen,
  help: Help,
  courses: Courses,
  course: CourseDetail,
  item: ItemDetail,
  calendar: Calendar,
  event: EventDetail,
  me: Me,
  profile: Profile,
  notifs: Notifications,
  settings: Settings,
  setLook: SettingsLook,
  setNav: SettingsNav,
  setAlerts: SettingsAlerts,
  setCourses: SettingsCourses,
  setGrading: SettingsGrading,
  setWorkload: SettingsWorkload,
  setAbout: SettingsAbout,
  setAssistant: SettingsAssistant,
  mine: Mine,
  note: NoteEditor,
  import: Import,
  study: Study,
  guide: Guide,
  drill: Drill,
  guess: Guess,
  quiz: Quiz,
  lesson: LessonPlayer,
  update: AddMaterial,
  connect: Connect,
  links: Links,
  ask: Ask,
  work: Work,
  maps: Maps,
  mail: Mail,
  export: Export,
  yes: Yes,
  draw: Draw,
  solve: Solve,
  edit: EditCourse,
  analyse: Analyse,
  classmates: Classmates,
  activities: Activities,
  clocks: Clocks,
  proof: Proof,
  applying: Applying,
  behind: Behind,
  degree: Degree,
  meet: Meet,
  people: People,
  brief: Reports,
  essay: Essay,
  deck: Deck,
  write: Write,
  sheet: SheetScreen,
  equations: Equations,
  exam: Exam,
  announce: Changes,
  costs: Costs,
  gap: Gap,
  groupwork: Groupwork,
  call: Call,
  meals: Meals,
  housing: Housing,
  runway: Runway,
  registrar: Registrar,
  sources: Sources,
  account: AccountScreen,
  slides: SlideDeck,
};
