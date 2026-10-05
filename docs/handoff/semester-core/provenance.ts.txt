export type Origin = 'official' | 'connected' | 'made' | 'personal' | 'sample' | 'stale' | 'ai' | 'estimated' | 'external';
/** Strongest first. stale ranks below personal on purpose: an unchecked copy that may have moved is worth less than a guess that knows it is one. */
export const LADDER: Origin[] = ['official', 'connected', 'made', 'personal', 'sample', 'stale'];
const DISPLAY_ONLY: Origin[] = ['ai', 'estimated', 'external'];
export const STALE_AFTER_MS: Partial<Record<Origin, number>> = { official: 24 * 3600e3, connected: 6 * 3600e3 };

export interface Fact<T> { value: T; origin: Origin; updatedAt?: number; by?: string }

export function rank(o: Origin): number {
  const i = LADDER.indexOf(o);
  return i >= 0 ? i : LADDER.length + DISPLAY_ONLY.indexOf(o);
}
/** A synced fact past its window is demoted to stale before ranking. */
export function effectiveOrigin(f: Fact<unknown>, now: number): Origin {
  const win = STALE_AFTER_MS[f.origin];
  if (win && f.updatedAt != null && now - f.updatedAt > win) return 'stale';
  if (win && f.updatedAt == null) return 'stale';
  return f.origin;
}
/** Pick the fact to show; ties go to the newest. Returns the conflict so the UI can say "2 sources disagree". */
export function resolve<T>(facts: Fact<T>[], now: number): { shown: Fact<T> & { effective: Origin }; conflict: boolean } | null {
  if (!facts.length) return null;
  const scored = facts.map((f) => ({ ...f, effective: effectiveOrigin(f, now) }))
    .sort((a, b) => rank(a.effective) - rank(b.effective) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const shown = scored[0];
  const conflict = scored.some((f) => JSON.stringify(f.value) !== JSON.stringify(shown.value));
  return { shown, conflict };
}
export function ageLabel(updatedAt: number | undefined, now: number): string {
  if (updatedAt == null) return 'Update time not recorded';
  const m = Math.round((now - updatedAt) / 60000);
  if (m < 1) return 'Updated less than a minute ago';
  if (m < 60) return 'Updated ' + m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return 'Updated ' + h + ' h ago';
  const d = Math.round(h / 24);
  return 'Updated ' + d + (d === 1 ? ' day ago' : ' days ago');
}
