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
    id: 'billing-live-acceptance-2026-10-03',
    artifact: 'Production Semester Plus lifecycle acceptance: live checkout, paid invoice, entitlement, customer portal and end-of-period cancellation',
    path: 'docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md',
    produced: '2026-10-03',
    validFor: YEARLY,
    owner: 'founder',
    claims: [],
    rows: ['COM-001'],
    note: 'One owner-account acceptance run. It does not cover an annual charge, refund, failed renewal, dispute, registered-jurisdiction tax collection, Pro, institution access or general availability, and it does not authorize enabling the governed acquisition hold.',
  },
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
    id: 'production-dependency-audit-2026-10-02',
    artifact: 'Production npm dependency graph audited at the high threshold with no reported vulnerabilities, bound to the candidate commit and lockfile hash',
    path: 'docs/evidence/security/2026-10-02-production-dependency-audit.md',
    produced: '2026-10-02',
    validFor: MONTHLY,
    owner: 'security',
    claims: [],
    rows: ['SEC-004'],
    note: 'Point-in-time npm advisory evidence for production dependencies only. It is not DAST, SAST, a penetration test, provider assurance, or evidence about an unknown vulnerability. Renew on every lockfile change and at least monthly.',
  },
  {
    id: 'working-tree-secret-scan-2026-10-02',
    artifact: 'Checksum-verified Gitleaks scan of the complete working tree with no leaks found',
    path: 'docs/evidence/security/2026-10-02-working-tree-secret-scan.md',
    produced: '2026-10-02',
    validFor: MONTHLY,
    owner: 'security',
    claims: [],
    rows: ['SEC-004'],
    note: 'Point-in-time repository evidence using the version and configuration pinned by CI. It does not inspect provider-side secret stores, prove credential rotation, or replace continuous scanning. Renew for every release candidate and after credential-handling changes.',
  },
  {
    id: 'market-readiness-repository-verification-2026-10-02',
    artifact: 'Market-readiness repository verification: full regression, build, browser journeys, budgets, clean install, dependency and secret scans',
    path: 'docs/evidence/market-readiness/2026-10-02-repository-verification.md',
    produced: '2026-10-02',
    validFor: MONTHLY,
    owner: 'engineering',
    claims: [],
    rows: ['SRE-008'],
    note: 'Repository-controlled verification only. Independent assurance, legal approval, named-tenant acceptance, staffed production operation and customer outcomes remain separate gates.',
  },
  {
    id: 'founder-readiness-tabletop-2026-10-03',
    artifact: 'Founder-led incident and recovery tabletop covering a suspected cross-tenant AI disclosure and provider or model change',
    path: 'docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md',
    produced: '2026-10-03',
    validFor: QUARTERLY,
    owner: 'founder',
    claims: [],
    rows: ['AI-014', 'SEC-007', 'SRE-006'],
    note: 'Document and repository walkthrough only. Target alerting, staffed escalation, customer communication, provider recovery and two-person release approval remain open.',
  },
  {
    id: 'public-production-smoke-2026-10-03',
    artifact: 'Point-in-time public production smoke covering the frontend, deployed assets and the committed Supabase public API configuration',
    path: 'docs/evidence/operations/2026-10-03-public-production-smoke.md',
    produced: '2026-10-03',
    validFor: MONTHLY,
    owner: 'engineering',
    claims: [],
    rows: ['SRE-002'],
    note: 'One reachability observation, not availability history, institutional gateway monitoring, alert delivery, authenticated UAT, SLA evidence or named-tenant acceptance.',
  },
  {
    id: 'main-ci-red-diagnosis-2026-10-04',
    artifact: 'Diagnosis of the block of red CI runs on main on 4 October 2026, read from the Actions run history and two failing jobs\' logs',
    path: 'docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md',
    produced: '2026-10-04',
    validFor: MONTHLY,
    owner: 'engineering',
    claims: [],
    rows: ['SEC-003'],
    note: 'Two of 26 failing runs were read; no ruleset, required status or workflow was changed. Branch protection and merge gating remain unapplied.',
  },
  {
    id: 'founder-assurance-run-2026-10-03',
    artifact: 'Founder-operated repository assurance run across AI containment, prompt-injection, institutional policy, authentication and membership suites',
    path: 'docs/evidence/security/2026-10-03-founder-assurance-run.md',
    produced: '2026-10-03',
    validFor: MONTHLY,
    owner: 'security',
    claims: [],
    rows: ['SEC-003'],
    note: 'Repository-scoped automated evidence. It is not target DAST, an independent penetration test, provider validation, deployment proof or named-tenant acceptance.',
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
