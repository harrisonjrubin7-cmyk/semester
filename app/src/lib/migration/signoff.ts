/**
 * Sign-off: who must agree before a gate opens, and what makes their
 * agreement count.
 *
 * - **The institution signs for its own data.** Semester cannot attest that a
 *   bursar's ledger is right; the bursar can. Every domain names the
 *   institution role that owns it.
 * - **Separation of duties.** The preparers of the evidence (the migration
 *   lead and team) cannot sign it; an independent `semester_reviewer` does.
 *   One person cannot fill two roles.
 * - **A signature is about specific evidence.** It binds to the ledger head
 *   (`evidenceHead`). New evidence after signing — a re-run, a new exception —
 *   makes the signature stale and it must be given again.
 * - **A signature expires.** Approval of a rehearsal from March does not
 *   cover a cutover in August.
 * - **Legal conclusions are not ours.** Gates that turn on a legal reading
 *   (retention periods, consent, cross-border transfer, a guardian's
 *   rights) list `counsel` as a required role; no code here decides them.
 */
import type { ApprovalArea } from './center';
import type { DataDomain } from './types.ts';

export const GATES = [
  'mapping_approved',
  'validation_passed',
  'rehearsal_passed',
  'parallel_run_exit',
  'cutover_go',
  'post_cutover_acceptance',
  'archive_complete',
] as const;
export type Gate = (typeof GATES)[number];

/**
 * The institution's approvers are the Migration Center's own `ApprovalArea`s,
 * so a sign-off here and an approval recorded there name the same people.
 * The rest are Semester-side or outside both: an independent reviewer,
 * security, qualified counsel, and the institution's executive sponsor.
 */
export type Role = ApprovalArea | 'semester_reviewer' | 'semester_security' | 'counsel' | 'executive_sponsor';

/** The institution approver who must sign for each kind of data. */
export const DOMAIN_OWNER: Readonly<Record<DataDomain, ApprovalArea>> = {
  identity: 'it',
  academic_records: 'registrar',
  courses: 'registrar',
  learning_content: 'faculty',
  enrollments: 'registrar',
  finance: 'finance',
  family: 'data_owner',
  campus_services: 'data_owner',
  career: 'data_owner',
  documents: 'data_owner',
};

/** Roles every domain's gate needs beside its owner. */
const ALWAYS: Readonly<Record<Gate, readonly Role[]>> = {
  mapping_approved: ['semester_reviewer'],
  validation_passed: ['semester_reviewer'],
  rehearsal_passed: ['semester_reviewer', 'semester_security'],
  parallel_run_exit: ['semester_reviewer'],
  cutover_go: ['semester_reviewer', 'semester_security', 'executive_sponsor'],
  post_cutover_acceptance: ['semester_reviewer', 'executive_sponsor'],
  archive_complete: ['semester_reviewer', 'data_owner'],
};

/** Domains where a legal reading decides the gate: counsel signs as well. */
const NEEDS_COUNSEL: ReadonlySet<DataDomain> = new Set<DataDomain>(['family', 'documents', 'academic_records']);

/** Gates at which the domain owner signs. Archive is the data owner's, since they hold the records schedule. */
const OWNER_GATES: ReadonlySet<Gate> = new Set<Gate>(['mapping_approved', 'validation_passed', 'parallel_run_exit', 'cutover_go', 'post_cutover_acceptance']);

export function requiredRoles(gate: Gate, domain: DataDomain): Role[] {
  const roles = new Set<Role>(ALWAYS[gate]);
  if (OWNER_GATES.has(gate)) roles.add(DOMAIN_OWNER[domain]);
  if (NEEDS_COUNSEL.has(domain) && (gate === 'mapping_approved' || gate === 'cutover_go' || gate === 'archive_complete')) roles.add('counsel');
  return [...roles];
}

export interface Signoff {
  gate: Gate;
  domain: DataDomain;
  role: Role;
  person: string;
  at: string;
  /** `evidenceHead(ledger)` when this was given. */
  evidenceHead: string;
  decision: 'approve' | 'reject';
  /** Conditions to be met after the gate; a signature with conditions still needs them closed later. */
  conditions?: readonly string[];
}

export type SignoffProblem =
  | { code: 'missing'; role: Role }
  | { code: 'rejected'; role: Role }
  | { code: 'stale'; role: Role }
  | { code: 'expired'; role: Role }
  | { code: 'preparer_signed'; role: Role }
  | { code: 'same_person'; role: Role };

export interface SignoffStatus {
  open: boolean;
  problems: SignoffProblem[];
}

export const SIGNOFF_VALID_HOURS = 14 * 24;

export function evaluateSignoffs(
  gate: Gate,
  domain: DataDomain,
  signoffs: readonly Signoff[],
  currentHead: string,
  preparers: ReadonlySet<string>,
  now: string,
  validHours = SIGNOFF_VALID_HOURS,
): SignoffStatus {
  const problems: SignoffProblem[] = [];
  const people = new Map<string, Role>();
  for (const role of requiredRoles(gate, domain)) {
    const mine = signoffs.filter((s) => s.gate === gate && s.domain === domain && s.role === role);
    // The latest decision from the role stands; a later rejection overrides an earlier approval.
    const latest = [...mine].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
    if (!latest) { problems.push({ code: 'missing', role }); continue; }
    if (latest.decision === 'reject') { problems.push({ code: 'rejected', role }); continue; }
    if (latest.evidenceHead !== currentHead) { problems.push({ code: 'stale', role }); continue; }
    if (new Date(latest.at).getTime() + validHours * 3_600_000 < new Date(now).getTime()) { problems.push({ code: 'expired', role }); continue; }
    if (preparers.has(latest.person)) { problems.push({ code: 'preparer_signed', role }); continue; }
    if (people.has(latest.person)) { problems.push({ code: 'same_person', role }); continue; }
    people.set(latest.person, role);
  }
  return { open: problems.length === 0, problems };
}
