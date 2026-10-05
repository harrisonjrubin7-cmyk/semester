/**
 * The customer commitment register: every promise made to a named customer,
 * with the product dependency it rests on and the evidence that it was kept.
 *
 * ## Why it exists
 *
 * A sales promise and the product's reality drift apart one conversation at a
 * time. The register is where they are made to meet: a commitment names the
 * master-register rows it depends on, and `problems()` refuses a commitment
 * that claims delivery while a dependency is below `tested`, that is approved
 * by anyone but the founder seat, or that is closed with no evidence.
 *
 * ## Why it is empty
 *
 * There is no customer. The council's `champion` seat — the named person at
 * the pilot institution — is vacant, no pilot agreement is signed, and the
 * company that would sign one is not formed (docs/LAUNCH-DECISIONS.md items
 * 4, 5 and 7). `commitments.test.ts` asserts the register is empty while the
 * champion seat is vacant, so the first commitment cannot be recorded before
 * there is somebody to have made it to.
 *
 * ## What stays out
 *
 * The customer's name here is the institution or department, never a person.
 * Contract references are the identifier on the signed document, not its
 * contents; the documents themselves live in the private operations system,
 * for the same reason council acceptances and alert destinations do.
 */

import type { Seat } from '../launchreadiness';
import type { Status as RegisterStatus } from '../masterregister';

export type CommitmentStatus = 'proposed' | 'accepted' | 'in-progress' | 'delivered' | 'approved' | 'withdrawn';

export const COMMITMENT_STATUSES: readonly CommitmentStatus[] = ['proposed', 'accepted', 'in-progress', 'delivered', 'approved', 'withdrawn'];

export const STATUS_MEANING: Record<CommitmentStatus, string> = {
  proposed: 'Offered in a conversation; not yet in a signed document',
  accepted: 'In a signed document, with a due date',
  'in-progress': 'Work under way; the dependency rows say how far',
  delivered: 'Done, with evidence filed; awaiting completion approval',
  approved: 'The founder seat approved completion, and the customer was told',
  withdrawn: 'Withdrawn or renegotiated, with the customer communication recorded',
};

/** The support tiers of docs/market-readiness/SUPPORT_PLAYBOOK.md. */
export type SupportTier = 'T1' | 'T2' | 'T3';
export const SUPPORT_TIERS: readonly SupportTier[] = ['T1', 'T2', 'T3'];

export type Risk = 'P0' | 'P1' | 'P2' | 'P3';

export interface Commitment {
  /** `C-001`, `C-002`, … */
  id: string;
  /** The institution or department. Never a person. */
  customer: string;
  /** What was promised, as it was promised. */
  commitment: string;
  /** What is in, and what is out. */
  scope: string;
  /** The reference on the signed document, or `null` while proposed. */
  contractRef: string | null;
  owner: Seat;
  /** ISO date. */
  due: string;
  /** Master-register row ids the promise rests on. */
  dependsOn: readonly string[];
  supportTier: SupportTier;
  /** Repository paths, or private-system references, that show it was kept. */
  evidence: readonly string[];
  status: CommitmentStatus;
  /** The severity of missing the date, and why. */
  risk: { severity: Risk; why: string };
  /** What the customer was last told, and when. */
  communication: { on: string; said: string } | null;
  /** Completion approval. Only the founder seat may give it. */
  approval: { seat: Seat; on: string } | null;
}

export const COMMITMENTS: readonly Commitment[] = [];

/** The statuses that mean the customer is relying on the promise. */
export const BINDING: readonly CommitmentStatus[] = ['accepted', 'in-progress', 'delivered', 'approved'];

/** Register rows at or above this are real enough to promise on. */
export const PROMISABLE: readonly RegisterStatus[] = ['tested', 'evidenced', 'operational', 'launch-approved'];

export interface Context {
  /** Each master-register row the commitment might depend on, with its status. */
  register: ReadonlyMap<string, RegisterStatus>;
  seats: readonly Seat[];
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Everything wrong with one commitment. Empty means it may stand. The rules
 * are the brief's columns made to bite: a promise names what it rests on, a
 * closed promise has evidence, only the founder approves completion, and a
 * customer who is relying on something unproven has been told the risk.
 */
export function problems(c: Commitment, ctx: Context): string[] {
  const out: string[] = [];
  if (!/^C-\d{3}$/.test(c.id)) out.push(`id ${c.id} is not C-nnn`);
  if (!c.customer.trim()) out.push('no customer');
  if (/@/.test(c.customer)) out.push('customer looks like a personal address');
  if (!c.commitment.trim()) out.push('no commitment');
  if (!c.scope.trim()) out.push('no scope');
  if (!ctx.seats.includes(c.owner)) out.push(`owner ${c.owner} is not a council seat`);
  if (!ISO.test(c.due)) out.push(`due ${c.due} is not a date`);
  if (!SUPPORT_TIERS.includes(c.supportTier)) out.push(`support tier ${c.supportTier} is not one of ${SUPPORT_TIERS.join(', ')}`);
  if (!COMMITMENT_STATUSES.includes(c.status)) out.push(`status ${c.status} is unknown`);
  if (c.dependsOn.length === 0) out.push('depends on nothing: every promise rests on a register row');
  for (const id of c.dependsOn) if (!ctx.register.has(id)) out.push(`depends on ${id}, which is not a register row`);
  if (BINDING.includes(c.status) && c.contractRef === null) out.push(`${c.status} with no contract reference`);
  if (c.status === 'delivered' || c.status === 'approved') {
    if (c.evidence.length === 0) out.push(`${c.status} with no evidence`);
    const unproven = c.dependsOn.filter((id) => ctx.register.has(id) && !PROMISABLE.includes(ctx.register.get(id)!));
    if (unproven.length) out.push(`${c.status} while ${unproven.join(', ')} ${unproven.length === 1 ? 'is' : 'are'} below tested`);
  }
  if (c.status === 'approved') {
    if (!c.approval) out.push('approved with no approval');
    else if (c.approval.seat !== 'founder') out.push(`approved by ${c.approval.seat}; only the founder seat approves completion`);
    if (!c.communication) out.push('approved and the customer was not told');
  }
  if (c.status !== 'approved' && c.approval) out.push(`${c.status} but carries an approval`);
  if (c.status === 'withdrawn' && !c.communication) out.push('withdrawn and the customer was not told');
  if (BINDING.includes(c.status)) {
    const unproven = c.dependsOn.filter((id) => ctx.register.has(id) && !PROMISABLE.includes(ctx.register.get(id)!));
    if (unproven.length && !c.risk.why.trim()) out.push(`relies on ${unproven.join(', ')} below tested and names no risk`);
  }
  if (c.approval && !ISO.test(c.approval.on)) out.push('approval is undated');
  if (c.communication && !ISO.test(c.communication.on)) out.push('communication is undated');
  return out;
}
