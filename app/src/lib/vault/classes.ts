/**
 * What may be kept on a device at all — one table, read by every writer.
 *
 * `lib/sync/classes.ts` decides what may be *sent* once the connection is
 * back. This decides what may be *stored* while it is gone, which is a
 * different question and, until now, had no single answer: the
 * `semester-store` database and a dozen localStorage keys each kept whatever
 * their feature put in them (`docs/architecture/offline-sync-contract.md`,
 * "Current evidence"). The vault asks this table before it writes a byte.
 *
 * The rows are the contract's table, not new policy. A class not listed
 * here cannot be written: `DataClass` is the whole vocabulary, and a caller
 * that needs a new one adds a row and says why.
 *
 * ## Why "deny" is the right default for the official classes
 *
 * A grade, a bill or a hold cached on a lost phone is a disclosure; the same
 * value shown offline is a convenience that goes stale. The student loses
 * little by seeing "needs a connection" for the first and a great deal by
 * the second. So those classes are refused here rather than encrypted: an
 * encrypted copy of a record the contract says is online-authoritative is
 * still a second copy to expire, wipe and reconcile.
 */

export const DATA_CLASSES = [
  'personal_plan', //        tasks, personal calendar annotations, goals
  'student_draft', //        notes, drafts, study guides, portfolio drafts
  'assignment_meta', //      short-lived, allowlisted assignment metadata
  'official_record', //      grades, transcripts, registration, holds
  'financial', //            billing, aid, payment state
  'protected_case', //       conduct, wellness, accessibility, health
  'source_raw', //           raw SIS/LMS records and submission receipts
  'guardian_control', //     guardian projections and institution controls
  'credential', //           provider tokens, service secrets
] as const;
export type DataClass = (typeof DATA_CLASSES)[number];

export interface OfflineRule {
  /** `allow` is kept in full, `allowlisted` only the named fields, `deny` never. */
  offline: 'allow' | 'allowlisted' | 'deny';
  /** Oldest a kept copy may be before it is discarded unread. `null`: no expiry. */
  maxAgeMs: number | null;
  /** Who wins when the device and the server disagree. */
  authority: 'student_hlc' | 'student_versioned' | 'source' | 'online_only';
  /** Why — the sentence a reviewer reads. */
  why: string;
}

const DAY = 24 * 60 * 60 * 1000;

export const OFFLINE_RULES: Record<DataClass, OfflineRule> = {
  personal_plan: {
    offline: 'allow', maxAgeMs: null, authority: 'student_hlc',
    why: 'The student’s own state. Field-aware last-writer-wins on a hybrid logical clock keeps independent edits from two devices.',
  },
  student_draft: {
    offline: 'allow', maxAgeMs: null, authority: 'student_versioned',
    why: 'The student’s own writing. Versioned, so a conflict becomes a copy rather than a loss; CRDT only if it is ever collaborative.',
  },
  assignment_meta: {
    offline: 'allowlisted', maxAgeMs: 14 * DAY, authority: 'source',
    why: 'Titles and due dates are needed on a train; the source system owns them, so a stale copy expires rather than lingers.',
  },
  official_record: {
    offline: 'deny', maxAgeMs: null, authority: 'online_only',
    why: 'Authoritative at the school. A cached copy is a second record to expire, wipe and reconcile.',
  },
  financial: {
    offline: 'deny', maxAgeMs: null, authority: 'online_only',
    why: 'Billing and aid are authoritative at the school and the processor; a stale balance is worse than none.',
  },
  protected_case: {
    offline: 'deny', maxAgeMs: null, authority: 'online_only',
    why: 'Conduct, wellness, accessibility and health records are the ones a lost device must never reveal.',
  },
  source_raw: {
    offline: 'deny', maxAgeMs: null, authority: 'source',
    why: 'Raw SIS/LMS payloads and receipts belong to the source; only allowlisted derived fields travel (`assignment_meta`).',
  },
  guardian_control: {
    offline: 'deny', maxAgeMs: null, authority: 'online_only',
    why: 'A consent or projection read offline could outlive its revocation.',
  },
  credential: {
    offline: 'deny', maxAgeMs: null, authority: 'online_only',
    why: 'Tokens and secrets never go in a content store; they have a secure credential store of their own.',
  },
};

/** Fields of `assignment_meta` that may be kept. Anything else is dropped, not encrypted. */
export const ASSIGNMENT_META_FIELDS = ['courseId', 'title', 'dueAt', 'kind', 'sourceId', 'sourceFetchedAt'] as const;

export type Verdict = { ok: true; rule: OfflineRule } | { ok: false; reason: 'denied_class' | 'unknown_class'; why: string };

/** May this class be kept on a device? */
export function mayKeep(cls: string): Verdict {
  const rule = (OFFLINE_RULES as Record<string, OfflineRule | undefined>)[cls];
  if (!rule) return { ok: false, reason: 'unknown_class', why: `“${cls}” is not a data class, so it is not kept offline.` };
  if (rule.offline === 'deny') return { ok: false, reason: 'denied_class', why: rule.why };
  return { ok: true, rule };
}

/** Keep only what the class's allowlist permits. A class with no allowlist is returned whole. */
export function minimise(cls: DataClass, value: Record<string, unknown>): Record<string, unknown> {
  if (OFFLINE_RULES[cls].offline !== 'allowlisted') return value;
  const keep = new Set<string>(ASSIGNMENT_META_FIELDS);
  return Object.fromEntries(Object.entries(value).filter(([k]) => keep.has(k)));
}
