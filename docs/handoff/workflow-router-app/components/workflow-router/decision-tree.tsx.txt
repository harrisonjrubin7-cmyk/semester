'use client';
import type { RouterAnswers } from '@/lib/validation/workflow-router';
export const QUESTIONS: { key: keyof RouterAnswers; label: string; options: [string, string][] }[] = [
  { key: 'deliverable', label: 'Deliverable', options: [['interactive-tool', 'Interactive tool'], ['prototype', 'Product prototype'], ['marketing-page', 'Marketing page'], ['diagram', 'Diagram'], ['document', 'Document'], ['presentation', 'Presentation'], ['data-analysis', 'Data analysis'], ['react-component', 'React component'], ['full-stack', 'Full-stack feature']] },
  { key: 'interaction', label: 'Interaction', options: [['none', 'None'], ['simple-local', 'Simple local interaction'], ['complex-local', 'Complex local state'], ['multi-user', 'Multi-user collaboration']] },
  { key: 'backend', label: 'Backend', options: [['none', 'None'], ['file-export', 'File export'], ['database', 'Database'], ['server-api', 'Server API'], ['auth-secrets', 'Auth/secrets']] },
  { key: 'technology', label: 'Technology target', options: [['none', 'None'], ['html', 'HTML/CSS/JavaScript'], ['react', 'React'], ['nextjs', 'Next.js'], ['nextjs-postgres', 'Next.js + Postgres'], ['nextjs-supabase', 'Next.js + Supabase/Auth']] },
  { key: 'persistence', label: 'Persistence/access', options: [['none', 'No persistence'], ['database', 'Database'], ['auth', 'Auth'], ['storage', 'Storage'], ['realtime', 'Realtime'], ['multi-tenant', 'Multi-tenant organization workspace']] },
  { key: 'handoff', label: 'Handoff', options: [['share', 'Share immediately'], ['document-export', 'Document/source export'], ['github', 'GitHub'], ['vercel', 'Deploy to Vercel']] },
];
export function DecisionTree({ value, onChange }: { value: RouterAnswers; onChange: (v: RouterAnswers) => void }) {
  return (<div className="grid gap-5">{QUESTIONS.map((q) => (
    <fieldset key={q.key}><legend className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-600">{q.label}</legend>
      <div className="flex flex-wrap gap-2">{q.options.map(([v, l]) => (
        <label key={v} className={'cursor-pointer rounded border px-3 py-2 text-sm min-h-10 inline-flex items-center focus-within:ring-2 focus-within:ring-slate-500 ' + (value[q.key] === v ? 'border-slate-700 bg-slate-800 text-white' : 'border-neutral-300 bg-white hover:bg-neutral-50')}>
          <input type="radio" className="sr-only" name={q.key} value={v} checked={value[q.key] === v} onChange={() => onChange({ ...value, [q.key]: v } as RouterAnswers)} />{l}</label>))}</div></fieldset>))}</div>);
}
