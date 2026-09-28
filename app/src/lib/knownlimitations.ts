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
export const KNOWN_LIMITATIONS_AS_OF = '2026-09-28';

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
    title: 'The same note edited on two devices keeps the later edit.',
    what: 'Lists you add to keep both sides when devices sync, but one record edited on both devices before either syncs is not merged: the later edit of it survives. Files you attach do not sync at all; they stay on the device they were added on.',
    instead: 'Let one device sync (the Account screen says Synced) before editing the same item on another. Keep attachments on the device you use most, or put them in Take it with you (#/export).',
    sources: ['app/src/lib/cloud.ts', 'app/src/lib/merge.ts'],
  },
  {
    id: 'offline-high-risk',
    title: 'Offline, sharing and sending wait — nothing is queued.',
    what: 'Sharing, sending something to your school, publishing, deleting your account and opening an official site are refused while you are offline, with a sentence saying nothing was sent and nothing is waiting. Everything else is saved on the device and syncs when you are back.',
    instead: 'Do those five things when you have a connection. The banner under the header says when you are offline and when the changes you made have gone up.',
    sources: ['app/src/lib/offline-mode.ts'],
  },
  {
    id: 'offline-delete',
    title: 'A course deleted offline can come back.',
    what: 'Delete a course while offline and close the app before it syncs, and the next sync brings the course back from your account.',
    instead: 'Delete it again once you are online. It is visible and takes one tap; the alternative was a course silently lost, which is why it works this way.',
    sources: ['app/src/lib/cloud.ts'],
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
    what: 'Both exist as drafts for a lawyer and carry open decisions: the legal entity, the minimum age, liability, governing law. Neither has been reviewed or put in force.',
    instead: 'Read Privacy and your rights in the app (#/privacy) for what leaves your device and what deleting removes; that page is held to the code by a test. You can export or delete everything at any time.',
    sources: ['docs/legal/TERMS-OF-SERVICE-DRAFT.md', 'docs/legal/PRIVACY-POLICY-DRAFT.md', 'app/src/lib/privacy.ts'],
  },
  {
    id: 'no-sale',
    title: 'Nothing is for sale, and nothing can be bought.',
    what: 'Plus and Pro show planned prices so you know what to expect. There is no checkout and no billing in the app, and during the pilot every student feature is free.',
    instead: 'Nothing to do. If a page asks you to pay for Semester, it is not Semester.',
    sources: ['app/src/lib/plans.ts', 'ops/claims/README.md'],
  },
  {
    id: 'support-one-address',
    title: 'Support is one address, read by a person, with no promised response time.',
    what: 'There is no support desk, no ticket system you can watch, and no response time anybody has committed to. The status page checks the service from your own browser when you open it; it keeps no history and sends no notifications.',
    instead: 'Write to the address below with the screen, what you were doing and what you saw. For “is it down?”, open the status page from Help; Up means your browser reached it just now.',
    sources: ['app/src/lib/privacy.ts', 'docs/GO-NO-GO-CHECKLIST.md', 'app/public/status.html'],
  },
  {
    id: 'backup',
    title: 'Your own backup is the one that has been rehearsed.',
    what: 'A restore of the account database has passed as a local rehearsal. The production database has never been restored, and how long that would take is unmeasured.',
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
    title: 'Ask Semester does not cite its sources.',
    what: 'Answers do not say which reading or syllabus line they came from, and which model answers is a setting rather than chosen for the question asked. When the assistant cannot help it says why.',
    instead: 'Check any date, rule or grade weighting against the syllabus on the course screen (#/courses) before acting on it.',
    sources: ['SEMESTER_MARKET_READINESS.md'],
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
