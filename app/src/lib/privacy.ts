/**
 * What this app holds, where it goes, and how to get rid of it.
 *
 * Once a second person's grades are on a server, this stops being a personal
 * project and becomes a service with obligations. The obligations are not
 * onerous and they are not satisfied by a link to a template: somebody has to
 * be able to read what happens to their coursework, in words, before they hand
 * it over.
 *
 * ## Written as data so it can be checked
 *
 * The claims are a list rather than a wall of prose in a component, because a
 * privacy page that drifts from what the code does is worse than none — it is a
 * false statement somebody relied on. `privacy.test.ts` checks the ones that
 * are checkable: that the API key really is absent from what syncs, that the
 * fields named here are the fields the app actually uploads.
 *
 * ## Plain language, and specific
 *
 * "We take your privacy seriously" is not information. Every line below either
 * names a thing that is stored, a place it goes, or something that does not
 * happen — and the last kind is the most useful, because it is what somebody
 * is actually worried about.
 */

import { KEPT_TABLES } from './cloud';

export interface Claim {
  heading: string;
  /** One paragraph. No lists inside lists. */
  body: string;
}

/**
 * Where the account lives.
 *
 * Read from the build's own configuration rather than written here, so it
 * cannot say Frankfurt while pointing at Virginia. Empty when this build has
 * no account service at all, which is a true and different answer.
 */
export function region(supabaseUrl: string): string {
  const host = supabaseUrl.trim();
  if (!host) return '';
  // Supabase project URLs carry no region, so this reports the host rather than
  // guessing a country from it. A wrong region is worse than an unspecific one.
  try {
    return new URL(host).hostname;
  } catch {
    return '';
  }
}

/**
 * What the account copy actually carries, grouped by the name a person would
 * give it.
 *
 * The page used to name ten things and end "that is your academic record".
 * That sentence was written when the app was a syllabus reader with a study
 * guide attached, and it stayed on the page through everything that has been
 * added since: the documents, spreadsheets, decks and graphs somebody makes,
 * the drafts they write to a professor, what they have recorded a term
 * costing, the degree they are tracking, the people they have logged. All of
 * it goes up — the sync sends what `pickPersisted` returns, whole — so a list
 * of ten was not a summary, it was an understatement of what signing in does.
 *
 * Written as data for the same reason the claims are: `privacy.test.ts` holds
 * every field the store persists against these groups and fails on one that
 * is in none, so the next collection added to the app cannot be sent to the
 * account without appearing on this page. The sentence is built from the
 * `says` phrases below rather than typed a second time.
 */
export const SYNC_GROUPS: { says: string; keys: string[] }[] = [
  {
    says: 'your courses, their deadlines and everything you have added to them',
    keys: [
      'courses', 'updates', 'sources', 'linkUrls', 'extraLinks', 'term',
      'archivedTerms', 'sample', 'registrar', 'courseOrder', 'mySchools',
      'schoolId', 'schoolPack', 'examCovers', 'drops', 'gradeSystems', 'scale',
    ],
  },
  {
    says: 'what you have ticked off, started, handed in and attended, and when',
    keys: [
      'done', 'tickedAt', 'started', 'ready', 'submitted', 'saved', 'pieces',
      'progress', 'attendance', 'attendPolicy',
    ],
  },
  {
    says: 'your notes, tasks, appointments, activities and the calendars you subscribe to',
    keys: [
      'notes', 'tasks', 'appointments', 'commitments', 'timers', 'alarms',
      'feeds', 'feedEvents', 'feedHidden', 'feedOrder',
    ],
  },
  {
    says: 'the hours you plan to work, whether you are on a team, and the rules that decide your reminders',
    keys: [
      'windows', 'spent', 'contract', 'floor', 'rest', 'dayBudget', 'myRules',
      'quiet', 'notifs', 'mutedCourses', 'accessLeadDays',
      // Named in this group rather than among the layout settings, although it
      // is a switch like `showAll` is. It is a statement about the person
      // rather than about the phone — the page would be describing it wrongly
      // if it appeared under colours and text size.
      'athlete',
    ],
  },
  {
    // Its own line rather than folded in with the name, which is the group it
    // is otherwise nearest to. These are sentences somebody wrote about
    // themselves, they are the one field here that rides on every request the
    // assistant makes, and a person deciding whether to sign in should see
    // them said rather than summarised as "your profile".
    says: 'what you have told the assistant about yourself',
    keys: ['aboutMe'],
  },
  {
    says: 'everything you have made — documents, spreadsheets, decks, equations, graphs and the folders they sit in',
    keys: [
      'documents', 'sheets', 'decks', 'equations', 'plots', 'folders',
      'mathWorking', 'mathGiven',
    ],
  },
  {
    says: 'the email you have drafted, how you have marked messages, and the mail rules you have written',
    keys: ['mailDrafts', 'mailMarks', 'mailRules', 'mailPane'],
  },
  {
    says:
      'your study history — cards drilled, practice papers sat, the answers you gave and the ' +
      'study plan you have laid out',
    keys: ['reviews', 'sittings', 'answers', 'pretested', 'sessions', 'liveSession'],
  },
  {
    says: 'your grades, the work that came back, your degree plan and the applications you are tracking',
    keys: [
      'grades', 'returned', 'regradeWindows', 'requirements', 'taken',
      'applications', 'wanted',
    ],
  },
  {
    says: 'the people you have logged, the letters you have asked for and your advising visits',
    keys: ['people', 'visits', 'letters', 'myName'],
  },
  {
    says: 'what you have recorded a term costing, and your housing, meal and map records',
    keys: [
      'costs', 'charges', 'aid', 'payments', 'plans', 'balances', 'residences',
      'places', 'geocode',
    ],
  },
  {
    says: 'and how the app is set up — your navigation, layout, colours, text size and which screens you have opened',
    keys: [
      'nav', 'tone', 'seenOnboarding', 'registered', 'cleared',
      'waysOpen', 'keyOpen', 'countScreens', 'lastSync', 'recent', 'visited',
      'tabs', 'yours', 'controls', 'role', 'showAll',
      'schemaVersion', 'accent', 'textSize', 'ground', 'density', 'corners',
      'typeface', 'bodyface', 'lineHeight', 'readingWidth', 'iconShape', 'calm',
      'labels', 'badges', 'feed', 'courseColours', 'shell', 'favourites',
      'shortcuts', 'directory', 'groupOrder', 'boardOrder', 'hue',
    ],
  },
];

/** The groups as one sentence, so the prose cannot say less than the list. */
export function whatSyncs(): string {
  return SYNC_GROUPS.map((g) => g.says).join('; ');
}

/** A support address, so somebody stuck has a person rather than a form. */
export const SUPPORT = 'harrisonjrubin7@gmail.com';

/**
 * What a deleted account leaves behind, as one sentence.
 *
 * Read off `KEPT_TABLES` for the same reason `whatSyncs` is read off
 * `SYNC_GROUPS`: the paragraph below is the one that was false for eleven
 * tables, and a second hand-written copy of the reasons is how it got that
 * way. A row added to that list appears here whether or not anybody
 * remembers to come back to this file.
 */
export function whatDeletionLeaves(): string {
  return KEPT_TABLES.map((t) => t.why).join(' ');
}

export const CLAIMS: Claim[] = [
  {
    heading: 'It works without an account',
    body:
      'Everything in this app runs on your device. Signing in adds one thing: the same semester on your phone and your laptop. Signed out, nothing leaves the device at all — no courses, no grades, no notes, no analytics.',
  },
  {
    heading: 'What syncs when you are signed in',
    body:
      `All of it, and it is worth reading the list rather than the word: ${whatSyncs()}. ` +
      'If you have typed it into this app, signing in copies it to the account so the other ' +
      'device has it too. Nothing is left behind as a summary and nothing is sent that is not ' +
      'on that list — the two exceptions are named below, and they are exceptions in your ' +
      'favour: your API key and your attached files stay on this device. This is the whole ' +
      'reason the sign-in is optional.',
  },
  {
    heading: 'What never leaves the device',
    body:
      'Your Anthropic API key, if you have set one. It is not in the database, not in the sync payload, and not in any log — it is read from this device’s storage and sent only to Anthropic when you ask a question. Files you attach to notes also stay put: a lecture deck can be tens of megabytes, and uploading it on a phone plan is not a choice the app should make for you.',
  },
  {
    heading: 'The app keeps its own copies, on this device',
    body:
      'Once a day, and before anything that rewrites a lot at once — an import, a bulk change, closing a term — the app saves a copy of your account so a bad five minutes can be undone. They are kept for a week, in this browser’s storage, on this device only. Long text you are part way through writing is kept the same way, so leaving a screen does not lose it, and dropped after a fortnight. Neither is ever uploaded, neither is synced, and neither is in your export. You can see every copy, and delete any of them, under Take it with you.',
  },
  {
    heading: 'What the AI features send, and to whom',
    body:
      'Asking a question, generating a study guide from a syllabus, or drafting an essay sends that text to Anthropic to be answered. It is sent when you press the button and not before. Anthropic’s own terms govern what happens to it there. None of it goes anywhere else, and there is no third-party analytics in this app.',
  },
  {
    heading: 'The map, which is the one other thing off this device',
    body:
      'Getting there draws a real map, and its tiles come from OpenStreetMap as you look at them — so their servers see this device’s address and which part of the city is on screen, the same as opening any map. Nothing about your semester goes with it: no courses, no deadlines, no account, no identifier of any kind. It happens only while that screen is open, and on no other screen in the app. Looking a place up is separate and switched off until you switch it on: it sends the words you type, when you press Find, to whichever keyless service you pick — Nominatim, run by the OpenStreetMap Foundation, or Photon, run by Komoot on the same data. Turning your own position into a place name is a third switch, off by the same default, and it is the only one that sends a coordinate.',
  },
  {
    heading: 'Reminders, if you switch them on',
    body:
      'Push reminders are worked out on this device and queued for the coming week so they can arrive while the app is closed. That means the text of each one — a deadline title and its course — sits on the server until it is sent, and is deleted afterwards. Switching reminders off deletes the whole queue immediately.',
  },
  {
    heading: 'How long anything is kept',
    body:
      'Until you delete it. There is no retention schedule that quietly removes your work, and no archive kept after you delete your account. Nothing is used to train anything. Two things do age out, and neither of them is your work — both are records about it. The log of who has read your rows, described below, keeps ninety days. The record of which days you opened the app, also described below, keeps a little over a year.',
  },
  {
    heading: 'Who has read your rows, and how you can see it',
    body:
      'Two things in this app read your rows without signing in as you, and both are listed here because you can now see them happen. Your published calendar link is served to whoever presents it — that is how a calendar subscription works, and anyone holding the link can read your deadlines until you replace it. Your queued reminders are read by the sender, which runs on a schedule rather than being opened by a person. Every one of those reads is written down against your account, and you are the one who can read that log: it is on the Export screen beside the link, and it says what kind of thing fetched your calendar and on what day. A web browser in that list is worth looking at — a calendar subscription is fetched by a calendar app, so a browser is either you opening your own link or somebody else holding it. What is stored is the kind of client and nothing else: no address, no device, no browser fingerprint, and never the link itself. It is kept for ninety days, it is not in your export, and deleting your account deletes it.',
  },
  {
    heading: 'Deleting everything',
    body:
      'Delete my account, in Settings, empties every table this app can reach on your behalf: your courses and their deadlines, your notes, grades and cards, your reminders and calendar feed, the record of what read them, the record of which days you opened the app, your display name, which courses you said you were in, the messages and reactions you posted in class threads, the people you blocked, your group memberships, and any practice paper you shared along with the answers sent back to it. Deleting your messages leaves gaps in conversations other people are still reading, which is the deliberate half of a real choice: the alternative was leaving your words in their thread under a name nobody can look up. This device’s own copy is separate — signing out leaves it alone, and Erase from this device removes it.',
  },
  {
    heading: 'What deleting leaves behind',
    body:
      'Two things survive that button, and it is better to know which than to be told “everything”. First, three kinds of row that are not only yours. '
      + whatDeletionLeaves()
      + ' Second, the account record itself: an app running in your browser may delete the rows it owns, and should not be able to delete the sign-in — so the address you signed up with outlives the button. Removing that takes an email to '
      + SUPPORT
      + ', done by hand and answered. Everything else named above really is deleted, row by row, rather than marked hidden.',
  },
  {
    heading: 'Which screens you open',
    body:
      'The app keeps a count of how many times each of its screens has been opened, in this device’s own storage, under the key “semester.usage”. It is a number per screen — not when, not in what order, not how long. That count is not uploaded and is not in the sync payload; what it is for is the figure on this page of how many screens you never open, so you can decide whether to hide the rest. Switch it off on this page and nothing is counted. Two smaller facts about the same thing do go to the account when you are signed in, because the app uses them on every device you read on: which screens you have ever opened, and the day each was last opened. Both are in the list above, neither is timed to anything finer than the day, and signed out neither leaves the device at all.',
  },
  {
    heading: 'The three things counted about your account',
    body:
      'Semester is being piloted, and three questions decide whether it is worth building further: how many people who sign up get a course of their own in and study from it, how many open it in a given week, and how many are still opening it a month later. Answering them needs a record, and this is all of it: for each day you had the app open signed in, up to three words — that you opened it, that you had added a course by then, and that you had answered a card by then. No screen names, no titles, no course, no counts, no time of day, nothing about what you wrote or read. It is kept for a little over a year and then dropped, it is not in your export, deleting your account deletes it, and — this is the part worth saying plainly — it is ours, sent nowhere else. There is still no third-party analytics in this app and there is no tracking of you across the web. Signed out, none of it happens at all.',
  },
  {
    heading: 'Who can see your rows',
    body:
      'Your private rows are protected by row-level security keyed to your account, enforced by the database rather than by the app asking politely. There are two deliberate exceptions. A shared practice paper is visible to anyone holding its link. A support summary is visible only to the one verified university supporter you name, for the one-to-seven-day window you approve; every read is recorded, and raw notes, sources, recordings and mistake detail remain private.',
  },
];

/**
 * The fields that go up, named exactly as the sync sends them.
 *
 * Every one of them, read off the groups above rather than kept as a second
 * list. This was ten hand-written names and the test checked only that each
 * was really sent — which a list of ten passes just as easily as a list of
 * all hundred and nineteen, and so said nothing about the hundred and nine
 * it was silent on. `privacy.test.ts` now checks both directions against
 * `pickPersisted`, which is what makes this a claim rather than a sample.
 */
export const SYNCED_FIELDS = SYNC_GROUPS.flatMap((g) => g.keys);

/** Fields that must never appear in what is uploaded. */
export const NEVER_SYNCED = ['apiKey', 'anthropicKey', 'sessionToken', 'password'];
