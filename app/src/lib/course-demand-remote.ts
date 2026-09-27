import { cloud } from './cloud';
import { requireOnline } from './offline-mode';
import { readContribution, readDemand, type Contributed, type DemandRow, type MyContribution } from './course-demand';

/**
 * Course demand's calls (Phase K). Every one is a function: the student's
 * contribution replaces itself atomically at the school on their profile, and
 * staff read the snapshot rows their `demand:read` scope allows — counts of
 * ten or more, and nothing that names a person.
 */

export async function contribute(term: string, courses: readonly Contributed[]): Promise<number> {
  requireOnline('send');
  const { data, error } = await (await cloud()).rpc('contribute_course_plan', { want_term: term, want_courses: courses });
  if (error) throw new Error(error.message);
  return data as number;
}

export async function stopContributing(term: string): Promise<void> {
  const { error } = await (await cloud()).rpc('stop_contributing', { want_term: term });
  if (error) throw new Error(error.message);
}

export async function myContribution(term: string): Promise<MyContribution | null> {
  const { data, error } = await (await cloud()).rpc('my_demand_contribution', { want_term: term });
  if (error) throw new Error(error.message);
  return readContribution(data);
}

export interface DemandScope {
  kind: 'school' | 'department';
  id: string;
}

export async function myDemandScopes(): Promise<DemandScope[]> {
  const { data, error } = await (await cloud()).rpc('my_demand_scopes');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { scope_kind: string; scope_id: string }[])
    .filter((r) => r.scope_kind === 'school' || r.scope_kind === 'department')
    .map((r) => ({ kind: r.scope_kind as DemandScope['kind'], id: r.scope_id }));
}

export async function courseDemand(term: string): Promise<DemandRow[]> {
  const { data, error } = await (await cloud()).rpc('course_demand', { want_term: term });
  if (error) throw new Error(error.message);
  return readDemand(data);
}
