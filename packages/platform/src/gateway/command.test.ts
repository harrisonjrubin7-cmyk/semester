import { describe, expect, it } from '../../../../app/node_modules/vitest/dist/index.js';
import { openApproval, decide, consume as consumeApproval, type ApprovalRequest } from '../identity/approval.ts';
import { hashOf } from '../kernel/canonical.ts';
import { TENANT_A, TENANT_B, harness, type Snapshottable } from '../testing/memory.ts';
import { runCommand, type CommandDefinition, type CommandDeps } from './command.ts';
import { PlatformError } from './errors.ts';
import type { ActionRule } from '../policy/engine.ts';

const RULES: ActionRule[] = [
  { action: 'grade.amend', capability: 'grades.amend', classificationCeiling: 'education_record', requiresApproval: true },
  { action: 'note.add', capability: null, ownerMay: true, classificationCeiling: 'student_private' },
];

class Approvals implements Snapshottable {
  rows = new Map<string, ApprovalRequest>();
  async find(tenantId: string, id: string) {
    const r = this.rows.get(id);
    return r && r.tenantId === tenantId ? structuredClone(r) : undefined;
  }
  async consume(tenantId: string, id: string) {
    const r = this.rows.get(id);
    if (!r || r.tenantId !== tenantId) throw new PlatformError('not_found', 'No such approval.');
    const c = consumeApproval(r, Date.parse('2026-10-04T12:00:00Z'));
    if (!c.ok) throw new PlatformError('precondition_failed', c.reason);
    this.rows.set(id, c.request);
  }
  snapshot() {
    return structuredClone(this.rows);
  }
  restore(s: unknown) {
    this.rows = s as Map<string, ApprovalRequest>;
  }
}

function setup() {
  const h = harness(RULES, ({ registry, dirs }) => {
    registry.register('grades.amend');
    registry.defineRole({ role: 'registrar', capabilities: ['grades.amend'] });
    dirs.get(TENANT_A)!.add({ id: 'dept', tenantId: TENANT_A, kind: 'department', parentId: null, name: 'Econ' });
  });
  const approvals = new Approvals();
  h.enroll(approvals);
  let opened = 0;
  const writes: string[] = [];
  const deps: CommandDeps = {
    ...h.deps,
    approvals,
    openApproval: async (ctx, action, subject, changeHash) => {
      const id = `ap-${++opened}`;
      const v = openApproval({ id, tenantId: ctx.tenantId, action, subject, changeHash, requestedBy: ctx.actor.personId, requestedAt: h.clock.now().toISOString(), expiresAt: '2026-10-06T12:00:00Z', requiredApprovals: 1 });
      if (!v.ok) throw new Error(v.reason);
      approvals.rows.set(id, v.request);
      return { id };
    },
  };
  const amend: CommandDefinition<{ gradeId: string; to: string }, { ok: true }> = {
    name: 'grade.amend',
    parse: (p) => p as { gradeId: string; to: string },
    resource: (i, ctx) => ({ type: 'grade', id: i.gradeId, tenantId: ctx.tenantId, nodeId: 'dept', classification: 'education_record' }),
    handle: async (_tx, _ctx, i) => {
      writes.push(`${i.gradeId}=${i.to}`);
      return { data: { ok: true as const }, userMessage: 'Amended.' };
    },
  };
  const registrar = (key: string) => h.context(TENANT_A, 'registrar-1', { key, grants: [{ role: 'registrar', scopeKind: 'node', scopeId: 'dept' }], mfa: 'fresh' });
  return { h, deps, approvals, amend, writes, registrar };
}

const approve = async (a: Approvals, id: string) => {
  const r = a.rows.get(id)!;
  const v = decide(r, { approverId: 'second-person', decision: 'approve' }, { nowMs: Date.parse('2026-10-04T12:00:00Z'), canDecide: true });
  if (!v.ok) throw new Error(v.reason);
  a.rows.set(id, v.request);
};

describe('command pipeline: approval gate', () => {
  it('an action that needs a second person stops with pending_approval, writes nothing, and audits the request', async () => {
    const { h, deps, amend, writes, registrar } = setup();
    const r = await runCommand(deps, registrar('key-amend-0000000001'), amend, { gradeId: 'g1', to: 'A' });
    expect(r).toMatchObject({ status: 'pending_approval', nextAction: 'ap-1' });
    expect(writes).toEqual([]);
    expect(h.outbox.rows).toEqual([]);
    expect((await h.audit.read(TENANT_A)).map((a) => [a.action, a.decision])).toEqual([['grade.amend', 'pending_approval']]);
  });

  it('once approved, re-running with the approval id performs the change — once', async () => {
    const { deps, approvals, amend, writes, registrar } = setup();
    await runCommand(deps, registrar('key-amend-0000000001'), amend, { gradeId: 'g1', to: 'A' });
    await approve(approvals, 'ap-1');
    const done = await runCommand(deps, registrar('key-amend-0000000002'), amend, { gradeId: 'g1', to: 'A' }, { approvalId: 'ap-1' });
    expect(done.status).toBe('completed');
    expect(writes).toEqual(['g1=A']);
    expect(approvals.rows.get('ap-1')!.state).toBe('consumed');
    // The same approval cannot authorise a second run (a new key, so it is not an idempotent replay).
    const again = await runCommand(deps, registrar('key-amend-0000000003'), amend, { gradeId: 'g1', to: 'A' }, { approvalId: 'ap-1' });
    expect(again.status).toBe('pending_approval');
    expect(writes).toEqual(['g1=A']);
  });

  it('an approval for one change does not authorise another', async () => {
    const { deps, approvals, amend, writes, registrar } = setup();
    await runCommand(deps, registrar('key-amend-0000000001'), amend, { gradeId: 'g1', to: 'A' });
    await approve(approvals, 'ap-1');
    const other = await runCommand(deps, registrar('key-amend-0000000002'), amend, { gradeId: 'g1', to: 'F' }, { approvalId: 'ap-1' });
    expect(other.status).toBe('pending_approval');
    expect(writes).toEqual([]);
  });

  it('an unapproved or foreign approval id does not authorise', async () => {
    const { h, deps, approvals, amend, writes, registrar } = setup();
    await runCommand(deps, registrar('key-amend-0000000001'), amend, { gradeId: 'g1', to: 'A' });
    // still pending, not approved
    expect((await runCommand(deps, registrar('key-amend-0000000002'), amend, { gradeId: 'g1', to: 'A' }, { approvalId: 'ap-1' })).status).toBe('pending_approval');
    await approve(approvals, 'ap-1');
    // a registrar in another tenant cannot spend tenant A's approval (and has no node there anyway)
    const foreign = h.context(TENANT_B, 'registrar-1', { key: 'key-amend-0000000009', grants: [{ role: 'registrar', scopeKind: 'node', scopeId: 'dept' }], mfa: 'fresh' });
    await expect(runCommand(deps, foreign, amend, { gradeId: 'g1', to: 'A' }, { approvalId: 'ap-1' })).rejects.toMatchObject({ code: 'forbidden' });
    expect(writes).toEqual([]);
  });

  it('a command that fails after approval does not spend the approval', async () => {
    const { deps, approvals, amend, registrar } = setup();
    await runCommand(deps, registrar('key-amend-0000000001'), amend, { gradeId: 'g1', to: 'A' });
    await approve(approvals, 'ap-1');
    const failing: typeof amend = { ...amend, handle: async () => { throw new Error('db down'); } };
    await expect(runCommand(deps, registrar('key-amend-0000000002'), failing, { gradeId: 'g1', to: 'A' }, { approvalId: 'ap-1' })).rejects.toMatchObject({ code: 'internal' });
    expect(approvals.rows.get('ap-1')!.state).toBe('approved');
  });

  it('refuses, rather than silently performing, when no approval workflow is configured', async () => {
    const { deps, amend, registrar } = setup();
    const bare: CommandDeps = { ...deps, openApproval: undefined };
    await expect(runCommand(bare, registrar('key-amend-0000000001'), amend, { gradeId: 'g1', to: 'A' })).rejects.toMatchObject({ code: 'internal' });
  });

  it('the change hash is stable under key order (control for the approval binding)', async () => {
    expect(await hashOf({ action: 'a', change: { x: 1, y: 2 } })).toBe(await hashOf({ change: { y: 2, x: 1 }, action: 'a' }));
  });
});

describe('command pipeline: contract', () => {
  it('returns the CommandResult the service contract names, with ids that join', async () => {
    const { h, deps } = setup();
    const note: CommandDefinition<{ id: string }, { id: string }> = {
      name: 'note.add',
      parse: (p) => p as { id: string },
      resource: (i, ctx) => ({ type: 'note', id: i.id, tenantId: ctx.tenantId, ownerId: ctx.actor.personId, classification: 'student_private' }),
      handle: async (_tx, _c, i) => ({ data: { id: i.id }, userMessage: 'Saved.' }),
    };
    const ctx = h.context(TENANT_A, 'stu', { key: 'key-note-00000000001' });
    const r = await runCommand(deps, ctx, note, { id: 'n1' });
    expect(Object.keys(r).sort()).toEqual(['auditEventId', 'commandId', 'correlationId', 'data', 'status', 'userMessage']);
    expect(r.auditEventId).toBe((await h.audit.read(TENANT_A))[0].id);
    expect(r.correlationId).toBe(ctx.correlationId);
  });

  it('every command needs an idempotency key', async () => {
    const { h, deps } = setup();
    const note: CommandDefinition<{ id: string }, { id: string }> = {
      name: 'note.add', parse: (p) => p as { id: string },
      resource: (i, ctx) => ({ type: 'note', id: i.id, tenantId: ctx.tenantId, ownerId: ctx.actor.personId, classification: 'student_private' }),
      handle: async (_t, _c, i) => ({ data: { id: i.id }, userMessage: 'Saved.' }),
    };
    await expect(runCommand(deps, h.context(TENANT_A, 'stu'), note, { id: 'n1' })).rejects.toMatchObject({ code: 'invalid_request' });
  });
});

describe('command pipeline: client command id and key retention', () => {
  const note = (ttl?: number): CommandDefinition<{ id: string }, { id: string }> => ({
    name: 'note.add',
    ...(ttl === undefined ? {} : { idempotencyTtlMs: ttl }),
    parse: (p) => p as { id: string },
    resource: (i, ctx) => ({ type: 'note', id: i.id, tenantId: ctx.tenantId, ownerId: ctx.actor.personId, classification: 'student_private' }),
    handle: async (_t, _c, i) => ({ data: { id: i.id }, userMessage: 'Saved.' }),
  });

  it('echoes a well-formed client command id, and mints one for anything else (an id a client chose is a label, never a key)', async () => {
    const { h, deps } = setup();
    const id = '11111111-2222-4333-8444-555555555555';
    expect((await runCommand(deps, h.context(TENANT_A, 'stu', { key: 'key-cmdid-0000000001' }), note(), { id: 'a' }, { commandId: id })).commandId).toBe(id);
    for (const [i, bad] of ['not-a-uuid', '', 'x'.repeat(200)].entries()) {
      const r = await runCommand(deps, h.context(TENANT_A, 'stu', { key: `key-cmdid-bad-${i}-000000` }), note(), { id: `b${i}` }, { commandId: bad });
      expect(r.commandId).not.toBe(bad);
      expect(r.commandId).toMatch(/^cmd_/);
    }
  });

  it('a command can keep its key for 7 days instead of 24 hours; the default lapses at 24', async () => {
    const { h, deps } = setup();
    const ctx = (k: string) => h.context(TENANT_A, 'stu', { key: k });
    const DAY = 24 * 60 * 60 * 1000;
    await runCommand(deps, ctx('key-ttl-standard-0001'), note(), { id: 'a' });
    await runCommand(deps, ctx('key-ttl-extended-0001'), note(7 * DAY), { id: 'a' });
    h.clock.advance(2 * DAY);
    const standard = await runCommand(deps, ctx('key-ttl-standard-0001'), note(), { id: 'a' });
    const extended = await runCommand(deps, ctx('key-ttl-extended-0001'), note(7 * DAY), { id: 'a' });
    expect(h.outbox.rows).toEqual([]); // note emits nothing; the audit log tells the story
    const audit = await h.audit.read(TENANT_A);
    // standard ran again after 24h (2 rows for it); extended replayed (1 row)
    expect(audit.filter((a) => a.action === 'note.add')).toHaveLength(3);
    expect(standard.status).toBe('completed');
    expect(extended.status).toBe('completed');
  });
});
