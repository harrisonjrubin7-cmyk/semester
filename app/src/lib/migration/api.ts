/**
 * The Migration Center's client: the four tables in
 * `20260929200000_migration_center.sql`, under the signed-in account's RLS.
 *
 * Nothing here sends a row of a sample file. `recordRun` takes counts and a
 * SHA-256, which is all the table has columns for; the preview, validation
 * and reconciliation that produce them run in `center.ts`, in the browser.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  GATE_TEXT, STAGE_LABEL, STAGES,
  type ApprovalArea, type FieldMap, type MigrationApproval, type MigrationDomain, type MigrationProject, type MigrationRun,
  type RunCounts, type RunKind, type Stage,
} from './center';

/** The fields a migration lead edits directly. Stage, school and creator are the database's. */
export type ProjectPatch = Partial<Pick<MigrationProject,
  'name' | 'source_platform' | 'source_version' | 'data_owner' | 'classifications' | 'retention' | 'historical_cutoff'
  | 'duplicate_rule' | 'cutover_date' | 'rollback_plan' | 'archive_location' | 'required_approvals' | 'parallel_runs_required'>>;

export interface MigrationApi {
  /** This school's migrations. RLS would also return other schools' to an account working at several. */
  list(tenantId: string): Promise<MigrationProject[]>;
  create(tenantId: string, name: string, domain: MigrationDomain): Promise<string>;
  save(id: string, patch: ProjectPatch): Promise<void>;
  move(id: string, to: Stage): Promise<void>;
  maps(id: string): Promise<FieldMap[]>;
  addMap(p: MigrationProject, map: FieldMap): Promise<void>;
  removeMap(mapId: string): Promise<void>;
  runs(id: string): Promise<MigrationRun[]>;
  recordRun(p: MigrationProject, kind: RunKind, counts: RunCounts, sha: string, period: string): Promise<void>;
  approvals(id: string): Promise<MigrationApproval[]>;
  decide(p: MigrationProject, area: ApprovalArea, decision: MigrationApproval['decision'], note: string): Promise<void>;
}

/** Whether an account holding these verified capabilities should see the Migration tab at all. */
export function migrationAllowed(verified: readonly string[]): boolean {
  return verified.some((c) => c === 'migration:manage' || c === 'migration:approve' || c === 'migration:view');
}
export const canManage = (verified: readonly string[]) => verified.includes('migration:manage');
export const canApprove = (verified: readonly string[]) => verified.includes('migration:approve');

/**
 * A database refusal as a sentence. The gate's own list — "cannot move to
 * validation yet: validation_passed" — becomes the screen's words for each
 * code, so the refusal says what to do rather than what the column is called.
 */
export function refusal(error: { message?: string } | null, fallback: string): Error {
  const m = error?.message ?? '';
  if (/row-level security|permission denied/i.test(m)) return new Error('Your account cannot do that at this school.');
  const gate = m.match(/cannot move to ([a-z_]+) yet: (.+)$/);
  if (gate) {
    const to = (STAGES as readonly string[]).includes(gate[1]) ? STAGE_LABEL[gate[1] as Stage] : gate[1];
    const owed = gate[2].split(', ').map((c) => GATE_TEXT[c] ?? c);
    return new Error(`Not ready for ${to.toLowerCase()}: ${owed.join(' ')}`);
  }
  return new Error(m || fallback);
}

export function migrationApi(db: SupabaseClient): MigrationApi {
  return {
    async list(tenantId) {
      const { data, error } = await db.from('migration_projects').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load migrations.');
      return (data ?? []) as MigrationProject[];
    },
    async create(tenantId, name, domain) {
      const { data, error } = await db.from('migration_projects').insert({ tenant_id: tenantId, name, domain }).select('id').single();
      if (error) throw refusal(error, 'Could not open the migration.');
      return (data as { id: string }).id;
    },
    async save(id, patch) {
      const { data, error } = await db.from('migration_projects').update(patch).eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not save.');
      if (!data || data.length === 0) throw new Error('Your account cannot change this migration.');
    },
    async move(id, to) {
      const { data, error } = await db.from('migration_projects').update({ stage: to }).eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not move the migration.');
      if (!data || data.length === 0) throw new Error('Your account cannot move this migration.');
    },
    async maps(id) {
      const { data, error } = await db
        .from('migration_field_maps')
        .select('id, source_field, target_field, transform, required, is_key')
        .eq('project_id', id)
        .order('created_at');
      if (error) throw refusal(error, 'Could not load the mapping.');
      return (data ?? []) as FieldMap[];
    },
    async addMap(p, m) {
      const { error } = await db.from('migration_field_maps').insert({
        tenant_id: p.tenant_id, project_id: p.id, source_field: m.source_field, target_field: m.target_field,
        transform: m.transform, required: m.required, is_key: m.is_key,
      });
      if (error) throw refusal(error, 'Could not add the field.');
    },
    async removeMap(mapId) {
      const { error } = await db.from('migration_field_maps').delete().eq('id', mapId);
      if (error) throw refusal(error, 'Could not remove the field.');
    },
    async runs(id) {
      const { data, error } = await db
        .from('migration_runs')
        .select('id, kind, stage, period_label, rows_in, rows_ok, rows_failed, rows_missing, rows_extra, rows_differing, sample_sha256, passed, recorded_by, recorded_at')
        .eq('project_id', id)
        .order('recorded_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load the evidence.');
      return (data ?? []) as MigrationRun[];
    },
    async recordRun(p, kind, c, sha, period) {
      const { error } = await db.from('migration_runs').insert({
        tenant_id: p.tenant_id, project_id: p.id, kind, period_label: period,
        rows_in: c.rows_in, rows_ok: c.rows_ok, rows_failed: c.rows_failed,
        rows_missing: c.rows_missing, rows_extra: c.rows_extra, rows_differing: c.rows_differing,
        sample_sha256: sha,
      });
      if (error) throw refusal(error, 'Could not record the counts.');
    },
    async approvals(id) {
      const { data, error } = await db
        .from('migration_approvals')
        .select('id, area, decision, approver_id, note, recorded_at')
        .eq('project_id', id)
        .order('recorded_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load approvals.');
      return (data ?? []) as MigrationApproval[];
    },
    async decide(p, area, decision, note) {
      const { error } = await db.from('migration_approvals').insert({ tenant_id: p.tenant_id, project_id: p.id, area, decision, note });
      if (error) throw refusal(error, 'Could not record the decision.');
    },
  };
}
