// Regenerates docs/execution/role-app-requirements.csv from the code (lib/roleApps.ts, lib/roleAppSpecs.ts).
// Run from the workspace root: npx esbuild docs/execution/tools/roleAppRequirements.ts --bundle --platform=node --format=esm --outfile=/tmp/rar.mjs && node /tmp/rar.mjs > docs/execution/role-app-requirements.csv
import { ROLE_APP_ROWS } from '../../../apps/semester/src/lib/roleApps';
import { ROLE_APP_SPECS } from '../../../apps/semester/src/lib/roleAppSpecs';

const PUBLISHED_HOSTS = new Set(['site']); // only the Site app is published (2026-10-24)
const OWNER: Record<string, string> = { learner: 'Student product', academic: 'Academic product', campus: 'Campus services', institution: 'Institution platform', platform: 'Platform operations', external: 'Partner product', organization: 'Communities', commercial: 'Company operations' };
const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const out = [['id', 'source', 'role_app', 'host', 'family', 'capability', 'target_scope', 'boundary', 'owner', 'route', 'gap', 'designed', 'implemented', 'tested', 'deployed', 'institution_authorized', 'production_enabled'].join(',')];
ROLE_APP_ROWS.forEach(([role, key, host, caps], i) => {
  const [family, target, boundary] = ROLE_APP_SPECS[key] ?? ['unmapped', '', ''];
  caps.forEach(([name, route, state], j) => {
    out.push([
      `RA-${String(i + 1).padStart(2, '0')}-${String(j + 1).padStart(2, '0')}`,
      `S-09 role-catalog.csv row ${i + 2}; S-44 role-app-specifications.json ${key}`,
      role, host, family, name, target, boundary, OWNER[family] ?? 'Unassigned', route ?? '',
      state,
      'yes',
      state === 'existing' ? 'yes' : state === 'incomplete' ? 'partial' : 'no',
      'NOT TRACED',
      PUBLISHED_HOSTS.has(host) && route ? 'yes' : 'no',
      'no', 'no',
    ].map(q).join(','));
  });
});
console.log(out.join('\n'));
