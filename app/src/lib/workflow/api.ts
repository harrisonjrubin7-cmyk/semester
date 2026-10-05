/**
 * The Workflow Builder's client: `workflow_versions` in
 * `20260930231000_workflow_builder.sql`, under the signed-in account's RLS.
 *
 * Nothing here decides who may draft or publish. The database does, and its
 * refusals are turned into sentences by `refusal`. `saveDraft` sends a
 * definition and a note; the school, the author, the state and the version
 * number are the trigger's.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { problemText, type Definition, type WorkflowKey } from './spec';

export interface WorkflowVersion {
  id: string;
  tenant_id: string;
  workflow: WorkflowKey;
  state: 'draft' | 'published';
  version: number | null;
  definition: Definition;
  note: string;
  based_on: number | null;
  created_by: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface WorkflowApi {
  /** Every draft and published version at this school. */
  list(tenantId: string): Promise<WorkflowVersion[]>;
  /** Start or replace the workflow's one draft. `basedOn` is the published version it starts from. */
  saveDraft(tenantId: string, workflow: WorkflowKey, definition: Definition, note: string, basedOn: number | null, existing: WorkflowVersion | null): Promise<void>;
  discardDraft(id: string): Promise<void>;
  /** Publish the draft as it stands. The database refuses the drafter. */
  publish(draft: WorkflowVersion): Promise<void>;
}

/** A database refusal as a sentence: "This workflow is not valid: req_fact:x" becomes the screen's words. */
export function refusal(error: { message?: string; code?: string } | null, fallback: string): Error {
  const m = error?.message ?? '';
  if (/row-level security|permission denied/i.test(m)) return new Error('Your account cannot do that at this school.');
  if (error?.code === '23505' || /duplicate key/i.test(m)) return new Error('This workflow already has a draft. Open it, or discard it first.');
  const bad = m.match(/This workflow is not valid: (.+)$/);
  if (bad) return new Error(bad[1].split(', ').map(problemText).join(' '));
  return new Error(m || fallback);
}

export function workflowApi(db: SupabaseClient): WorkflowApi {
  return {
    async list(tenantId) {
      const { data, error } = await db
        .from('workflow_versions')
        .select('id, tenant_id, workflow, state, version, definition, note, based_on, created_by, published_by, created_at, updated_at, published_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load the workflows.');
      return (data ?? []) as WorkflowVersion[];
    },
    async saveDraft(tenantId, workflow, definition, note, basedOn, existing) {
      if (existing) {
        const { data, error } = await db.from('workflow_versions')
          .update({ definition, note, based_on: basedOn }).eq('id', existing.id).select('id');
        if (error) throw refusal(error, 'Could not save the draft.');
        if (!data || data.length === 0) throw new Error('Your account cannot change this draft.');
        return;
      }
      const { error } = await db.from('workflow_versions')
        .insert({ tenant_id: tenantId, workflow, definition, note, based_on: basedOn });
      if (error) throw refusal(error, 'Could not save the draft.');
    },
    async discardDraft(id) {
      const { data, error } = await db.from('workflow_versions').delete().eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not discard the draft.');
      if (!data || data.length === 0) throw new Error('Your account cannot discard this draft.');
    },
    async publish(draft) {
      const { data, error } = await db.from('workflow_versions')
        .update({ state: 'published' }).eq('id', draft.id).eq('updated_at', draft.updated_at).select('id');
      if (error) throw refusal(error, 'Could not publish.');
      if (!data || data.length === 0) throw new Error('This draft changed after you opened it, or your account cannot publish it. Reload it and review what it says now.');
    },
  };
}

// ── Versions ────────────────────────────────────────────────────────────────

/** The school's current published version of a workflow: the highest number. */
export function current(rows: readonly WorkflowVersion[], workflow: WorkflowKey): WorkflowVersion | null {
  let best: WorkflowVersion | null = null;
  for (const r of rows) {
    if (r.workflow !== workflow || r.state !== 'published' || r.version === null) continue;
    if (!best || r.version > (best.version ?? 0)) best = r;
  }
  return best;
}

/** The workflow's draft, if it has one. There is at most one. */
export function draftOf(rows: readonly WorkflowVersion[], workflow: WorkflowKey): WorkflowVersion | null {
  return rows.find((r) => r.workflow === workflow && r.state === 'draft') ?? null;
}

/** A workflow's published versions, newest first. */
export function history(rows: readonly WorkflowVersion[], workflow: WorkflowKey): WorkflowVersion[] {
  return rows
    .filter((r) => r.workflow === workflow && r.state === 'published' && r.version !== null)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
}

// `workflowsAllowed` lives in its own module so the University screen can ask
// it without importing this file (and through it the whole spec) into the
// route's opening cost. Re-exported so this stays the one import.
export { workflowsAllowed } from './allowed';

/**
 * Whether the signed-in account may publish this draft, and if not, why — the
 * sentences the database would raise.
 */
export function publishBlocker(draft: WorkflowVersion, problemsNow: readonly string[], viewerId: string | null, holds: readonly string[]): string | null {
  if (!holds.includes('workflow:publish')) return 'Your account cannot publish workflows at this school.';
  if (viewerId !== null && viewerId === draft.created_by) return 'Whoever drafted a workflow does not publish it. Ask a colleague who holds the publish role.';
  if (problemsNow.length > 0) return problemText(problemsNow[0]);
  return null;
}
