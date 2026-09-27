/**
 * The Integration Dashboard's model: what the architecture map, the
 * connection list, the mapping view, sync history and the conflict view show,
 * built from the rows RLS lets the viewer read.
 *
 * Row-level security is the boundary (docs/architecture/0002). This file adds
 * two things on top: every domain the command lists is on the map whether or
 * not a school has connected it — an empty domain says "Not connected", never
 * a made-up provider — and nothing here selects a credential, a payload, or a
 * student's canonical record. `loadDashboard` names its columns so a future
 * `select *` cannot quietly widen it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DOMAIN_CEILING, SOURCE_OF_TRUTH, syncClassFor,
  type ConflictKind, type ConnectionStatus, type Freshness, type ProviderDomain, type SyncDirection, type SyncMode,
} from './catalog';
import type { DataClass } from './classification';
import { freshnessFromAge } from './freshness';

export interface ConnectionRow {
  id: string;
  public_id: string;
  tenant_id: string;
  provider_domain: ProviderDomain;
  provider_name: string;
  provider_product: string | null;
  connection_name: string;
  status: ConnectionStatus;
  authentication_type: string;
  data_classification_ceiling: DataClass;
  sync_mode: SyncMode;
  sync_direction: SyncDirection;
  freshness_target: string | null;
  last_successful_sync_at: string | null;
  last_error_at: string | null;
  feature_flag_key: string | null;
  owner_account_id: string | null;
  approved_at: string | null;
  paused_reason: string | null;
}

export interface ScopeRow { connection_id: string; scope_key: string; approved: boolean; expires_at: string | null }
export interface MappingRow {
  connection_id: string; external_entity_type: string; canonical_entity_type: string;
  external_field: string; canonical_field: string; transform_config: Record<string, unknown>;
  required: boolean; mapping_version: number; active: boolean;
  validation_state: 'unvalidated' | 'valid' | 'conflict' | 'invalid'; conflict_kind: ConflictKind | null;
}
export interface RunRow {
  public_id: string; connection_id: string; trigger_type: string; status: string;
  started_at: string; completed_at: string | null; records_received: number; records_created: number;
  records_updated: number; records_unchanged: number; records_rejected: number; errors_count: number;
  retry_count: number; reconciliation_state: string; cursor_after: Record<string, unknown> | null;
}
export interface ErrorRow {
  id: string; connection_id: string; sync_run_id: string | null; external_entity_type: string | null;
  error_category: string; sanitized_message: string; severity: string; retryable: boolean;
  retry_count: number; created_at: string;
}
export interface DeadLetterRow {
  id: string; connection_id: string; reason: string; attempts: number;
  replay_requested_at: string | null; created_at: string;
}
export interface KillSwitchRow { switch_key: string; tenant_id: string | null; engaged: boolean; reason: string }

export interface DashboardData {
  connections: ConnectionRow[];
  scopes: ScopeRow[];
  mappings: MappingRow[];
  runs: RunRow[];
  errors: ErrorRow[];
  deadLetters: DeadLetterRow[];
  killSwitches: KillSwitchRow[];
}

export const EMPTY_DASHBOARD: DashboardData = {
  connections: [], scopes: [], mappings: [], runs: [], errors: [], deadLetters: [], killSwitches: [],
};

/** The map's domains, in the order the command draws them. */
export const MAP_DOMAINS: readonly { domain: ProviderDomain; label: string; group: 'academic' | 'people' | 'campus' | 'finance' }[] = [
  { domain: 'identity', label: 'Identity', group: 'people' },
  { domain: 'sis', label: 'SIS', group: 'academic' },
  { domain: 'degree_audit', label: 'Degree audit', group: 'academic' },
  { domain: 'lms', label: 'LMS', group: 'academic' },
  { domain: 'advising', label: 'Advising', group: 'people' },
  { domain: 'admissions_crm', label: 'Admissions CRM', group: 'people' },
  { domain: 'career', label: 'Career', group: 'campus' },
  { domain: 'erp', label: 'ERP', group: 'finance' },
  { domain: 'library', label: 'Library', group: 'campus' },
  { domain: 'tutoring', label: 'Tutoring', group: 'campus' },
  { domain: 'events', label: 'Events & organizations', group: 'campus' },
  { domain: 'calendar', label: 'Calendar', group: 'campus' },
  { domain: 'research', label: 'Research', group: 'academic' },
  { domain: 'alerts', label: 'Transit & alerts', group: 'campus' },
];

/** Status words and a glyph each, so no state is carried by colour alone. */
export const STATUS_TEXT: Record<ConnectionStatus | 'none', { word: string; glyph: string }> = {
  none: { word: 'Not connected', glyph: '○' },
  disconnected: { word: 'Disconnected', glyph: '○' },
  configuring: { word: 'Configuring', glyph: '◐' },
  healthy: { word: 'Healthy', glyph: '●' },
  degraded: { word: 'Degraded', glyph: '▲' },
  paused: { word: 'Paused', glyph: '❚❚' },
  error: { word: 'Error', glyph: '✕' },
};

export const DIRECTION_TEXT: Record<SyncDirection, string> = {
  read: 'Inbound (read-only)',
  approved_write: 'Approved outbound',
  bidirectional: 'Bidirectional',
};

export interface MapNode {
  domain: ProviderDomain;
  label: string;
  group: string;
  status: ConnectionStatus | 'none';
  connections: ConnectionRow[];
  direction: SyncDirection | null;
  modes: SyncMode[];
  ceiling: DataClass;
  sourceOfTruth: string;
  lastSync: string | null;
  freshness: Freshness;
  openErrors: number;
  flags: string[];
  /** One sentence carrying everything the node shows, for a screen reader and the table. */
  description: string;
}

const RANK: Record<ConnectionStatus, number> = {
  error: 0, degraded: 1, paused: 2, configuring: 3, disconnected: 4, healthy: 5,
};

function minutes(interval: string | null, fallback: number): number {
  if (!interval) return fallback;
  const hms = interval.match(/^(\d+):(\d+):(\d+)/);
  if (hms) return Number(hms[1]) * 60 + Number(hms[2]);
  const days = interval.match(/(\d+)\s*day/);
  const hours = interval.match(/(\d+)\s*hour/);
  const mins = interval.match(/(\d+)\s*min/);
  const total = (days ? +days[1] * 1440 : 0) + (hours ? +hours[1] * 60 : 0) + (mins ? +mins[1] : 0);
  return total || fallback;
}

export function connectionFreshness(c: ConnectionRow, now: Date): Freshness {
  const target = minutes(c.freshness_target, syncClassFor(c.provider_domain).targetMinutes);
  const live = c.approved_at !== null && (c.status === 'healthy' || c.status === 'degraded');
  return freshnessFromAge(c.last_successful_sync_at ? new Date(c.last_successful_sync_at) : null, target, now, live);
}

function domainMembers(domain: ProviderDomain): ProviderDomain[] {
  if (domain === 'events') return ['events', 'organizations'];
  if (domain === 'alerts') return ['alerts', 'transit'];
  if (domain === 'erp') return ['erp', 'bursar', 'financial_aid'];
  if (domain === 'sis') return ['sis', 'catalog'];
  return [domain];
}

export function buildMap(data: DashboardData, now: Date): MapNode[] {
  return MAP_DOMAINS.map(({ domain, label, group }) => {
    const members = domainMembers(domain);
    const conns = data.connections.filter((c) => members.includes(c.provider_domain));
    const worst = conns.slice().sort((a, b) => RANK[a.status] - RANK[b.status])[0];
    const status: MapNode['status'] = worst ? worst.status : 'none';
    const ids = new Set(conns.map((c) => c.id));
    const openErrors = data.errors.filter((e) => ids.has(e.connection_id)).length;
    const lastSync = conns.map((c) => c.last_successful_sync_at).filter(Boolean).sort().pop() ?? null;
    const freshness: Freshness = worst ? connectionFreshness(worst, now) : 'unavailable';
    const direction = conns.some((c) => c.sync_direction === 'bidirectional') ? 'bidirectional'
      : conns.some((c) => c.sync_direction === 'approved_write') ? 'approved_write'
      : conns.length ? 'read' : null;
    const node: MapNode = {
      domain, label, group, status, connections: conns, direction,
      modes: [...new Set(conns.map((c) => c.sync_mode))],
      ceiling: conns.length ? conns.map((c) => c.data_classification_ceiling).sort().pop()! : DOMAIN_CEILING[domain],
      sourceOfTruth: SOURCE_OF_TRUTH[domain],
      lastSync, freshness, openErrors,
      flags: [...new Set(conns.map((c) => c.feature_flag_key).filter((f): f is string => !!f))],
      description: '',
    };
    node.description = describeNode(node);
    return node;
  });
}

export function describeNode(n: MapNode): string {
  const s = STATUS_TEXT[n.status].word;
  if (n.connections.length === 0) {
    return `${n.label}: not connected. Source of truth stays ${n.sourceOfTruth}. Nothing flows into Semester.`;
  }
  const providers = n.connections.map((c) => c.provider_name).join(', ');
  const when = n.lastSync ? `last successful sync ${n.lastSync.slice(0, 16).replace('T', ' ')} UTC` : 'never synced';
  const errs = n.openErrors ? `, ${n.openErrors} open error${n.openErrors === 1 ? '' : 's'}` : '';
  return `${n.label}: ${providers}. ${s}, ${n.direction ? DIRECTION_TEXT[n.direction].toLowerCase() : 'no direction'}, `
    + `ceiling ${n.ceiling}, source of truth ${n.sourceOfTruth}, ${when}${errs}.`;
}

export interface ConflictGroup { kind: string; count: number; latest: string; connections: number }

/** Open errors and conflicted mappings, grouped by kind for the conflict view. */
export function conflicts(data: DashboardData): ConflictGroup[] {
  const groups = new Map<string, { count: number; latest: string; conns: Set<string> }>();
  const add = (kind: string, at: string, conn: string) => {
    const g = groups.get(kind) ?? { count: 0, latest: '', conns: new Set<string>() };
    g.count += 1;
    g.latest = at > g.latest ? at : g.latest;
    g.conns.add(conn);
    groups.set(kind, g);
  };
  for (const e of data.errors) add(e.error_category, e.created_at, e.connection_id);
  for (const m of data.mappings) if (m.conflict_kind) add(m.conflict_kind, '', m.connection_id);
  return [...groups.entries()]
    .map(([kind, g]) => ({ kind, count: g.count, latest: g.latest, connections: g.conns.size }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

/**
 * The export: counts and states only. No names of people, no ids beyond the
 * connection's public id, no messages (which could echo provider text).
 */
export function healthSummary(data: DashboardData, now: Date) {
  return {
    generatedAt: now.toISOString(),
    connections: data.connections.map((c) => ({
      connection: c.public_id,
      domain: c.provider_domain,
      provider: c.provider_name,
      status: c.status,
      direction: c.sync_direction,
      ceiling: c.data_classification_ceiling,
      freshness: connectionFreshness(c, now),
      lastSuccessfulSync: c.last_successful_sync_at,
      approved: c.approved_at !== null,
      openErrors: data.errors.filter((e) => e.connection_id === c.id).length,
      deadLetters: data.deadLetters.filter((d) => d.connection_id === c.id).length,
    })),
    conflicts: conflicts(data).map(({ kind, count, connections }) => ({ kind, count, connections })),
    killSwitches: data.killSwitches.filter((k) => k.engaged).map((k) => ({ key: k.switch_key, global: k.tenant_id === null })),
  };
}

export const CONNECTION_COLUMNS = [
  'id', 'public_id', 'tenant_id', 'provider_domain', 'provider_name', 'provider_product', 'connection_name',
  'status', 'authentication_type', 'data_classification_ceiling', 'sync_mode', 'sync_direction',
  'freshness_target', 'last_successful_sync_at', 'last_error_at', 'feature_flag_key', 'owner_account_id',
  'approved_at', 'paused_reason',
].join(',');

/** Read what RLS allows. A viewer without `integration:view` gets empty lists. */
export async function loadDashboard(db: SupabaseClient): Promise<DashboardData> {
  const [c, s, m, r, e, d, k] = await Promise.all([
    db.from('integration_connections').select(CONNECTION_COLUMNS).order('provider_domain'),
    db.from('integration_scopes').select('connection_id,scope_key,approved,expires_at'),
    db.from('integration_mappings').select('connection_id,external_entity_type,canonical_entity_type,external_field,canonical_field,transform_config,required,mapping_version,active,validation_state,conflict_kind'),
    db.from('integration_sync_runs').select('public_id,connection_id,trigger_type,status,started_at,completed_at,records_received,records_created,records_updated,records_unchanged,records_rejected,errors_count,retry_count,reconciliation_state,cursor_after').order('started_at', { ascending: false }).limit(50),
    db.from('integration_sync_errors').select('id,connection_id,sync_run_id,external_entity_type,error_category,sanitized_message,severity,retryable,retry_count,created_at').is('resolved_at', null).order('created_at', { ascending: false }).limit(200),
    db.from('integration_dead_letter_events').select('id,connection_id,reason,attempts,replay_requested_at,created_at').is('resolved_at', null).limit(200),
    db.from('feature_kill_switch').select('switch_key,tenant_id,engaged,reason'),
  ]);
  const failed = [c, s, m, r, e, d, k].find((x) => x.error);
  if (failed?.error) throw new Error(failed.error.message || 'Could not load integration status.');
  return {
    connections: (c.data ?? []) as unknown as ConnectionRow[],
    scopes: (s.data ?? []) as ScopeRow[],
    mappings: (m.data ?? []) as MappingRow[],
    runs: (r.data ?? []) as RunRow[],
    errors: (e.data ?? []) as ErrorRow[],
    deadLetters: (d.data ?? []) as DeadLetterRow[],
    killSwitches: (k.data ?? []) as KillSwitchRow[],
  };
}

export async function setPaused(db: SupabaseClient, connection: string, paused: boolean, reason: string): Promise<string> {
  const { data, error } = await db.rpc('integration_set_paused', {
    want_connection: connection, want_paused: paused, want_reason: reason,
  });
  if (error) throw new Error(error.message || 'The change was refused.');
  return String(data);
}

export async function requestReplay(db: SupabaseClient, deadLetter: string, reason: string): Promise<void> {
  const { error } = await db.rpc('integration_request_replay', { want_dead_letter: deadLetter, want_reason: reason });
  if (error) throw new Error(error.message || 'The replay request was refused.');
}
