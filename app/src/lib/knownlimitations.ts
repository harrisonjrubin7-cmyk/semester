/**
 * Known limitations, written for pilot users, as data.
 *
 * The `known-limitations` gate in `launchreadiness.ts` asks for limitations
 * "published internally and appropriately to pilot users". The internal half
 * is `SEMESTER_MARKET_READINESS.md`, which is written for an engineer and
 * says "adapter registry" where a student needs "your school is not
 * connected". This is the other half: the same facts in plain language, each
 * with what to do instead and where in the tree it is stated.
 *
 * Nothing here is new information. Every entry cites the file that states
 * the limitation, and `pilotdocs.test.ts` fails on a citation that does not
 * exist — the same rule the go/no-go applies to evidence. An entry with no
 * source is an entry somebody invented.
 *
 * Printed in three places from this one list, so they cannot disagree:
 * `docs/pilot/KNOWN-LIMITATIONS.md` (rendered by the test), the public site's
 * `/known-limitations/`, and the Help screen in the app, which is the copy a
 * pilot student actually has, since the site has no deployment yet.
 */

import { SUPPORT } from './privacy';

export interface Limitation {
  id: string;
  /** What a student reads first. A plain sentence, not a feature name. */
  title: string;
  /** What does not work yet, in the words of the file that says so. */
  what: string;
  /** What to do instead, today. Never "wait for the next version". */
  instead: string;
  /** Repository files that state this limitation. Each must exist. */
  sources: readonly string[];
}

/** The date of the last time somebody read every entry against its sources. */
export const KNOWN_LIMITATIONS_AS_OF = '2026-10-03';

export const KNOWN_LIMITATIONS: readonly Limitation[] = [
  {
    id: 'school-systems',
    title: 'Semester is not connected to your school’s systems.',
    what: 'No registrar, student-information or learning-system connection is live for any institution. The framework exists and is tested with mock adapters; the adapter registry is deliberately empty, and the learning-system launch has only been tested against a test platform.',
    instead: 'Register, drop, pay and submit in your university’s own systems. Paste your schedule into Registration (#/yes) and upload each syllabus on Add a course (#/import); every date Semester shows came from what you gave it, and the official system is the one that counts.',
    sources: ['SEMESTER_MARKET_READINESS.md', 'ops/claims/README.md', 'app/server/institution/gateway.ts'],
  },
  {
    id: 'sync-merge',
    title: 'Files you attach do not sync, and two devices can still disagree.',
    what: 'Files you attach stay on the device they were added on: they can be tens of megabytes, and uploading them over a phone plan is not a decision the app makes for you. Everything else you type or make syncs. A note, action or other record you edit on two devices before either syncs keeps the later edit in use and offers you the other version to choose on Account. Deleting a course, note, action, appointment, document, sheet or deck on one device deletes it on the others, unless you changed it on another device, in which case the changed one stays and you are asked. Other lists (folders, equations, places and the rest) do not carry a deletion yet, so an item you delete from one of them can come back from another device.',
    instead: 'Keep attachments on the device you use most, or put them in Take it with you (#/export). Check Account for a version to choose after two devices have been used offline. If something you deleted from one of the other lists comes back, delete it again.',
    sources: ['app/src/lib/cloud.ts', 'app/src/lib/merge.ts', 'app/src/lib/conflicts.ts', 'app/src/lib/deletions.ts'],
  },
  {
    id: 'offline-high-risk',
    title: 'Offline, only two things can be kept to send later, and none sends itself.',
    what: 'Sharing an advisor meeting and sending your course plan to your school can be kept on this device when you are offline. Neither goes by itself: when you are back online you send each one from Account, and one that waited more than three days is not sent and has to be made again. A share cut off by a dropped connection may or may not have arrived, so you check before sending it again. Where the browser will not keep saved sends, they are lost if you close the app. Publishing, deleting your account, choosing an office program and opening an official site are refused while you are offline, with a sentence saying nothing was sent and nothing is waiting. Nothing that writes to an official or financial record can be kept.',
    instead: 'Keep the two from the screen that was refused, then send them from Account when you are back. Do the rest when you have a connection. The banner under the header says when you are offline and when the changes you made have gone up.',
    sources: ['app/src/lib/offline-mode.ts', 'app/src/lib/sync/outbox.ts', 'app/src/lib/sync/classes.ts'],
  },
  {
    id: 'offline-delete',
    title: 'Deleting nearly a whole list at once, offline, can bring it back.',
    what: 'A course, note, action, appointment, document, sheet or deck you delete while offline stays deleted, even if you close the app before it syncs. The exception is a safeguard: if you delete five or more of the same kind, and nearly all you had, while offline, and close the app before the next sync, the app treats that as an accident rather than a choice, because an app that lost rows by mistake would look exactly the same and would delete them from your account. They come back on the next sync.',
    instead: 'Delete them again once you are online, where each deletion goes up as you make it.',
    sources: ['app/src/lib/deletions.ts'],
  },
  {
    id: 'no-mfa-sso',
    title: 'No multi-factor sign-in, and no sign-in through your school.',
    what: 'Multi-factor sign-in is planned and not built. Sign-in through an institution’s identity provider is configured for no institution and has not been tested against a real one.',
    instead: 'Use an email address and a password you use nowhere else, or one of the providers the sign-in screen offers. An account is optional: everything works on the device without one.',
    sources: ['ops/claims/README.md', 'app/src/lib/cloud.ts'],
  },
  {
    id: 'accessibility-review',
    title: 'No review by a person using a screen reader, and no conformance report.',
    what: 'Automated checks run on every build and find a minority of barriers. No review of the main student journey by a person with a screen reader, keyboard only, at 320px or at 200% zoom has been recorded, and there is no VPAT or ACR.',
    instead: 'If something does not work for you, report it (below) with “Accessibility” in the subject. A barrier that stops you finishing what you came to do is fixed before anything else in that screen ships.',
    sources: ['app/src/site/pages.tsx', 'ops/claims/README.md'],
  },
  {
    id: 'policies-draft',
    title: 'The terms of service and privacy policy are drafts, not in force.',
    what: 'Both exist as drafts for a lawyer and carry open decisions: the legal entity, liability, governing law. The minimum age is 13, set by the owner and not yet reviewed by counsel. Neither has been reviewed or put in force.',
    instead: 'Read Privacy and your rights in the app (#/privacy) for what leaves your device and what deleting removes; that page is held to the code by a test. You can export or delete everything at any time.',
    sources: ['docs/legal/TERMS-OF-SERVICE-DRAFT.md', 'docs/legal/PRIVACY-POLICY-DRAFT.md', 'app/src/lib/privacy.ts'],
  },
  {
    id: 'plus-checkout-new',
    title: 'Individual paid acquisition is held; Plus and Pro are not on sale.',
    what: 'The checkout and cancellation implementation exists, but new checkout is disabled while pricing, legal, tax, accessibility, security, support and operational approvals remain open. Existing subscribers retain cancellation and billing-history access. During controlled validation, every feature a student can use is free.',
    instead: 'Do not enter payment information for Semester. Use Free during controlled validation. Existing subscribers can use Account to cancel or open billing history and should contact support about any unrecognized charge.',
    sources: ['app/src/lib/membership.ts', 'app/src/lib/plans.ts', 'docs/DECISION-LOG.md'],
  },
  {
    id: 'support-one-address',
    title: 'The beta support desk is live, but email delivery and formal coverage are gated.',
    what: 'Help shows your questions, stable SUP references, replies and their non-binding 24-hour or 72-hour first-response target. Authorized staff answer through an identity-free queue. Production ticket creation, staff reply, Help-thread receipt and resolution passed UAT on October 3, 2026, and the founder staffs the current beta queue. Email notices are unavailable: their delivery mechanics reached provider acceptance in that UAT, but the worker and UI are now parked until Resend has a completed vendor review, executed terms/DPA, an owner and an explicit activation decision. Outlook inbox receipt also remains pending. Replies remain available in Help. Newly classified individual-beta tickets without a signed school deployment are deleted 180 days after resolution or closure unless a legal hold applies; a school-domain claim alone remains individual beta. Tickets opened under a signed school deployment await a configured contract rule and are not automatically purged. Tickets created before the durable classifier stay outside automated and ticket-only deletion until their historical authority is verified instead of guessed from today’s profile. Whole-account erasure detaches those legacy records from the deleted account and preserves them with an opaque review key so potentially held evidence is not destroyed. Support still uses the founder’s personal Gmail address, and no support hours, guaranteed response time or 24/7 coverage are promised. The status page checks the service from your own browser and its AI and checkout rows only show that the service answered.',
    instead: 'If the ticket panel is available, use it and keep the SUP reference. Otherwise write to the address below. For “is it down?”, open the status page from Help; Up means your browser reached it just now.',
    sources: ['app/src/lib/supporttickets.ts', 'app/src/components/console/SupportQueue.tsx', 'docs/launch-readiness/2026-10-03-support-production-uat.md', 'docs/trust/VENDOR-RISK-REGISTER.md', 'supabase/migrations/20261008195500_support_ticket_retention.sql', 'docs/GO-NO-GO-CHECKLIST.md', 'app/public/status.html'],
  },
  {
    id: 'backup',
    title: 'Your own backup is the one that has been rehearsed.',
    what: 'A restore of the account database is rehearsed on every change, into an empty database. The production database has never been restored, and how long that would take is unmeasured.',
    instead: 'Download “Everything, as data” from Take it with you (#/export) at the start of term and after big changes. Restoring that file into a fresh browser is exercised on every build.',
    sources: ['RESTORE.md', 'app/scripts/golden-path.mjs'],
  },
  {
    id: 'classmate-rooms',
    title: 'Course rooms are not separated by school yet.',
    what: 'Today a confirmed email address of any domain can enter any school’s course room. The claim-your-school step exists and protects nothing yet; the isolation that would use it is not written.',
    instead: 'Treat a room as open to anyone with a confirmed address. Do not post what you would not say in a public hallway.',
    sources: ['SEMESTER_MARKET_READINESS.md'],
  },
  {
    id: 'ai-no-citations',
    title: 'Not every Ask Semester answer has a source to cite.',
    what: 'When Ask Semester uses saved course material, its answer details show the source title, locator and excerpt. Answers based on general knowledge have no citation; the “How to read this answer” section labels them “No source” and says what needs the official record or a person. The model is selected in Settings rather than chosen independently for each question.',
    instead: 'Open the answer details and check the cited excerpt. If the answer says “No source”, or if a date, rule or grade weighting matters, confirm it against the syllabus on the course screen (#/courses) or the official record before acting on it.',
    sources: ['app/src/intelligence/Disclosure.tsx', 'app/src/ai/converse.ts', 'app/src/ai/quality.ts'],
  },
  {
    id: 'read-only-windows',
    title: 'During maintenance the app may be read-only.',
    what: 'While the account service is being restored or repaired, a build may be deployed in read-only mode: nothing you change is sent to your account until it ends, and a banner on every screen says so.',
    instead: 'Keep working. Everything is saved on the device and goes up by itself once read-only mode ends.',
    sources: ['app/src/lib/readonly.ts', 'docs/FEATURE-FLAG-REGISTRY.md'],
  },
];

/** How a pilot user reports something, in the words the site's accessibility route uses. */
export const REPORT = {
  address: SUPPORT,
  lines: [
    `Write to ${SUPPORT}. Say which screen, what you were trying to do, and what happened; for a barrier, add the browser and assistive technology you used and put “Accessibility” in the subject.`,
    'You will get a reply from a person that says what was found and what happens next. No response time is promised yet.',
    'If an accessibility reply does not resolve it, write again with “Accessibility escalation” in the subject; it goes to the accessibility seat.',
    'Please do not test against other students’ accounts.',
  ],
} as const;

/** `docs/pilot/KNOWN-LIMITATIONS.md`, rendered. `pilotdocs.test.ts` holds the file to this. */
export function renderKnownLimitations(): string {
  const out: string[] = [
    '# Known limitations — for pilot users',
    '',
    '<!-- Rendered from app/src/lib/knownlimitations.ts by pilotdocs.test.ts. Edit the data, then run `REGISTERS=write npx vitest run src/lib/pilotdocs.test.ts` from app/. -->',
    '',
    `**As of ${KNOWN_LIMITATIONS_AS_OF}.** What does not work yet, what to do instead, and how to`,
    'report something. Every item names the file in this repository that states it;',
    'nothing here is a plan or a guess. The same list is printed on the public site',
    'at `/known-limitations/` and on the Help screen in the app, from the same data.',
    '',
    'Semester works on your device without an account, and everything below is',
    'about the edges of that. If something on this page turns out to be wrong in',
    'either direction, that is a bug: report it the same way.',
    '',
    '## What does not work yet',
    '',
  ];
  for (const l of KNOWN_LIMITATIONS) {
    out.push(`### ${l.title}`, '', `**What does not work yet.** ${l.what}`, '', `**What to do instead.** ${l.instead}`, '', `*Stated in:* ${l.sources.map((s) => `\`${s}\``).join(', ')}`, '');
  }
  out.push('## How to report something', '');
  for (const line of REPORT.lines) out.push(`- ${line}`);
  out.push('', '## How this list stays honest', '');
  out.push(
    'It is rendered from `app/src/lib/knownlimitations.ts`, where each entry cites the',
    'file that states it. `pilotdocs.test.ts` fails when a cited file is missing or',
    'when this page differs from the data. When a limitation is fixed, its entry is',
    'removed in the same change, and the date above moves.',
    '',
  );
  return out.join('\n');
}
