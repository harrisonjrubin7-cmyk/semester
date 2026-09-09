/**
 * Every place in the app, named once.
 *
 * Three things were each carrying their own private idea of what this app
 * contains: the tab bar knew six screens, the Me screen listed seven buttons,
 * and search knew about deadlines only. So a screen could exist and be
 * reachable and still be unfindable — Connect accounts was two taps down a
 * list of identical grey buttons, and typing "email" found nothing at all.
 *
 * This is the one list. The tab bar reads it to know which tab to light up for
 * a screen nested under it, the Me screen renders it as a directory with a
 * sentence saying what each thing is for, and search matches against the
 * labels, the blurbs and the keywords — so "gmail", "powerpoint" and "sync"
 * all land somewhere sensible even though none of those words is a screen
 * name.
 */

import type { Screen } from './types';
import { allowed, cardName, lmsName, showsCash, showsSwipes, swipeUnit, type Capabilities } from './school';
import { showing, type Facts } from './reveal';

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
 *
 * Nine then, because six could not be drawn. Yours had grown to fifteen, which
 * is not a row of pills on a phone at any text size — it is a scroll with no
 * end in sight, which is the thing shelves exist to stop. Upkeep held "how am
 * I doing" beside "fix my data", two questions asked on different days;
 * Standing took the first and Data the second. Study held learning and
 * producing together, so Make takes the producing.
 *
 * Grouped by what the student is doing rather than by where a screen was
 * filed before, so several cross the old boundaries: Tonight and Ahead answer
 * "what now" and sit under Semester; Mail is drafting, so it sits beside
 * Draft it under Make; Costs is money rather than a campus service.
 *
 * ## Eight, because Standing wore out
 *
 * Standing was three screens and shrinking — the assistant screens moved to
 * Study and the calendar work moved to Semester, and what was left was Grades,
 * The degree and When you are behind. A shelf of three is worse than no shelf:
 * it costs a pill in the row and a tile in the grid to hold a third of what
 * every other shelf holds, and "which of these nine is it under" gets harder
 * for every shelf that exists, not just the full ones.
 *
 * Grades and When you are behind fold into Semester, where the question was
 * already being asked — Reports is a Semester screen and carries the `stand`
 * tag. Semester is your term, and how it is going is part of your term. It
 * also puts The week ahead and When you are behind next to each other, which
 * is where two screens that answer the same question in opposite directions
 * should always have been.
 *
 * The degree goes to Courses instead. It was the one of the three that is not
 * about this term — what is left of a major, what each course counts towards,
 * where the hours stand — and Semester is a term. Courses is where the things
 * it counts are, and it sits directly under the course list for that reason:
 * the four courses, then what they add up to, then the admin that keeps them
 * true.
 *
 * The largest is eight and the smallest five, which is what keeps any one
 * shelf drawable as a single row.
 */
export type Group =
  | 'Semester'
  | 'Courses'
  | 'Study'
  | 'Make'
  | 'Campus'
  | 'Life'
  | 'You'
  | 'Data';

/**
 * The shelves in the order they are shown.
 *
 * One list, exported, because three files had each written their own copy —
 * the tab chooser, the guidebook and the Everything screen — and a shelf
 * added to the registry appeared in none of them until all three were edited.
 * A regrouping is exactly the change that finds that bug, so the copies are
 * gone and this is the order.
 */
export const GROUPS: Group[] = [
  'Semester',
  'Courses',
  'Study',
  'Make',
  'Campus',
  'Life',
  'You',
  'Data',
];

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
  /**
   * What you would be trying to do, as against where the thing lives.
   *
   * `group` is a shelf and a screen sits on exactly one; a task is an
   * intention and a screen can serve several. "Exam runway" is Study by
   * shelf, and somebody reaching for it is planning a week, studying for
   * something, or looking past this term depending on the week they are in.
   *
   * On the registry rather than in a list of its own, so that adding a screen
   * without saying what it is for is a type error instead of a row that
   * quietly never appears under any task.
   */
  taskTags: TaskTag[];
  /** The tab this lives under, so navigation stays oriented inside it. */
  root: Screen;
}

/**
 * The intentions, in the order they are shown.
 *
 * Nine rather than the eight the brief suggested: every one of `help`,
 * `settings`, `notifs` and the directory itself is about finding your way
 * around the app rather than about the term, and filing them under "fix or
 * change my data" would have put the guide next to the export.
 *
 * Written as pairs so the label is here and not in the screen — a tag with no
 * heading is a section nobody can name, and a heading with no tag is an empty
 * section that looks like a bug.
 */
export const TASKS = [
  ['due', 'Keep track of what is due'],
  ['study', 'Study for something'],
  ['stand', 'Know where I stand'],
  ['make', 'Write or make something'],
  ['week', 'Plan my week'],
  ['campus', 'Handle campus life'],
  ['ahead', 'Look ahead past this term'],
  ['data', 'Fix or change my data'],
  ['app', 'Find your way around'],
] as const;

export type TaskTag = (typeof TASKS)[number][0];

/** The heading for a tag, or the tag itself if somebody adds one loosely. */
export function taskLabel(tag: TaskTag): string {
  return TASKS.find(([id]) => id === tag)?.[1] ?? tag;
}

export const DESTINATIONS: Destination[] = [
  {
    screen: 'home',
    label: 'Today',
    blurb: 'What is due, what is next, and what is on today.',
    keywords: 'now due soon next class plan agenda',
    group: 'Semester',
    taskTags: ['due', 'week'],
    root: 'home',
  },
  {
    screen: 'brief',
    label: 'Reports',
    short: 'Report',
    blurb: 'The day, the week or the term, read back from what the app recorded.',
    // Three screens' worth, because three screens merged into this one: a
    // search for "weekly report" or "what worked" has to land somewhere, and
    // the somewhere is now a grain of this rather than a screen of its own.
    keywords:
      'brief briefing report daily day start end morning evening summary recap review standup what is due what did i do plan wrap up ' +
      'weekly week sunday end of week retrospective what happened how did the week go progress last week next week ' +
      'what worked end of term semester reflection study habits pattern patterns evidence december finals over improve next term learn about myself',
    group: 'Semester',
    taskTags: ['due', 'week', 'stand', 'ahead'],
    root: 'home',
  },
  {
    screen: 'courses',
    label: 'Courses',
    // Three grains, and the third is the one people search for by name:
    // Grades was a destination of its own until it turned out to be this
    // screen's third tab as well. Its keywords came here with it, so "what do
    // i need on the final" still lands somewhere.
    blurb: 'Every course, what it is asking of you, and what you have scored so far.',
    keywords:
      'class syllabus professor office hours grading credits grade grades gpa mark score final exam what do i need weighting rubric percent average',
    group: 'Courses',
    taskTags: ['due', 'stand'],
    root: 'courses',
  },
  {
    screen: 'degree',
    label: 'The degree',
    short: 'Degree',
    blurb: 'What is left of a major or a minor, what each course counts towards, and where the hours stand.',
    keywords: 'degree audit major minor requirements axle distribution graduation graduate credits credit hours transcript gpa cumulative four year plan declare declaration advisor advising what is left electives double count',
    group: 'Courses',
    taskTags: ['ahead', 'stand'],
    root: 'me',
  },
  {
    screen: 'calendar',
    label: 'Calendar',
    blurb: 'Classes and deadlines by day, month or the whole semester.',
    keywords: 'schedule month day week semester timetable events',
    group: 'Semester',
    taskTags: ['due', 'week'],
    root: 'calendar',
  },
  {
    screen: 'study',
    label: 'Study',
    blurb: 'Pick a course and a way through it — cards, read, watch, slides.',
    keywords: 'revise revision learn practice guide',
    group: 'Study',
    taskTags: ['study'],
    root: 'study',
  },
  {
    screen: 'ask',
    label: 'Ask Claude',
    short: 'Ask',
    blurb: 'The conversation — your term in hand, and every thread you have had.',
    // The full-screen chat was a destination of its own called "Chat", beside
    // a tab called "Ask Claude" that opened a key form. One room, one door.
    keywords:
      'ai chat explain help tutor claude conversation talk assistant ask threads history messages ' +
      'discuss back and forth question answer gpt chatgpt',
    group: 'Study',
    taskTags: ['study', 'app'],
    root: 'study',
  },
  {
    screen: 'work',
    label: 'Work on it',
    short: 'Work',
    blurb: 'Paste an assignment and get it broken down — rubric, plan, dates, what to ask.',
    keywords: 'assignment essay paper homework problem set instructions rubric deadline draft feedback outline plan generate write',
    group: 'Make',
    taskTags: ['study', 'make'],
    root: 'study',
  },
  {
    screen: 'update',
    label: 'Add a reading',
    short: 'Material',
    blurb: 'New material into a course — and every study mode picks it up.',
    keywords: 'reading add material update new chapter article handout slides lecture notes supplement extra pdf paste attach cards quiz guide refresh keep current course content',
    group: 'Study',
    taskTags: ['study', 'data'],
    root: 'study',
  },
  {
    screen: 'analyse',
    label: 'Analyse data',
    short: 'Analyse',
    blurb: 'A CSV in, and the statistics out — computed here, then explained.',
    keywords: 'data analysis statistics stats csv spreadsheet excel mean median average standard deviation sd variance correlation regression ols slope r squared scatter histogram quartile summary descriptive dataset numbers analyse analyze',
    group: 'Study',
    taskTags: ['make', 'study'],
    root: 'study',
  },
  {
    screen: 'draw',
    label: 'Draw it',
    blurb: 'A graph, a flow, a timeline or a matrix — drawn from what you describe.',
    keywords: 'diagram graph chart draw picture figure visual illustration flowchart curve supply demand axes timeline matrix payoff structure hierarchy causal mermaid svg sketch map model',
    group: 'Make',
    taskTags: ['make'],
    root: 'study',
  },
  {
    screen: 'solve',
    label: 'Work the problem',
    short: 'Solve',
    blurb: 'The method, worked on other numbers — and your own attempt checked.',
    keywords: 'math maths solve problem set equation calculate algebra derivative statistics elasticity growth rate percentage formula step working check answer wrong show me how practice arithmetic quantitative',
    group: 'Study',
    taskTags: ['study'],
    root: 'study',
  },
  {
    screen: 'exam',
    label: 'Practice paper',
    short: 'Paper',
    blurb: 'A paper with a shape, a total and a clock — sat, then marked against a key.',
    keywords: 'practice test exam quiz paper mock midterm final past paper questions multiple choice short answer essay question mark marking key revision revise study test generator sit timed',
    group: 'Study',
    taskTags: ['study', 'stand'],
    root: 'study',
  },
  {
    screen: 'deck',
    label: 'Make a deck',
    short: 'Deck',
    blurb: 'A real PowerPoint file — from a unit you have, or from a brief.',
    keywords: 'slides slideshow deck powerpoint pptx keynote google slides presentation present talk pitch briefing bullets speaker notes export slide',
    group: 'Make',
    taskTags: ['make'],
    root: 'study',
  },
  {
    screen: 'sources',
    label: 'Sources',
    blurb: 'Every reading you have kept, with what each is for — and out as BibTeX.',
    keywords: 'source sources citation citations bibliography reference references reading list bibtex zotero overleaf works cited quote author year paper article book cite',
    group: 'Make',
    taskTags: ['make', 'study'],
    root: 'study',
  },
  {
    screen: 'essay',
    label: 'Draft it',
    blurb: 'A real draft for a cover letter, a statement, a newsletter — not coursework.',
    keywords: 'essay write writing draft cover letter application internship job resume personal statement scholarship fellowship op-ed blog newsletter pitch memo prose compose generator',
    group: 'Make',
    taskTags: ['make'],
    root: 'study',
  },
  {
    screen: 'import',
    label: 'Add a course',
    short: 'Import',
    blurb: 'Upload a syllabus and get the course back, checked before you keep it.',
    keywords: 'new syllabus pdf upload generate create import',
    group: 'Courses',
    taskTags: ['data'],
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
    group: 'Courses',
    taskTags: ['data'],
    root: 'courses',
  },
  {
    screen: 'registrar',
    label: 'Term deadlines',
    short: 'Dates',
    blurb: 'Add/drop, withdrawal, registration — the dates your registrar sets, not a syllabus.',
    keywords: 'registrar term deadline add drop withdraw withdrawal pass fail audit registration enrol enroll academic calendar reading days finals exam period evaluations grades posted last day university school important dates w transcript',
    group: 'Courses',
    taskTags: ['due', 'ahead'],
    root: 'calendar',
  },
  {
    screen: 'announce',
    label: 'A change to a date',
    short: 'Changes',
    blurb: 'The email that moved a deadline, or the calendar that disagrees — taken one at a time.',
    // Two screens' worth. "Check the dates" was its own destination and is a
    // source of this one now, so its words have to keep landing somewhere.
    keywords:
      'announcement announce email post update moved change changed cancelled canceled postponed rescheduled deadline date shift new due date brightspace canvas notice message professor said class email paste ' +
      'check dates verify compare reconcile lms ics calendar feed disagree wrong date out of date stale syllabus says different mismatch',
    group: 'Courses',
    taskTags: ['due', 'data'],
    root: 'courses',
  },
  {
    screen: 'costs',
    label: 'What this term cost',
    short: 'Costs',
    blurb: 'Books, fees and access codes, with what came back — and what the same course cost last time.',
    keywords: 'cost costs money price prices textbook textbooks book books buy rent rental sell back buyback bookstore fee fees access code clicker supplies spend spending budget expense expenses receipt total how much',
    group: 'Life',
    taskTags: ['campus', 'ahead'],
    root: 'courses',
  },
  {
    screen: 'groupwork',
    label: 'Group work',
    short: 'Group',
    blurb: 'The shared list for a group project — who has which part, and whether it lands.',
    keywords: 'group groups project team partner partners case study shared checklist divide split parts sections who is doing what deliverable presentation together collaborate classmates group chat assignment split up',
    group: 'Campus',
    taskTags: ['due', 'campus'],
    root: 'courses',
  },
  {
    screen: 'meals',
    label: 'Meal plan',
    // Neutral, because this is the fallback for a school that has not named
    // its card. `saysFor` writes the specific one — a Vanderbilt student still
    // reads "Meal swipes and Commodore Cash".
    blurb: 'What is on your plan, what it is a day, and the week it runs out.',
    keywords: 'meal meals plan swipes swipe commodore cash dining dollars money balance cbord get food eat eating board plan munchie mart declined out of run out',
    group: 'Campus',
    taskTags: ['campus'],
    root: 'me',
  },
  {
    screen: 'housing',
    label: 'Housing',
    blurb: 'Your room, and the move-out date counted from your last exam rather than left as a rule.',
    keywords: 'housing residence hall dorm dormitory room roommate starrez move out moveout move in movein assignment building live living address selection lottery timeslot storage checkout check out key keys',
    group: 'Campus',
    taskTags: ['campus', 'ahead'],
    root: 'me',
  },
  {
    screen: 'runway',
    label: 'Exam runway',
    short: 'Runway',
    blurb: 'The weeks before an exam, counted backwards from it — and what stands in the way.',
    keywords: 'exam runway midterm final revision revise cram countdown prepare preparation study plan weeks before how long until ready readiness test',
    group: 'Study',
    taskTags: ['study', 'week', 'ahead'],
    root: 'study',
  },
  {
    screen: 'ahead',
    label: 'The week ahead',
    short: 'Ahead',
    blurb: 'The next seven days in hours — what is promised, what is due, where the room is.',
    keywords: 'week ahead next seven days forecast load hours busy workload plan planning free time capacity schedule how much time commitments heaviest day room',
    group: 'Semester',
    taskTags: ['week'],
    root: 'home',
  },
  {
    screen: 'behind',
    label: 'When you are behind',
    short: 'Behind',
    blurb: 'What has gone by, what still fits, and the moves that are not working harder.',
    keywords: 'behind late overdue missed catch up caught up triage bad week overwhelmed stressed stress panic drowning too much falling behind help extension late policy recover crisis sick',
    group: 'Semester',
    taskTags: ['due', 'week', 'stand'],
    root: 'home',
  },
  {
    screen: 'maps',
    label: 'Getting there',
    short: 'Map',
    blurb: 'A map you can search — campus or the whole city — and directions to anywhere.',
    keywords: 'map maps directions route walk drive transit bus navigate campus nashville where building room address google apple search find location openstreetmap nearby',
    group: 'Campus',
    taskTags: ['campus'],
    root: 'maps',
  },
  {
    screen: 'mail',
    label: 'Email',
    blurb: 'Draft the email you have been putting off — extension, question, meeting.',
    keywords: 'email mail write draft professor reply extension office hours absence recommendation letter follow up gmail outlook compose message send',
    group: 'Make',
    taskTags: ['campus', 'make'],
    root: 'courses',
  },
  {
    screen: 'yes',
    label: 'Registration',
    // The bar keeps a generic eight characters whatever the school calls it —
    // a registrar named "Student Center" would not fit, and truncating it in
    // the bar would read as a bug. `saysFor` names it everywhere with room.
    short: 'Register',
    blurb: 'Registration and class search — and paste your schedule straight back in.',
    keywords: 'yes enrollment enrolment registration register student landing search classes schedule timetable transcript holds advisor commodore vanderbilt add drop credit hours section',
    group: 'Campus',
    taskTags: ['ahead', 'campus'],
    root: 'courses',
  },
  {
    screen: 'classmates',
    label: 'Classmates',
    short: 'Class',
    blurb: 'A room per class, for everyone at your school taking it.',
    keywords: 'classmates classmate message messages chat talk group groups room people students friends study group discussion ask class peers social connect dm',
    group: 'Campus',
    taskTags: ['campus', 'study'],
    root: 'courses',
  },
  {
    screen: 'activities',
    label: 'Activities',
    short: 'Clubs',
    blurb: 'Clubs, a job, research, a chapter, a team — and what the week really costs.',
    keywords: 'extracurricular extracurriculars activity activities club clubs organization organisation org research lab job work shift employment fraternity sorority greek chapter rush intramural im club sport varsity athletics team practice volunteer service music theatre arts anchorlink involvement commitment hours load',
    group: 'Campus',
    taskTags: ['campus', 'week'],
    root: 'mine',
  },
  {
    screen: 'people',
    label: 'People and letters',
    short: 'People',
    blurb: 'The professors who will write about you, what you have actually talked about, and what you asked them for.',
    keywords: 'recommendation letter letters reference references professor mentor advisor office hours conversation relationship network networking grad school fellowship truman rhodes marshall boren scholarship internship referral thank you follow up',
    group: 'Life',
    taskTags: ['campus', 'ahead'],
    root: 'me',
  },
  {
    screen: 'tonight',
    label: 'Tonight',
    blurb: 'How long you have, and where those hours buy the most against your grade.',
    keywords: 'tonight evening plan priority prioritise prioritize what should i do first order effort allocation worth it points per hour six hours study plan triage decide choose',
    group: 'Semester',
    taskTags: ['study', 'week'],
    root: 'home',
  },
  {
    screen: 'applying',
    label: 'Applications',
    short: 'Apply',
    blurb: 'Internships, jobs and research posts — the deadlines that land on the same days as your coursework.',
    keywords: 'internship internships job jobs application applications apply applied recruiting recruitment career careers offer interview interviews resume cv cover letter fellowship scholarship grad school research assistant ra summer analyst deadline pipeline tracker handshake linkedin networking coffee chat referral',
    group: 'Life',
    taskTags: ['ahead', 'due'],
    root: 'mine',
  },
  {
    screen: 'proof',
    label: 'Check the writing',
    short: 'Check',
    blurb: 'Spelling, grammar and punctuation read back to you — before somebody else reads it.',
    keywords: 'spell check spelling spellcheck grammar grammar check proofread proofreading proof read punctuation typo typos writing editor edit check my writing mistakes errors comma apostrophe capitalisation capitalization word choice',
    group: 'Make',
    taskTags: ['make'],
    root: 'me',
  },
  {
    screen: 'clocks',
    label: 'Timers and alarms',
    short: 'Timers',
    blurb: 'A countdown for anything, and an alarm at a time. Nothing to do with your courses.',
    keywords: 'timer timers alarm alarms clock countdown stopwatch minutes egg kitchen wake up wake me nap ring ringing remind reminder pomodoro count down set a timer set an alarm snooze',
    group: 'Life',
    taskTags: ['week', 'study'],
    root: 'mine',
  },
  {
    screen: 'mine',
    // "Mine" said whose it was and not what it held. Everything in the app is
    // yours; what makes this tab different is that you put it there yourself.
    label: 'Personal',
    blurb: 'Your own tasks, appointments, notes and files.',
    keywords: 'mine personal todo task appointment note file attachment place own yours',
    // Moved from Life when the Everything screen was folded into Progress.
    // That took You to four, and the shelf rule is five to eight — a shelf
    // thinner than five costs a pill in the row and a tile in the grid to
    // hold half of what its neighbours hold, so it should be folded rather
    // than kept. You and Data together are nine, one past the ceiling that
    // keeps a shelf drawable as one row, so folding was not available and one
    // screen had to move instead. This is the one that reads right on either:
    // Life is the admin around a term — money, contacts, applications, hours —
    // and what a student typed themselves is about them, not around them.
    group: 'You',
    taskTags: ['due', 'week'],
    root: 'mine',
  },
  {
    screen: 'me',
    // "Me" was a profile screen's name on a screen that is mostly a progress
    // report and a directory. It is the second thing it does that people come
    // for, so the name says the first.
    label: 'Progress',
    blurb: 'Your load at a glance, every screen the app has, and what each is for.',
    // Widened with the `everything` screen's own words when that screen was
    // folded in here. A search for "sitemap" or "never opened" has to land
    // somewhere, and this is now the only screen that answers either.
    keywords:
      'me progress profile load more menu overview directory settings everything all screens index list of features what can this app do capabilities map contents table of contents browse explore find a screen where is what is there tour inventory sitemap unused never opened by task',
    group: 'You',
    taskTags: ['stand', 'app'],
    root: 'me',
  },
  {
    screen: 'account',
    /*
     * Data rather than You, which is where it sat while carrying the `data`
     * tag — the file already thought this was a data screen and shelved it
     * with Progress and Settings anyway.
     *
     * Signing in is the decision about whether this term leaves the device
     * at all, which is the question the other four on that shelf answer:
     * what comes in (Connect accounts), what is held (Your data), what is
     * sent (Privacy), and how to take it out (Take it with you). The move
     * also puts Data back over the five-screen floor after Files & mail was
     * deleted, and leaves You on five rather than six.
     */
    label: 'Account',
    blurb: 'Sign in so the same semester is on your phone and your laptop.',
    keywords: 'sign in log in register sync devices password email',
    group: 'Data',
    taskTags: ['data'],
    root: 'me',
  },
  {
    screen: 'links',
    label: 'Links',
    short: 'Links',
    blurb: 'Campus sites, the bookstore, tickets, and any address you add.',
    keywords: 'links bookmarks shortcuts campus yes anchorlink brightspace onevu myvu bookstore books tickets game football basketball commodores social instagram twitter x address url website site',
    group: 'Life',
    taskTags: ['campus'],
    root: 'me',
  },
  {
    screen: 'connect',
    label: 'Connect accounts',
    short: 'Connect',
    blurb: 'Your course site, Outlook, Google, Zoom — calendars and links in.',
    keywords: 'brightspace outlook microsoft google zoom apple icloud ics feed subscribe calendar drive onedrive send deadlines to my calendar',
    group: 'Data',
    taskTags: ['data'],
    root: 'me',
  },
  {
    screen: 'help',
    label: 'How this works',
    short: 'Guide',
    blurb: 'Every screen in the app, what it is for, and what it will not do.',
    keywords: 'help guide manual how do i what does documentation tour onboarding explain instructions getting started first time shortcuts keyboard reference handbook',
    group: 'You',
    taskTags: ['app'],
    root: 'me',
  },
  {
    screen: 'data',
    label: 'Your data and how it is running',
    short: 'Your data',
    blurb: 'Every record the app holds, what it weighs, and how much room is left.',
    keywords: 'data storage space records size counts quota full disk memory how many database indexeddb localstorage diagnostics health inspect browse export backup usage',
    group: 'Data',
    taskTags: ['data'],
    root: 'me',
  },
  {
    screen: 'privacy',
    label: 'Privacy and your rights',
    short: 'Privacy',
    blurb: 'What leaves this device, what it is used for, and how to delete all of it.',
    keywords: 'privacy policy data gdpr delete account remove erase retention what is stored where api key anthropic sent transmitted analytics tracking rights legal terms security row level',
    group: 'Data',
    taskTags: ['data'],
    root: 'me',
  },
  {
    screen: 'export',
    label: 'Take it with you',
    short: 'Export',
    blurb: 'Download everything, or push it to Drive or OneDrive.',
    keywords: 'export download backup save csv ics markdown json zip archive google drive onedrive transfer migrate leave copy print spreadsheet excel calendar import restore',
    group: 'Data',
    taskTags: ['data'],
    root: 'me',
  },
  {
    screen: 'settings',
    label: 'Settings',
    blurb: 'Navigation, alerts, which courses are loaded.',
    keywords: 'preferences options remove course sample notifications feed tab bar',
    group: 'You',
    taskTags: ['data', 'app'],
    root: 'me',
  },
  {
    screen: 'notifs',
    label: 'Alerts',
    blurb: 'What the app would have poked you about.',
    keywords: 'notifications reminders',
    group: 'You',
    taskTags: ['due', 'app'],
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
  // Every settings page lives under Me, the same as settings itself, so the
  // tab bar does not change out from under somebody two taps deep in it.
  setLook: 'me',
  setNav: 'me',
  setAlerts: 'me',
  setCourses: 'me',
  setGrading: 'me',
  setWorkload: 'me',
  setStorage: 'me',
  setAbout: 'me',
  setAssistant: 'me',
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

/**
 * The shelf a screen sits on.
 *
 * Its own, when the registry lists it; otherwise the shelf of the root it
 * nests under, so a flashcard three levels inside Study still answers Study
 * rather than nothing. The last fallback is the first shelf, unreachable in
 * practice because every root is a destination, and there so the return type
 * is a `Group` rather than one every caller has to unwrap.
 */
export function shelfOf(screen: Screen): Group {
  const own = destination(screen)?.group;
  if (own) return own;
  return destination(rootOf(screen))?.group ?? GROUPS[0];
}

export function destinationsIn(group: Group): Destination[] {
  return DESTINATIONS.filter((d) => d.group === group);
}

/**
 * The same list, minus what this school has no equivalent of.
 *
 * A screen whose capability is absent disappears rather than rendering an
 * empty state apologising for somebody's university — see `lib/school.ts`. It
 * is filtered here, once, so the directory, search and the tab chooser cannot
 * disagree about whether a screen exists.
 */
export function destinationsFor(group: Group, c: Capabilities): Destination[] {
  return destinationsIn(group).filter((d) => allowed(d.screen, c));
}

/** Every destination the app can offer this student, across all groups. */
export function offered(c: Capabilities): Destination[] {
  return DESTINATIONS.filter((d) => allowed(d.screen, c));
}

/**
 * The two gates together, which are different things.
 *
 * `allowed` is about the school — a meal plan screen at a university with no
 * meal plan is absent, not pending, and no amount of using the app produces
 * one. `showing` is about how far along somebody is — a real screen that is
 * not useful yet. A destination has to pass both, and the order does not
 * matter because neither can un-hide what the other hid.
 */
export function listed(
  group: Group,
  c: Capabilities,
  facts: Facts,
  visited: Record<string, boolean>,
  showAll: boolean,
): Destination[] {
  return destinationsFor(group, c).filter((d) => showing(d.screen, facts, visited, showAll));
}

/**
 * A destination said the way this school says it.
 *
 * The directory used to promise "Swipes and Commodore Cash" to everyone and
 * label the registration screen "YES" — Vanderbilt's word for its registrar —
 * for a student at a university that has never heard of it. Both were the
 * exact failure the capability model exists to prevent: not a screen that
 * should have been hidden, but a screen whose *words* were somebody else's.
 *
 * Note what is not here: a check for which school this is. The table asks the
 * capabilities what things are called, and Vanderbilt is the school whose
 * answers happen to be Commodore Cash and YES.
 */
const SAYS: Partial<Record<Screen, (c: Capabilities) => { label?: string; blurb?: string }>> = {
  meals: (c) => ({ blurb: mealsBlurb(c) }),
  yes: (c) => ({ label: c.registrarName?.trim() || undefined }),
  connect: (c) => ({
    blurb: `${lmsName(c)}, Outlook, Google, Zoom — calendars and links in.`,
  }),
};

function upper(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mealsBlurb(c: Capabilities): string {
  const swipes = showsSwipes(c);
  const cash = showsCash(c);
  if (swipes && cash) {
    return `${upper(swipeUnit(c))} and ${cardName(c)}, with what they are a day and the week they run out.`;
  }
  if (swipes) {
    return `${upper(swipeUnit(c))}, with what they are a day and the week they run out.`;
  }
  if (cash) {
    return `${upper(cardName(c))}, with what it is a day and the week it runs out.`;
  }
  // Unreachable through the directory — `allowed` hides the screen entirely
  // for a school with no plan — but a caller that asks anyway gets the honest
  // generic rather than a sentence about swipes nobody has.
  return 'What is on your plan, what it is a day, and the week it runs out.';
}

/** What to print for a destination, given where somebody studies. */
export function saysFor(d: Destination, c: Capabilities): { label: string; blurb: string } {
  const said = SAYS[d.screen]?.(c);
  return { label: said?.label ?? d.label, blurb: said?.blurb ?? d.blurb };
}

/**
 * The handful of places somebody actually keeps going back to.
 *
 * Recency above taxonomy. Five shelves fixed "which heading was that under",
 * and somebody still had to remember which shelf; the app already knows what
 * they revisit, and four rows of it costs nothing.
 *
 * `onBar` is whatever this layout's own navigation already offers — the tab
 * bar, or the springboard's dock. A shortcut to something that is one tap away
 * is noise, and the two layouts have different bars, which is why it is a
 * parameter rather than a constant.
 *
 * Capability-gated like everything else: a screen visited before somebody
 * changed school must not come back through this door.
 */
/**
 * The tag sections, each with the screens that carry it, in registry order.
 *
 * The shelves (`GROUPS`) answer "where is the thing called X"; this answers
 * "what would I use this for". A screen appears under every intention it
 * serves, so several appear more than once — `taskTags` is a list, not a
 * category, and a view that showed each screen once would be the shelves with
 * different headings.
 *
 * It lived in `lib/everything.ts` with seven other functions when there was an
 * Everything screen. That screen drew the shelves and the never-opened list
 * that Progress already drew, so it was folded in and only this came with it —
 * which left one function in a file of its own, importing `TASKS` and
 * `taskLabel` from here. It is here now.
 */
export function byTask(rows: Destination[]): { tag: TaskTag; label: string; rows: Destination[] }[] {
  return TASKS.map(([tag]) => ({
    tag,
    label: taskLabel(tag),
    rows: rows.filter((d) => d.taskTags.includes(tag)),
  })).filter((s) => s.rows.length > 0);
}

export function lately(
  recent: string[],
  onBar: string[],
  c: Capabilities,
  hide: string[] = [],
  limit = 4,
): Destination[] {
  const out: Destination[] = [];
  const seen = new Set<string>();
  for (const screen of recent) {
    if (seen.has(screen) || onBar.includes(screen) || hide.includes(screen)) continue;
    if (!allowed(screen, c)) continue;
    const d = DESTINATIONS.find((x) => x.screen === screen);
    if (!d) continue;
    seen.add(screen);
    out.push(d);
    if (out.length >= limit) break;
  }
  return out;
}
