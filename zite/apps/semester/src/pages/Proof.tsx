import { useMemo, useRef, useState } from 'react';
import { study, sources as sourcesApi } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Metric } from '../components/kit';
import { check, checkQuotes, grade, sentences, wordsOf, type Issue, type Kind } from '../lib/proofRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
const LABEL: Record<Kind, string> = { spelling: 'Spelling', grammar: 'Grammar', punctuation: 'Punctuation', style: 'Style', quote: 'Quotations' };
const ORDER: Kind[] = ['spelling', 'grammar', 'punctuation', 'style'];
const canApply = (i: Issue) => i.suggestion !== undefined && !i.suggestion.startsWith('(');

export default function Proof() {
  const docs = useLoad(() => study({ action: 'list' } as never) as Promise<any>, []);
  const lib = useLoad(() => sourcesApi({ action: 'list' } as never) as Promise<any>, []);
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [only, setOnly] = useState<Kind | 'all'>('all');
  const ref = useRef<HTMLTextAreaElement>(null);
  const issues = useMemo(() => check(text), [text]);
  const saved = (lib.data as any)?.sources?.map((s: any) => ({ authors: s.data?.authors ?? [], year: s.data?.year ?? '' })) ?? [];
  const qs = useMemo(() => checkQuotes(text, source, saved), [text, source, saved.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const ss = sentences(text).filter((s) => wordsOf(s.text).length);
  const nWords = wordsOf(text).length;
  const g = grade(text);
  const shown = issues.filter((i) => only === 'all' || i.kind === only);
  const select = (start: number, end: number) => { const el = ref.current; if (!el) return; el.focus(); el.setSelectionRange(start, end); };
  const apply = (i: Issue) => setText(text.slice(0, i.start) + i.suggestion + text.slice(i.end));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Toolkit" title="Check the writing" sub="Spelling slips, grammar, punctuation, style and quotations, checked on this page. Nothing is sent anywhere or saved; it does not grade your work." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Your text" action={<Loadable state={docs}>{(d: any) => {
            const notes = (d.items ?? []).filter((i: any) => i.kind === 'Note');
            return <select aria-label="Load a Write document" className="rounded-md border border-border bg-background p-1 text-xs" defaultValue="" onChange={(e) => { const n = notes.find((x: any) => x.id === e.target.value); if (n) setText(n.body ?? ''); e.target.value = ''; }}>
              <option value="">{notes.length ? 'Load from Write…' : 'No Write documents'}</option>{notes.map((n: any) => <option key={n.id} value={n.id}>{n.title}</option>)}</select>;
          }}</Loadable>}>
            <Textarea ref={ref} aria-label="Text to check" spellCheck lang="en" rows={16} placeholder="Paste or type your draft" value={text} onChange={(e) => setText(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Your browser also underlines spelling it does not recognise. Changes here do not change the saved document; copy the text back when you are done.</p>
            <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={!text} onClick={() => navigator.clipboard?.writeText(text)}>Copy text</Button></div>
          </Panel>
          <Panel title="Quotations">
            <Textarea aria-label="Source text to check quotations against" rows={5} placeholder="Paste the passage(s) you quoted from, to check each quotation word for word" value={source} onChange={(e) => setSource(e.target.value)} />
            {!qs.length ? <Empty>No quotations of four or more words in the text.</Empty> : <ul className="mt-2 space-y-2 text-sm">{qs.map((q, i) => (
              <li key={i} className="rounded-md border border-border p-2">
                <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => select(q.start, q.end)}>“{q.text}”</button>
                <p className="mt-1 text-xs">{q.found === 'exact' ? '✓ Word for word in the source text.' : q.found === 'close' ? `! Close but not exact. The source says: “${q.closest}”` : q.found === 'missing' ? '! Not found in the source text.' : '· Paste the source text above to check the wording.'}</p>
                <p className="text-xs">{q.cited === 'none' ? '! No citation found right after this quotation.' : q.cited === 'in-sources' ? `✓ Cited (${q.citation})${/^\d/.test(q.citation ?? '') ? '' : ', and in your Sources.'}` : `! Cited (${q.citation}), but no matching author and year in your Sources.`}</p>
              </li>))}</ul>}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Summary">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Words" value={String(nWords)} />
              <Metric label="Sentences" value={String(ss.length)} />
              <Metric label="Words per sentence" value={ss.length ? (nWords / ss.length).toFixed(1) : '—'} />
              <Metric label="Reading grade" value={g === null ? '—' : String(g)} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Reading grade is the Flesch–Kincaid estimate (needs 30+ words). It describes sentence and word length, not quality.</p>
          </Panel>
          <Panel title={`Suggestions (${issues.length})`}>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Filter suggestions">
              <Button size="sm" variant={only === 'all' ? 'default' : 'outline'} onClick={() => setOnly('all')}>All</Button>
              {ORDER.map((k) => <Button key={k} size="sm" variant={only === k ? 'default' : 'outline'} onClick={() => setOnly(k)}>{LABEL[k]} {issues.filter((i) => i.kind === k).length}</Button>)}
            </div>
            {!text ? <Empty>Paste some writing to check it.</Empty> : !shown.length ? <Empty>Nothing to flag{only === 'all' ? '' : ` in ${LABEL[only as Kind].toLowerCase()}`}.</Empty> : (
              <ul className="mt-2 space-y-2 text-sm">{shown.slice(0, 200).map((i, n) => (
                <li key={`${i.start}-${i.kind}-${n}`} className="rounded-md border border-border p-2">
                  <p className="text-xs text-muted-foreground">{LABEL[i.kind]}</p>
                  <p><span className="font-mono text-xs">{i.text.length > 60 ? `${i.text.slice(0, 60)}…` : i.text}</span>{i.suggestion !== undefined && <> → <span className="font-mono text-xs">{i.suggestion === ' ' ? '(one space)' : i.suggestion}</span></>}</p>
                  <p className="text-xs">{i.message}</p>
                  <div className="mt-1 flex gap-1"><Button size="sm" variant="ghost" onClick={() => select(i.start, i.end)}>Show</Button>{canApply(i) && <Button size="sm" variant="outline" onClick={() => apply(i)}>Apply</Button>}</div>
                </li>))}</ul>)}
            {shown.length > 200 && <p className="mt-2 text-xs">Showing the first 200.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
