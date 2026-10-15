/**
 * Whether a role may see the Configuration Studio at all.
 *
 * Its own file, and deliberately tiny: the University screen asks this on
 * every render to decide whether to show the tab, and it must do so without
 * importing the spec, the defaults and the diff in `studio.ts`, which only the
 * lazily loaded screen needs. `app/perf-budgets.json` holds University.tsx to
 * a cost that the whole of `studio.ts` would break.
 */
export function studioAllowed(holds: readonly string[]): boolean {
  return holds.some((c) => c === 'config:manage' || c === 'config:publish' || c === 'config:view');
}
