import type { AuditEvent, KillSwitchState } from '../../types.ts';
import type { Clock } from '../store/clock.ts';
import { sha256, canonical } from '../store/hash.ts';
import { redact } from '../store/redact.ts';
import type { OperatorStore } from '../store/store.ts';

/**
 * C05 — Audit and kill switch.
 *
 * Audit events are application-written: a worker cannot write one directly,
 * only cause one through a tool or the runtime. Each event is redacted, then
 * hash-chained to the previous event, so a gap or an edit is detectable.
 */
export interface AuditLog {
  record(kind: string, actor: string, detail: Record<string, unknown>, taskId?: string): AuditEvent;
  verifyChain(): { ok: boolean; events: number; brokenAt?: number };
  events(): AuditEvent[];
}

export function createAuditLog(store: OperatorStore, clock: Clock): AuditLog {
  function hashOf(event: Omit<AuditEvent, 'hash'>): string {
    return sha256(canonical(event));
  }
  return {
    record(kind, actor, detail, taskId) {
      const events = store.audit();
      const last = events.at(-1);
      const base: Omit<AuditEvent, 'hash'> = {
        seq: (last?.seq ?? 0) + 1, at: clock.now().toISOString(), actor, kind, detail: redact(detail), prevHash: last?.hash ?? 'genesis',
        ...(taskId ? { taskId } : {}),
      };
      const event: AuditEvent = { ...base, hash: hashOf(base) };
      store.appendAudit(event);
      return event;
    },
    verifyChain() {
      const events = store.audit();
      let prev = 'genesis';
      for (const [index, event] of events.entries()) {
        const { hash, ...rest } = event;
        if (event.prevHash !== prev || hashOf(rest) !== hash || event.seq !== index + 1) return { ok: false, events: events.length, brokenAt: event.seq };
        prev = hash;
      }
      return { ok: true, events: events.length };
    },
    events: () => store.audit(),
  };
}

export interface KillSwitch {
  engaged(): boolean;
  state(): KillSwitchState;
  /** Stops new work and marks every running execution interrupted, recording any external action whose outcome is unknown. */
  engage(reason: string, by: string): { interrupted: string[] };
  release(by: string): void;
}

export function createKillSwitch(store: OperatorStore, clock: Clock, audit: AuditLog): KillSwitch {
  return {
    engaged: () => store.killSwitch().engaged,
    state: () => store.killSwitch(),
    engage(reason, by) {
      const at = clock.now().toISOString();
      store.saveKillSwitch({ engaged: true, reason, by, at });
      const interrupted: string[] = [];
      for (const execution of store.executions()) {
        if (execution.status !== 'running') continue;
        store.saveExecution({ ...execution, status: 'interrupted', endedAt: at, evidence: [...execution.evidence, { kind: 'note', label: 'kill-switch', detail: `Interrupted by ${by}: ${reason}` }] });
        const task = store.task(execution.taskId);
        if (task) store.saveTask({ ...task, status: 'interrupted', updatedAt: at, blockedReason: `Kill switch: ${reason}` });
        interrupted.push(execution.id);
      }
      audit.record('kill_switch.engaged', by, { reason, interrupted });
      return { interrupted };
    },
    release(by) {
      store.saveKillSwitch({ engaged: false });
      audit.record('kill_switch.released', by, {});
    },
  };
}
