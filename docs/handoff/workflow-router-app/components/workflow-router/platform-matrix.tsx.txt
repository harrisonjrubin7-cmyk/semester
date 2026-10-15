'use client';
import { WORKFLOWS, PLATFORM_LABEL } from '@/lib/benchmark/benchmark.config';
export function PlatformMatrix() {
  return (<div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-neutral-100"><tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Workflow</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Recommended</th><th className="px-3 py-2 text-left">Persistence</th></tr></thead>
    <tbody>{WORKFLOWS.map((w) => <tr key={w.number} className="border-t"><td className="px-3 py-2 tabular-nums">{w.number}</td><td className="px-3 py-2">{w.title}</td><td className="px-3 py-2">{w.category}</td><td className="px-3 py-2">{PLATFORM_LABEL[w.recommended]}</td><td className="px-3 py-2">{w.requiresPersistence ? 'Required' : '—'}</td></tr>)}</tbody></table></div>);
}
