import { DESTINATIONS, GROUPS, type Destination, type Group } from './nav';
import { SHORTCUTS, keyLabel } from './keys';
import {
  BADGES,
  BODYFACES,
  CORNERS,
  DENSITIES,
  FEEDS,
  GROUNDS,
  ICON_SHAPES,
  LABELS,
  LINE_HEIGHTS,
  NAVS,
  READING_WIDTHS,
  SHELLS,
  SIZES,
  TYPEFACES,
} from './look';
import type { Screen } from './types';

/**
 * The guide to the app, assembled from the app.
 *
 * Written by hand it would be wrong within a fortnight: a screen gets added,
 * a setting gets renamed, and the guide goes on describing an app that no
 * longer exists — which is worse than no guide, because somebody follows it
 * and concludes the app is broken.
 *
 * So none of the facts here are typed. The screens come from the registry, the
 * shortcuts from the array behind `?`, the settings from the option lists in
 * `look.ts`. What is written by hand is the connective prose, and `check()`
 * refuses to let any of it name a screen, a shortcut or a setting that does
 * not exist. `scripts/build-guide.ts` runs that check and fails the build.
 *
 * ## What it must also do
 *
 * Say what the app does not do. A guide that only sells is a guide nobody
 * trusts, and the sentences people remember are the ones that told them where
 * the edge was before they walked off it.
 */

export interface Section {
  id: string;
  title: string;
  /** Paragraphs and lists, already resolved. Markdown. */
  body: string;
}

export interface Guidebook {
  sections: Section[];
  /** Everything the guide claims exists, for the grounding check. */
  claims: { screens: Screen[]; shortcuts: string[]; settings: string[] };
}

/** The six areas, in the order somebody meets them. */


/** What each area is for. The one piece of prose per group. */
const AREA: Record<Group, string> = {
  Semester:
    'What is happening and when. Everything here is built from your syllabi — the dates, the weights, the readings — so it is only as right as what was imported, and every screen here will show you the sentence it came from.',
  Study:
    'Turning what a course holds into something you can be tested on. One guide per course, and several ways through it: cards, a quiz, a read-through, a cram sheet, slides. They all read the same material, so adding a reading updates every one of them at once.',
  Make:
    'The tools that produce something — a practice paper, a deck, a diagram, a draft, a letter. These are the screens that ask for your own work rather than showing you the app’s.',
  Courses:
    'The four courses themselves, and the ways their record is kept true. A syllabus moves, a professor sends an email, a date slips; nothing here changes anything without showing you what it would change first.',
  Standing:
    'Where you actually are. What each course is running at, what that does to the degree, and which weeks went by without being ticked off — the questions worth asking once a week rather than once a day.',
  Campus:
    'The parts of university that are not coursework — where a building is, what is on your meal plan, where you live, what is on this week.',
  Life:
    'The term around the coursework. Your own notes and tasks, the hours you sit down for, the people, the applications, what it is all costing.',
  You: 'Your account, how the app looks, and what it is allowed to do.',
  Data:
    'Where your semester is kept and what reaches it. The accounts you have connected, the copies held off this device, everything exportable, and what the app will and will not send.',
};

/**
 * The tasks somebody actually arrives with, and the screens that serve them.
 *
 * Written here rather than derived, because "I want to know where I stand" is
 * not a fact about any one screen — it is a route through several. Every id is
 * checked against the registry, so a screen removed or renamed fails the build
 * rather than leaving a dead step in the guide.
 *
 * When `taskTags` lands on the registry this table moves there and the
 * ordering comes with it.
 */
export const TASKS: { task: string; why: string; steps: Screen[] }[] = [
  {
    task: 'I want to know what is due',
    why: 'Start at Today, which is the whole term narrowed to the next few days.',
    steps: ['home', 'ahead', 'calendar'],
  },
  {
    /*
     * `guide` and `drill` are not steps here even though they are where the
     * studying happens. They are per-course screens reached from Study rather
     * than destinations in the registry, and naming them made the grounding
     * check fail — correctly. The prose says where they are; the route names
     * only what somebody can navigate to.
     */
    task: 'I want to study for an exam',
    why: 'Study first, to see what the course holds and how cold each unit is. The guide and the drill open from there. A practice paper is the last step, not the first.',
    steps: ['study', 'tonight', 'exam'],
  },
  {
    task: 'I want to know where I stand',
    why: 'Grades from your own entries and weights from the syllabus; nothing is fetched.',
    steps: ['grades', 'behind', 'brief'],
  },
  {
    task: 'I want to plan my week',
    why: 'Hours first, then the calendar — a week that does not fit is not a scheduling problem.',
    steps: ['ahead', 'work', 'calendar', 'tonight'],
  },
  {
    task: 'I want to fix bad import data',
    why: 'Every screen here shows the old and the new side by side before anything changes.',
    steps: ['edit', 'announce', 'import'],
  },
];

/** Every setting the app has, with what it changes and what it does not. */
const SETTINGS: { name: string; options: { id: string; label: string }[]; does: string; doesNot: string }[] = [
  { name: 'Text size', options: SIZES, does: 'Scales every piece of text in the app, including the ones written in the screens themselves.', doesNot: 'It does not change how much fits in a column — that is Reading width.' },
  { name: 'Density', options: DENSITIES, does: 'How much space sits between rows and inside cards.', doesNot: 'It does not change the type size.' },
  { name: 'Line spacing', options: LINE_HEIGHTS, does: 'How far apart the lines sit in a long reading.', doesNot: 'It does not affect headings, which set their own.' },
  { name: 'Reading width', options: READING_WIDTHS, does: 'How wide a paragraph gets before it wraps, on a large screen.', doesNot: 'It does nothing on a phone, where the screen is already the limit.' },
  { name: 'Ground', options: GROUNDS, does: 'The background the whole app is drawn on, and every colour that has to work against it.', doesNot: 'It does not change the accent, which is chosen separately.' },
  { name: 'Accent', options: [], does: 'The one colour the app uses for what you can act on.', doesNot: 'It is never used for a warning, which has a colour of its own.' },
  { name: 'Heading face', options: TYPEFACES, does: 'The face used for titles and labels.', doesNot: 'It does not change the body face.' },
  { name: 'Body face', options: BODYFACES, does: 'The face everything you read is set in.', doesNot: 'It does not change headings.' },
  { name: 'Corners', options: CORNERS, does: 'How square or soft every edge in the app is.', doesNot: 'Nothing else.' },
  { name: 'Icon shape', options: ICON_SHAPES, does: 'How the icons in the bar and the rail are drawn.', doesNot: 'It does not change which icons are there.' },
  { name: 'Tab labels', options: LABELS, does: 'Whether the bottom bar names its tabs or shows icons alone.', doesNot: 'It does not change which tabs are in the bar.' },
  { name: 'Badges', options: BADGES, does: 'Whether counts appear on the tabs and the rail.', doesNot: 'It does not change what is counted.' },
  /*
   * These two named each other's options.
   *
   * "Navigation" was handed `SHELLS` — Drawn, Grouped, Soft — while its prose
   * described the tab bar and the springboard, and no entry documented the
   * layout at all. So the app's own guidebook printed three layout names
   * under a heading about navigation, which is worse than saying nothing:
   * somebody reading it learned a wrong pairing and then could not find the
   * setting. `NAVS` and `SHELLS` are the two lists now, one each, and the
   * page they both live on is named in the prose.
   */
  { name: 'How your day is drawn', options: FEEDS, does: 'The shape of Today — cards, compact rows, or one timeline down the day.', doesNot: 'It does not change what is on it.' },
  { name: 'Navigation', options: NAVS, does: 'Which single navigation the app draws: a tab bar, one feed, a home screen of icons, or two rows of shelves. On Layout and navigation.', doesNot: 'It never draws two. Every screen is reachable in all four, and search finds them all.' },
  { name: 'Layout', options: SHELLS, does: 'How a screen is arranged once you are on it — drawn cards, grouped inset lists, or soft raised tiles. On Layout and navigation, beside the navigation.', doesNot: 'It changes no content and adds no navigation of its own.' },
];

/** A registry entry by screen id, or nothing. */
const byScreen = new Map(DESTINATIONS.map((d) => [d.screen, d]));

const label = (screen: Screen): string => byScreen.get(screen)?.label ?? screen;

/**
 * When somebody would open a screen, from what the registry already says.
 *
 * Derived rather than written: the blurb is the app's own sentence about the
 * screen and the keywords are the words somebody would arrive with, so the
 * line is grounded even though it reads as prose.
 */
function whenYouWouldOpen(d: Destination): string {
  const first = d.keywords.split(/\s+/).slice(0, 4).filter(Boolean);
  return first.length > 0
    ? `Open it when you are thinking about ${first.slice(0, 3).join(', ')}.`
    : '';
}

export function build(): Guidebook {
  const sections: Section[] = [];
  const screens: Screen[] = [];
  const shortcuts: string[] = [];
  const settings: string[] = [];

  // 1 — What this is.
  sections.push({
    id: 'what',
    title: 'What this is',
    body: [
      'Semester takes the PDFs your professors posted and turns them into a term you can see: every deadline, every weight, and a study guide per course that every way of studying reads from. It is built around one idea — that the syllabus already contains the answer, and the work is getting it out of the PDF and into a place you will look.',
      '',
      'It does not do several things on purpose. It does not fetch your grades from the university; there is no student API a student can use alone, so what it knows about your marks is what you have typed. It does not write your coursework. It does not invent a citation, a date or a fact: where it quotes your syllabus it shows the sentence, and anything it could not find in the file is dropped rather than guessed. It has no account requirement and no analytics, and signed out nothing leaves this device.',
      '',
      'What it needs from you is the syllabus, once per course, and your own marks as you get them. Everything else it can work out. The import is the only part that takes real effort, and it takes about five minutes a course.',
    ].join('\n'),
  });

  // 2 — Your first fifteen minutes.
  const firstRun: Screen[] = ['import', 'edit', 'settings', 'notifs'];
  screens.push(...firstRun);
  sections.push({
    id: 'start',
    title: 'Your first fifteen minutes',
    body: [
      `1. **Import a syllabus.** ${label('import')} takes the PDF, reads it, and shows you what it found before saving any of it. This is the slowest step and the one worth watching: it is about two minutes a course, most of it waiting.`,
      '',
      `2. **Check what it got wrong.** Every date it found carries the sentence it came from. Read those, not the dates. ${label('edit')} is where you correct anything, and correcting it there is permanent — the import never overwrites what you have edited.`,
      '',
      `3. **Set a text size and a ground.** ${label('settings')} — this takes thirty seconds and it is the difference between reading the app and squinting at it.`,
      '',
      `4. **Turn on reminders.** ${label('notifs')}. The browser will ask once and never ask again, so if you refuse it now you have to undo that in the browser rather than in the app.`,
      '',
      'Nothing above is required. The app works signed out, offline, and with no reminders at all.',
    ].join('\n'),
  });

  // 3 — The six areas.
  for (const group of GROUPS) {
    const inGroup = DESTINATIONS.filter((d) => d.group === group);
    screens.push(...inGroup.map((d) => d.screen));
    sections.push({
      id: `area-${group.toLowerCase()}`,
      title: group,
      body: [
        AREA[group],
        '',
        ...inGroup.map((d) => `- **${d.label}** — ${d.blurb}`),
      ].join('\n'),
    });
  }

  // 4 — By task.
  for (const t of TASKS) screens.push(...t.steps);
  sections.push({
    id: 'tasks',
    title: 'By task',
    body: TASKS.map((t) =>
      [`**${t.task}**`, '', t.why, '', t.steps.map((s, i) => `${i + 1}. ${label(s)}`).join('  →  ')].join('\n'),
    ).join('\n\n'),
  });

  // 5 — Every screen. One entry each, from the registry.
  screens.push(...DESTINATIONS.map((d) => d.screen));
  sections.push({
    id: 'screens',
    title: 'Every screen',
    body: DESTINATIONS.map((d) => {
      const root = d.root && d.root !== d.screen ? byScreen.get(d.root)?.label : null;
      return [
        `### ${d.label}`,
        d.blurb,
        root ? `Sits under ${root}.` : '',
        whenYouWouldOpen(d),
      ]
        .filter(Boolean)
        .join('\n');
    }).join('\n\n'),
  });

  // 6 — Settings.
  for (const s of SETTINGS) settings.push(s.name);
  sections.push({
    id: 'settings',
    title: 'Settings',
    body: SETTINGS.map((s) =>
      [
        `### ${s.name}`,
        s.options.length > 0 ? `${s.options.map((o) => o.label).join(', ')}.` : '',
        s.does,
        s.doesNot,
      ]
        .filter(Boolean)
        .join('\n'),
    ).join('\n\n'),
  });

  // 7 — Shortcuts. From the array behind `?`, never a second list.
  for (const s of SHORTCUTS) shortcuts.push(s.key);
  sections.push({
    id: 'keys',
    title: 'Shortcuts',
    body: [
      'On a keyboard. There are deliberately few — a list of thirty is a list nobody learns.',
      '',
      ...SHORTCUTS.map((s) => `- \`${keyLabel(s.key)}\` — ${s.does}`),
      '',
      'On a phone: swipe back from the left edge, pull down on Today to refresh, and long-press a deadline to move it.',
    ].join('\n'),
  });

  // 8 — When things go wrong.
  const fixes: { problem: string; screen: Screen; what: string }[] = [
    { problem: 'The import got a date wrong', screen: 'edit', what: 'Correct it here. The quote under each date is the sentence it was read from — if the quote is right and the date is wrong, that is a bug worth reporting; if the quote is wrong, the syllabus said something the reader misread.' },
    { problem: 'A deadline moved and the app does not know', screen: 'announce', what: 'Paste the email. It proposes the change and quotes the sentence; nothing moves until you take it.' },
    { problem: 'Two devices disagree', screen: 'account', what: 'The last sync and what it decided, per field. Lists are merged rather than replaced, so nothing you added on one device is lost by syncing the other.' },
    { problem: 'Storage is full', screen: 'data', what: 'Every collection with its size, largest first. Nothing is deleted for you.' },
    { problem: 'Reminders are not arriving', screen: 'notifs', what: 'The app can only ask the browser once. If it was refused, the switch here will say so and the fix is in the browser’s own settings for this site.' },
    { problem: 'The AI key was rejected', screen: 'connect', what: 'The key lives on this device and is never sent anywhere but the model’s own API. A rejected key is usually a key from the wrong account rather than a broken one.' },
  ];
  screens.push(...fixes.map((f) => f.screen));
  sections.push({
    id: 'wrong',
    title: 'When things go wrong',
    body: fixes.map((f) => `### ${f.problem}\n${label(f.screen)} — ${f.what}`).join('\n\n'),
  });

  return { sections, claims: { screens, shortcuts, settings } };
}

/**
 * Whether the guide and the app still agree.
 *
 * Four rules, and each one has failed at least once in some codebase: a screen
 * missing from the guide, a screen named in the guide that no longer exists, a
 * shortcut documented that was never bound, and a setting described that was
 * renamed. `scripts/build-guide.ts` treats any of them as a build failure.
 */
export function check(book: Guidebook): string[] {
  const wrong: string[] = [];
  const known = new Set(DESTINATIONS.map((d) => d.screen));

  // 1 — every screen appears exactly once in "Every screen".
  const listed = book.sections.find((s) => s.id === 'screens')?.body ?? '';
  const headings = [...listed.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  for (const d of DESTINATIONS) {
    const times = headings.filter((h) => h === d.label).length;
    if (times === 0) wrong.push(`"${d.label}" (${d.screen}) is in the registry and not in the guide.`);
    if (times > 1) wrong.push(`"${d.label}" appears ${times} times in Every screen; it must appear once.`);
  }
  if (headings.length !== DESTINATIONS.length) {
    wrong.push(`Every screen has ${headings.length} entries and the registry has ${DESTINATIONS.length}.`);
  }

  // 2 — every screen the guide names exists.
  for (const s of book.claims.screens) {
    if (!known.has(s)) wrong.push(`The guide names a screen that is not in the registry: "${s}".`);
  }

  // 3 — every shortcut documented is bound.
  const bound = new Set(SHORTCUTS.map((s) => s.key));
  for (const k of book.claims.shortcuts) {
    if (!bound.has(k)) wrong.push(`The guide documents a shortcut that is not bound: "${k}".`);
  }

  // 4 — every setting described has options that still exist.
  for (const s of SETTINGS) {
    if (s.options.length === 0) continue;
    if (s.options.some((o) => !o.label)) wrong.push(`The setting "${s.name}" has an option with no label.`);
  }

  return wrong;
}

/** The whole thing as one markdown file. */
export function toMarkdown(book: Guidebook): string {
  return [
    '# Semester',
    '',
    '_This guide is generated from the app itself. Every screen, shortcut and setting named here exists; the build fails if one does not._',
    '',
    // A blank line between sections, or the last paragraph of one runs
    // straight into the next heading and markdown renders them as one block.
    ...book.sections.flatMap((s) => [`## ${s.title}`, '', s.body, '']),
  ].join('\n');
}
