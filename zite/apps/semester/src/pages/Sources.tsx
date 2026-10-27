import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { sources as api } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Textarea } from '@project/components/ui/textarea';
import { PageHeader, Panel, Empty, Loadable, useLoad, Status, errMsg } from '../components/kit';
import { KINDS, blank, validate, toBibtex, parseBibtex, cite, type Source } from '../lib/sourceRules';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Item = { id: number; data: Source; sectionId: string | null; section: string; mine: boolean; owner: string; published: boolean; version: number };
const sel = 'rounded-md border border-border bg-background p-2 text-sm';
const norm = (d: any): Source => ({ ...blank(), ...(d ?? {}) });
const download = (name: string, text: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/x-bibtex' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
const containerLabel: Record<string, string> = { article: 'Journal', chapter: 'Book title', report: 'Institution', web: 'Website', book: 'Series (optional)', other: 'Published in' };

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-1"><label htmlFor={id} className="text-xs font-medium">{label}</label>{children}{hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}</div>;
}

export default function Sources() {
  const state = useLoad(() => api({ action: 'list' } as never) as Promise<any>, []);
  const [open, setOpen] = useState<{ id: number | null; version: number; sectionId: string | null } | null>(null);
  const [src, setSrc] = useState<Source>(blank());
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('');
  const [style, setStyle] = useState<'apa' | 'mla'>('apa');
  const [bib, setBib] = useState('');
  const [importing, setImporting] = useState(false);
  const parsed = useMemo(() => (bib.trim() ? parseBibtex(bib) : null), [bib]);
  const errors = open ? validate(src) : [];
  const run = async (input: object, ok: string) => { try { await api(input as never); toast(ok); await state.reload(); return true; } catch (e) { toast(`! ${errMsg(e)}`); return false; } };
  const start = (it: Item | null) => { setOpen(it ? { id: it.id, version: it.version, sectionId: it.sectionId } : { id: null, version: 0, sectionId: course || null }); setSrc(it ? norm(it.data) : blank()); };
  const set = (k: keyof Source, v: any) => setSrc({ ...src, [k]: v });

  return (
    <Loadable state={state}>{(d: any) => {
      const all: Item[] = d.sources.map((s: any) => ({ ...s, data: norm(s.data) }));
      const match = (it: Item) => (!course || it.sectionId === course) && (!q || JSON.stringify(it.data).toLowerCase().includes(q.toLowerCase()));
      const mine = all.filter((i) => i.mine && match(i));
      const reading = all.filter((i) => !i.mine && match(i));
      const teachingThis = open?.sectionId && d.sections.find((s: any) => s.id === open.sectionId)?.teaching;
      const current = open?.id ? all.find((i) => i.id === open.id) : null;
      return (
        <div className="space-y-4">
          <PageHeader eyebrow="Learn" title="Sources" sub="Every reading kept, with what each one is for. Export to BibTeX for LaTeX, Zotero or Overleaf."
            actions={<div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => start(null)}>Add a source</Button>
              <Button size="sm" variant="outline" onClick={() => setImporting(!importing)} aria-expanded={importing}>Import BibTeX</Button>
              <Button size="sm" variant="outline" disabled={!mine.length} onClick={() => download('sources.bib', toBibtex(mine.map((i) => i.data)))}>Export BibTeX ({mine.length})</Button>
            </div>} />

          {importing && <Panel title="Import BibTeX">
            <Textarea aria-label="BibTeX to import" rows={6} className="font-mono text-xs" placeholder="Paste entries exported from Zotero, Google Scholar or a .bib file" value={bib} onChange={(e) => setBib(e.target.value)} />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <input type="file" accept=".bib,text/plain" aria-label="Choose a .bib file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setBib(await f.text()); }} />
              {parsed && <span>{parsed.sources.length} found{parsed.skipped ? `, ${parsed.skipped} skipped (no title)` : ''}</span>}
              <Button size="sm" disabled={!parsed?.sources.length || parsed.sources.length > 500}
                onClick={async () => { if (await run({ action: 'import', list: parsed!.sources }, `Imported ${parsed!.sources.length}.`)) { setBib(''); setImporting(false); } }}>Import</Button>
              {parsed && parsed.sources.length > 500 && <span className="text-destructive">! Up to 500 at a time.</span>}
            </div>
          </Panel>}

          <div className="flex flex-wrap gap-2">
            <Input aria-label="Search sources" placeholder="Search title, author, notes" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Course" className={sel} value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">All courses</option>{d.sections.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4">
              <Panel title={`Yours (${mine.length})`}>
                {!mine.length ? <Empty>{q || course ? 'Nothing matches.' : 'No sources yet. Add one or import a .bib file.'}</Empty> : mine.map((i) => (
                  <button type="button" key={i.id} onClick={() => start(i)} className={`mt-1 block w-full rounded-md border p-2 text-left text-sm ${open?.id === i.id ? 'border-primary' : 'border-border'}`}>
                    <span className="block font-medium">{i.data.title}</span>
                    <span className="block text-xs text-muted-foreground">{[i.data.authors[0], i.data.year, i.section].filter(Boolean).join(' · ')}{i.published ? ' · on reading list' : ''}</span>
                    {i.data.purpose && <span className="block text-xs">For: {i.data.purpose}</span>}
                  </button>))}
              </Panel>
              <Panel title={`Course reading lists (${reading.length})`}>
                {!reading.length ? <Empty>Your instructors have not added readings{course ? ' for this course' : ''} yet.</Empty> : reading.map((i) => (
                  <div key={i.id} className="mt-1 rounded-md border border-border p-2 text-sm">
                    <p className="font-medium">{i.data.title}</p><p className="text-xs text-muted-foreground">{i.section} · added by {i.owner}</p>
                    <p className="mt-1 text-xs">{cite(i.data, style)}</p>
                    <Button size="sm" variant="outline" className="mt-1" onClick={() => run({ action: 'copy', id: i.id }, 'Copied to your sources.')}>Copy to my sources</Button>
                  </div>))}
              </Panel>
            </div>

            <div className="lg:col-span-2">{!open ? <Panel><Empty>Choose a source or add a new one.</Empty></Panel> : (
              <Panel title={open.id ? 'Edit source' : 'New source'} action={<div className="flex gap-2">
                <Button size="sm" disabled={errors.length > 0} onClick={async () => { if (await run({ action: 'save', id: open.id, sectionId: open.sectionId, data: { ...src, authors: src.authors.map((a) => a.trim()).filter(Boolean) }, expectedVersion: open.version }, 'Saved.')) setOpen(null); }}>Save</Button>
                {open.id && <Button size="sm" variant="ghost" onClick={async () => { if (await run({ action: 'delete', id: open.id }, 'Deleted.')) setOpen(null); }}>Delete</Button>}</div>}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="s-kind" label="Type"><select id="s-kind" className={`${sel} w-full`} value={src.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></Field>
                  <Field id="s-course" label="Course (optional)"><select id="s-course" className={`${sel} w-full`} value={open.sectionId ?? ''} disabled={!!current?.published} onChange={(e) => setOpen({ ...open, sectionId: e.target.value || null })}>
                    <option value="">None</option>{d.sections.map((s: any) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
                  <div className="sm:col-span-2"><Field id="s-title" label="Title"><Input id="s-title" value={src.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
                  <div className="sm:col-span-2"><Field id="s-auth" label="Authors" hint="One per line, as Last, First."><Textarea id="s-auth" aria-describedby="s-auth-hint" rows={2} value={src.authors.join('\n')} onChange={(e) => set('authors', e.target.value.split('\n'))} /></Field></div>
                  <Field id="s-year" label="Year"><Input id="s-year" inputMode="numeric" value={src.year} onChange={(e) => set('year', e.target.value)} /></Field>
                  <Field id="s-cont" label={containerLabel[src.kind]}><Input id="s-cont" value={src.container} onChange={(e) => set('container', e.target.value)} /></Field>
                  <Field id="s-pub" label="Publisher"><Input id="s-pub" value={src.publisher} onChange={(e) => set('publisher', e.target.value)} /></Field>
                  <div className="grid grid-cols-3 gap-2">
                    <Field id="s-vol" label="Volume"><Input id="s-vol" value={src.volume} onChange={(e) => set('volume', e.target.value)} /></Field>
                    <Field id="s-iss" label="Issue"><Input id="s-iss" value={src.issue} onChange={(e) => set('issue', e.target.value)} /></Field>
                    <Field id="s-pp" label="Pages"><Input id="s-pp" value={src.pages} onChange={(e) => set('pages', e.target.value)} /></Field>
                  </div>
                  <Field id="s-doi" label="DOI"><Input id="s-doi" placeholder="10.1234/abcd" value={src.doi} onChange={(e) => set('doi', e.target.value)} /></Field>
                  <Field id="s-url" label="Link"><Input id="s-url" placeholder="https://" value={src.url} onChange={(e) => set('url', e.target.value)} /></Field>
                  {src.kind === 'web' && <Field id="s-acc" label="Accessed"><Input id="s-acc" type="date" value={src.accessed} onChange={(e) => set('accessed', e.target.value)} /></Field>}
                  <Field id="s-tags" label="Tags" hint="Separate with commas."><Input id="s-tags" aria-describedby="s-tags-hint" value={src.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20))} /></Field>
                  <div className="sm:col-span-2"><Field id="s-for" label="What it is for" hint="Your own note — which argument, chapter or assignment this supports."><Textarea id="s-for" aria-describedby="s-for-hint" rows={2} value={src.purpose} onChange={(e) => set('purpose', e.target.value)} /></Field></div>
                </div>
                {errors.length > 0 && <ul className="mt-3 space-y-1 text-sm text-destructive" aria-live="polite">{errors.map((e) => <li key={e}>! {e}</li>)}</ul>}
                <div className="mt-4 rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center gap-2"><span className="text-xs font-medium">Reference</span>
                    <select aria-label="Citation style" className={sel} value={style} onChange={(e) => setStyle(e.target.value as 'apa' | 'mla')}><option value="apa">APA 7</option><option value="mla">MLA 9</option></select>
                    <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(cite(src, style)).then(() => toast('Copied.'))}>Copy</Button></div>
                  <p className="mt-2">{src.title ? cite(src, style) : '—'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Check the result against your course's style guide; edge cases (editors, translations, editions) are not formatted.</p>
                </div>
                {open.id && open.sectionId && teachingThis && (
                  <div className="mt-3 flex items-center gap-2 text-sm"><Status value={current?.published ? 'On the reading list' : 'Private'} />
                    <Button size="sm" variant="outline" onClick={() => run({ action: 'publish', id: open.id, on: !current?.published }, current?.published ? 'Removed from the reading list.' : 'Added to the reading list; enrolled students were notified.')}>
                      {current?.published ? 'Remove from reading list' : 'Add to course reading list'}</Button></div>)}
              </Panel>)}</div>
          </div>
        </div>
      );
    }}</Loadable>
  );
}
