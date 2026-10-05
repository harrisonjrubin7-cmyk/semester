'use client';
import { useState } from 'react';
export function CopyBlock({ label, text }: { label: string; text: string }) {
  const [said, setSaid] = useState('');
  return (<div className="rounded-md border border-neutral-300 bg-white"><div className="flex items-center justify-between border-b px-4 py-2"><h3 className="text-sm font-semibold">{label}</h3>
    <button type="button" className="min-h-9 rounded border px-3 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setSaid('Copied'); } catch { setSaid('Copy failed — select the text'); } setTimeout(() => setSaid(''), 1500); }}>Copy</button></div>
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs">{text}</pre><span role="status" className="sr-only">{said}</span>{said && <p className="px-4 pb-2 text-xs">{said}</p>}</div>);
}
