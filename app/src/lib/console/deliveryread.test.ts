import { describe, expect, it } from 'vitest';
import { readDelivery } from './client';

const project = {
  id: 'pr-1', tenant_id: 'north', stage: 'integrate', status: 'at_risk', kickoff_at: null, go_live_at: null,
  has_owner: true, milestones_total: 3, milestones_done: 1, milestones_overdue: 1,
  next_milestone: { name: 'SIS feed live', owner_role: 'integration', due_at: '2026-10-23' },
};
const renewal = {
  contract_id: 'c-1', contract_kind: 'order_form', renewal_date: '2027-01-24', stage: 'exec_90',
  outcome: 'pending', decision_on: null, has_owner: false,
};
const base = {
  billing_account_id: 'b-1', account_name: 'North University', tenant_ids: ['north'], tenant_names: ['North'],
  is_demo: false, projects: [project], has_success_plan: false, success_plan_has_owner: false,
  next_qbr_at: null, last_qbr_on: null, qbr_count: 0, renewals: [renewal],
  health_status: null, health_reason: null, health_next_action: null, health_has_owner: false,
  health_taken_at: null, provenance: 'p', limitation: 'l',
};

describe('delivery portfolio rows', () => {
  it('keeps a missing plan, QBR and health snapshot as missing', () => {
    const d = readDelivery(base);
    expect(d).toMatchObject({ hasSuccessPlan: false, nextQbrAt: null, lastQbrOn: null, healthStatus: null, healthReason: null });
    expect(d.projects[0]).toMatchObject({ stage: 'integrate', milestonesOverdue: 1, nextMilestone: { name: 'SIS feed live', dueAt: '2026-10-23' } });
    expect(d.renewals[0]).toMatchObject({ stage: 'exec_90', outcome: 'pending', decisionOn: null, hasOwner: false });
  });

  it('reads a project with no open milestone as having no next milestone', () => {
    expect(readDelivery({ ...base, projects: [{ ...project, next_milestone: null }] }).projects[0].nextMilestone).toBeNull();
  });

  it('refuses a stage, status or outcome the console does not know', () => {
    expect(() => readDelivery({ ...base, projects: [{ ...project, stage: 'celebrate' }] })).toThrow(/unknown implementation stage/);
    expect(() => readDelivery({ ...base, projects: [{ ...project, status: 'fine' }] })).toThrow(/unknown implementation status/);
    expect(() => readDelivery({ ...base, renewals: [{ ...renewal, outcome: 'maybe' }] })).toThrow(/unknown renewal outcome/);
    expect(() => readDelivery({ ...base, health_status: 'glowing' })).toThrow(/unknown health status/);
  });
});
