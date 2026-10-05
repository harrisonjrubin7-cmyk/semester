'use client';
import { useMemo, useState } from 'react';
export const FEATURES = [
  { platform: 'Claude Artifacts', primaryUse: 'Self-contained interactive artifacts, diagrams, prototypes', execution: 'Client-side sandbox beside the chat', sandbox: 'Approved CDNs only; localStorage/fetch may be restricted', react: 4, clientState: 4, persistent: 1, multiFile: 1, server: 0, database: 0, auth: 0, docExport: 3, codeExport: 4, github: 1, deploy: 1, semester: 'Decision tools, artifact catalog, architecture diagrams' },
  { platform: 'ChatGPT Canvas', primaryUse: 'Revision-centred writing and code iteration', execution: 'Isolated React/HTML preview; Python execution', sandbox: 'Isolated preview; not a hosting environment', react: 3, clientState: 3, persistent: 1, multiFile: 2, server: 1, database: 0, auth: 0, docExport: 5, codeExport: 3, github: 1, deploy: 0, semester: 'PRDs, TDDs, legal first drafts, CSV analysis' },
  { platform: 'v0', primaryUse: 'Multi-file Next.js apps with server logic', execution: 'VM-backed Node.js sandbox', sandbox: 'Isolated VM; runs server code, API routes, DB connections', react: 5, clientState: 5, persistent: 4, multiFile: 5, server: 5, database: 4, auth: 4, docExport: 1, codeExport: 5, github: 5, deploy: 5, semester: 'Authenticated, database-backed Semester features' },
] as const;
type Row = (typeof FEATURES)[number]; type Key = keyof Row;
const COLS: [Key, string][] = [['platform', 'Platform'], ['primaryUse', 'Primary use'], ['execution', 'Execution model'], ['sandbox', 'Sandbox limits'], ['react', 'React'], ['clientState', 'Client state'], ['persistent', 'Persistent state'], ['multiFile', 'Multi-file'], ['server', 'Server/API'], ['database', 'Database'], ['auth', 'Auth'], ['docExport', 'Doc export'], ['codeExport', 'Code export'], ['github', 'GitHub'], ['deploy', 'Deploy'], ['semester', 'Best Semester use']];
const word = (n: number) => ['None', 'Minimal', 'Partial', 'Good', 'Strong', 'Native'][n];
export function FeatureMatrix() {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'platform', dir: 1 }); const [q, setQ] = useState('');
  const rows = useMemo(() => [...FEATURES].filter((r) => JSON.stringify(r).toLowerCase().includes(q.toLowerCase())).sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir), [sort, q]);
  return (<div><label className="mb-2 block text-sm">Search <input value={q} onChange={(e) => setQ(e.target.value)} className="ml-2 min-h-9 rounded border px-2" /></label>
    <div className="overflow-x-auto rounded-md border" role="region" aria-label="Feature matrix" tabIndex={0}><table className="min-w-[1400px] text-sm"><thead className="bg-neutral-100"><tr>{COLS.map(([k, l]) => (
      <th key={k} scope="col" aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 text-left text-xs uppercase tracking-wider"><button type="button" onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>{l}{sort.key === k ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}</button></th>))}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.platform} className="border-t">{COLS.map(([k]) => <td key={k} className="px-3 py-2 align-top">{typeof r[k] === 'number' ? <span className="tabular-nums">{word(r[k] as number)} ({r[k]}/5)</span> : String(r[k])}</td>)}</tr>)}</tbody></table></div></div>);
}
