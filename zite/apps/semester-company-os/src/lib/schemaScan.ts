// Pure scanner over migration source text: which tables and triggers the code declares. Used to generate guardManifest.ts
// (scripts/genGuardManifest.mjs) and by tests/guardManifest.test.ts to fail when the manifest drifts from the code.
export type Guard = { trigger: string; table: string; timing: string; events: string };
export type Manifest = { tables: string[]; guards: Guard[] };

export function scan(sources: string[]): Manifest {
  const tables = new Set<string>();
  const guards = new Map<string, Guard>();
  for (const src of sources) {
    for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_][a-z0-9_]*)/g)) tables.add(m[1]);
    for (const m of src.matchAll(/CREATE TRIGGER ([a-z_][a-z0-9_]*)\s+(BEFORE|AFTER)\s+([A-Z ]+?)\s+ON\s+([a-z_][a-z0-9_]*)/g)) {
      guards.set(`${m[4]}.${m[1]}`, { trigger: m[1], timing: m[2], events: m[3].trim(), table: m[4] });
    }
  }
  return {
    tables: [...tables].sort(),
    guards: [...guards.values()].sort((a, b) => (a.table + a.trigger).localeCompare(b.table + b.trigger)),
  };
}
