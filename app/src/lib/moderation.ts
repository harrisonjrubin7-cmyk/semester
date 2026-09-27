import { cloud } from './cloud';

/**
 * The report queue — the screen half of the §58 P0.
 *
 * Reports have been filed since 1 September. `20260921214500_report_status.sql`
 * gave them a status and made them readable, `20260922012000_capabilities.sql`
 * pointed who may read at `report:read` and who may move one at
 * `moderation:action`, and `20260924223000_moderation_audit.sql` records every
 * status change. What nobody built was the place a moderator reads them. This
 * is it.
 *
 * ## What it shows, and what it leaves out
 *
 * The reason the reporter gave, the copy of the message as it stood, when, and
 * the status. **Not who reported, and not who it was about** — the rows carry
 * both ids, and neither is selected. A reviewer deciding whether a message is
 * harassment needs the message; a list of names is a different tool with a
 * different risk, and the graduated actions that would need an identity are not
 * built. Selecting only these columns keeps them off the device entirely.
 *
 * ## Moving a report
 *
 * Only `status` changes. The column grant allows nothing else — a moderator
 * cannot rewrite a complaint, which `reports.check.sql` asserts — and the audit
 * trigger records every move. The transitions are the four statuses the check
 * constraint allows, and a closed report can be reopened rather than being a
 * dead end, because a wrong dismissal has to be fixable.
 */

export const STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

/** Where a report can go from each status, as the button labels say it. */
export const MOVES: Record<ReportStatus, readonly { to: ReportStatus; label: string }[]> = {
  open: [
    { to: 'under_review', label: 'Take under review' },
    { to: 'dismissed', label: 'Dismiss' },
  ],
  under_review: [
    { to: 'resolved', label: 'Resolve' },
    { to: 'dismissed', label: 'Dismiss' },
    { to: 'open', label: 'Put back' },
  ],
  resolved: [{ to: 'open', label: 'Reopen' }],
  dismissed: [{ to: 'open', label: 'Reopen' }],
};

export interface QueuedReport {
  id: string;
  status: ReportStatus;
  reason: string;
  copy: string;
  createdAt: string;
  /** Whether the reported message still exists. The copy is kept either way. */
  messageGone: boolean;
}

export interface ModerationAccess {
  canRead: boolean;
  canAct: boolean;
}

export const NO_ACCESS: ModerationAccess = { canRead: false, canAct: false };

/** Open first, then under review, then closed; newest first inside each. */
export function ordered(reports: readonly QueuedReport[]): QueuedReport[] {
  const rank = (s: ReportStatus) => STATUSES.indexOf(s);
  return [...reports].sort((a, b) => rank(a.status) - rank(b.status) || b.createdAt.localeCompare(a.createdAt));
}

export function counts(reports: readonly QueuedReport[]): Record<ReportStatus, number> {
  const out = { open: 0, under_review: 0, resolved: 0, dismissed: 0 };
  for (const r of reports) out[r.status] += 1;
  return out;
}

function isStatus(v: unknown): v is ReportStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

/** A row as the API returns it, made safe to draw. An unknown status is dropped. */
export function readRow(v: unknown): QueuedReport | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !isStatus(o.status)) return null;
  return {
    id: o.id,
    status: o.status,
    reason: typeof o.reason === 'string' ? o.reason : '',
    copy: typeof o.copy === 'string' ? o.copy : '',
    createdAt: typeof o.created_at === 'string' ? o.created_at : '',
    messageGone: o.message_id === null,
  };
}

/** The caller's own two capabilities. Anything unexpected reads as no access. */
export async function moderationAccess(): Promise<ModerationAccess> {
  const { data, error } = await (await cloud()).rpc('my_moderation_access');
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { can_read?: unknown; can_act?: unknown } | undefined;
  return { canRead: row?.can_read === true, canAct: row?.can_act === true };
}

/** The columns a reviewer needs, and deliberately not `reporter` or `about`. */
export const QUEUE_COLUMNS = 'id, status, reason, copy, created_at, message_id';

export async function loadQueue(): Promise<QueuedReport[]> {
  const { data, error } = await (await cloud())
    .from('reports')
    .select(QUEUE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return ordered((data ?? []).map(readRow).filter((r): r is QueuedReport => r !== null));
}

export async function moveReport(id: string, to: ReportStatus): Promise<void> {
  const { data, error } = await (await cloud()).from('reports').update({ status: to }).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  // Row-level security answers a refused update with zero rows, not an error.
  if (!data || data.length === 0) throw new Error('That report could not be moved — your access may have changed.');
}
