/**
 * The Configuration Studio's client: `school_config_versions` in
 * `20260930230000_configuration_studio.sql`, under the signed-in account's RLS.
 *
 * Nothing here decides who may draft or publish. The database does, and its
 * refusals are turned into sentences by `refusal`. `saveDraft` sends settings
 * and a note; the school, the author, the state and the version number are
 * the trigger's.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { problemText, type ConfigDomain, type ConfigVersion, type Settings } from './studio';

export interface ConfigApi {
  /** Every draft and published version at this school. */
  list(tenantId: string): Promise<ConfigVersion[]>;
  /** Start or replace the domain's one draft. `basedOn` is the published version it starts from. */
  saveDraft(tenantId: string, domain: ConfigDomain, settings: Settings, note: string, basedOn: number | null, existing: ConfigVersion | null): Promise<void>;
  discardDraft(id: string): Promise<void>;
  /** Publish the draft as it stands. The database refuses the drafter. */
  publish(draft: ConfigVersion): Promise<void>;
}

/**
 * A database refusal as a sentence. "This configuration is not valid:
 * bad_value:approval_sla_days" becomes the screen's words for the code.
 */
export function refusal(error: { message?: string; code?: string } | null, fallback: string): Error {
  const m = error?.message ?? '';
  if (/row-level security|permission denied/i.test(m)) return new Error('Your account cannot do that at this school.');
  if (error?.code === '23505' || /duplicate key/i.test(m)) return new Error('This domain already has a draft. Open it, or discard it first.');
  const bad = m.match(/This configuration is not valid: (.+)$/);
  if (bad) return new Error(bad[1].split(', ').map(problemText).join(' '));
  return new Error(m || fallback);
}

export function configApi(db: SupabaseClient): ConfigApi {
  return {
    async list(tenantId) {
      const { data, error } = await db
        .from('school_config_versions')
        .select('id, tenant_id, domain, state, version, settings, note, based_on, created_by, published_by, created_at, updated_at, published_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load the configuration.');
      return (data ?? []) as ConfigVersion[];
    },
    async saveDraft(tenantId, domain, settings, note, basedOn, existing) {
      if (existing) {
        const { data, error } = await db.from('school_config_versions')
          .update({ settings, note, based_on: basedOn }).eq('id', existing.id).select('id');
        if (error) throw refusal(error, 'Could not save the draft.');
        if (!data || data.length === 0) throw new Error('Your account cannot change this draft.');
        return;
      }
      const { error } = await db.from('school_config_versions')
        .insert({ tenant_id: tenantId, domain, settings, note, based_on: basedOn });
      if (error) throw refusal(error, 'Could not save the draft.');
    },
    async discardDraft(id) {
      const { data, error } = await db.from('school_config_versions').delete().eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not discard the draft.');
      if (!data || data.length === 0) throw new Error('Your account cannot discard this draft.');
    },
    async publish(draft) {
      // The draft *as reviewed*: the database compares the row with itself, so a
      // draft saved since this one was opened would pass its publish-as-reviewed
      // check and publish settings the publisher never saw. `updated_at` moves on
      // every save, so a changed draft reaches no row here.
      const { data, error } = await db.from('school_config_versions')
        .update({ state: 'published' }).eq('id', draft.id).eq('updated_at', draft.updated_at).select('id');
      if (error) throw refusal(error, 'Could not publish.');
      if (!data || data.length === 0) {
        throw new Error('This draft changed after you opened it, or your account cannot publish it. Reload it and review what it says now.');
      }
    },
  };
}
