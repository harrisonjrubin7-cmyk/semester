// Sources: a student's readings, what each is for, and BibTeX out/in. Pure functions; nothing here calls a model.
export type SourceKind = 'article' | 'book' | 'chapter' | 'web' | 'report' | 'other';
export const KINDS: { key: SourceKind; label: string; bib: string }[] = [
  { key: 'article', label: 'Journal article', bib: 'article' },
  { key: 'book', label: 'Book', bib: 'book' },
  { key: 'chapter', label: 'Book chapter', bib: 'incollection' },
  { key: 'web', label: 'Web page', bib: 'online' },
  { key: 'report', label: 'Report', bib: 'techreport' },
  { key: 'other', label: 'Other', bib: 'misc' },
];
export type Source = {
  kind: SourceKind; title: string; authors: string[]; year: string; container: string; publisher: string;
  volume: string; issue: string; pages: string; doi: string; url: string; accessed: string; purpose: string; tags: string[];
};
export const blank = (): Source => ({ kind: 'article', title: '', authors: [], year: '', container: '', publisher: '', volume: '', issue: '', pages: '', doi: '', url: '', accessed: '', purpose: '', tags: [] });

/** Problems that stop a save. Empty array = fine. */
export function validate(s: Source): string[] {
  const e: string[] = [];
  if (!s.title.trim()) e.push('Add a title.');
  if (s.title.length > 300) e.push('Keep the title under 300 characters.');
  if (s.year && !/^\d{4}[a-z]?$/.test(s.year.trim())) e.push('Year should be four digits, like 2021.');
  if (s.doi && !/^10\.\d{4,9}\/\S+$/.test(s.doi.trim())) e.push('DOI should look like 10.1234/abcd.');
  if (s.url && !/^https?:\/\/\S+$/i.test(s.url.trim())) e.push('Link should start with http:// or https://.');
  if (s.authors.length > 50) e.push('Up to 50 authors.');
  if (s.purpose.length > 1000) e.push('Keep "what it is for" under 1000 characters.');
  return e;
}

/** Split "Last, First" or "First Last" into parts. */
export function nameParts(a: string): { last: string; first: string } {
  const t = a.trim().replace(/\s+/g, ' ');
  if (t.includes(',')) { const [last, ...rest] = t.split(','); return { last: last.trim(), first: rest.join(',').trim() }; }
  const w = t.split(' ');
  return w.length === 1 ? { last: w[0], first: '' } : { last: w[w.length - 1], first: w.slice(0, -1).join(' ') };
}
const ascii = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const STOP = new Set(['a', 'an', 'the', 'on', 'of', 'in', 'and', 'for', 'to']);

/** smith2021first — unique within `taken` by adding b, c, … */
export function bibKey(s: Source, taken: Set<string>): string {
  const last = ascii(s.authors[0] ? nameParts(s.authors[0]).last : '') || 'anon';
  const word = ascii(s.title.split(/\s+/).find((w) => w && !STOP.has(w.toLowerCase())) ?? '') || 'untitled';
  const base = `${last}${(s.year.match(/\d{4}/) ?? ['nd'])[0]}${word}`;
  let k = base; let i = 0;
  while (taken.has(k)) { i += 1; k = base + String.fromCharCode(97 + i); }
  taken.add(k);
  return k;
}

/** Escape LaTeX specials so a title can never break the .bib file. */
export function bibEscape(v: string): string {
  return v.replace(/\\/g, '\\textbackslash{}').replace(/([&%$#_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}').replace(/[\r\n]+/g, ' ');
}

export function toBibtex(list: Source[]): string {
  const taken = new Set<string>();
  return list.map((s) => {
    const kind = KINDS.find((k) => k.key === s.kind)?.bib ?? 'misc';
    const f: [string, string][] = [];
    const add = (k: string, v: string) => { if (v.trim()) f.push([k, v.trim()]); };
    add('author', s.authors.map((a) => { const p = nameParts(a); return p.first ? `${p.last}, ${p.first}` : p.last; }).join(' and '));
    add('title', s.title);
    add(s.kind === 'article' ? 'journal' : s.kind === 'chapter' ? 'booktitle' : s.kind === 'report' ? 'institution' : s.kind === 'web' ? 'organization' : 'howpublished', s.container);
    add('publisher', s.publisher); add('year', s.year); add('volume', s.volume); add('number', s.issue);
    add('pages', s.pages.replace(/\s*[-–—]\s*/, '--')); add('doi', s.doi); add('url', s.url); add('urldate', s.accessed);
    const body = f.map(([k, v]) => `  ${k} = {${k === 'url' || k === 'doi' ? v.replace(/[{}]/g, '') : bibEscape(v)}}`).join(',\n');
    return `@${kind}{${bibKey(s, taken)},\n${body}\n}`;
  }).join('\n\n') + (list.length ? '\n' : '');
}

/** Read simple BibTeX (as exported by Zotero, Google Scholar, this page). Unknown fields are ignored. */
export function parseBibtex(text: string): { sources: Source[]; skipped: number } {
  const out: Source[] = []; let skipped = 0;
  const kindOf = (t: string): SourceKind => ({ article: 'article', book: 'book', incollection: 'chapter', inbook: 'chapter', online: 'web', misc: 'other', techreport: 'report', report: 'report' } as Record<string, SourceKind>)[t.toLowerCase()] ?? 'other';
  const re = /@(\w+)\s*\{\s*([^,\s{}]*),/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 1; let i = re.lastIndex;
    while (i < text.length && depth > 0) { if (text[i] === '\\') { i += 2; continue; } if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
    const body = text.slice(re.lastIndex, i - 1); re.lastIndex = i;
    if (/^(comment|string|preamble)$/i.test(m[1])) continue;
    const fields: Record<string, string> = {};
    const fr = /(\w+)\s*=\s*/g; let g: RegExpExecArray | null;
    while ((g = fr.exec(body))) {
      let j = fr.lastIndex; let v = '';
      if (body[j] === '{') { let d = 1; j++; const st = j; while (j < body.length && d > 0) { if (body[j] === '\\') { j += 2; continue; } if (body[j] === '{') d++; else if (body[j] === '}') d--; j++; } v = body.slice(st, j - 1); }
      else if (body[j] === '"') { const st = ++j; while (j < body.length && body[j] !== '"') j++; v = body.slice(st, j); j++; }
      else { const st = j; while (j < body.length && body[j] !== ',') j++; v = body.slice(st, j).trim(); }
      fields[g[1].toLowerCase()] = v.replace(/\\([&%$#_{}])/g, '$1').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
      fr.lastIndex = j;
    }
    if (!fields.title) { skipped++; continue; }
    out.push({ ...blank(), kind: kindOf(m[1]), title: fields.title, authors: (fields.author ?? '').split(/\s+and\s+/).map((a) => a.trim()).filter(Boolean),
      year: (fields.year ?? fields.date ?? '').slice(0, 4), container: fields.journal ?? fields.booktitle ?? fields.institution ?? fields.organization ?? fields.howpublished ?? '',
      publisher: fields.publisher ?? '', volume: fields.volume ?? '', issue: fields.number ?? '', pages: (fields.pages ?? '').replace(/-+/, '–'),
      doi: fields.doi ?? '', url: fields.url ?? '', accessed: fields.urldate ?? '' });
  }
  return { sources: out, skipped };
}

/** A reference-list line. Format follows the common APA 7 / MLA 9 shape; check your course's style guide. */
export function cite(s: Source, style: 'apa' | 'mla'): string {
  const ps = s.authors.map(nameParts);
  const end = (x: string) => (x && !/[.?!]$/.test(x) ? `${x}.` : x);
  const tail = [s.doi ? `https://doi.org/${s.doi}` : s.url].filter(Boolean).join('');
  if (style === 'apa') {
    const ini = (f: string) => f.split(/[\s-]+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}.`).join(' ');
    const one = (p: { last: string; first: string }) => (p.first ? `${p.last}, ${ini(p.first)}` : p.last);
    const au = ps.length === 0 ? '' : ps.length === 1 ? one(ps[0]) : ps.length <= 20 ? `${ps.slice(0, -1).map(one).join(', ')}, & ${one(ps[ps.length - 1])}` : `${ps.slice(0, 19).map(one).join(', ')}, … ${one(ps[ps.length - 1])}`;
    const vol = [s.volume, s.issue ? `(${s.issue})` : ''].join('');
    const where = [s.container, vol, s.pages].filter(Boolean).join(', ');
    return [au ? end(au) : '', `(${s.year || 'n.d.'}).`, end(s.title), where ? end(where) : '', s.publisher && s.kind === 'book' ? end(s.publisher) : '', tail].filter(Boolean).join(' ');
  }
  const au = ps.length === 0 ? '' : ps.length === 1 ? `${ps[0].last}${ps[0].first ? `, ${ps[0].first}` : ''}` : ps.length === 2 ? `${ps[0].last}, ${ps[0].first}, and ${ps[1].first} ${ps[1].last}`.trim() : `${ps[0].last}, ${ps[0].first}, et al`;
  const title = s.kind === 'book' ? s.title : `“${end(s.title)}”`;
  const bits = [s.container, s.volume ? `vol. ${s.volume}` : '', s.issue ? `no. ${s.issue}` : '', s.publisher, s.year, s.pages ? `pp. ${s.pages}` : ''].filter(Boolean).join(', ');
  return [au ? end(au) : '', s.kind === 'book' ? end(title) : title, bits ? end(bits) : '', tail ? end(tail) : ''].filter(Boolean).join(' ');
}
