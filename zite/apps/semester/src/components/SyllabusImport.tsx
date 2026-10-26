import { useState } from 'react';
import { Textarea } from '@project/components/ui/textarea';
import { Input } from '@project/components/ui/input';
import { Button } from '@project/components/ui/button';
import { X } from 'lucide-react';
import { SourceTag } from './kit';

export type DraftTask = { title: string; dueAt: string | null };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseSyllabus(text: string): DraftTask[] {
  const year = new Date().getFullYear();
  const out: DraftTask[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    let m = line.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i);
    let month = -1, d = 0;
    if (m) { month = MONTHS.indexOf(m[1].toLowerCase()); d = +m[2]; }
    else if ((m = line.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i))) { month = MONTHS.indexOf(m[2].toLowerCase()); d = +m[1]; }
    else if ((m = line.match(/\b(\d{1,2})\/(\d{1,2})\b/))) { month = +m[1] - 1; d = +m[2]; }
    if (month < 0 || d < 1 || d > 31) continue;
    const title = line.replace(m![0], '').replace(/^[\s:–—\-·,]+|[\s:–—\-·,]+$/g, '') || 'Syllabus item';
    out.push({ title, dueAt: new Date(year, month, d, 23, 59).toISOString() });
  }
  return out;
}

export default function SyllabusImport({ items, setItems }: { items: DraftTask[]; setItems: (t: DraftTask[]) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-3">
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Paste your syllabus schedule, e.g.\nOct 23 – Essay draft due\n30 Oct: Midterm exam\n11/14 Lab report'} />
      <Button type="button" variant="outline" size="sm" onClick={() => setItems(parseSyllabus(text))} disabled={!text.trim()}>Find dates</Button>
      {items.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{items.length} tasks found. Edit before saving. They’ll be labeled <SourceTag source="Made Here" />.</p>
          {items.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={t.title} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <Input type="date" className="w-40" value={t.dueAt?.slice(0, 10) ?? ''} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, dueAt: e.target.value ? new Date(e.target.value + 'T23:59').toISOString() : null } : x)))} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
