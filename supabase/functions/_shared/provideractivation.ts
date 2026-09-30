/**
 * Whether Semester's shared AI key may serve anybody at all.
 *
 * The `claude` function served every signed-in account whenever the
 * `ANTHROPIC_API_KEY` secret was set. On 29 September 2026 it did: the
 * kill-switch drill (`docs/evidence/ai/killswitch-drill-…`) got 200 from it
 * before and after the switch. At that moment Semester had no legal entity to
 * be the Customer, had accepted no provider terms in its own name, had decided
 * nothing about student records or retention, and nobody had approved who the
 * key may serve (`docs/trust/PROVIDER-TERMS.md`). A secret is a credential, not
 * an agreement, and setting one is all it took.
 *
 * So the key now needs two things, and either alone serves nobody:
 *
 *  1. **The record below, complete.** Five owner decisions, each recorded with
 *     a file under `docs/evidence/vendors/` that shows it happened. A decision
 *     reaches this file only through a pull request, and
 *     `app/src/lib/trust/provideractivation.test.ts` refuses a recorded
 *     decision whose evidence file is not in the tree.
 *  2. **`SHARED_AI_PROVIDER=on`** on the deployment, set by whoever runs it.
 *     A complete record does not switch the key on by being merged.
 *
 * Every field starts at `pending-owner`, and nothing in this repository may
 * move one: forming a company, accepting terms, deciding what counts as an
 * education record, choosing a retention setting and approving an audience are
 * the owner's acts, not code. `blockers` says, in words, which are still owed.
 *
 * Pure and dependency-free, like `killswitch.ts` beside it, so the app's test
 * suite holds the same object the deployed function reads.
 */

/** Owed by the owner, and not yet done. */
export interface Pending {
  status: 'pending-owner';
  /** What the owner has to do, in one sentence. */
  next: string;
}

/** Done, with the file that shows it. */
export type Recorded<T> = T & {
  status: 'recorded';
  /** A path under `docs/evidence/vendors/`. The test refuses one that is not in the tree. */
  evidence: string;
  /** YYYY-MM-DD, the day the owner recorded it. */
  recordedOn: string;
};

export interface SharedProviderActivation {
  provider: 'Anthropic';
  /** The company that is the Customer. The terms bind an entity, and there is none until one is formed. */
  legalEntity: Pending | Recorded<{ name: string; jurisdiction: string }>;
  /** Anthropic's Commercial Terms, accepted by that entity for the account the key belongs to. */
  termsAccepted: Pending | Recorded<{ terms: string; account: string }>;
  /**
   * What happens to student education records. Either a FERPA or student-data
   * addendum is signed, or counsel has concluded the shared key carries none.
   * Both are the owner's call with counsel, and neither is assumed.
   */
  studentData: Pending | Recorded<{ decision: 'student-data-addendum-signed' | 'no-education-records-counsel-opinion' }>;
  /** The retention the provider applies to this account: zero retention if granted, or the default knowingly accepted. */
  retention: Pending | Recorded<{ setting: 'zero-data-retention-granted' | 'standard-retention-accepted' }>;
  /**
   * Who the key may serve. The shared key serves individual accounts with no
   * school, so `individuals` has to be true for it to serve anybody. A school
   * named in `institutions` is one that approved it for its own students.
   */
  approval: Pending | Recorded<{ individuals: boolean; institutions: readonly string[] }>;
}

export const REQUIREMENTS = ['legalEntity', 'termsAccepted', 'studentData', 'retention', 'approval'] as const;
export type Requirement = (typeof REQUIREMENTS)[number];

/** What each requirement is called when it is owed. */
export const NAMED: Record<Requirement, string> = {
  legalEntity: 'a legal entity to be the Customer',
  termsAccepted: "Anthropic's Commercial Terms accepted by that entity",
  studentData: 'a decision on student education records (an addendum, or counsel’s opinion that none are sent)',
  retention: 'a retention setting for the account',
  approval: 'an approval of who the shared key may serve',
};

/**
 * The record as it stands. Every field is owed; nothing has been formed,
 * accepted, decided or approved. Change a field only in a pull request that
 * adds its evidence file, and only after the act itself has happened.
 */
export const SHARED_PROVIDER: SharedProviderActivation = {
  provider: 'Anthropic',
  legalEntity: { status: 'pending-owner', next: 'Form the company that will be the Customer in each provider agreement.' },
  termsAccepted: { status: 'pending-owner', next: "Open the Anthropic Console organization under that company, accepting the Commercial Terms, and file the acceptance." },
  studentData: { status: 'pending-owner', next: 'Get Anthropic’s answer on a student-data addendum, and with counsel decide whether the shared key may carry education records.' },
  retention: { status: 'pending-owner', next: 'Request zero data retention, or record that the default retention is knowingly accepted.' },
  approval: { status: 'pending-owner', next: 'Record who the shared key may serve: individual students, and any school that approved it.' },
};

/** The deployment switch, the second half of the gate. Exactly `on`, nothing else. */
export const SWITCH = 'SHARED_AI_PROVIDER';

/**
 * A file under `docs/evidence/vendors/`, named plainly: every segment starts
 * with a letter, digit, `_` or `-` (so `.` and `..` cannot walk out of the
 * folder), and the last one has an extension (so a folder is not evidence).
 * The test also checks the path is a file in the tree.
 */
const EVIDENCE = /^docs\/evidence\/vendors\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.[A-Za-z0-9]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Each requirement still owed, in words, in a fixed order. Empty means the record is complete. */
export function blockers(record: SharedProviderActivation): string[] {
  const out: string[] = [];
  for (const r of REQUIREMENTS) {
    const field = record[r];
    if (field.status !== 'recorded') {
      out.push(`${NAMED[r]}: pending the owner`);
      continue;
    }
    if (!EVIDENCE.test(field.evidence)) out.push(`${NAMED[r]}: recorded without evidence under docs/evidence/vendors/`);
    else if (!DAY.test(field.recordedOn)) out.push(`${NAMED[r]}: recorded without a date`);
  }
  const approval = record.approval;
  if (approval.status === 'recorded' && !approval.individuals) {
    out.push(`${NAMED.approval}: it does not cover individual accounts, which are the only callers the shared key serves`);
  }
  return out;
}

export interface Activation {
  active: boolean;
  /** Why not, in words. Empty only when active. */
  blockers: string[];
}

/** Whether the shared key may serve anybody: a complete record and the switch set to exactly `on`. */
export function activation(record: SharedProviderActivation, switchValue: string | undefined): Activation {
  const owed = blockers(record);
  const on = (switchValue ?? '').trim() === 'on';
  if (!on) owed.push(`the deployment switch ${SWITCH} is not set to on`);
  return { active: owed.length === 0, blockers: owed };
}

/** The error code the function answers with, so the app can tell this refusal from a missing key. */
export const NOT_ACTIVATED = 'shared_provider_not_activated';

/** Said to the caller. Nothing about who is to blame, and the way to carry on. */
export const NOT_ACTIVATED_MESSAGE =
  "The shared key is switched off until Semester's agreements with its AI provider are in place. " +
  'Add your own key under Ask Claude → Settings to carry on.';
