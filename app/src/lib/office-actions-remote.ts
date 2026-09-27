import { cloud } from './cloud';
import { requireOnline } from './offline-mode';
import {
  dueInstant,
  isEligibility,
  readOfficeActions,
  type DeskStatus,
  type DeskStep,
  type Draft,
  type EligibilityKey,
  type OfficeAction,
  type OfficeActionType,
} from './office-actions';

/**
 * The office action feed's calls (Phase J). The feed and the desk are read
 * through functions, never the table: `my_office_actions` returns only the
 * complete, published rows that reach the caller, and `office_desk_actions`
 * returns an office's own rows with a completion count that the database
 * leaves null below ten.
 *
 * The two tables the student writes are theirs alone:
 * `institution_action_audiences` (what they said applies to them) and
 * `institution_action_progress` (what they marked done). No office can read
 * either.
 */

export async function myOfficeActions(): Promise<OfficeAction[]> {
  const { data, error } = await (await cloud()).rpc('my_office_actions');
  if (error) throw new Error(error.message);
  return readOfficeActions(data);
}

export interface Audiences {
  programs: string[];
  eligibility: EligibilityKey[];
}

export async function myAudiences(): Promise<Audiences> {
  const { data, error } = await (await cloud()).from('institution_action_audiences').select('kind, value');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { kind: string; value: string }[];
  return {
    programs: rows.filter((r) => r.kind === 'program').map((r) => r.value),
    eligibility: rows.filter((r) => r.kind === 'eligibility').map((r) => r.value).filter(isEligibility),
  };
}

/** The programs offices at the student's school publish to. */
export async function publishedPrograms(): Promise<string[]> {
  const { data, error } = await (await cloud()).rpc('office_action_programs');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { program: string }[]).map((r) => r.program).filter(Boolean);
}

export async function setAudience(userId: string, kind: 'program' | 'eligibility', value: string, on: boolean): Promise<void> {
  requireOnline('send');
  const client = await cloud();
  const { error } = on
    ? await client.from('institution_action_audiences').insert({ user_id: userId, kind, value })
    : await client.from('institution_action_audiences').delete().eq('user_id', userId).eq('kind', kind).eq('value', value);
  // Choosing twice is not an error the student needs to see.
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

export async function markDone(userId: string, actionId: string, done: boolean): Promise<void> {
  requireOnline('send');
  const client = await cloud();
  const { error } = done
    ? await client.from('institution_action_progress').insert({ action_id: actionId, user_id: userId })
    : await client.from('institution_action_progress').delete().eq('user_id', userId).eq('action_id', actionId);
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
}

// ── The office desk ───────────────────────────────────────────────────────

export interface PublishScope {
  office: string;
  label: string;
  scopeKind: string;
  scopeId: string;
  resourceOnly: boolean;
}

export async function myPublishScopes(): Promise<PublishScope[]> {
  const { data, error } = await (await cloud()).rpc('my_action_publish_scopes');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    office: String(r.office),
    label: String(r.label),
    scopeKind: String(r.scope_kind),
    scopeId: String(r.scope_id),
    resourceOnly: Boolean(r.resource_only),
  }));
}

export interface DeskRow {
  id: string;
  office: string;
  scopeId: string;
  type: OfficeActionType;
  audience: string;
  target: string | null;
  title: string;
  why: string;
  dueAt: string | null;
  url: string;
  source: string;
  status: DeskStatus;
  mine: boolean;
  reviewNote: string | null;
  updatedAt: string;
  /** Null below ten, by the database. */
  completed: number | null;
}

export async function deskActions(): Promise<DeskRow[]> {
  const { data, error } = await (await cloud()).rpc('office_desk_actions');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    office: String(r.office),
    scopeId: String(r.scope_id),
    type: r.action_type as OfficeActionType,
    audience: String(r.audience_kind),
    target: (r.target as string | null) ?? null,
    title: String(r.title),
    why: String(r.why_it_matters),
    dueAt: (r.due_at as string | null) ?? null,
    url: String(r.official_url),
    source: String(r.source_note),
    status: r.status as DeskStatus,
    mine: Boolean(r.mine),
    reviewNote: (r.review_note as string | null) ?? null,
    updatedAt: String(r.updated_at),
    completed: typeof r.completed === 'number' ? r.completed : null,
  }));
}

export async function saveDraft(d: Draft): Promise<string> {
  requireOnline('publish');
  const { data, error } = await (await cloud()).rpc('draft_office_action', {
    want_office: d.office,
    want_scope_kind: d.scopeKind,
    want_scope_id: d.scopeId,
    want_type: d.type,
    want_audience: d.audience,
    want_target: d.audience === 'tenant' ? null : d.target.trim(),
    want_title: d.title.trim(),
    want_why: d.why.trim(),
    want_due: dueInstant(d.due),
    want_url: d.url.trim(),
    want_source: d.source.trim(),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function moveAction(id: string, step: DeskStep, note?: string): Promise<DeskStatus> {
  requireOnline('publish');
  const { data, error } = await (await cloud()).rpc('move_office_action', { want_id: id, want_step: step, want_note: note ?? null });
  if (error) throw new Error(error.message);
  return data as DeskStatus;
}
