import { cloud } from './cloud';
import { readProductivity, type Productivity } from './productivity';
export interface CloudWorkspace {
  revision: number;
  data: Productivity;
  tenantId: string | null;
  shareAggregate: boolean;
  updatedAt: string;
}
export function readCloudWorkspace(v: unknown): CloudWorkspace {
  const r = v as CloudWorkspace;
  if (
    !r ||
    !Number.isSafeInteger(r.revision) ||
    r.revision < 1 ||
    (r.tenantId !== null && typeof r.tenantId !== 'string') ||
    typeof r.shareAggregate !== 'boolean' ||
    typeof r.updatedAt !== 'string'
  )
    throw new Error('Cloud workspace is invalid; local data was preserved');
  return { ...r, data: readProductivity(r.data) };
}
export async function loadWorkspace(
  userId: string,
): Promise<CloudWorkspace | null> {
  const { data, error } = await (
    await cloud()
  )
    .from('productivity_workspace')
    .select('revision,data,tenant_id,share_aggregate,updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? readCloudWorkspace({
        revision: Number(data.revision),
        data: data.data,
        tenantId: data.tenant_id,
        shareAggregate: data.share_aggregate,
        updatedAt: data.updated_at,
      })
    : null;
}
export async function saveWorkspace(
  data: Productivity,
  expected: number,
  tenantId: string | null,
  shareAggregate: boolean,
): Promise<CloudWorkspace> {
  readProductivity(data);
  const result = await (
    await cloud()
  ).rpc('save_productivity_workspace', {
    p_expected: expected,
    p_data: data,
    p_tenant: tenantId,
    p_aggregate: shareAggregate,
  });
  if (result.error)
    throw new Error(
      result.error.code === '40001'
        ? 'Another device changed this workspace. Load and review the cloud copy first.'
        : result.error.message,
    );
  return readCloudWorkspace(result.data);
}
export async function deleteWorkspace(userId: string): Promise<void> {
  const { error } = await (
    await cloud()
  )
    .from('productivity_workspace')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
export async function productivityAggregate(tenantId: string): Promise<{
  state: string;
  minimum?: number;
  cohort?: number;
  decisions?: number;
  decided?: number;
}> {
  const { data, error } = await (
    await cloud()
  ).rpc('productivity_readiness_aggregate', { p_tenant: tenantId });
  if (error) throw new Error(error.message);
  return data;
}
