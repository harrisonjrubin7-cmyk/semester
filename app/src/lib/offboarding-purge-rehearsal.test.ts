import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20261026200000_offboarding_purge_rehearsal.sql'),
  'utf8',
);
const check = readFileSync(
  join(process.cwd(), '..', 'supabase', 'offboarding-purge-rehearsal.check.sql'),
  'utf8',
);
const worker = sql.match(
  /create or replace function public\.run_school_purge_rehearsal[\s\S]*?\$\$;\n\nrevoke all on function public\.run_school_purge_rehearsal/,
)?.[0] ?? '';

describe('synthetic purge execution rehearsal boundary', () => {
  it('has one fixed synthetic adapter and no tenant-data delete statement', () => {
    expect(sql).toContain("adapter_key text primary key check (adapter_key = 'synthetic_discard_v1')");
    expect(sql).toContain("target_relation text not null check (target_relation = 'private.offboarding_purge_rehearsal_fixture')");
    expect(worker.match(/delete\s+from\s+[^;]+/gi)).toEqual([
      'delete from private.offboarding_purge_rehearsal_fixture where job_id = j.id',
    ]);
    expect(sql).not.toMatch(/delete\s+from\s+public\./i);
    expect(worker).not.toMatch(/execute\s+format|school_tenant_tables/i);
  });

  it('keeps every activation layer independently fail-closed', () => {
    for (const gate of [
      "private.has_capability('console:operate', 'platform', '')",
      "private.has_capability('offboarding:purge-rehearse', 'platform', '')",
      "public.feature_state('offboarding.purge_rehearsal'",
      'private.offboarding_purge_rehearsal_entitled',
      "r.state in ('suspended', 'archived')",
      "a.adapter_key = 'synthetic_discard_v1'",
      "public.kill_switch_engaged('kill.writeback'",
      "public.kill_switch_engaged('kill.integration_sync'",
      "req.duty_id <> 'offboarding-purge-rehearsal'",
    ]) expect(sql).toContain(gate);
    expect(sql).toContain("'offboarding-purge-rehearsal'");
    expect(sql).toContain("array['privacy', 'security'], true");
    expect(sql).not.toContain("('data_steward', 'offboarding:purge-rehearse')");
    expect(sql).not.toMatch(/plan_entitlements[\s\S]{0,200}offboarding\.purge_rehearsal/i);
  });

  it('binds the queue to fresh immutable evidence and a service-only worker', () => {
    for (const binding of [
      "p.generated_at + interval '30 minutes'",
      "g.generated_at + interval '24 hours'",
      'p.snapshot_sha256',
      'g.manifest_sha256',
      'req.detail ->> \'preview_receipt_id\'',
      'count(distinct d.approver)',
      'prior.queued_by <> me',
      'prior.request_sha256 <> request_hash',
    ]) expect(sql).toContain(binding);
    expect(sql).toContain('before update or delete on private.offboarding_purge_rehearsal_receipt');
    expect(sql).toContain('revoke all on function public.run_school_purge_rehearsal(uuid) from public, anon, authenticated');
    expect(sql).toContain('grant execute on function public.run_school_purge_rehearsal(uuid) to service_role');
  });

  it('tests kill, stop, replay, tamper, cross-tenant, restore, and no-change behavior', () => {
    for (const proof of [
      'cross-operator replay is refused',
      'approval scoped to another tenant is refused',
      'tampering with an immutable queue binding',
      'kill switch stops the queued rehearsal',
      'dedicated capability is assigned to no role by default',
      'deterministic restore is verified',
      'manual stop is terminal and idempotent',
      'rehearsal changes no tenant profile',
      'rehearsal leaves the tenant present',
    ]) expect(check).toContain(proof);
  });
});
