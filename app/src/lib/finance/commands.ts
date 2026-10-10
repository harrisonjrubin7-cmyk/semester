import type { SupabaseClient } from '@supabase/supabase-js';

export type FinanceCommandAction = 'request.create' | 'request.approve' | 'request.reject' | 'request.withdraw' | 'plan.request';
export type FinanceCommandUiState = 'pending' | 'unknown' | 'accepted' | 'denied' | 'conflict';

export interface FinanceCommandReceipt {
  id: string;
  commandKey: string;
  action: FinanceCommandAction;
  status: 'accepted';
  resourceId: string;
  state: 'proposed' | 'approved' | 'rejected' | 'withdrawn';
  version: number;
  recordedAt: string;
}

export class FinanceCommandError extends Error {
  readonly kind: Exclude<FinanceCommandUiState, 'pending' | 'accepted'>;

  constructor(kind: Exclude<FinanceCommandUiState, 'pending' | 'accepted'>, message: string) {
    super(message);
    this.kind = kind;
  }
}

export const newFinanceCommandKey = (action: FinanceCommandAction) =>
  `finance:${action}:${globalThis.crypto.randomUUID()}`;

const pendingPrefix = 'semester.finance-command.pending:';
export interface PendingFinanceCommand {
  tenantId: string;
  studentRef: string;
  action: FinanceCommandAction;
  key: string;
  resourceId: string;
}
const pendingSlot = (tenantId: string, studentRef: string, action: FinanceCommandAction, resourceId = '') =>
  `${pendingPrefix}${encodeURIComponent(tenantId)}:${encodeURIComponent(studentRef)}:${action}:${encodeURIComponent(resourceId)}`;

export function rememberPendingFinanceCommand(tenantId: string, studentRef: string, action: FinanceCommandAction, key: string, resourceId = '') {
  globalThis.localStorage?.setItem(pendingSlot(tenantId, studentRef, action, resourceId), JSON.stringify({ tenantId, studentRef, action, key, resourceId }));
}

export function pendingFinanceCommand(tenantId: string, studentRef: string, action: FinanceCommandAction, resourceId = '') {
  const saved = globalThis.localStorage?.getItem(pendingSlot(tenantId, studentRef, action, resourceId));
  if (!saved) return null;
  try {
    return (JSON.parse(saved) as PendingFinanceCommand).key;
  } catch {
    return saved;
  }
}

export function forgetPendingFinanceCommand(tenantId: string, studentRef: string, action: FinanceCommandAction, resourceId = '') {
  globalThis.localStorage?.removeItem(pendingSlot(tenantId, studentRef, action, resourceId));
}

export function pendingFinanceCommands() {
  const storage = globalThis.localStorage;
  if (!storage) return [] as PendingFinanceCommand[];
  const found: PendingFinanceCommand[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const slot = storage.key(i);
    if (!slot?.startsWith(pendingPrefix)) continue;
    try {
      const saved = JSON.parse(storage.getItem(slot) ?? '') as PendingFinanceCommand;
      if (saved.key && saved.tenantId && saved.studentRef && saved.action) found.push(saved);
    } catch {
      // Pre-registry values are still recoverable by their exact known slot.
    }
  }
  return found;
}

const commandError = (error: { message?: string; code?: string } | null, fallback: string) => {
  const message = error?.message || fallback;
  if (error?.code === 'SC409' || /version conflict|different finance command/i.test(message)) {
    return new FinanceCommandError('conflict', message);
  }
  if (/failed to fetch|network|load failed|timeout/i.test(message)) {
    return new FinanceCommandError('unknown', 'No answer came back. Recover this receipt before trying a new command.');
  }
  return new FinanceCommandError('denied', message);
};

export async function submitFinanceCommand(
  db: SupabaseClient,
  tenantId: string,
  studentRef: string,
  action: FinanceCommandAction,
  key: string,
  expectedVersion: number | null,
  payload: Record<string, unknown>,
): Promise<FinanceCommandReceipt> {
  const { data, error } = await db.rpc('finance_command', {
    want_tenant: tenantId,
    want_student: studentRef,
    want_action: action,
    want_key: key,
    want_expected_version: expectedVersion,
    want_payload: payload,
  });
  if (error) throw commandError(error, 'The finance command was denied.');
  return data as unknown as FinanceCommandReceipt;
}

export async function recoverFinanceReceipt(
  db: SupabaseClient,
  tenantId: string,
  studentRef: string,
  action: FinanceCommandAction,
  key: string,
): Promise<FinanceCommandReceipt> {
  const { data, error } = await db.rpc('finance_command_receipt', {
    want_tenant: tenantId,
    want_student: studentRef,
    want_action: action,
    want_key: key,
  });
  if (error) throw commandError(error, 'The receipt could not be recovered.');
  return data as unknown as FinanceCommandReceipt;
}
