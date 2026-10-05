/**
 * The six kinds of record a student meets, and for each one who owns it, what
 * Semester does with it, what it never does, and where the official version is.
 *
 * As Semester takes on more of what a student's SIS and LMS did, a screen that
 * shows a record without saying *whose* record it is invites the mistake this
 * file exists to prevent: reading Semester's plan, or its estimate, or a
 * student's own claim, as the school's word. `source.ts` says where a fact came
 * from and how old it is; this says what kind of record it is and what to do
 * next, and the two are shown together (`components/RecordLabel.tsx`).
 *
 * The kinds are the record hierarchy in the roadmap this rests on. The wording
 * is held to what the product does *today*, not what it is designed to do: a
 * kind Semester has no screen for says so rather than describing a capability.
 * `RECORD_SCREENS` names the screens that carry a label, and a test holds each
 * one to it.
 */

import type { TrustKind } from './source';

export const RECORD_KINDS = ['transcript', 'degree_audit', 'plan', 'evidence', 'credential', 'portfolio'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export interface RecordFacts {
  /** What the record is called on a screen. */
  type: string;
  /** Who owns it: the one whose word it is. */
  authority: string;
  /** What Semester can do with it, today. */
  can: string;
  /** What Semester never does with it. */
  cannot: string;
  /** The official next step, in the student's terms. Never "wait for Semester". */
  next: string;
  /** How Semester usually comes by it, for the badge when a screen names no better. */
  source: TrustKind;
}

export const RECORD_FACTS: Record<RecordKind, RecordFacts> = {
  transcript: {
    type: 'Transcript',
    authority: 'The registrar',
    can: 'Show a summary you entered, and point you to the registrar.',
    cannot: 'Issue, change or vouch for an official transcript.',
    next: 'Ask the registrar for an official transcript.',
    source: 'student_entered',
  },
  degree_audit: {
    type: 'Degree audit',
    authority: 'The registrar, by your school’s rules',
    can: 'Explain requirements and test “what if” plans from numbers you enter.',
    cannot: 'Certify your progress or clear you to graduate.',
    next: 'Confirm with your advisor or run your school’s official degree audit.',
    source: 'student_entered',
  },
  plan: {
    type: 'Semester plan',
    authority: 'You',
    can: 'Let you build it, compare options and share the parts you choose.',
    cannot: 'Register you, hold a seat or promise one.',
    next: 'Enroll in your school’s official registration system.',
    source: 'student_entered',
  },
  evidence: {
    type: 'Learning evidence',
    authority: 'You, a faculty member or your school, as the source says',
    can: 'Keep it with where it came from and how far it has been confirmed.',
    cannot: 'Confirm a claim itself.',
    next: 'Ask the person or office that can confirm it.',
    source: 'student_entered',
  },
  credential: {
    type: 'Credential',
    authority: 'The issuer',
    can: 'Nothing yet: a wallet for credentials is designed, not built.',
    cannot: 'Issue a credential or check one with its issuer.',
    next: 'Ask the issuer for the credential or a link that verifies it.',
    source: 'external',
  },
  portfolio: {
    type: 'Career portfolio',
    authority: 'You',
    can: 'Let you collect work and choose what to show.',
    cannot: 'Vouch for the work or share it without you choosing to.',
    next: 'Ask a mentor, employer or the career office to review it.',
    source: 'student_entered',
  },
};

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === 'string' && (RECORD_KINDS as readonly string[]).includes(value);
}

/**
 * The screens that carry a record label, by component file, and which kind
 * each shows. A test holds each file to importing the label and to naming the
 * kind, so the list cannot say a screen is labelled when it is not. A screen
 * that shows a record and is not here is the gap, and is visible as one.
 */
export const RECORD_SCREENS: Record<string, RecordKind> = {
  'components/GraduationSimulator.tsx': 'degree_audit',
};
