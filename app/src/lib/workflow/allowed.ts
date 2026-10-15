/**
 * Whether an account holding these verified capabilities should see the
 * Workflows tab at all.
 *
 * Its own file, and deliberately tiny: the University screen asks this on
 * every render, and it must do so without importing the spec, the templates
 * and the client in `api.ts`, which only the lazily loaded screen needs.
 * `app/perf-budgets.json` holds University.tsx to a cost they would break.
 */
export function workflowsAllowed(holds: readonly string[]): boolean {
  return holds.some((c) => c === 'workflow:manage' || c === 'workflow:publish' || c === 'workflow:view');
}
