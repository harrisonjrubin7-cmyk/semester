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

/**
 * The shelves the directory is arranged on.
 *
 * Six, and each one small enough to be a tab rather than a section of a long
 * scroll. "Semester" used to hold ten unrelated things — the calendar, the
 * campus map, email, registration — because it was the only shelf wide enough
 * to take them. Splitting Make and Campus out is what lets Me show one shelf
 * at a time instead of all of them at once.
 *
 * Then Semester filled up again, at ten, while Make sat at four. The split
 * this time is between the term and the work of maintaining it: Semester is
 * the four things that *are* your term — today, the week, your courses, the
 * calendar — and Upkeep is the six you go to when something needs correcting,
 * adding or checking. Nobody opens "Check the dates" as part of their day.
 */
export type Group = 'Study' | 'Make' | 'Semester' | 'Upkeep' | 'Campus' | 'Yours';

export interface Destination {
  screen: Screen;
  label: string;
  /**
   * The name for the bottom bar, where there is room for about nine
   * characters and no room for a sentence.
   *
   * The directory can afford "Fold in an announcement", which says what you
   * would come here to do; a 57px tab cannot, and abbreviating at render time
   * would produce "Fold in an…". Set only where the label is too long — the
   * label is used as-is otherwise, so this does not have to be maintained for
   * every screen. See `lib/tabbar.ts`.
   */
  short?: string;
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
    screen: 'brief',
    label: 'Your day',
    blurb: 'A start-of-day and an end-of-day report — what is due, and what got done.',
    keywords: 'brief briefing report daily day start end morning evening summary recap review standup what is due what did i do plan wrap up',
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
    short: 'Ask',
    blurb: 'A question about this course, answered with its guide in hand.',
    keywords: 'ai chat explain help tutor claude',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'work',
    label: 'Work on it',
    short: 'Work',
    blurb: 'Paste an assignment and get it broken down — rubric, plan, dates, what to ask.',
    keywords: 'assignment essay paper homework problem set instructions rubric deadline draft feedback outline plan generate write',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'update',
    label: 'Add a reading',
    short: 'Material',
    blurb: 'New material into a course — and every study mode picks it up.',
    keywords: 'reading add material update new chapter article handout slides lecture notes supplement extra pdf paste attach cards quiz guide refresh keep current course content',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'analyse',
    label: 'Analyse data',
    short: 'Analyse',
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
    group: 'Make',
    root: 'study',
  },
  {
    screen: 'solve',
    label: 'Work the problem',
    short: 'Solve',
    blurb: 'The method, worked on other numbers — and your own attempt checked.',
    keywords: 'math maths solve problem set equation calculate algebra derivative statistics elasticity growth rate percentage formula step working check answer wrong show me how practice arithmetic quantitative',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'exam',
    label: 'Practice paper',
    short: 'Paper',
    blurb: 'A paper with a shape, a total and a clock — sat, then marked against a key.',
    keywords: 'practice test exam quiz paper mock midterm final past paper questions multiple choice short answer essay question mark marking key revision revise study test generator sit timed',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'deck',
    label: 'Make a deck',
    short: 'Deck',
    blurb: 'A real PowerPoint file — from a unit you have, or from a brief.',
    keywords: 'slides slideshow deck powerpoint pptx keynote google slides presentation present talk pitch briefing bullets speaker notes export slide',
    group: 'Make',
    root: 'study',
  },
  {
    screen: 'sources',
    label: 'Sources',
    blurb: 'Every reading you have kept, with what each is for — and out as BibTeX.',
    keywords: 'source sources citation citations bibliography reference references reading list bibtex zotero overleaf works cited quote author year paper article book cite',
    group: 'Make',
    root: 'study',
  },
  {
    screen: 'essay',
    label: 'Draft it',
    blurb: 'A real draft for a cover letter, a statement, a newsletter — not coursework.',
    keywords: 'essay write writing draft cover letter application internship job resume personal statement scholarship fellowship op-ed blog newsletter pitch memo prose compose generator',
    group: 'Make',
    root: 'study',
  },
  {
    screen: 'import',
    label: 'Add a course',
    short: 'Import',
    blurb: 'Upload a syllabus and get the course back, checked before you keep it.',
    keywords: 'new syllabus pdf upload generate create import',
    group: 'Upkeep',
    root: 'courses',
  },
  {
    // Reachable from a course, and now by name. Several screens tell you to
    // "record it under Edit the course" — the essay tool's AI-policy check
    // most of all — and until this was listed, searching those words found
    // nothing.
    screen: 'edit',
    label: 'Edit the course',
    short: 'Edit',
    blurb: 'A syllabus is a first draft — fix dates, weightings, rooms and the AI policy.',
    keywords: 'edit change fix correct course syllabus date moved weighting grading room professor email meets credits delete deadline add assignment ai policy allowed banned rules',
    group: 'Upkeep',
    root: 'courses',
  },
  {
    screen: 'registrar',
    label: 'Term deadlines',
    short: 'Dates',
    blurb: 'Add/drop, withdrawal, registration — the dates your registrar sets, not a syllabus.',
    keywords: 'registrar term deadline add drop withdraw withdrawal pass fail audit registration enrol enroll academic calendar reading days finals exam period evaluations grades posted last day university school important dates w transcript',
    group: 'Semester',
    root: 'calendar',
  },
  {
    screen: 'announce',
    label: 'Fold in an announcement',
    short: 'Notices',
    blurb: 'Paste the email that moved a deadline, and take the changes one at a time.',
    keywords: 'announcement announce email post update moved change changed cancelled canceled postponed rescheduled deadline date shift new due date brightspace canvas notice message professor said class email paste',
    group: 'Upkeep',
    root: 'courses',
  },
  {
    screen: 'costs',
    label: 'What this term cost',
    short: 'Costs',
    blurb: 'Books, fees and access codes, with what came back — and what the same course cost last time.',
    keywords: 'cost costs money price prices textbook textbooks book books buy rent rental sell back buyback bookstore fee fees access code clicker supplies spend spending budget expense expenses receipt total how much',
    group: 'Campus',
    root: 'courses',
  },
  {
    screen: 'groupwork',
    label: 'Group work',
    short: 'Group',
    blurb: 'The shared list for a group project — who has which part, and whether it lands.',
    keywords: 'group groups project team partner partners case study shared checklist divide split parts sections who is doing what deliverable presentation together collaborate classmates group chat assignment split up',
    group: 'Campus',
    root: 'courses',
  },
  {
    screen: 'meals',
    label: 'Meal plan',
    blurb: 'Swipes and Commodore Cash, with what they are a day and the week they run out.',
    keywords: 'meal meals plan swipes swipe commodore cash dining dollars money balance cbord get food eat eating board plan munchie mart declined out of run out',
    group: 'Campus',
    root: 'me',
  },
  {
    screen: 'housing',
    label: 'Housing',
    blurb: 'Your room, and the move-out date counted from your last exam rather than left as a rule.',
    keywords: 'housing residence hall dorm dormitory room roommate starrez move out moveout move in movein assignment building live living address selection lottery timeslot storage checkout check out key keys',
    group: 'Campus',
    root: 'me',
  },
  {
    screen: 'runway',
    label: 'Exam runway',
    short: 'Runway',
    blurb: 'The weeks before an exam, counted backwards from it — and what stands in the way.',
    keywords: 'exam runway midterm final revision revise cram countdown prepare preparation study plan weeks before how long until ready readiness test',
    group: 'Study',
    root: 'study',
  },
  {
    screen: 'worked',
    label: 'What worked',
    short: 'Worked',
    blurb: 'The end of a term, read back from your own evidence — and silent where the evidence is thin.',
    keywords: 'what worked end of term semester review retrospective looking back reflection how did it go study habits pattern patterns evidence december finals over improve next term learn about myself',
    group: 'Upkeep',
    root: 'home',
  },
  {
    screen: 'weekly',
    label: 'Weekly report',
    short: 'Weekly',
    blurb: 'The week that happened and the one coming — finished, slipped, drilled, sat.',
    keywords: 'weekly week report review recap summary sunday end of week retrospective what happened how did the week go progress last week next week',
    group: 'Upkeep',
    root: 'home',
  },
  {
    screen: 'ahead',
    label: 'The week ahead',
    short: 'Ahead',
    blurb: 'The next seven days in hours — what is promised, what is due, where the room is.',
    keywords: 'week ahead next seven days forecast load hours busy workload plan planning free time capacity schedule how much time commitments heaviest day room',
    group: 'Upkeep',
    root: 'home',
  },
  {
    screen: 'check',
    label: 'Check the dates',
    short: 'Check',
    blurb: 'Your syllabus dates against what the LMS calendar says today.',
    keywords: 'check dates changed moved deadline reconcile compare diff brightspace calendar feed ics syllabus out of date wrong date updated rescheduled verify audit',
    group: 'Upkeep',
    root: 'courses',
  },
  {
    screen: 'grades',
    label: 'Grades',
    blurb: 'What you have so far, and what the rest has to average.',
    keywords: 'grade gpa mark score final exam what do i need weighting rubric percent average',
    group: 'Upkeep',
    root: 'courses',
  },
  {
    screen: 'maps',
    label: 'Getting there',
    short: 'Map',
    blurb: 'A map you can search — campus or the whole city — and directions to anywhere.',
    keywords: 'map maps directions route walk drive transit bus navigate campus nashville where building room address google apple search find location openstreetmap nearby',
    group: 'Campus',
    root: 'maps',
  },
  {
    screen: 'mail',
    label: 'Email',
    blurb: 'Draft the email you have been putting off — extension, question, meeting.',
    keywords: 'email mail write draft professor reply extension office hours absence recommendation letter follow up gmail outlook compose message send',
    group: 'Campus',
    root: 'courses',
  },
  {
    screen: 'yes',
    label: 'YES',
    blurb: 'Registration and class search — and paste your schedule straight back in.',
    keywords: 'yes enrollment enrolment registration register student landing search classes schedule timetable transcript holds advisor commodore vanderbilt add drop credit hours section',
    group: 'Campus',
    root: 'courses',
  },
  {
    screen: 'classmates',
    label: 'Classmates',
    short: 'Class',
    blurb: 'A room per class, for everyone at Vanderbilt taking it.',
    keywords: 'classmates classmate message messages chat talk group groups room people students friends study group discussion ask class peers social connect dm',
    group: 'Campus',
    root: 'courses',
  },
  {
    screen: 'activities',
    label: 'Activities',
    short: 'Clubs',
    blurb: 'Clubs, a job, research, a chapter, a team — and what the week really costs.',
    keywords: 'extracurricular extracurriculars activity activities club clubs organization organisation org research lab job work shift employment fraternity sorority greek chapter rush intramural im club sport varsity athletics team practice volunteer service music theatre arts anchorlink involvement commitment hours load',
    group: 'Campus',
    root: 'mine',
  },
  {
    screen: 'behind',
    label: 'When you are behind',
    short: 'Behind',
    blurb: 'What has gone by, what still fits, and the moves that are not working harder.',
    keywords: 'behind late overdue missed catch up caught up triage bad week overwhelmed stressed stress panic drowning too much falling behind help extension late policy recover crisis sick',
    group: 'Upkeep',
    root: 'home',
  },
  {
    screen: 'tonight',
    label: 'Tonight',
    blurb: 'How long you have, and where those hours buy the most against your grade.',
    keywords: 'tonight evening plan priority prioritise prioritize what should i do first order effort allocation worth it points per hour six hours study plan triage decide choose',
    group: 'Study',
    root: 'home',
  },
  {
    screen: 'applying',
    label: 'Applications',
    short: 'Apply',
    blurb: 'Internships, jobs and research posts — the deadlines that land on the same days as your coursework.',
    keywords: 'internship internships job jobs application applications apply applied recruiting recruitment career careers offer interview interviews resume cv cover letter fellowship scholarship grad school research assistant ra summer analyst deadline pipeline tracker handshake linkedin networking coffee chat referral',
    group: 'Yours',
    root: 'mine',
  },
  {
    screen: 'proof',
    label: 'Check the writing',
    short: 'Check',
    blurb: 'Spelling, grammar and punctuation read back to you — before somebody else reads it.',
    keywords: 'spell check spelling spellcheck grammar grammar check proofread proofreading proof read punctuation typo typos writing editor edit check my writing mistakes errors comma apostrophe capitalisation capitalization word choice',
    group: 'Make',
    root: 'me',
  },
  {
    screen: 'clocks',
    label: 'Timers and alarms',
    short: 'Timers',
    blurb: 'A countdown for anything, and an alarm at a time. Nothing to do with your courses.',
    keywords: 'timer timers alarm alarms clock countdown stopwatch minutes egg kitchen wake up wake me nap ring ringing remind reminder pomodoro count down set a timer set an alarm snooze',
    group: 'Yours',
    root: 'mine',
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
    group: 'Yours',
    root: 'me',
  },
  {
    screen: 'account',
    label: 'Account',
    blurb: 'Sign in so the same semester is on your phone and your laptop.',
    keywords: 'sign in log in register sync devices password email',
    group: 'Yours',
    root: 'me',
  },
  {
    screen: 'connect',
    label: 'Connect accounts',
    short: 'Connect',
    blurb: 'Brightspace, Outlook, Google, Zoom, oneVU — calendars and links in.',
    keywords: 'brightspace onevu myvu yes anchorlink outlook microsoft google zoom apple icloud ics feed subscribe claude anthropic api key sign in with claude tickets game football basketball commodores vucommodores instagram twitter x social',
    group: 'Yours',
    root: 'me',
  },
  {
    screen: 'cloud',
    label: 'Files & mail',
    short: 'Cloud',
    blurb: 'Pull a reading out of Drive or OneDrive; turn announcements into cards.',
    keywords: 'gmail email drive onedrive sharepoint documents attachments send tasks',
    group: 'Yours',
    root: 'me',
  },
  {
    screen: 'export',
    label: 'Take it with you',
    short: 'Export',
    blurb: 'Download everything, or push it to Drive or OneDrive.',
    keywords: 'export download backup save csv ics markdown json zip archive google drive onedrive transfer migrate leave copy print spreadsheet excel calendar import restore',
    group: 'Yours',
    root: 'me',
  },
  {
    screen: 'settings',
    label: 'Settings',
    blurb: 'Navigation, alerts, which courses are loaded.',
    keywords: 'preferences options remove course sample notifications feed tab bar',
    group: 'Yours',
    root: 'me',
  },
  {
    screen: 'notifs',
    label: 'Alerts',
    blurb: 'What the app would have poked you about.',
    keywords: 'notifications reminders',
    group: 'Yours',
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
