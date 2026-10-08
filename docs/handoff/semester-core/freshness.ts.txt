export type State = 'live' | 'recent' | 'delayed' | 'failed' | 'rebuilding';
export interface Projection { lastEventAt: number; appliedAt?: number; workerFailed?: boolean; rebuilding?: boolean }
export function state(p: Projection, now: number): State {
  if (p.rebuilding) return 'rebuilding';
  if (p.workerFailed) return 'failed';
  const lag = (now - (p.appliedAt ?? 0)) / 1000;
  return lag <= 5 ? 'live' : lag <= 60 ? 'recent' : 'delayed';
}
export interface Policy { display: string; safe: boolean; destructive: 'allowed' | 'confirm-at-source' | 'disabled'; badge?: string }
export const POLICY: Record<State, Policy> = {
  live: { display: 'normal', safe: true, destructive: 'allowed' },
  recent: { display: 'normal', safe: true, destructive: 'allowed' },
  delayed: { display: 'normal', safe: true, destructive: 'confirm-at-source', badge: 'Delayed' },
  failed: { display: 'last-known', safe: false, destructive: 'disabled', badge: 'Not updating' },
  rebuilding: { display: 'versioned', safe: true, destructive: 'disabled', badge: 'Rebuilding' },
};
/** Optimistic mutation: pending until the projection version reaches the command's version; rollback after timeout. */
export function optimistic(sentVersion: number, seenVersion: number, sentAt: number, now: number, timeoutMs = 15000): 'pending' | 'confirmed' | 'rolled-back' {
  if (seenVersion >= sentVersion) return 'confirmed';
  return now - sentAt > timeoutMs ? 'rolled-back' : 'pending';
}
