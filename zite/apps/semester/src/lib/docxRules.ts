// Markdown (as written in Learn → Write) to a real Word .docx file. Pure functions, no dependency.
import { zip } from './zip';

export type Span = { text: string; b?: boolean; i?: boolean; code?: boolean; href?: string };
export type Block =
  | { t: 'h'; level: 1 | 2 | 3; spans: Span[] }
  | { t: 'p'; spans: Span[] }
  | { t: 'quote'; spans: Span[] }
  | { t: 'li'; ordered: boolean; depth: number; spans: Span[]; list: number }
  | { t: 'code'; lines: string[] }
  | { t: 'table'; head: Span[][]; rows: Span[][][] }
  | { t: 'hr' };

const safeHref = (u: string) => (/^(https?:|mailto:)/i.test(u.trim()) ? u.trim() : null);

/** **bold**, *italic* / _italic_, `code`, [text](https://link). Anything else is literal text. */
export function inline(src: string): Span[] {
  const out: Span[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    if (m[2] ?? m[3]) out.push({ text: (m[2] ?? m[3])!, b: true });
    else if (m[4] ?? m[5]) out.push({ text: (m[4] ?? m[5])!, i: true });
    else if (m[6]) out.push({ text: m[6], code: true });
    else { const h = safeHref(m[8]); out.push(h ? { text: m[7], href: h } : { text: m[0] }); }
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out.map((s) => ({ ...s, text: s.text.replace(/\\([*_`[\]\\])/g, '$1') }));
}

export function parse(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = []; let para: string[] = []; let list = 0; let inList = false;
  const flush = () => { if (para.length) { out.push({ t: 'p', spans: inline(para.join(' ')) }); para = []; } };
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^```/.test(l.trim())) { flush(); inList = false; const code: string[] = []; i++; while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++]); out.push({ t: 'code', lines: code }); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { flush(); inList = false; out.push({ t: 'h', level: Math.min(3, h[1].length) as 1 | 2 | 3, spans: inline(h[2].replace(/\s#+\s*$/, '')) }); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); inList = false; out.push({ t: 'hr' }); continue; }
    if (l.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      flush(); inList = false; const head = cells(l); const rows: Span[][][] = []; i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      i--; out.push({ t: 'table', head, rows }); continue;
    }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(l);
    if (li) { flush(); if (!inList) { list++; inList = true; } out.push({ t: 'li', ordered: /\d/.test(li[2]), depth: Math.min(2, Math.floor(li[1].replace(/\t/g, '  ').length / 2)), spans: inline(li[3].replace(/^\[[ xX]\]\s+/, '')), list }); continue; }
    const q = /^>\s?(.*)$/.exec(l);
    if (q) { flush(); inList = false; out.push({ t: 'quote', spans: inline(q[1]) }); continue; }
    if (!l.trim()) { flush(); inList = false; continue; }
    para.push(l.trim());
  }
  flush();
  return out;
}

export function words(md: string): number { return parse(md).flatMap((b) => ('spans' in b ? b.spans.map((s) => s.text) : b.t === 'code' ? b.lines : b.t === 'table' ? [...b.head, ...b.rows.flat()].flat().map((s) => s.text) : [])).join(' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length; }

const x = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

export function toDocx(title: string, md: string): Uint8Array<ArrayBuffer> {
  const links: string[] = [];
  const run = (s: Span, extra = '') => {
    const pr = `${s.b ? '<w:b/>' : ''}${s.i ? '<w:i/>' : ''}${s.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : ''}${s.href ? '<w:rStyle w:val="Hyperlink"/>' : ''}${extra}`;
    return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(s.text)}</w:t></w:r>`;
  };
  const runs = (spans: Span[]) => spans.map((s) => { if (!s.href) return run(s); links.push(s.href); return `<w:hyperlink r:id="rIdL${links.length}">${run(s)}</w:hyperlink>`; }).join('');
  const p = (body: string, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${body}</w:p>`;
  const blocks = parse(md);
  const lists = [...new Set(blocks.filter((b): b is Extract<Block, { t: 'li' }> => b.t === 'li').map((b) => `${b.list}:${b.ordered ? 1 : 0}`))];
  const body = [p(run({ text: title || 'Untitled' }), '<w:pStyle w:val="Title"/>'), ...blocks.map((b) => {
    switch (b.t) {
      case 'h': return p(runs(b.spans), `<w:pStyle w:val="Heading${b.level}"/>`);
      case 'p': return p(runs(b.spans));
      case 'quote': return p(runs(b.spans), '<w:pStyle w:val="Quote"/>');
      case 'li': return p(runs(b.spans), `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${b.depth}"/><w:numId w:val="${lists.indexOf(`${b.list}:${b.ordered ? 1 : 0}`) + 1}"/></w:numPr>`);
      case 'code': return b.lines.map((l) => p(run({ text: l || ' ', code: true }), '<w:pStyle w:val="Code"/>')).join('');
      case 'hr': return p('', '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>');
      case 'table': {
        const n = Math.max(b.head.length, ...b.rows.map((r) => r.length));
        const row = (cs: Span[][], head: boolean) => `<w:tr>${Array.from({ length: n }, (_, k) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${p((cs[k] ?? []).map((s) => (head ? run({ ...s, b: true }) : run(s))).join(''))}</w:tc>`).join('')}</w:tr>`;
        return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((e) => `<w:${e} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${'<w:gridCol/>'.repeat(n)}</w:tblGrid>${row(b.head, true)}${b.rows.map((r) => row(r, false)).join('')}</w:tbl>${p('')}`;
      }
    }
  })].join('');
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const style = (id: string, name: string, ppr: string, rpr: string, type = 'paragraph') => `<w:style w:type="${type}" w:styleId="${id}"><w:name w:val="${name}"/>${type === 'paragraph' ? '<w:basedOn w:val="Normal"/>' : ''}${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}</w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>`
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
    + style('Title', 'Title', '<w:spacing w:after="240"/>', '<w:b/><w:sz w:val="44"/>')
    + style('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="32"/>')
    + style('Heading2', 'heading 2', '<w:keepNext/><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="26"/>')
    + style('Heading3', 'heading 3', '<w:keepNext/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/>', '<w:b/><w:sz w:val="24"/>')
    + style('Quote', 'Quote', '<w:ind w:left="720"/>', '<w:i/>')
    + style('ListParagraph', 'List Paragraph', '<w:spacing w:after="60"/>', '')
    + style('Code', 'Code', '<w:spacing w:after="0"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>')
    + style('Hyperlink', 'Hyperlink', '', '<w:color w:val="0563C1"/><w:u w:val="single"/>', 'character')
    + '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>';
  const lvl = (i: number, ordered: boolean) => `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${ordered ? ['decimal', 'lowerLetter', 'lowerRoman'][i] : 'bullet'}"/><w:lvlText w:val="${ordered ? `%${i + 1}.` : ['•', '◦', '▪'][i]}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${W}><w:abstractNum w:abstractNumId="0">${[0, 1, 2].map((i) => lvl(i, false)).join('')}</w:abstractNum><w:abstractNum w:abstractNumId="1">${[0, 1, 2].map((i) => lvl(i, true)).join('')}</w:abstractNum>`
    + lists.map((k, i) => `<w:num w:numId="${i + 1}"><w:abstractNumId w:val="${k.endsWith(':1') ? 1 : 0}"/>${k.endsWith(':1') ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : ''}</w:num>`).join('') + '</w:numbering>';
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>`
    + links.map((h, i) => `<Relationship Id="rIdL${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${x(h)}" TargetMode="External"/>`).join('') + '</Relationships>';
  const files: Record<string, string> = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${x(title)}</dc:title></cp:coreProperties>`,
    'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    'word/styles.xml': styles,
    'word/numbering.xml': numbering,
    'word/_rels/document.xml.rels': docRels,
  };
  const enc = new TextEncoder();
  return zip(Object.entries(files).map(([n, s]) => ({ name: n, data: enc.encode(s) })));
}
