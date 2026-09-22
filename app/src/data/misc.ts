import type { AppNotification } from '../lib/types';

/** Which alerts the app can send. Toggled in onboarding and in Settings. */
/**
 * How many screens the first run has.
 *
 * Here rather than in `screens/Onboarding.tsx` because the reducer decides
 * when the run is over and must not hold its own copy of the number: it did,
 * as a literal `>= 2`, and adding a step would have ended the run one screen
 * early with the last one never shown.
 */
export const ONB_STEPS = 5;

export const NOTIF_DEFS = [
  { k: 'class', label: 'Class starting in 15 minutes' },
  { k: 'today', label: 'Anything due today, at 8am' },
  { k: 'two', label: 'Two-day warning on big assignments' },
  { k: 'start', label: 'The morning something has to be started' },
  { k: 'free', label: '“Nothing due tonight” all-clear' },
  { k: 'sun', label: 'Sunday night: your weekly report' },
  { k: 'exam', label: 'Exam in one week' },
  { k: 'term', label: 'A registrar deadline a week out' },
  { k: 'attend', label: 'Before a class you cannot afford to miss' },
  { k: 'bill', label: 'A tuition payment a week out' },
] as const;

export type NotifKey = (typeof NOTIF_DEFS)[number]['k'];

export const DEFAULT_NOTIFS: Record<NotifKey, boolean> = {
  class: true,
  today: true,
  two: true,
  /*
   * On by default, on the same argument as `attend` and `bill` below rather
   * than on the argument that it is useful: it cannot fire for a student the
   * app has never timed any work for, because `lib/start.ts` refuses to invent
   * an estimate. So it is silent for a new account and stays silent until the
   * app has learned enough to be right, and the first thing it ever says is a
   * start date it can defend.
   */
  start: true,
  free: false,
  sun: true,
  exam: true,
  // On by default, unlike the other opt-ins: this is the one whose cost is
  // money rather than points, and somebody who has not filled the dates in
  // gets nothing from it anyway.
  term: true,
  // On for the same reason. It cannot fire for a course with no attendance
  // policy or with absences to spare, so for most people it is silent, and
  // for the one person on their last absence it is the warning that arrives
  // before the class rather than the arithmetic that explains it afterwards.
  attend: true,
  /*
   * On by default, for the same reason as `term` above: the cost of missing it
   * is money and a registration hold rather than points, and it cannot fire at
   * all for somebody who has not entered a payment date — so it is silent for
   * most people and is the one warning that arrives in time for the person it
   * is for.
   */
  bill: true,
};

/** The morning batch. A demonstration of the alert style, not a live feed. */
export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    code: 'BUS 1600',
    when: '7:02 AM',
    title: 'Group Assignment 1 lands tonight',
    body: 'ECOALF case, 11:59 PM. Your team hasn’t opened the doc.',
  },
  {
    id: 'n2',
    code: 'CORE 2500',
    when: '7:02 AM',
    title: 'Reflection #1 due before 1:15p',
    body: 'Self-assessed. Rubric is attached in Brightspace.',
  },
  {
    id: 'n3',
    code: 'PSCI 1104',
    when: '6:41 AM',
    title: 'Class canceled today',
    body: 'Prof. Trounstine is at APSA. 2:45p is yours.',
  },
  {
    id: 'n4',
    code: 'ECON 1020',
    when: 'Yesterday',
    title: 'PSet 1 posted',
    body: 'Due Friday 11:59 PM on Gradescope. No extensions, ever.',
  },
];

/**
 * Where the app's figures actually come from, shown in Settings › About.
 *
 * This list came out of the design comp (`project/Semester Phone.dc.html`),
 * where four plausible connected accounts are exactly what a mockup should
 * have, and it shipped verbatim under a header that promises provenance.
 * Three of the four rows said something the code does not do and the fourth
 * said something no third-party app can do:
 *
 *  · **Brightspace — “4 courses · synced 6:40 AM · On”.** `lib/connect.ts`
 *    says what the Brightspace route is: a read-only per-user .ics feed the
 *    student pastes. Nothing syncs, on a clock or otherwise, and the feed
 *    carries no course list.
 *  · **Gradescope — “On”.** The word appears nowhere in `app/src` outside
 *    sample course data. There is no Gradescope route, of any kind.
 *  · **Apple Calendar — “Two-way”.** `lib/connect.ts` again: *“Apple —
 *    sign-in only. There is no iCloud calendar API”*. `lib/subscribe.ts`
 *    publishes a feed outward; a feed is one direction by construction.
 *  · **Top Hat — a join code.** Top Hat's only integration surface is LTI,
 *    which connects it to an institution's LMS. There is no public API and no
 *    student data export, so no app outside a data-sharing agreement can read
 *    a student's own Top Hat score — and reading it out of their logged-in
 *    session is the credential-scraping this app refuses everywhere else.
 *
 * `screens/lmsclaims.test.ts` already pins three other places where this app
 * told a student something too generous about an LMS. This was the fourth,
 * and it survived that pass because it is data rather than prose.
 *
 * So the rows now name the routes that exist, and the tag says **what each
 * one takes** rather than whether it is switched on — there is no switch, and
 * a status column for connections the app does not hold is the whole defect.
 */
export const SOURCES = [
  {
    label: 'Your syllabus',
    meta: 'Every date, weight and quote, read from the file you upload',
    state: 'File',
  },
  {
    label: 'A calendar link',
    meta: 'Brightspace, Outlook, Google, iCloud — read-only, and never whether you submitted',
    state: 'Link',
  },
  {
    label: 'Canvas',
    meta: 'A token you issue yourself — assignments, and your own submissions',
    state: 'Token',
  },
  {
    label: 'What you enter',
    meta: 'Scores, absences, hours. Nothing is filled in on your behalf.',
    state: 'Yours',
  },
  {
    /*
     * Named, all three, rather than "your classroom response tool".
     *
     * This row exists to be *found*, by a student staring at a participation
     * mark they cannot square with the app — and they are looking for the word
     * on their own screen. It shipped as `Top Hat` alone because both shipped
     * Top Hat courses made that the case in front of us; a student whose course
     * uses iClicker or Poll Everywhere read the same list and found no answer
     * at all, which `TOPHAT.md` observes is how the question gets asked again.
     *
     * The naming is only here. `lib/clicker.ts` has the argument for why the
     * *parser* must go on recognising none of them: a category name is carried
     * verbatim, so all three already arrive with no rule written, and a
     * vocabulary there would drop the courses it had not been taught.
     */
    label: 'Top Hat, iClicker, Poll Everywhere',
    meta: 'Not connected — no app can read your score, and the same goes for any other clicker. The grade line comes from your syllabus; the number is yours.',
    state: 'By hand',
  },
];

/** The three onboarding screens. */
