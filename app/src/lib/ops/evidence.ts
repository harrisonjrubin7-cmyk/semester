/**
 * The evidence register: every dated artifact the repository holds today,
 * how long it is good for, and which public claims and register rows rest
 * on it.
 *
 * ## Why a date and a validity, not a word
 *
 * The prototype marked documents "current". A word typed beside a document is
 * a claim about the document that nothing re-checks, and the failure it
 * invites is the usual one: a restore rehearsed once, still "current" a year
 * later. So a record here carries the date the artifact was produced, read
 * from the file that states it, and the number of days it stays good for,
 * from the cadence the operating rhythm sets. `evidenceState()` turns the two
 * into a state for a given day — `current`, `expiring` with the escalation
 * step from `console.ts` that applies, or `expired` — and the console's
 * Evidence view, the claims register and the procurement pack read that
 * state rather than a word.
 *
 * ## What is in it
 *
 * Only artifacts that exist, with the dates their files state. The tree holds
 * dated AI, advisor, restore, milestone-verification, procurement, security,
 * governance, and regression records, and each is here with what rests on it.
 * The master register and `docs/PROOF-CALENDAR.md` still govern which records
 * can advance a row and which artifacts remain due. `evidence.test.ts` refuses a
 * record whose file does not state its date, and `claims.test.ts` refuses an
 * “available” claim that rests on an expired record.
 *
 * `docs/EVIDENCE-REGISTER.md` is rendered from this file by `evidence.test.ts`;
 * edit the data, then `npm run registers` from app/.
 */

import type { Seat } from '../launchreadiness';
import { escalation, type Escalation } from './console';

// ── cadences ───────────────────────────────────────────────────────────────

/** Days an artifact stays good for, by the cadence that renews it. */
export const MONTHLY = 30;
export const QUARTERLY = 91;
export const HALF_YEARLY = 182;
export const YEARLY = 365;

// ── records ────────────────────────────────────────────────────────────────

export interface EvidenceRecord {
  id: string;
  /** What was produced, as a reviewer would name it. */
  artifact: string;
  /** Repository-relative; must exist, and must state `produced`. */
  path: string;
  /** ISO date the artifact was produced, as `path` states it. */
  produced: string;
  /** Days it stays good for. */
  validFor: number;
  owner: Seat;
  /** Claim ids from claims.ts that rest on it. */
  claims: readonly string[];
  /** Master-register rows it is evidence for. */
  rows: readonly string[];
  note?: string;
}

export const EVIDENCE: readonly EvidenceRecord[] = [
  {
    id: 'ai-killswitch-drill',
    artifact: 'AI kill-switch drill against production: kill.ai_generation engaged, the deployed claude function refusing, released, each step timed',
    path: 'docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json',
    produced: '2026-09-29',
    validFor: QUARTERLY,
    owner: 'engineering',
    claims: [],
    rows: ['AI-012'],
    note: 'Held, 3 of 3: answered 200 before, refused 503 with the runtime’s own sentence while engaged, answered 200 after release. The institution gateway is not deployed and was not observed; aikillswitch.test.ts holds it to the same switch. Renewed by the quarterly DR exercise.',
  },
  {
    id: 'ai-injection-redteam',
    artifact: 'Prompt-injection red-team against the real model: three canaries in the material of seven prompt builders, 21 cases, through the shared key’s proxy',
    path: 'docs/evidence/ai/injection-redteam-2026-09-29T22-58-56-465Z-claude-opus-5.json',
    produced: '2026-09-29',
    validFor: QUARTERLY,
    owner: 'engineering',
    claims: [],
    rows: ['AI-010'],
    note: 'Held, 21 of 21 on claude-opus-5: no reply carried a canary. One model, one run; a model or prompt-builder change is a reason to run it again (REDTEAM=write, app/src/ai/injection.live.test.ts).',
  },
  {
    id: 'advisor-before-2026-09-30',
    artifact: 'Production security and performance advisor read before the reconciliation: 49 policy-less tables, 180 signed-in-callable definer functions, four unindexed foreign keys, two tables without a primary key',
    path: 'docs/evidence/advisors/2026-09-30-before.json',
    produced: '2026-09-30',
    validFor: MONTHLY,
    owner: 'engineering',
    claims: [],
    rows: ['IAM-008'],
    note: 'The before column of docs/ADVISOR-RECONCILIATION-2026-09-30.md, read-only. The after reading on production is not taken until the migration is applied, which needs separate authorization. Renewed by re-running supabase/advisor-probe.sql.',
  },
  {
    id: 'release-secret-verification',
    artifact: 'Release secret verification across the current tree, reachable Git history, release range, production bundle and isolated institutional-preview bundle',
    path: 'docs/evidence/security/2026-10-01-secret-verification.md',
    produced: '2026-10-01',
    validFor: QUARTERLY,
    owner: 'security',
    claims: [],
    rows: ['SEC-003', 'SEC-004'],
    note: 'Gitleaks 8.28.0 found no credential in the current tree, reachable history or release range; the redacting artifact scanner found none in either browser bundle. Provider stores and build logs were not audited. Renew on a credential-handling change and at least quarterly.',
  },
  {
    id: 'production-controls-2026-10-02',
    artifact: 'Live production-host security-header probe and production Supabase Auth rate-limit dashboard reading',
    path: 'docs/evidence/production/2026-10-02-production-controls.md',
    produced: '2026-10-02',
    validFor: QUARTERLY,
    owner: 'security',
    claims: [],
    rows: ['SEC-007', 'SRE-001'],
    note: 'The Vercel production URL served CSP, HSTS, nosniff, referrer and permissions policies. Auth email (2/hour), sign-in/sign-up, OTP, refresh, SMS, anonymous and Web3 values were read from the production project dashboard; no setting was changed.',
  },
  {
    id: 'terms-privacy-review-attestation-2026-09-30',
    artifact: 'Owner attestation that Jessica Springsteen reviewed the terms and privacy materials and Harrison Rubin approved the reviewed materials',
    path: 'docs/evidence/legal/2026-09-30-terms-privacy-review-attestation.md',
    produced: '2026-09-30',
    validFor: YEARLY,
    owner: 'privacy',
    claims: [],
    rows: ['LEG-001'],
    note: 'Records the owner-provided reviewer, timestamp and approval. Reviewer qualification was not independently verified, and open DECIDE fields mean the drafts are not yet represented as in force.',
  },
  {
    id: 'restore-rehearsal',
    artifact: 'Backup restore rehearsal: a logical dump restored locally, schema and row counts compared',
    path: 'docs/GO-NO-GO-CHECKLIST.md',
    produced: '2026-09-21',
    validFor: QUARTERLY,
    owner: 'engineering',
    claims: ['restore-drill'],
    rows: ['SRE-004', 'SRE-005'],
    note: 'The go/no-go checklist records the pass date; RESTORE.md and supabase/restore.sh hold the procedure and state no date. Production has never been restored, which is why the claim stays in preparation. Renewed by the quarterly disaster-recovery exercise.',
  },
  {
    id: 'restore-rehearsal-offboarding',
    artifact: 'Backup restore rehearsal after the school-offboarding migration: a logical dump restored locally, 308 tables, schema and row counts compared, timed',
    path: 'docs/evidence/restore/2026-09-30-logical-rehearsal.md',
    produced: '2026-09-30',
    validFor: QUARTERLY,
    owner: 'engineering',
    claims: [],
    rows: ['SRE-004', 'SRE-005'],
    note: 'A rehearsal in a throwaway database with one account, not a restore of the live project. Production has never been restored; release gate G5 stays unmet until it is, on a non-production project, by someone other than the author.',
  },
  {
    id: 'production-physical-restore-2026-10-02',
    artifact: 'Production physical-backup restore to a separate Supabase project, with source/restore RLS, event-trigger, table and gateway-journal verification',
    path: 'docs/evidence/restore/2026-10-02-production-physical-restore.md',
    produced: '2026-10-02',
    validFor: QUARTERLY,
    owner: 'engineering',
    claims: ['restore-drill'],
    rows: ['SRE-004', 'SRE-005'],
    note: 'Supabase marked the restore completed. RLS and ensure_rls survived and the gateway journal relation was present; production had one newer public table. The dashboard view did not expose the start timestamp, so RTO remains unmeasured and the timed-restore gate stays open.',
  },
  {
    id: 'pages-rollback-drill-2026-10-02',
    artifact: 'Protected GitHub Pages production rollback to the prior main release, live smoke, restoration of current main, and repeat live smoke',
    path: 'docs/evidence/rollback/2026-10-02-pages-rollback-drill.md',
    produced: '2026-10-02',
    validFor: QUARTERLY,
    owner: 'engineering',
    claims: [],
    rows: ['SRE-006'],
    note: 'The tag path was correctly rejected by production environment protection. Re-running the prior successful main deployment rolled back in 1m03s; re-running current main restored it in 1m18s; the live HTML, module, stylesheet and Supabase probe passed after both transitions.',
  },
  {
    id: 'm1-m2-automated-verification',
    artifact: 'M1/M2 automated verification: 21 focused workflow files, 355 tests, Master Plan controls, TypeScript, lint and a production build',
    path: 'docs/evidence/m1-m2/2026-09-30-automated-verification.md',
    produced: '2026-09-30',
    validFor: MONTHLY,
    owner: 'engineering',
    claims: [],
    rows: ['SRE-008'],
    note: 'Repository-only evidence. It does not prove deployment, live tenant isolation, human accessibility, production restore, or a student pilot. Renew on a material M1/M2 change or monthly.',
  },
  {
    id: 'offboarding-hosted-rehearsal',
    artifact: 'School offboarding walked end to end on a hosted Supabase preview database with synthetic schools and accounts, inside a rolled-back transaction',
    path: 'docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md',
    produced: '2026-09-30',
    validFor: QUARTERLY,
    owner: 'engineering',
    claims: [],
    rows: ['LEG-004'],
    note: 'Run by the author on an empty disposable preview, not by a second person and not on production; the compact script omits some of the 98 local checks. The purge is not built and the export file is generated elsewhere.',
  },
  {
    id: 'hecvat-draft',
    artifact: 'HECVAT draft response, not sent',
    path: 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md',
    produced: '2026-09-28',
    validFor: YEARLY,
    owner: 'security',
    claims: ['hecvat'],
    rows: ['SEC-001', 'SEC-011'],
    note: 'A draft written from the repository; the claim stays planned until one is sent. A HECVAT is re-issued yearly.',
  },
  {
    id: 'owner-attestations',
    artifact: 'Owner attestations: company ownership, and multi-factor sign-in on the GitHub, Google and Supabase accounts',
    path: 'docs/market-readiness/HECVAT_DRAFT_RESPONSE.md',
    produced: '2026-09-28',
    validFor: QUARTERLY,
    owner: 'security',
    claims: [],
    rows: ['IAM-005'],
    note: 'Attested, not independently checked; the file says to keep a screenshot of each account’s security page. Renewed at the quarterly access review.',
  },
  {
    id: 'security-whitepaper',
    artifact: 'Security whitepaper, version 0.1, draft',
    path: 'docs/trust/SECURITY-WHITEPAPER.md',
    produced: '2026-09-28',
    validFor: HALF_YEARLY,
    owner: 'security',
    claims: [],
    rows: ['SEC-013'],
    note: 'Its own control table says: next review before the first institutional security review, and at least every six months.',
  },
  {
    id: 'master-register-reread',
    artifact: 'Master launch readiness register re-read, row by row, against origin/main at fd8fc0b',
    path: 'docs/MASTER-LAUNCH-READINESS-REGISTER.md',
    produced: '2026-09-28',
    validFor: MONTHLY,
    owner: 'founder',
    claims: [],
    rows: ['PRG-002'],
    note: 'Every public claim rests on rows of this register, so the re-read is the evidence that their floors were checked. Reviewed monthly, per SEMESTER-OPERATING-SYSTEM.md.',
  },
  {
    id: 'operating-system-review',
    artifact: 'Operating-system register review: every authoritative document read and standing',
    path: 'SEMESTER-OPERATING-SYSTEM.md',
    produced: '2026-09-28',
    validFor: MONTHLY,
    owner: 'founder',
    claims: [],
    rows: ['PRG-002'],
    note: 'The registers that change with every merge are reviewed monthly, the rest quarterly; the earlier of the two is the register’s own validity.',
  },
  {
    id: 'regression-baseline',
    artifact: 'Regression checklist: the full suite, typecheck, lint and build re-taken and recorded',
    path: 'REGRESSION-CHECKLIST.md',
    produced: '2026-09-21',
    validFor: MONTHLY,
    owner: 'engineering',
    claims: [],
    rows: ['SRE-008'],
    note: 'A measured run with its figures, not the suite itself; CI runs the suite on every change, and this record is the last time somebody wrote the figures down.',
  },
];

export function evidence(id: string): EvidenceRecord {
  const found = EVIDENCE.find((r) => r.id === id);
  if (!found) throw new Error(`No evidence record ${id}`);
  return found;
}

// ── state ──────────────────────────────────────────────────────────────────

export type EvidenceWord = 'current' | 'expiring' | 'expired';

export const EVIDENCE_WORD_MEANING: Record<EvidenceWord, string> = {
  current: 'More than thirty days to expiry; nothing is due',
  expiring: 'Thirty days or fewer; the escalation step for the days left applies',
  expired: 'Past its validity: superseded, out of the procurement pack, and every claim resting on it flagged',
};

export interface EvidenceState {
  /** ISO date: `produced` plus `validFor` days. */
  expires: string;
  /** Days from `today` to `expires`; negative once past. */
  daysLeft: number;
  /** The escalation step that applies, or `null` while none does. */
  step: Escalation | null;
  state: EvidenceWord;
}

const DAY = 86_400_000;

const utc = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** `iso` plus `days`, as an ISO date. */
export function addDays(iso: string, days: number): string {
  return new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY);
}

/** Where a record stands on `today` (an ISO date, passed in; nothing here reads the clock). */
export function evidenceState(record: Pick<EvidenceRecord, 'produced' | 'validFor'>, today: string): EvidenceState {
  const expires = addDays(record.produced, record.validFor);
  const daysLeft = daysBetween(today, expires);
  const step = escalation(daysLeft);
  return { expires, daysLeft, step, state: daysLeft <= 0 ? 'expired' : step ? 'expiring' : 'current' };
}

/**
 * The register rows, of those given, that no longer have a current artifact
 * under `docs/evidence/`: every filed path they cite is either unregistered
 * here or registered and expired on `today`. A row past `tested` is only as
 * current as its drill, so each one named must be re-drilled or come back
 * down to `tested` (Codex on #994: AI-012 would otherwise stay `evidenced`
 * after its quarterly drill ran out).
 */
export function staleRows(
  rows: readonly { id: string; evidence: readonly { path: string }[] }[],
  records: readonly EvidenceRecord[],
  today: string,
): string[] {
  return rows
    .filter((row) => {
      const filed = row.evidence.map((e) => e.path).filter((p) => p.startsWith('docs/evidence/'));
      const backing = records.filter((r) => r.rows.includes(row.id) && filed.includes(r.path));
      return backing.length === 0 || backing.every((r) => evidenceState(r, today).state === 'expired');
    })
    .map((row) => row.id);
}

/** The ids of the records under `claimId` that have expired on `today`; the shape `claims.ts` `Facts.expiredEvidence` takes. */
export function expiredUnder(records: readonly EvidenceRecord[], today: string): (claimId: string) => string[] {
  return (claimId) => records.filter((r) => r.claims.includes(claimId) && evidenceState(r, today).state === 'expired').map((r) => r.id);
}
