/**
 * Which mode a school runs each module in: Connect or Core (D-151).
 *
 * Connect is Semester reading the school's own system and preparing actions.
 * Core is Semester as the record for that module. The mode is a row per school
 * and module in `public.tenant_module_mode`, changed only by a request two
 * other administrators approve (`module_mode_request`, `module_mode_approval`),
 * and read through `public.effective_module_modes`, which already applies the
 * `kill.core_modules` switch. This file is the one resolver the app asks.
 *
 * ## It fails to Connect
 *
 * Every doubt resolves to Connect: not loaded, signed out, a failed read, a
 * module the database does not list. "Core" is a claim that Semester holds the
 * record, and a dropped request is not evidence of that. So no screen shows a
 * Core surface because a read failed the other way.
 */
import { useEffect, useState } from 'react';
import { CORE_MODULES, type CoreModuleId, type ModuleMode } from '@semester/contract';
import { cloud, cloudConfigured } from './cloud';

/** A row of `public.effective_module_modes`. */
export interface ModuleModeRow {
  module: string;
  mode: string;
  frozen: boolean;
  killed: boolean;
}

/** Where the answer came from, in words a screen can print. */
export type ModeSource = 'school' | 'default' | 'kill-switch' | 'unavailable';

export interface ResolvedMode {
  mode: ModuleMode;
  /** Core data is kept but read-only: the module went back to Connect, or the switch is engaged. */
  frozen: boolean;
  source: ModeSource;
}

export const SOURCE_TEXT: Record<ModeSource, string> = {
  school: 'Set by your institution',
  default: 'Connect, the default: Semester reads your institution’s system',
  'kill-switch': 'Core is paused by a kill switch; the data is kept, read-only',
  unavailable: 'Connect, because the setting could not be read',
};

/** `rows` is null when nothing has been read (yet, or the read failed). */
export function resolveModuleMode(module: CoreModuleId, rows: readonly ModuleModeRow[] | null): ResolvedMode {
  if (!rows) return { mode: 'connect', frozen: false, source: 'unavailable' };
  const row = rows.find((r) => r.module === module);
  if (!row) return { mode: 'connect', frozen: false, source: 'default' };
  if (row.killed) return { mode: 'connect', frozen: row.frozen, source: 'kill-switch' };
  if (row.mode === 'core' && !row.frozen) return { mode: 'core', frozen: false, source: 'school' };
  return { mode: 'connect', frozen: row.frozen, source: row.frozen ? 'school' : 'default' };
}

export function readModeRows(data: unknown): ModuleModeRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .filter((r) => typeof r.module === 'string' && (CORE_MODULES as readonly string[]).includes(r.module))
    .map((r) => ({ module: r.module as string, mode: String(r.mode), frozen: r.frozen === true, killed: r.killed === true }));
}

/** Null on any failure, so the resolver answers Connect. */
export async function loadModuleModes(school: string): Promise<ModuleModeRow[] | null> {
  if (!cloudConfigured || !school) return null;
  try {
    const db = await cloud();
    const { data, error } = await db.rpc('effective_module_modes', { want_tenant: school });
    if (error) return null;
    return readModeRows(data);
  } catch {
    return null;
  }
}

/** One school's answer, read once per school per page load and shared. */
const cache = new Map<string, Promise<ModuleModeRow[] | null>>();
export function moduleModes(school: string, fresh = false): Promise<ModuleModeRow[] | null> {
  if (fresh || !cache.has(school)) cache.set(school, loadModuleModes(school));
  return cache.get(school)!;
}

/** For tests: forget what was read. */
export function forgetModuleModes(): void {
  cache.clear();
}

/** The mode of one module for this school. Connect until the database says otherwise. */
export function useModuleMode(module: CoreModuleId, school: string): ResolvedMode {
  const [rows, setRows] = useState<readonly ModuleModeRow[] | null>(null);
  useEffect(() => {
    let live = true;
    void moduleModes(school).then((r) => { if (live) setRows(r); });
    return () => { live = false; };
  }, [school]);
  return resolveModuleMode(module, rows);
}

// ── The changes: a request, an approval, a way back ───────────────────────

export interface ModuleRequest {
  id: string;
  module: string;
  to_mode: string;
  reason: string;
  status: string;
  requested_by: string | null;
  requested_at: string;
  expires_at: string;
  approvals: number;
  approvedByMe: boolean;
}

/** Pending requests for a school, with how many people have approved each. Empty on any failure. */
export async function loadRequests(school: string, me: string): Promise<ModuleRequest[]> {
  if (!cloudConfigured || !school) return [];
  try {
    const db = await cloud();
    const { data, error } = await db
      .from('module_mode_request')
      .select('id,module,to_mode,reason,status,requested_by,requested_at,expires_at,module_mode_approval(approver)')
      .eq('tenant_id', school)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: Record<string, unknown>) => {
      const approvers = (Array.isArray(r.module_mode_approval) ? r.module_mode_approval : []) as { approver: string | null }[];
      return {
        id: String(r.id), module: String(r.module), to_mode: String(r.to_mode), reason: String(r.reason),
        status: String(r.status), requested_by: (r.requested_by as string | null) ?? null,
        requested_at: String(r.requested_at), expires_at: String(r.expires_at),
        approvals: approvers.length, approvedByMe: approvers.some((a) => a.approver === me),
      };
    });
  } catch {
    return [];
  }
}

async function write(school: string, run: (db: Awaited<ReturnType<typeof cloud>>) => PromiseLike<{ error: { message: string } | null }>): Promise<string | null> {
  try {
    const { error } = await run(await cloud());
    if (error) return error.message;
    void moduleModes(school, true);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'The change was not sent.';
  }
}

/** Ask to move a module. Going to Connect applies at once; going to Core waits for two approvals. */
export function requestModuleMode(school: string, me: string, module: CoreModuleId, to: ModuleMode, reason: string): Promise<string | null> {
  return write(school, (db) => db.from('module_mode_request').insert({ tenant_id: school, module, to_mode: to, reason: reason.trim(), requested_by: me }));
}

export function approveModuleMode(school: string, me: string, request: string): Promise<string | null> {
  return write(school, (db) => db.from('module_mode_approval').insert({ request_id: request, approver: me }));
}
