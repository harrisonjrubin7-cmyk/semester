/**
 * Every place in the app, named once.
 *
 * Three things were each carrying their own private idea of what this app
 * contains: the tab bar knew six screens, the Me screen listed seven buttons,
 * and search knew about deadlines only. So a screen could exist and be
 * reachable and still be unfindable — Files & mail was two taps down a list of
 * identical grey buttons, and typing "email" found nothing at all.
 *
 * This is the one list. The tab bar reads it to know which tab to light up for
 * a screen nested under it, the Me screen renders it as a directory with a
 * sentence saying what each thing is for, and search matches against the
 * labels, the blurbs and the keywords — so "gmail", "powerpoint" and "sync"
 * all land somewhere sensible even though none of those words is a screen
 * name.
 */

import type { Screen } from './types';

export type Group = 'Study' | 'Semester' | 'Yours' | 'Accounts' | 'App';

export interface Destination {
  screen: Screen;
  label: string;
  /** One line, in the second person, saying what you would come here to do. */
  blurb: string;
  /** Words a person might search for that are not in the label or the blurb. */
  keywords: string;
  group: Group;
  /** The tab this lives under, so navigation stays oriented inside it. */
  root: Screen;
}

export const DESTINATIONS: Destination[] = [
  {
    screen: 'home',
    label: 'Today',
    blurb: 'What is due, what is next, and tonight’s study plan.',
    keywords: 'now due soon next class plan agenda',
    group: 'Semester',
    root: 'home',
  },
  {
    screen: 'courses',
    label: 'Courses',
    blurb: 'Every course, its deadlines, its grading and its professor.',
    keywords: 'class syllabus professor office hours grading credits',
    group: 'Semester',
    root: 'courses',
  },
  {
    screen: 'calendar',
    label: 'Calendar',
    blurb: 'Classes and deadlines by day, month or the whole semester.',
    keywords: 'schedule month day week semester timetable events',
    group: 'Semester',
    root: 'calendar',
  },
  {
    screen: 'study',
    label: 'Study',
    blurb: 'Pick a course and a way through it — cards, read, watch, slides.',
    keywords: 'revise revision learn practice guide',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'ask',
    label: 'Ask Claude',
    blurb: 'A question about this course, answered with its guide in hand.',
    keywords: 'ai chat explain help tutor claude',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'work',
    label: 'Work on it',
    blurb: 'Paste an assignment and get it broken down — rubric, plan, dates, what to ask.',
    keywords: 'assignment essay paper homework problem set instructions rubric deadline draft feedback outline plan generate write',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'update',
    label: 'Add a reading',
    blurb: 'New material into a course — and every study mode picks it up.',
    keywords: 'reading add material update new chapter article handout slides lecture notes supplement extra pdf paste attach cards quiz guide refresh keep current course content',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'analyse',
    label: 'Analyse data',
    blurb: 'A CSV in, and the statistics out — computed here, then explained.',
    keywords: 'data analysis statistics stats csv spreadsheet excel mean median average standard deviation sd variance correlation regression ols slope r squared scatter histogram quartile summary descriptive dataset numbers analyse analyze',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'draw',
    label: 'Draw it',
    blurb: 'A graph, a flow, a timeline or a matrix — drawn from what you describe.',
    keywords: 'diagram graph chart draw picture figure visual illustration flowchart curve supply demand axes timeline matrix payoff structure hierarchy causal mermaid svg sketch map model',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'solve',
    label: 'Work the problem',
    blurb: 'The method, worked on other numbers — and your own attempt checked.',
    keywords: 'math maths solve problem set equation calculate algebra derivative statistics elasticity growth rate percentage formula step working check answer wrong show me how practice arithmetic quantitative',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'import',
    label: 'Add a course',
    blurb: 'Upload a syllabus and get the course back, checked before you keep it.',
    keywords: 'new syllabus pdf upload generate create import',
    group: 'Semester',
    root: 'courses',
  },
  {
    screen: 'grades',
    label: 'Grades',
    blurb: 'What you have so far, and what the rest has to average.',
    keywords: 'grade gpa mark score final exam what do i need weighting rubric percent average',
    group: 'Semester',
    root: 'courses',
  },
  {
    screen: 'maps',
    label: 'Getting there',
    blurb: 'A map you can search — campus or the whole city — and directions to anywhere.',
    keywords: 'map maps directions route walk drive transit bus navigate campus nashville where building room address google apple search find location openstreetmap nearby',
    group: 'Semester',
    root: 'maps',
  },
  {
    screen: 'mail',
    label: 'Email',
    blurb: 'Draft the email you have been putting off — extension, question, meeting.',
    keywords: 'email mail write draft professor reply extension office hours absence recommendation letter follow up gmail outlook compose message send',
    group: 'Semester',
    root: 'courses',
  },
  {
    screen: 'yes',
    label: 'YES',
    blurb: 'Registration and class search — and paste your schedule straight back in.',
    keywords: 'yes enrollment enrolment registration register student landing search classes schedule timetable transcript holds advisor commodore vanderbilt add drop credit hours section',
    group: 'Semester',
    root: 'courses',
  },
  {
    screen: 'classmates',
    label: 'Classmates',
    blurb: 'A room per class, for everyone at Vanderbilt taking it.',
    keywords: 'classmates classmate message messages chat talk group groups room people students friends study group discussion ask class peers social connect dm',
    group: 'Semester',
    root: 'courses',
  },
  {
    screen: 'mine',
    label: 'Mine',
    blurb: 'Your own tasks, appointments, notes and files.',
    keywords: 'todo task appointment note file attachment personal',
    group: 'Yours',
    root: 'mine',
  },
  {
    screen: 'me',
    label: 'Me',
    blurb: 'Your load at a glance, and everything else the app can do.',
    keywords: 'profile more menu overview directory',
    group: 'App',
    root: 'me',
  },
  {
    screen: 'account',
    label: 'Account',
    blurb: 'Sign in so the same semester is on your phone and your laptop.',
    keywords: 'sign in log in register sync devices password email',
    group: 'Accounts',
    root: 'me',
  },
  {
    screen: 'connect',
    label: 'Connect accounts',
    blurb: 'Brightspace, Outlook, Google, Zoom, oneVU — calendars and links in.',
    keywords: 'brightspace onevu myvu yes anchorlink outlook microsoft google zoom apple icloud ics feed subscribe claude anthropic api key sign in with claude tickets game football basketball commodores vucommodores instagram twitter x social',
    group: 'Accounts',
    root: 'me',
  },
  {
    screen: 'cloud',
    label: 'Files & mail',
    blurb: 'Pull a reading out of Drive or OneDrive; turn announcements into cards.',
    keywords: 'gmail email drive onedrive sharepoint documents attachments send tasks',
    group: 'Accounts',
    root: 'me',
  },
  {
    screen: 'export',
    label: 'Take it with you',
    blurb: 'Download everything, or push it to Drive or OneDrive.',
    keywords: 'export download backup save csv ics markdown json zip archive google drive onedrive transfer migrate leave copy print spreadsheet excel calendar import restore',
    group: 'App',
    root: 'me',
  },
  {
    screen: 'settings',
    label: 'Settings',
    blurb: 'Navigation, alerts, which courses are loaded.',
    keywords: 'preferences options remove course sample notifications feed tab bar',
    group: 'App',
    root: 'me',
  },
  {
    screen: 'notifs',
    label: 'Alerts',
    blurb: 'What the app would have poked you about.',
    keywords: 'notifications reminders',
    group: 'App',
    root: 'me',
  },
];

/** Screens that are reached from somewhere rather than gone to directly. */
const NESTED: Partial<Record<Screen, Screen>> = {
  course: 'courses',
  edit: 'courses',
  item: 'courses',
  event: 'calendar',
  guide: 'study',
  drill: 'study',
  quiz: 'study',
  lesson: 'study',
  slides: 'study',
  note: 'mine',
  search: 'home',
};

const BY_SCREEN = new Map(DESTINATIONS.map((d) => [d.screen, d]));

/**
 * Which tab a screen belongs under.
 *
 * The tab bar used to vanish on every screen that was not itself a tab, so
 * opening a course guide left Back as the only way anywhere — five taps to
 * reach the calendar from a flashcard. Now the bar stays and this says which
 * tab should look active while you are down inside it.
 */
export function rootOf(screen: Screen): Screen {
  return NESTED[screen] ?? BY_SCREEN.get(screen)?.root ?? 'home';
}

export function destination(screen: Screen): Destination | undefined {
  return BY_SCREEN.get(screen);
}

export function destinationsIn(group: Group): Destination[] {
  return DESTINATIONS.filter((d) => d.group === group);
}
