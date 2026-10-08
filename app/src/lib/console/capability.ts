import type { Grant } from '../capabilities';

/*
 * Kept apart from `client.ts` on purpose: the Me screen offers the console to
 * staff and needs only this, and importing the whole client there put its
 * weight on every opening of Me (`perf-budgets.json`). `client.ts` re-exports
 * both, so there is one definition and every existing import still works.
 */

/** The capability that opens the console, held at platform scope. */
export const CONSOLE_CAPABILITY = 'console:operate';

/** Whether these grants open the console: the capability, at platform scope, exactly. */
export function holdsConsole(grants: readonly Grant[]): boolean {
  return grants.some((g) => g.capability === CONSOLE_CAPABILITY && g.scopeKind === 'platform');
}
