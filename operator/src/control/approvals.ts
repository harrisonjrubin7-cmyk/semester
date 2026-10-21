import type { Approval, ToolName } from '../../types.ts';
import type { Clock } from '../store/clock.ts';
import { iso } from '../store/clock.ts';
import type { IdFactory } from '../store/ids.ts';
import type { OperatorStore } from '../store/store.ts';

/**
 * C02 — Approval service.
 *
 * An approval is bound to the exact tool, target, payload hash, optional
 * artifact hash and optional task; to an approver who is not the actor; to an
 * expiry; and to a permitted use count. Anything that differs is a different
 * action and finds no approval. The service never grants on its own: it is
 * called by the operator interface on an owner's behalf and by the policy
 * controller to look up and consume.
 */
export interface GrantInput {
  tool: ToolName;
  target: string;
  payloadHash: string;
  approver: string;
  ttlMs: number;
  usesAllowed?: number;
  taskId?: string;
  artifactHash?: string;
}

export interface ConsumeInput {
  tool: ToolName;
  target: string;
  payloadHash: string;
  taskId: string;
  actor: string;
  artifactHash?: string;
}

export type ConsumeResult = { ok: true; approval: Approval } | { ok: false; code: string; reason: string };

export interface ApprovalService {
  grant(input: GrantInput): Approval;
  /** Finds a matching, live approval without consuming it. */
  find(input: ConsumeInput): Approval | undefined;
  consume(input: ConsumeInput): ConsumeResult;
  revoke(id: string, by: string): Approval | undefined;
  list(): Approval[];
}

export function createApprovalService(store: OperatorStore, clock: Clock, ids: IdFactory): ApprovalService {
  function live(approval: Approval, input: ConsumeInput): string | undefined {
    if (approval.revoked) return 'revoked';
    if (approval.tool !== input.tool) return 'tool_mismatch';
    if (approval.target !== input.target) return 'target_mismatch';
    if (approval.payloadHash !== input.payloadHash) return 'payload_changed';
    if (approval.artifactHash && approval.artifactHash !== input.artifactHash) return 'artifact_changed';
    if (approval.taskId && approval.taskId !== input.taskId) return 'task_mismatch';
    if (approval.approver === input.actor) return 'self_approval';
    if (new Date(approval.expiresAt).getTime() <= clock.now().getTime()) return 'expired';
    if (approval.usesConsumed >= approval.usesAllowed) return 'consumed';
    return undefined;
  }

  return {
    grant(input) {
      if (!input.approver.trim()) throw new Error('An approval needs an approver.');
      if (input.ttlMs <= 0) throw new Error('An approval needs a positive lifetime.');
      const now = clock.now();
      const approval: Approval = {
        id: ids('apr'), tool: input.tool, target: input.target, payloadHash: input.payloadHash, approver: input.approver,
        grantedAt: now.toISOString(), expiresAt: new Date(now.getTime() + input.ttlMs).toISOString(),
        usesAllowed: input.usesAllowed ?? 1, usesConsumed: 0, consumedBy: [], revoked: false,
        ...(input.taskId ? { taskId: input.taskId } : {}), ...(input.artifactHash ? { artifactHash: input.artifactHash } : {}),
      };
      store.saveApproval(approval);
      return approval;
    },
    find(input) {
      return store.approvals().find((approval) => live(approval, input) === undefined);
    },
    consume(input) {
      const approvals = store.approvals();
      const reasons: string[] = [];
      for (const approval of approvals) {
        const problem = live(approval, input);
        if (problem) { reasons.push(`${approval.id}:${problem}`); continue; }
        const consumed: Approval = { ...approval, usesConsumed: approval.usesConsumed + 1, consumedBy: [...approval.consumedBy, `${input.taskId}@${iso(clock)}`] };
        store.saveApproval(consumed);
        return { ok: true, approval: consumed };
      }
      return { ok: false, code: 'approval_required', reason: reasons.length ? `No live approval matches. Candidates: ${reasons.join(', ')}` : 'No approval exists for this action.' };
    },
    revoke(id, by) {
      const approval = store.approvals().find((item) => item.id === id);
      if (!approval) return undefined;
      const revoked: Approval = { ...approval, revoked: true, consumedBy: [...approval.consumedBy, `revoked-by:${by}@${iso(clock)}`] };
      store.saveApproval(revoked);
      return revoked;
    },
    list: () => store.approvals(),
  };
}
