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

export const CLAIMS: Claim[] = [
  {
    heading: 'It works without an account',
    body:
      'Everything in this app runs on your device. Signing in adds one thing: the same semester on your phone and your laptop. Signed out, nothing leaves the device at all — no courses, no grades, no notes, no analytics.',
  },
  {
    heading: 'What syncs when you are signed in',
    body:
      'Your courses and their deadlines, what you have ticked off and when, your own tasks, appointments and notes, your grades and practice paper results, your study card history, and your settings. That is your academic record, and it is the reason the sign-in is optional.',
  },
  {
    heading: 'What never leaves the device',
    body:
      'Your Anthropic API key, if you have set one. It is not in the database, not in the sync payload, and not in any log — it is read from this device’s storage and sent only to Anthropic when you ask a question. Files you attach to notes also stay put: a lecture deck can be tens of megabytes, and uploading it on a phone plan is not a choice the app should make for you.',
  },
  {
    heading: 'What the AI features send, and to whom',
    body:
      'Asking a question, generating a study guide from a syllabus, or drafting an essay sends that text to Anthropic to be answered. It is sent when you press the button and not before. Anthropic’s own terms govern what happens to it there. Nothing is sent to anyone else, and there is no third-party analytics in this app.',
  },
  {
    heading: 'Reminders, if you switch them on',
    body:
      'Push reminders are worked out on this device and queued for the coming week so they can arrive while the app is closed. That means the text of each one — a deadline title and its course — sits on the server until it is sent, and is deleted afterwards. Switching reminders off deletes the whole queue immediately.',
  },
  {
    heading: 'How long anything is kept',
    body:
      'Until you delete it. There is no retention schedule that quietly removes your work, and no archive kept after you delete your account. Nothing is used to train anything.',
  },
  {
    heading: 'Deleting everything',
    body:
      'Delete my account, in Settings, removes every row belonging to you: courses, deadlines, notes, grades, cards, reminders, the lot. It cascades in the database rather than marking things hidden. This device’s own copy is separate — signing out leaves it alone, and Erase from this device removes it.',
  },
  {
    heading: 'Which screens you open',
    body:
      'The app keeps a count of how many times each of its screens has been opened, in this device’s own storage, under the key “semester.usage”. It is a number per screen — not when, not in what order, not how long. It is not uploaded, it is not in the sync payload, and nobody but you can read it; what it is for is the count on this page of how many screens you never open, so you can decide whether to hide the rest. Switch it off on this page and nothing is counted.',
  },
  {
    heading: 'Who can see your rows',
    body:
      'Only you. Every table is protected by row-level security keyed to your account, which is enforced by the database rather than by the app asking politely. A shared practice paper is the one exception and it is deliberate: you generate a link, and anyone with the link can open that one paper.',
  },
];

/**
 * The fields that go up, named exactly as the sync sends them.
 *
 * Kept here so the page can be checked against the code rather than trusted.
 * The test asserts these are a subset of what `pickPersisted` returns, so a
 * page that claims less than the app sends fails the build.
 */
export const SYNCED_FIELDS = [
  'courses',
  'notes',
  'tasks',
  'appointments',
  'done',
  'tickedAt',
  'started',
  'grades',
  'sittings',
  'reviews',
];

/** Fields that must never appear in what is uploaded. */
export const NEVER_SYNCED = ['apiKey', 'anthropicKey', 'sessionToken', 'password'];

/** A support address, so somebody stuck has a person rather than a form. */
export const SUPPORT = 'harrisonjrubin7@gmail.com';
