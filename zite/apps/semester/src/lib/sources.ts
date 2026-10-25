// Source freshness + reconciliation rules. Pure; unit-tested in tests/sources.test.ts.
export type SourceInput = { name: string; connector: string; enabled: boolean; authorized: boolean; syncStatus: string; lastSyncedAt: string | null };
export type SourceState = 'Fresh' | 'Stale' | 'Error' | 'Unauthorized' | 'Not connected';
export type SourceView = SourceInput & { state: SourceState; ageHours: number | null; detail: string };

/** Max age before a feed is stale. SIS drives official records, so it has the tightest window. */
export const MAX_AGE_HOURS: Record<string, number> = { SIS: 24, LMS: 72, SSO: 168, Calendar: 168 };

export function sourceState(s: SourceInput, now: Date): SourceView {
  const age = s.lastSyncedAt ? (now.getTime() - new Date(s.lastSyncedAt).getTime()) / 36e5 : null;
  const max = MAX_AGE_HOURS[s.connector] ?? 72;
  const v = (state: SourceState, detail: string): SourceView => ({ ...s, state, ageHours: age == null ? null : Math.round(age * 10) / 10, detail });
  if (!s.enabled) return v('Not connected', 'Not enabled. Data from this source is not shown as current.');
  if (!s.authorized) return v('Unauthorized', 'Enabled but not authorized by the institution. Treated as unusable.');
  if (s.syncStatus === 'Sync Error' || s.syncStatus === 'Rolled Back') return v('Error', `Last sync: ${s.syncStatus}.`);
  if (age == null) return v('Stale', 'Never synced.');
  if (age > max) return v('Stale', `Last synced ${Math.round(age)}h ago (limit ${max}h).`);
  return v('Fresh', `Synced ${Math.round(age)}h ago.`);
}

/** Consequential registrar commands are blocked when an enabled SIS feed is not Fresh. No SIS = Semester is the record of request only. */
export function sisBlock(sources: SourceView[]): string | null {
  const sis = sources.filter((s) => s.connector === 'SIS' && s.state !== 'Not connected');
  const bad = sis.find((s) => s.state !== 'Fresh');
  return bad ? `${bad.name} is ${bad.state.toLowerCase()} (${bad.detail}) Official changes are paused until it is fresh.` : null;
}

export type ReconRow = { sectionId: string; label: string; zite: number; ledger: number };
/** Compares enrolled counts in app records against the registrar ledger. */
export function reconcile(rows: ReconRow[]) {
  const mismatches = rows.filter((r) => r.zite !== r.ledger);
  return { checked: rows.length, mismatches, ok: mismatches.length === 0 };
}
